/**
 * Renderer/VisualOptions.js
 *
 * How the player chose to see the world: the display helpers (TitanRO's Build-in roadmap features 9 to 15), which the
 * renderers read every frame, so a change shows at once. The Helpers plugin sets them from the player's helper
 * settings; nothing here changes what the server sends or what the game knows, only how it is drawn.
 *
 * The Windows client (TitanRONet.dll, src/visual.rs) draws the same options with the same constants (GRID,
 * PROP_ALPHA): keep them in step. That client draws map models opaque whatever their alpha, so there see-through
 * props are hidden instead.
 *
 * @author Trojal
 */

/**
 * Flat map: the ground's grey; cell grid: the line darkness and the tint of cells nobody can walk on (RCX's dead
 * cells: magenta at half strength).
 */
import MonsterTable from 'DB/Monsters/MonsterTable.js';

export const GRID = Object.freeze({ flatGrey: 0.62, line: 0.55, deadCell: Object.freeze([1, 0, 1, 0.5]) });

/** See-through props: the opacity of map models. */
export const PROP_ALPHA = 0.45;

const DEFAULTS = {
	flatGround: false,
	hideProps: false,
	propAlpha: 1,
	cellGrid: false,
	/** Effects to leave out: filter(init) returns true to keep the effect (init: EffectManager.spam's parameters). */
	effectFilter: null,
	hideWeather: false,
	/** No adelay: attack and cast animations shown at once (frames only; hits and damage keep the server's timing). */
	instantActions: false,
	bigStatusIcons: false,
	smallWoeObjects: false,
	instantVanish: false,
	bigMvps: false,
	smallEmperium: false
};

/** No adelay: the frame time of attack and cast animations, in ms. */
export const INSTANT_FRAME_MS = 1;

/** Whether `action` is one of the entity's attack or cast animations (the ones no adelay shows at once). */
export function isAttackOrCast(entity, action) {
	const A = entity.ACTION;
	return (
		action >= 0 &&
		(action === A.ATTACK ||
			action === A.ATTACK1 ||
			action === A.ATTACK2 ||
			action === A.ATTACK3 ||
			action === A.SKILL)
	);
}

/**
 * WoE GRF helpers (roadmap "Titan GRF parity"), drawing only. The Windows client's TitanRONet.dll (sizes.rs) rewrites
 * the same sprites with the same numbers; keep them in step.
 */
export const STATUS_SCALE = 2.0;
export const WOE_SCALE = 0.6;
export const MVP_SCALE = 1.5;
export const EMPERIUM_SCALE = 0.6;
/** 3D models (MonsterTable's .gr2 names, lower case): the Emperium and the guild flag. */
const EMPERIUM_MODEL = 'empelium90_0.gr2';
const FLAG_MODEL = 'guildflag90_1.gr2';
/** Status icons drawn at STATUS_SCALE (attachment uids, which are the sprite names). */
export const BIG_STATUS_ICONS = new Set(['status-stun', 'status-sleep']);
/** Barricades and guardian stones (monster sprite names): small, and gone at once when they break. */
export const BREAKABLE_SPRITES = new Set(['barricade', 's_empel_1', 's_empel_2']);
/** Castle flags (small only). */
export const FLAG_SPRITES = new Set(['1_flag_lion', '1_flag_eagle']);
/**
 * MVP sprites (mob_db MvpExp > 0), leaving out any a monster that is neither an MVP nor a boss also uses (Poring, the
 * Biolab and Valkyrie sprites). The same list as the DLL's MVP_SPRITES (TitanRO/client tools/mvp-sprites/gen.py).
 */
export const MVP_SPRITES = new Set([
	'amon_ra',
	'apocalips_h',
	'atros',
	'bakonawa',
	'baphomet',
	'beelzebub_',
	'boitata',
	'buwaya',
	'daehyon',
	'dark_lord',
	'dark_snake_lord',
	'detale',
	'dr_big_eggring',
	'dracula',
	'drake',
	'eddga',
	'event_bapho',
	'faceworm_queen',
	'faceworm_queen_b',
	'faceworm_queen_g',
	'faceworm_queen_y',
	'fallingbishop',
	'garm',
	'gioia',
	'gloomundernight',
	'golden_bug',
	'i_queen_scaraba',
	'ifrit',
	'incantation_samurai',
	'kades',
	'kiel_',
	'kraken',
	'kublin',
	'lady_tanee',
	'leak',
	'lord_of_death',
	'maya',
	'mechaspider',
	'mg_amdarais',
	'mg_corruption_root',
	'mistress',
	'moonlight',
	'morocc',
	'n_amon_ra',
	'orc_lord',
	'ork_hero',
	'osiris',
	'pharaoh',
	'phreeoni',
	'pyuriel',
	'queen_scaraba',
	'rsx_0806',
	'tao_gunka',
	'thanatos',
	'timeholder',
	'turtle_general',
	'xm_celine_kimi'
]);

/** The monster or NPC sprite name of a job id (lower case), or '' (players, 3D models, unknown ids). */
export function spriteName(job) {
	const name = MonsterTable[job];
	return typeof name === 'string' && !name.endsWith('.gr2') ? name.toLowerCase() : '';
}

/** How much bigger (or smaller) the helpers draw a unit's sprite, from its job id; 1 for most. */
export function spriteScale(options, job) {
	const model = typeof MonsterTable[job] === 'string' ? MonsterTable[job].toLowerCase() : '';
	if (model === EMPERIUM_MODEL) return options.smallEmperium ? EMPERIUM_SCALE : 1;
	if (model === FLAG_MODEL) return options.smallWoeObjects ? WOE_SCALE : 1;
	const name = spriteName(job);
	if (!name) return 1;
	if (options.smallWoeObjects && (BREAKABLE_SPRITES.has(name) || FLAG_SPRITES.has(name))) return WOE_SCALE;
	if (options.bigMvps && MVP_SPRITES.has(name)) return MVP_SCALE;
	return 1;
}

/** Whether a unit of this job id vanishes at once when it breaks (instantVanish). */
export function vanishesAtOnce(options, job) {
	return !!options.instantVanish && BREAKABLE_SPRITES.has(spriteName(job));
}

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
	}
};

export default VisualOptions;
