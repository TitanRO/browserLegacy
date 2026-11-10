/**
 * The display helpers: what each setting asks of the renderers, the low effects filter, the trap markers, the
 * options list both clients draw, and the camera's zoom cap.
 */
import { afterEach, describe, expect, it } from 'vitest';
import VisualOptions, { PROP_ALPHA } from 'Renderer/VisualOptions.js';
import {
	ALWAYS_KEPT,
	MARKED_UNITS,
	TrapMarkers,
	WEATHER_EFFECTS,
	effectFilter,
	heavyEffects,
	isCastle,
	visualOptions
} from 'Plugins/Helpers/VisualHelpers.js';
import { DEFAULT_SETTINGS } from 'Plugins/Helpers/HelperSettings.js';
import SU from 'DB/Skills/SkillUnitConst.js';
import SK from 'DB/Skills/SkillConst.js';
import EC from 'DB/Effects/EffectConst.js';
import SkillEffect from 'DB/Skills/SkillEffect.js';

const settings = (overrides = {}) => {
	const doc = structuredClone(DEFAULT_SETTINGS);
	for (const [section, values] of Object.entries(overrides)) Object.assign(doc[section], values);
	return (section, key) => doc[section][key];
};
const context = { currentMap: () => 'prontera.gat', myId: () => 1, isPlayer: e => e.objecttype === 0 };

afterEach(() => VisualOptions.reset());

describe('display options', () => {
	it('defaults draw the game as it is, with bright cast circles', () => {
		const options = visualOptions(settings(), context);
		expect(options).toMatchObject({
			flatGround: false,
			hideProps: false,
			propAlpha: 1,
			cellGrid: false,
			castCircles: true,
			hideWeather: false,
			effectFilter: null
		});
	});

	it('each setting turns its option on', () => {
		const options = visualOptions(
			settings({
				flatMap: { enabled: true, hideProps: true },
				transparentProps: { enabled: true },
				cellGrid: { enabled: true },
				lowEffects: { enabled: true }
			}),
			context
		);
		expect(options).toMatchObject({
			flatGround: true,
			hideProps: true,
			propAlpha: PROP_ALPHA,
			cellGrid: true,
			hideWeather: true
		});
		expect(typeof options.effectFilter).toBe('function');
	});
});

describe('low effects', () => {
	const low = { enabled: true, weather: true, castle: true, heavyAoe: true, othersEffects: true };
	const keep = (filter, init) => filter(init);

	it('is off unless enabled', () => {
		expect(effectFilter({ ...low, enabled: false }, context)).toBeNull();
	});

	it('hides weather, heavy area skills and other players effects, never the cast circle', () => {
		const filter = effectFilter(low, context);
		expect(keep(filter, { effectId: EC.EF_SNOW })).toBe(false);
		expect(keep(filter, { effectId: SkillEffect[SK.WZ_STORMGUST].effectId })).toBe(false);
		expect(keep(filter, { effectId: SkillEffect[SK.WZ_VERMILION].effectId })).toBe(false);
		expect(keep(filter, { effectId: 513 })).toBe(true);
		expect(ALWAYS_KEPT.has(513)).toBe(true);
		expect(heavyEffects().has(513)).toBe(false);
		// a heal on another player, and one on me
		expect(keep(filter, { effectId: 312, ownerEntity: { objecttype: 0, GID: 2 } })).toBe(false);
		expect(keep(filter, { effectId: 312, ownerEntity: { objecttype: 0, GID: 1 } })).toBe(true);
		// a monster's effect, a ground unit's
		expect(keep(filter, { effectId: 312, ownerEntity: { objecttype: 1, GID: 3 } })).toBe(true);
	});

	it('categories can be left on', () => {
		const filter = effectFilter({ ...low, weather: false, othersEffects: false }, context);
		expect(keep(filter, { effectId: EC.EF_SNOW })).toBe(true);
		expect(keep(filter, { effectId: 312, ownerEntity: { objecttype: 0, GID: 2 } })).toBe(true);
		expect(WEATHER_EFFECTS.has(EC.EF_SAKURA)).toBe(true);
	});

	it('hides map effects on castles only', () => {
		const filter = effectFilter(low, context);
		expect(keep(filter, { effectId: 47, ownerAID: 'torch01' })).toBe(true);
		const castle = effectFilter(low, { ...context, currentMap: () => 'prtg_cas01.gat' });
		expect(keep(castle, { effectId: 47, ownerAID: 'torch01' })).toBe(false);
		expect(isCastle('aldeg_cas03')).toBe(true);
		expect(isCastle('te_prtcas01')).toBe(true);
		expect(isCastle('prontera')).toBe(false);
	});
});

describe('trap markers', () => {
	const fake = () => {
		const shown = new Map();
		return {
			shown,
			add: (uid, x, y, color) => shown.set(uid, { x, y, color }),
			remove: uid => shown.delete(uid),
			clear: () => shown.clear()
		};
	};

	it('marks traps and the listed ground skills while on', () => {
		const markers = fake();
		const traps = new TrapMarkers(markers);
		traps.setEnabled(true);
		traps.appear(10, SU.UNT_ANKLESNARE, 5, 6);
		traps.appear(11, SU.UNT_LANDPROTECTOR, 7, 7);
		traps.appear(12, SU.UNT_FIREWALL, 8, 8);
		expect([...markers.shown.keys()]).toEqual([10, 11]);
		expect(markers.shown.get(11).color).toEqual(MARKED_UNITS.get(SU.UNT_LANDPROTECTOR));
		// a trap that went off turns into a used trap
		traps.changed(10, SU.UNT_USED_TRAPS);
		expect(markers.shown.has(10)).toBe(false);
		traps.disappear(11);
		expect(markers.shown.size).toBe(0);
	});

	it('keeps following units while off, and shows them when turned on', () => {
		const markers = fake();
		const traps = new TrapMarkers(markers);
		traps.appear(20, SU.UNT_SAFETYWALL, 1, 2);
		expect(markers.shown.size).toBe(0);
		traps.setEnabled(true);
		expect(markers.shown.get(20)).toMatchObject({ x: 1, y: 2 });
		traps.reset();
		expect(markers.shown.size).toBe(0);
	});
});

describe('the renderers options', () => {
	it('tells listeners about changes and rejects unknown options', () => {
		let calls = 0;
		const stop = VisualOptions.onChange(() => calls++);
		VisualOptions.set({ cellGrid: true });
		VisualOptions.set({ cellGrid: true });
		stop();
		expect(calls).toBe(1);
		expect(() => VisualOptions.set({ nope: 1 })).toThrow();
	});

	it('a failing effect filter keeps the effect', () => {
		VisualOptions.set({
			effectFilter: () => {
				throw new Error('x');
			}
		});
		expect(VisualOptions.keepEffect({ effectId: 1 })).toBe(true);
	});
});
