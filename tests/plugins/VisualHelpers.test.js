/**
 * The display helpers: what each setting asks of the renderers, the effects levels, the RCX-style ground overlays
 * (markers, cast targets, chat and cast ranges), and the options rows both clients draw.
 */
import { afterEach, describe, expect, it } from 'vitest';
import VisualOptions, { isAttackOrCast, PROP_ALPHA } from 'Renderer/VisualOptions.js';
import { argb } from 'Renderer/Map/GroundMarkers.js';
import {
	ALWAYS_KEPT,
	COLORS,
	CastTargets,
	MINIMUM,
	NONE,
	NORMAL,
	TrapMarkers,
	WEATHER_EFFECTS,
	castRangeCells,
	castTargetCells,
	chatScopeCells,
	circleDistance,
	effectFilter,
	heavyEffects,
	unitColor,
	visualOptions
} from 'Plugins/Helpers/VisualHelpers.js';
import { HELPER_OPTIONS, optionSections } from 'Plugins/Helpers/HelperOptions.js';
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

afterEach(() => VisualOptions.reset());

describe('display options', () => {
	it('defaults draw the game as it is', () => {
		expect(visualOptions(settings())).toMatchObject({
			flatGround: false,
			hideProps: false,
			propAlpha: 1,
			cellGrid: false,
			hideWeather: false,
			effectFilter: null
		});
	});

	it('no adelay asks the renderer to show attacks and casts at once', () => {
		expect(visualOptions(settings({ noAdelay: { enabled: true } })).instantActions).toBe(true);
		expect(visualOptions(settings()).instantActions).toBe(false);
	});

	it('no adelay covers attack and cast animations only', () => {
		// a player's action ids (EntityAction): attacks 5, 10, 11 and cast 12; walk 1, ready 4
		const pc = { ACTION: { ATTACK: -2, ATTACK1: 5, ATTACK2: 10, ATTACK3: 11, SKILL: 12, WALK: 1, READYFIGHT: 4 } };
		expect([5, 10, 11, 12].every(a => isAttackOrCast(pc, a))).toBe(true);
		expect([1, 4, -1].some(a => isAttackOrCast(pc, a))).toBe(false);
		// a monster without a cast action (SKILL -1) never matches -1
		const mob = { ACTION: { ATTACK: -2, ATTACK1: 3, ATTACK2: -1, ATTACK3: -1, SKILL: -1 } };
		expect(isAttackOrCast(mob, 3)).toBe(true);
		expect(isAttackOrCast(mob, -1)).toBe(false);
	});

	it('Grayworld is the flat map and the cell grid together', () => {
		expect(visualOptions(settings({ flatMap: { enabled: true } }))).toMatchObject({ flatGround: true, cellGrid: true });
		expect(visualOptions(settings({ flatMap: { enabled: false } }))).toMatchObject({ flatGround: false, cellGrid: false });
	});

	it('each setting turns its option on', () => {
		const options = visualOptions(
			settings({
				flatMap: { enabled: true, hideProps: true },
				transparentProps: { enabled: true },
				lowEffects: { level: MINIMUM }
			})
		);
		expect(options).toMatchObject({ flatGround: true, hideProps: true, propAlpha: PROP_ALPHA, cellGrid: true });
		expect(options.hideWeather).toBe(true);
		expect(typeof options.effectFilter).toBe('function');
	});

	it('the window rows are settings with defaults; the effects level is one choice of three', () => {
		for (const option of HELPER_OPTIONS) {
			const [section, key] = option.key.split('.');
			expect(DEFAULT_SETTINGS[section][key], option.key).toBeDefined();
		}
		const display = optionSections().find(s => s.section === 'Display').options;
		const levels = display.filter(o => o.key === 'lowEffects.level');
		expect(levels.map(o => [o.type, o.value])).toEqual([
			['choice', NORMAL],
			['choice', MINIMUM],
			['choice', NONE]
		]);
	});
});

describe('effects levels', () => {
	const storm = SkillEffect[SK.WZ_STORMGUST].effectId;

	it('normal hides nothing', () => {
		expect(effectFilter(NORMAL)).toBeNull();
	});

	it('minimum hides weather, map ambience and heavy area skills', () => {
		const keep = effectFilter(MINIMUM);
		expect(keep({ effectId: EC.EF_SNOW })).toBe(false);
		expect(keep({ effectId: 47, ownerAID: 'torch01' })).toBe(false);
		expect(keep({ effectId: storm })).toBe(false);
		expect(keep({ effectId: 312, ownerAID: 5 })).toBe(true);
		expect(WEATHER_EFFECTS.has(EC.EF_SAKURA)).toBe(true);
	});

	it('none hides every effect but the cast circle', () => {
		const keep = effectFilter(NONE);
		expect(keep({ effectId: 312, ownerAID: 5 })).toBe(false);
		expect(keep({ effectId: 513 })).toBe(true);
		expect(ALWAYS_KEPT.has(513)).toBe(true);
		expect(heavyEffects().has(513)).toBe(false);
	});
});

describe('ground overlays', () => {
	const fake = () => {
		const shown = new Map();
		return {
			shown,
			add: (uid, x, y, color) => shown.set(uid, { x, y, color }),
			remove: uid => shown.delete(uid),
			clear: () => shown.clear()
		};
	};

	it('colours are RCX colours (0xAARRGGBB)', () => {
		expect(argb('7F00FF00')).toEqual([0, 1, 0, 127 / 255]);
		expect(unitColor(SU.UNT_SAFETYWALL)).toEqual(argb('BFFF00FF'));
		expect(unitColor(SU.UNT_LANDPROTECTOR)).toEqual(argb('7FFA00F6'));
		expect(unitColor(999)).toBe(COLORS.default);
	});

	it('marks every ground unit while on, and follows changes', () => {
		const markers = fake();
		const traps = new TrapMarkers(markers);
		traps.appear(20, SU.UNT_SAFETYWALL, 1, 2);
		expect(markers.shown.size).toBe(0);
		traps.setEnabled(true);
		traps.appear(21, SU.UNT_FOGWALL, 3, 3);
		expect(markers.shown.get(20)).toMatchObject({ x: 1, y: 2 });
		expect(markers.shown.get(21).color).toEqual(unitColor(SU.UNT_FOGWALL));
		traps.changed(20, SU.UNT_USED_TRAPS);
		expect(markers.shown.get(20).color).toEqual(unitColor(SU.UNT_USED_TRAPS));
		traps.disappear(21);
		traps.reset();
		expect(markers.shown.size).toBe(0);
	});

	it('chat range is a square ring at 9 cells, cast range a circle at 9', () => {
		const chat = chatScopeCells(100, 100);
		expect(chat.length).toBe(4 * 18);
		expect(chat.every(c => Math.max(Math.abs(c.x - 100), Math.abs(c.y - 100)) === 9)).toBe(true);
		expect(circleDistance(9, 0)).toBe(8);
		expect(circleDistance(10, 0)).toBe(9);
		const cast = castRangeCells(0, 0);
		expect(cast.every(c => circleDistance(c.x, c.y) === 9)).toBe(true);
		expect(cast.some(c => c.x === 10 && c.y === 0)).toBe(true);
	});

	it('a ground cast shows its area until it ends or is cancelled', () => {
		let now = 1000;
		const casts = new CastTargets(() => now);
		expect(castTargetCells(SK.WZ_STORMGUST, 50, 50).length).toBeGreaterThan(1);
		casts.start(7, SK.WZ_STORMGUST, 50, 50, 2000);
		expect(casts.cells().length).toBe(castTargetCells(SK.WZ_STORMGUST, 50, 50).length);
		now = 3100;
		expect(casts.cells()).toEqual([]);
		casts.start(7, SK.WZ_STORMGUST, 50, 50, 2000);
		casts.cancel(7);
		expect(casts.cells()).toEqual([]);
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
