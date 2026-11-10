import { describe, expect, it, vi } from 'vitest';
import { flameRing, cellRangeSpots, cloudKillGrid, gaiaGrid } from '../../src/Renderer/Effects/GroundUnitSim.js';
import GroundUnitEffects from '../../src/DB/Effects/GroundUnitEffects.js';
import SkillUnit from '../../src/DB/Skills/SkillUnit.js';
import SU from '../../src/DB/Skills/SkillUnitConst.js';
import EffectTable from '../../src/DB/Effects/EffectTable.js';

// Ground skill units as the official client (kRO 2025-07-16) draws them: the unit picks an
// effect id (CSkill's unit switch), and the effect is built in code from the client's files.

const fixed = value => () => value;

describe('GroundUnitSim', () => {
	it('lays the 20 flames of effects 916-918 18 degrees apart, 6 and 12 units out', () => {
		const flames = flameRing(fixed(0));
		expect(flames).toHaveLength(20);
		expect(flames[0]).toMatchObject({ x: 0, y: 1.2, scale: 0.4, tick: 0 });
		expect(Math.hypot(flames[1].x, flames[1].y)).toBeCloseTo(2.4, 6);
		expect(flames[5].x).toBeCloseTo(2.4, 6); // 90 degrees
		expect(flames[1].scale).toBeCloseTo(0.5, 6);
		expect(flameRing(fixed(0.99))[0].scale).toBeCloseTo(0.7, 6);
	});

	it('covers a unit range of cells 6 units apart (Zenkai)', () => {
		expect(cellRangeSpots(0, fixed(0))).toEqual([{ x: -0.2, y: -0.2 }]);
		const spots = cellRangeSpots(3, fixed(0.5));
		expect(spots).toHaveLength(49);
		expect(spots[0].x).toBeCloseTo((-18 + 1 - 1) / 5, 6);
		expect(cellRangeSpots(undefined)).toHaveLength(1);
	});

	it('spreads Cloud Kill over a 6 x 6 grid and Power of Gaia over 3 x 3', () => {
		expect(cloudKillGrid()).toHaveLength(36);
		expect(cloudKillGrid()[0]).toEqual({ x: -2, y: -2 });
		expect(gaiaGrid()).toHaveLength(9);
		expect(gaiaGrid()[8]).toEqual({ x: 1, y: 1 });
	});
});

describe('Ground skill units', () => {
	const drawn = {
		UNT_CLOUD_KILL: 1080,
		UNT_NEUTRALBARRIER: 783,
		UNT_STEALTHFIELD: 784,
		UNT_DEMONIC_FIRE: 916,
		UNT_FIRE_INSIGNIA: 916,
		UNT_FIRE_EXPANSION_SMOKE_POWDER: 917,
		UNT_FIRE_EXPANSION_TEAR_GAS: 918,
		UNT_HELLS_PLANT: 919,
		UNT_VACUUM_EXTREME: 921,
		UNT_FIRE_MANTLE: 25,
		UNT_WATER_BARRIER: 939,
		UNT_ZEPHYR: 465,
		UNT_POWER_OF_GAIA: 1088,
		UNT_ZENKAI_WATER: 992,
		UNT_ZENKAI_LAND: 993,
		UNT_ZENKAI_FIRE: 994,
		UNT_ZENKAI_WIND: 995,
		UNT_MAKIBISHI: 1007,
		UNT_ICEMINE: 1026,
		UNT_WATER_INSIGNIA: 'ef_water_insignia',
		UNT_WIND_INSIGNIA: 'ef_wind_insignia',
		UNT_EARTH_INSIGNIA: 'ef_earth_insignia',
		UNT_FIRE_RAIN: 'ef_rl_fire_rain'
	};

	it('launches the effect the official client launches, and the table has it', () => {
		for (const [name, effectId] of Object.entries(drawn)) {
			expect(SkillUnit[SU[name]], name).toBe(effectId);
			expect(EffectTable[effectId], name).toBeDefined();
		}
	});

	it('draws nothing for the units the official client leaves bare', () => {
		for (const name of ['UNT_GRAFFITI', 'UNT_FEINTBOMB', 'UNT_BANDING', 'UNT_B_TRAP']) {
			expect(EffectTable[SkillUnit[SU[name]]], name).toBeUndefined();
		}
	});

	it('tints the Insignias as the client does', () => {
		const spawned = [];
		const manager = { spamEffect: p => spawned.push(p) };
		const Params = { Inst: { effectID: 1, startTick: 0, position: [10, 20, 0] }, Init: { ownerAID: 5 } };
		GroundUnitEffects.ef_water_insignia[0].func.call(manager, Params);
		expect(spawned).toHaveLength(20);
		expect(spawned[0].effect).toMatchObject({ type: '3D', red: 20 / 255, green: 20 / 255, blue: 180 / 255 });
		expect(spawned[0].effect.absoluteSpriteName).toMatch(/ifrit$/);
		const action = spawned[0].effect.sprAction();
		expect(action).toBeGreaterThanOrEqual(32);
		expect(action).toBeLessThan(40);
		expect(spawned[0].Init).toBe(Params.Init);
	});

	it('plays the Zenkai .str on each cell of the unit range, owned by the unit', () => {
		const spawned = [];
		const manager = { spamEffect: p => spawned.push(p) };
		const Params = {
			Inst: { effectID: 992, startTick: 0, position: [10, 20, 0] },
			Init: { ownerAID: 5, unitRange: 1 }
		};
		vi.spyOn(Math, 'random').mockReturnValue(0.5);
		GroundUnitEffects[992][0].func.call(manager, Params);
		vi.restoreAllMocks();
		expect(spawned).toHaveLength(9);
		expect(spawned[0].effect).toEqual({ type: 'STR', file: '\xbc\xfa\xbd\xc4\xc0\xfc\xb0\xb33', attachedEntity: false });
		expect(spawned[0].Init.ownerAID).toBe(5);
		expect(spawned[0].Init.position[0]).toBeCloseTo(10 - 6 / 5, 6);
	});
});
