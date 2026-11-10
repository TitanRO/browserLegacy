/**
 * Renderer/VisualOptions.js
 *
 * How the player chose to see the world: the display helpers (TitanRO's Build-in roadmap features 9 to 15), which the
 * renderers read every frame, so a change shows at once. The Helpers plugin sets them from the player's helper
 * settings; nothing here changes what the server sends or what the game knows, only how it is drawn.
 *
 * The Windows client (TitanRONet.dll, src/visual.rs) draws the same options with the same constants (BRIGHT, GRID,
 * CAST_CIRCLE): keep them in step. That client draws map models opaque whatever their alpha, so there see-through
 * props are hidden instead.
 *
 * @author Trojal
 */

/** Bright maps: the least light a map gets (RSW ambient and diffuse per channel, and the ground lightmap's shadow). */
export const BRIGHT = Object.freeze({ ambient: 0.5, diffuse: 0.6, shadow: 0.6 });

/** Flat map: the ground's grey; cell grid: the line darkness and how dark blocked cells are drawn. */
export const GRID = Object.freeze({ flatGrey: 0.62, line: 0.55, blocked: 0.35 });

/** Cast circles: the circle's least opacity and how much brighter it is drawn. */
export const CAST_CIRCLE = Object.freeze({ minAlpha: 0.85, brighten: 1.6 });

/** See-through props: the opacity of map models. */
export const PROP_ALPHA = 0.45;

const DEFAULTS = {
	noFog: false,
	brightMaps: false,
	flatGround: false,
	hideProps: false,
	propAlpha: 1,
	cellGrid: false,
	castCircles: false,
	/** Effects to leave out: filter(init) returns true to keep the effect (init: EffectManager.spam's parameters). */
	effectFilter: null,
	hideWeather: false
};

const _listeners = new Set();

const VisualOptions = {
	...DEFAULTS,

	/**
	 * Change some options; listeners hear about it.
	 *
	 * @param {object} changes
	 */
	set(changes) {
		let changed = false;
		for (const [key, value] of Object.entries(changes)) {
			if (!(key in DEFAULTS)) {
				throw new Error(`VisualOptions: unknown option "${key}"`);
			}
			if (this[key] !== value) {
				this[key] = value;
				changed = true;
			}
		}
		if (changed) {
			for (const listener of _listeners) {
				listener(this);
			}
		}
	},

	/** Back to how the game draws by default. */
	reset() {
		this.set(DEFAULTS);
	},

	/**
	 * @param {function} listener - listener(VisualOptions) after a change
	 * @returns {function} call to stop listening
	 */
	onChange(listener) {
		_listeners.add(listener);
		return () => _listeners.delete(listener);
	},

	/** Whether an effect is kept (low effects mode). */
	keepEffect(init) {
		if (!this.effectFilter) {
			return true;
		}
		try {
			return this.effectFilter(init) !== false;
		} catch (error) {
			console.error('[VisualOptions] effect filter failed', error);
			return true;
		}
	},

	/**
	 * The map's light as drawn: with bright maps on, ambient and diffuse raised to BRIGHT's floor (out is reused per
	 * frame, so no allocation while drawing).
	 *
	 * @param {object} light - the map's light {ambient, diffuse, opacity, direction, env}
	 * @param {object} out - an object to fill
	 * @returns {object} light, or out
	 */
	light(light, out) {
		if (!this.brightMaps || !light) {
			return light;
		}
		return brightLight(light, out);
	}
};

/**
 * A light with ambient and diffuse raised to BRIGHT's floor, channel by channel.
 *
 * @param {object} light
 * @param {object} [out]
 * @returns {object}
 */
export function brightLight(light, out = {}) {
	Object.assign(out, light);
	out.ambient = floor3(light.ambient, BRIGHT.ambient, out._ambient || (out._ambient = new Float32Array(3)));
	out.diffuse = floor3(light.diffuse, BRIGHT.diffuse, out._diffuse || (out._diffuse = new Float32Array(3)));
	// the light environment colour, as MapRenderer derives it from the map's light
	const env = out._env || (out._env = new Float32Array(3));
	for (let i = 0; i < 3; ++i) {
		env[i] = 1 - (1 - out.diffuse[i]) * (1 - out.ambient[i]);
	}
	out.env = env;
	return out;
}

function floor3(values, min, out) {
	for (let i = 0; i < 3; ++i) {
		out[i] = Math.max(values ? values[i] : 0, min);
	}
	return out;
}

export default VisualOptions;
