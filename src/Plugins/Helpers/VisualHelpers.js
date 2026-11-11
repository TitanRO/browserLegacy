/**
 * Plugins/Helpers/VisualHelpers.js
 *
 * The display helpers (Build-in roadmap features 9 to 15, and RCX parity) in the web client: the effects level,
 * ground-skill and trap markers, cast circles, the chat and cast ranges, Grayworld (flat map and cell grid together)
 * with hidden props, see-through props (fog and lighting are the client's own /fog and /lightmap). The player's helper settings turn
 * them on; Renderer/VisualOptions.js and Renderer/Map/GroundMarkers.js draw them from the next frame. The Windows
 * client (TitanRONet.dll) has the same options, with the same colours (GroundColors.json).
 *
 * Ground overlays look as RCX and its open successor SimpleROHook drew them: translucent cells in a colour per
 * skill unit. Nothing is copied from either; the colours are SimpleROHook's published defaults.
 *
 * Effects levels: 0 normal; 1 minimum: weather, map ambience and heavy area skills' looks off; 2 none: every
 * optional effect off. Damage numbers, cast circles and ground-skill markers are never hidden.
 *
 * Zone rules: none of these shows anything the server didn't send, so they work the same in every zone (roadmap
 * decision 1).
 *
 * @author Trojal
 */

import VisualOptions, { PROP_ALPHA } from 'Renderer/VisualOptions.js';
import GroundMarkers, { argb } from 'Renderer/Map/GroundMarkers.js';
import { castSize } from 'Renderer/Effects/MagicTargetSim.js';
import groundColors from './GroundColors.json';
import SU from 'DB/Skills/SkillUnitConst.js';
import SK from 'DB/Skills/SkillConst.js';
import EC from 'DB/Effects/EffectConst.js';
import SkillEffect from 'DB/Skills/SkillEffect.js';
import SkillUnit from 'DB/Skills/SkillUnit.js';

/** Weather: the map's weather effects (WeatherTable, and the server's weather effect packets). */
export const WEATHER_EFFECTS = new Set([
	EC.EF_RAIN,
	EC.EF_SNOW,
	EC.EF_SAKURA,
	EC.EF_MAPLE,
	EC.EF_POKJUK,
	EC.EF_POKJUK_SOUND,
	EC.EF_CLOUD,
	EC.EF_CLOUD2,
	EC.EF_CLOUD3,
	EC.EF_CLOUD4,
	EC.EF_CLOUD5,
	EC.EF_CLOUD6,
	EC.EF_CLOUD7,
	EC.EF_CLOUD8,
	EC.EF_CLOUD9,
	EC.EF_CLOUD10
]);

/** Heavy area skills whose looks low effects can hide (the damage, cast circle and markers stay). */
export const HEAVY_SKILLS = [
	SK.WZ_STORMGUST,
	SK.WZ_VERMILION,
	SK.WZ_METEOR,
	SK.WZ_HEAVENDRIVE,
	SK.PR_MAGNUS,
	SK.HW_GANBANTEIN,
	SK.HW_GRAVITATION,
	SK.NJ_HUUJIN,
	SK.NJ_RAIGEKISAI,
	SK.NJ_KAMAITACHI,
	SK.RK_DRAGONBREATH,
	SK.AB_JUDEX,
	SK.WL_JACKFROST,
	SK.WL_CRIMSONROCK,
	SK.WL_COMET,
	SK.WL_CHAINLIGHTNING,
	SK.WL_CHAINLIGHTNING_ATK,
	SK.WL_EARTHSTRAIN,
	SK.WL_TETRAVORTEX,
	SK.WL_TETRAVORTEX_FIRE,
	SK.WL_TETRAVORTEX_WATER,
	SK.WL_TETRAVORTEX_WIND,
	SK.WL_TETRAVORTEX_GROUND,
	SK.SO_EARTHGRAVE,
	SK.SO_DIAMONDDUST,
	SK.SO_PSYCHIC_WAVE,
	SK.SO_VARETYR_SPEAR,
	SK.GN_DEMONIC_FIRE
].filter(id => id !== undefined);

/** Ground units of heavy area skills. */
export const HEAVY_UNITS = [
	SU.UNT_MAGNUS,
	SU.UNT_GRAVITATION,
	SU.UNT_EARTHSTRAIN,
	SU.UNT_PSYCHIC_WAVE,
	SU.UNT_DEMONIC_FIRE,
	SU.UNT_SEVERE_RAINSTORM
].filter(id => id !== undefined);

/** Effects no level hides: the ground cast circle (EF_GROUNDSAMPLE). */
export const ALWAYS_KEPT = new Set([513]);

const SKILL_EFFECT_FIELDS = [
	'effectId',
	'groundEffectId',
	'hitEffectId',
	'successEffectId',
	'beforeHitEffectId',
	'effectIdOnCaster'
];

/** The effect ids of the heavy skills and units. */
export function heavyEffects() {
	const ids = new Set();
	const add = id => [id].flat().forEach(e => e !== undefined && e !== null && ids.add(e));
	for (const skill of HEAVY_SKILLS) {
		const entry = SkillEffect[skill];
		if (entry) SKILL_EFFECT_FIELDS.forEach(field => add(entry[field]));
	}
	for (const unit of HEAVY_UNITS) add(SkillUnit[unit]);
	for (const id of ALWAYS_KEPT) ids.delete(id);
	return ids;
}

/** Effects levels. */
export const NORMAL = 0;
export const MINIMUM = 1;
export const NONE = 2;

/** The overlay colours, [r, g, b, a] 0..1. */
export const COLORS = {
	default: argb(groundColors.default),
	units: new Map(Object.entries(groundColors.units).map(([unit, color]) => [Number(unit), argb(color)])),
	castTarget: argb(groundColors.castTarget),
	chatScope: argb(groundColors.chatScope),
	castRange: argb(groundColors.castRange)
};

/** A ground unit's marker colour. */
export function unitColor(unit) {
	return COLORS.units.get(unit) || COLORS.default;
}

/**
 * The effect filter for an effects level.
 *
 * @param {number} level - NORMAL, MINIMUM or NONE
 * @returns {function|null} filter(init) => keep
 */
export function effectFilter(level, heavy = heavyEffects()) {
	if (!(level >= MINIMUM)) return null;
	return init => {
		const id = init.effectId;
		if (ALWAYS_KEPT.has(id)) return true;
		if (level >= NONE) return false;
		if (WEATHER_EFFECTS.has(id)) return false;
		// map ambience (RSW emitters carry the emitter's name as owner)
		if (typeof init.ownerAID === 'string') return false;
		return !heavy.has(id);
	};
}

/** What the settings ask of the renderers (VisualOptions.set). */
export function visualOptions(get, heavy) {
	const level = Number(get('lowEffects', 'level')) || NORMAL;
	return {
		flatGround: get('flatMap', 'enabled') === true,
		hideProps: get('flatMap', 'hideProps') === true,
		propAlpha: get('transparentProps', 'enabled') === true ? PROP_ALPHA : 1,
		cellGrid: get('flatMap', 'enabled') === true, // Grayworld: flat ground and the cell grid together
		instantActions: get('noAdelay', 'enabled') === true,
		bigStatusIcons: get('bigStatusIcons', 'enabled') === true,
		smallWoeObjects: get('smallWoeObjects', 'enabled') === true,
		instantVanish: get('instantVanish', 'enabled') === true,
		bigMvps: get('bigMvps', 'enabled') === true,
		smallEmperium: get('smallEmperium', 'enabled') === true,
		hideWeather: level >= MINIMUM,
		effectFilter: effectFilter(level, heavy)
	};
}

/**
 * Follows the ground units the server sends and keeps a marker on each while ground-skill markers are on (every
 * unit the server sends: a trap, Land Protector, Safety Wall, an area skill's cells, ...).
 */
export class TrapMarkers {
	constructor(markers = GroundMarkers) {
		this.markers = markers;
		this.units = new Map(); // uid -> {unit, x, y}
		this.enabled = false;
	}

	setEnabled(on) {
		this.enabled = !!on;
		this.markers.clear();
		if (this.enabled) for (const [uid, u] of this.units) this._show(uid, u);
	}

	appear(uid, unit, x, y) {
		const u = { unit, x, y };
		this.units.set(uid, u);
		if (this.enabled) this._show(uid, u);
	}

	/** A unit changed its look (a trap went off). */
	changed(uid, unit) {
		const u = this.units.get(uid);
		if (u) this.appear(uid, unit, u.x, u.y);
	}

	disappear(uid) {
		this.units.delete(uid);
		this.markers.remove(uid);
	}

	/** A new map: the server sends the units in view again. */
	reset() {
		this.units.clear();
		this.markers.clear();
	}

	_show(uid, u) {
		this.markers.add(uid, u.x, u.y, unitColor(u.unit));
	}
}

/** RCX's circle distance: the client's, which makes straight lines one cell longer than the radius. */
export function circleDistance(dx, dy) {
	return Math.max(0, Math.floor(Math.sqrt(dx * dx + dy * dy) - 0.0625));
}

/** The cells of the chat range around (x, y): a square ring at 9 cells. */
export function chatScopeCells(x, y, color = COLORS.chatScope) {
	const cells = [];
	for (let d = -9; d <= 9; ++d) {
		cells.push({ x: x + d, y: y - 9, color }, { x: x + d, y: y + 9, color });
		if (d > -9 && d < 9) cells.push({ x: x - 9, y: y + d, color }, { x: x + 9, y: y + d, color });
	}
	return cells;
}

/** The cells of the cast range around (x, y): a ring 9 cells away by the client's circle distance. */
export function castRangeCells(x, y, color = COLORS.castRange) {
	const cells = [];
	for (let dy = -10; dy <= 10; ++dy)
		for (let dx = -10; dx <= 10; ++dx)
			if (circleDistance(dx, dy) === 9) cells.push({ x: x + dx, y: y + dy, color });
	return cells;
}

/**
 * The cells a ground cast will hit: the skill's N x N area around the target (the client draws its cast circle one
 * cell wider each way: castSize).
 */
export function castTargetCells(skill, x, y, color = COLORS.castTarget) {
	const size = castSize(skill) - 2;
	if (size < 1) return [];
	const half = Math.floor(size / 2);
	const cells = [];
	for (let dy = -half; dy < size - half; ++dy)
		for (let dx = -half; dx < size - half; ++dx) cells.push({ x: x + dx, y: y + dy, color });
	return cells;
}

/**
 * Ground casts in progress (a caster's target cell and skill until the cast ends or is cancelled).
 */
export class CastTargets {
	constructor(now = () => Date.now()) {
		this.now = now;
		this.casts = new Map(); // caster -> {skill, x, y, until}
	}

	start(caster, skill, x, y, delay) {
		this.casts.set(caster, { skill, x, y, until: this.now() + Math.max(delay, 300) });
	}

	cancel(caster) {
		this.casts.delete(caster);
	}

	reset() {
		this.casts.clear();
	}

	cells() {
		const now = this.now();
		const cells = [];
		for (const [caster, c] of this.casts) {
			if (c.until < now) this.casts.delete(caster);
			else cells.push(...castTargetCells(c.skill, c.x, c.y));
		}
		return cells;
	}
}

/**
 * Starts the display helpers.
 *
 * @param {object} options
 * @param {HelperSettingsClient} options.settings
 * @param {object} options.network - Network (onPacket)
 * @param {object} options.packets - PACKET
 * @param {object} options.context - {player(): {x, y} | null}
 * @param {function} [options.onApplied] - after each change reaches the renderers
 */
export function startVisualHelpers({ settings, network, packets, context, onApplied }) {
	const heavy = heavyEffects();
	const traps = new TrapMarkers();
	const casts = new CastTargets();
	const on = key => settings.get(key, 'enabled') === true;

	const apply = () => {
		const before = { filter: VisualOptions.effectFilter, weather: VisualOptions.hideWeather };
		VisualOptions.set(visualOptions((section, key) => settings.get(section, key), heavy));
		traps.setEnabled(on('trapMarkers'));
		if (onApplied) onApplied(before);
	};
	settings.onChange(apply);
	apply();

	GroundMarkers.addLayer(() => {
		const cells = [];
		if (on('castCircles')) cells.push(...casts.cells());
		const me = (on('chatScope') || on('castRange')) && context.player();
		if (me) {
			if (on('castRange')) cells.push(...castRangeCells(me.x, me.y));
			if (on('chatScope')) cells.push(...chatScopeCells(me.x, me.y));
		}
		return cells;
	});

	const zc = packets.ZC;
	const listen = (names, fn) => {
		for (const name of names) if (zc[name] && zc[name].id) network.onPacket(zc[name], fn);
	};
	listen(['SKILL_ENTRY', 'SKILL_ENTRY2', 'SKILL_ENTRY3', 'SKILL_ENTRY4', 'SKILL_ENTRY5'], pkt =>
		traps.appear(pkt.AID, pkt.job, pkt.xPos, pkt.yPos)
	);
	listen(['SKILL_DISAPPEAR'], pkt => traps.disappear(pkt.AID));
	listen(['NPCACK_MAPMOVE', 'NPCACK_SERVERMOVE', 'NPCACK_SERVERMOVE2'], () => {
		traps.reset();
		casts.reset();
	});
	listen(['SPRITE_CHANGE2', 'SPRITE_CHANGE'], pkt => {
		if (pkt.type === 0) traps.changed(pkt.GID, pkt.value);
	});
	// a cast with a ground target (x, y set), and its cancel
	listen(['USESKILL_ACK', 'USESKILL_ACK2', 'USESKILL_ACK3'], pkt => {
		if (pkt.xPos || pkt.yPos) casts.start(pkt.AID, pkt.SKID, pkt.xPos, pkt.yPos, pkt.delayTime || 0);
	});
	listen(['DISPEL'], pkt => casts.cancel(pkt.AID));
	return { apply, traps, casts };
}
