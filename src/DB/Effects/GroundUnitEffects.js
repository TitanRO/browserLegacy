/**
 * DB/Effects/GroundUnitEffects.js
 *
 * Effects the official client (kRO 2025-07-16) draws for ground skill units
 * that it builds in code instead of playing one .str file. Each skill unit
 * (DB/Skills/SkillUnit.js) names the effect id the client launches for it;
 * the rows here draw that effect with the client's own sprites and textures.
 * Placement numbers are in Renderer/Effects/GroundUnitSim.js.
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

import { flameRing, cellRangeSpots, cloudKillGrid, gaiaGrid } from 'Renderer/Effects/GroundUnitSim.js';

/** data/sprite/<monster folder>/ */
const MONSTER_SPRITES = 'data/sprite/\xb8\xf3\xbd\xba\xc5\xcd/';

const r = k => Math.floor(Math.random() * k);

/**
 * Rows spawned from a FUNC row share the unit's owner, so they go with it. A row's `at`
 * ({x, y} in cells) draws it that far from the unit.
 *
 * @param {object} manager EffectManager
 * @param {object} Params the FUNC row's parameters
 * @param {Array<object>} rows
 */
function spawnRows(manager, Params, rows) {
	rows.forEach(({ at, ...effect }, i) => {
		const position = Params.Inst.position;
		manager.spamEffect({
			effect,
			Inst: {
				effectID: Params.Inst.effectID,
				duplicateID: i + 1,
				startTick: Params.Inst.startTick
			},
			// `at` moves a row off the unit's cell, in cells
			Init: at ? { ...Params.Init, position: [position[0] + at.x, position[1] + at.y, position[2]] } : Params.Init
		});
	});
}

/**
 * Effects 916-918: twenty flame sprites (the Ifrit sprite's actions 32-39)
 * around the unit, fading in to alpha 150. The Insignias tint them.
 *
 * @param {Array<number>} [color] tint, [r, g, b] out of 255
 * @return {Array<object>} effect rows
 */
function flameField(color) {
	return [
		{
			type: 'FUNC',
			attachedEntity: false,
			func: function (Params) {
				spawnRows(
					this,
					Params,
					flameRing().map(flame => ({
						type: '3D',
						absoluteSpriteName: MONSTER_SPRITES + 'ifrit',
						sprAction: () => 32 + r(8),
						playSprite: true,
						attachedEntity: false,
						posx: flame.x,
						posy: flame.y,
						size: flame.scale * 100,
						alphaMax: 150 / 255,
						red: color ? color[0] / 255 : 1,
						green: color ? color[1] / 255 : 1,
						blue: color ? color[2] / 255 : 1,
						duration: 2000,
						delayStart: (flame.tick * 1000) / 60
					}))
				);
			}
		}
	];
}

/**
 * Effects 783 and 784: a tall wavy band of light on each cell, about 0.6
 * cells across, 5-7 cells high, turning slowly.
 *
 * @param {string} textureName effect texture
 * @return {Array<object>} effect rows
 */
function lightColumn(textureName) {
	return [
		{
			type: 'CYLINDER',
			textureName,
			totalCircleSides: 20,
			circleSides: 18,
			bottomSize: 0.6,
			topSize: 0.6,
			height: 3.5,
			rotate: true,
			angleYRandom: 360,
			alphaMax: 0.2,
			blendMode: 2,
			attachedEntity: false,
			duration: 2000
		}
	];
}

/** Effects keyed by the client's effect id. */
const GroundUnitEffects = {
	// EF_BOTTOM_BARRIER, Neutral Barrier's cells (slash01.tga)
	783: lightColumn('slash01'),

	// EF_BOTTOM_STEALTH, Stealth Field's cells (the thunderstorm particle texture)
	784: lightColumn('\xbd\xe3\xb4\xf5\xbd\xba\xc5\xe8\xc6\xc4\xc6\xbc\xc5\xac'),

	// EF_DEMONICFIRE, Demonic Fire and Fire Insignia
	916: [...flameField(), { wav: 'effect/ef_firewall' }],

	// EF_DEMONICFIRE2 and 3, Fire Expansion's Smoke Powder and Tear Gas fields
	917: flameField(),
	918: flameField(),

	// The other Insignias: effect 916 in the client's tint for the element
	ef_water_insignia: [...flameField([20, 20, 180]), { wav: 'effect/ef_firewall' }],
	ef_wind_insignia: [...flameField([20, 180, 20]), { wav: 'effect/ef_firewall' }],
	ef_earth_insignia: [...flameField([40, 40, 40]), { wav: 'effect/ef_firewall' }],

	// EF_HELLSPLANT, Hell's Plant: the mavka_bullet sprite, green, at 0.7
	919: [
		{
			type: '3D',
			absoluteSpriteName: MONSTER_SPRITES + 'mavka_bullet',
			sprAction: () => r(8),
			playSprite: true,
			attachedEntity: false,
			size: 70,
			red: 155 / 255,
			green: 1,
			blue: 155 / 255,
			duration: 1000
		},
		{
			wav: 'effect/g\xb0\xa1\xbd\xc3\xb3\xaa\xb9\xab\xb5\xa3'
		}
	],

	// EF_VACUUM, Vacuum Extreme: two breeze sprites (actions 0 and 4), white, about a character's size
	921: [
		...[0, 4].map(action => ({
			type: '3D',
			absoluteSpriteName: MONSTER_SPRITES + 'breeze',
			sprAction: action,
			playSprite: true,
			attachedEntity: false,
			size: 130,
			alphaMax: 205 / 255,
			blendMode: 2,
			duration: 2000
		})),
		{ wav: 'effect/s\xbd\xba\xc6\xe7\xc7\xc7\xbd\xba\xc6\xae' }
	],

	// EF_BOTTOM_DE2, Water Barrier: ring_blue rings 3 cells out, rising
	939: [0, 1, 2, 3, 4, 5, 6, 7].map(k => ({
		type: 'CYLINDER',
		textureName: 'ring_blue',
		bottomSize: k % 2 ? 3.2 : 3,
		topSize: k % 2 ? 3.2 : 3,
		height: 0.4,
		posZ: k * 0.4,
		alphaMax: 0.35,
		blendMode: 2,
		rotate: true,
		attachedEntity: false,
		duration: 2000
	})),

	// EF_STORMKICK7, Zephyr: a storm2.tga whirlwind
	465: [
		{
			type: 'CYLINDER',
			textureName: 'storm2',
			bottomSize: 1,
			topSize: 3,
			height: 6,
			rotate: true,
			alphaMax: 0.35,
			blendMode: 2,
			attachedEntity: false,
			duration: 2000
		}
	],

	// EF_CLOUD_KILL: particle3 sprites rising in a fountain about 2 cells wide
	1080: cloudKillGrid().map(point => ({
		type: '3D',
		spriteName: 'particle3',
		attachedEntity: false,
		duplicate: 4,
		timeBetweenDupli: 150,
		posxStartRand: 0.4,
		posxStartRandMiddle: point.x / 2,
		posxEndRand: 0.4,
		posxEndRandMiddle: point.x / 2,
		posyStartRand: 0.4,
		posyStartRandMiddle: point.y / 2,
		posyEndRand: 0.4,
		posyEndRandMiddle: point.y / 2,
		poszStart: 0,
		poszEnd: 2.5,
		size: 38,
		sizeRand: 15,
		fadeIn: true,
		fadeOut: true,
		duration: (40 * 1000) / 60
	})),

	// EF_POISONSMOKE, Poison Smoke's cells: a particle3 sprite every 9 ticks, 2-7 units out in a
	// random direction, scaled (40 + r(50)) / 170, rising for 40 ticks
	772: [
		{
			type: '3D',
			spriteName: 'particle3',
			attachedEntity: false,
			duplicate: 4,
			timeBetweenDupli: 150,
			posxRandDiff: 1.4,
			posyRandDiff: 1.4,
			poszStart: 0,
			poszEnd: 1.5,
			size: 38,
			sizeRand: 15,
			fadeIn: true,
			fadeOut: true,
			duration: (40 * 1000) / 60
		}
	],

	// Poison Smoke's puffs: on about one tick in fifty the client plays new_poisonsmoke_1 or _2
	// on the cell (effects 1546 and 1547)
	ef_poisonsmoke_puff: [
		{
			type: 'STR',
			file: 'new_poisonsmoke/new_poisonsmoke/new_poisonsmoke_%d',
			rand: [1, 2],
			texturePath: 'new_poisonsmoke/new_poisonsmoke/',
			attachedEntity: false,
			repeatDelay: 800
		}
	],

	// EF_POWER_OF_GAIA: ring_yellow light standing on a 3 x 3 grid
	1088: gaiaGrid().map(point => ({
		type: 'CYLINDER',
		textureName: 'ring_yellow',
		totalCircleSides: 4,
		circleSides: 4,
		angleY: 45,
		posX: point.x,
		posY: point.y,
		bottomSize: 0.8,
		topSize: 0.8,
		height: 2.5,
		alphaMax: 120 / 255,
		blue: 0.5,
		blendMode: 2,
		attachedEntity: false,
		duration: 2000
	})),

	// EF_KO_MAKIBISHI: the caltrops texture flat on the cell
	1007: [
		{
			type: 'PRIM',
			prim: 'quad',
			texture: 'makibishi.bmp',
			size: 1.2,
			height: 0.2,
			frames: 1e9,
			attachedEntity: false
		}
	],

	// EF_ICEMINE: the icemine sprite
	1026: [
		{
			type: 'SPR',
			file: 'icemine',
			attachedEntity: false,
			repeat: true
		}
	]
};

/**
 * Effects 992-995 (Zenkai): the element's .str on every cell of the unit's
 * range.
 *
 * @param {string} file
 * @return {Array<object>} effect rows
 */
function zenkaiField(file) {
	return [
		{
			type: 'FUNC',
			attachedEntity: false,
			func: function (Params) {
				spawnRows(
					this,
					Params,
					cellRangeSpots(Params.Init.unitRange || 0).map(spot => ({
						type: 'STR',
						file,
						attachedEntity: false,
						at: spot
					}))
				);
			}
		}
	];
}

// 술식전개 3, 4, 2 and 5: water, earth, fire and wind
GroundUnitEffects[992] = zenkaiField('\xbc\xfa\xbd\xc4\xc0\xfc\xb0\xb33');
GroundUnitEffects[993] = zenkaiField('\xbc\xfa\xbd\xc4\xc0\xfc\xb0\xb34');
GroundUnitEffects[994] = zenkaiField('\xbc\xfa\xbd\xc4\xc0\xfc\xb0\xb32');
GroundUnitEffects[995] = zenkaiField('\xbc\xfa\xbd\xc4\xc0\xfc\xb0\xb35');

export default GroundUnitEffects;
