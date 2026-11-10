/**
 * Plugins/Helpers/VisualHelpers.js
 *
 * The display helpers (Build-in roadmap features 9 to 15) in the web client: low effects by category, no fog, bright
 * maps, bright cast circles, trap and ground-skill markers, flat map with hidden props, see-through props and the cell
 * grid. The player's helper settings turn them on; Renderer/VisualOptions.js carries them to the renderers, which
 * draw them from the next frame. The Windows client (TitanRONet.dll src/visual.rs) has the same options.
 *
 * Zone rules: none of these hides or shows anything the server didn't send, so they work the same in every zone
 * (roadmap decision 1: see-through props and flat maps on for everyone, WoE and PvP included). Low effects never hide
 * damage numbers, cast circles or trap markers.
 *
 * @author Trojal
 */

import VisualOptions, { PROP_ALPHA } from 'Renderer/VisualOptions.js';
import GroundMarkers from 'Renderer/Map/GroundMarkers.js';
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

/** Effects low effects never hides: the ground cast circle (EF_GROUNDSAMPLE). */
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

/** Castles (agit maps): their map effects are the "castle" category. */
export function isCastle(map) {
	return /^\w+g_cas\d+$|^te_\w*cas\d+$|^\w+_cas\d+$/.test(String(map || '').replace(/\.(gat|rsw)$/i, ''));
}

/** The trap and ground-skill markers: unit id -> colour. */
const TRAP_COLOR = [1.0, 0.25, 0.15];
export const MARKED_UNITS = new Map([
	[SU.UNT_LANDPROTECTOR, [1.0, 0.85, 0.1]],
	[SU.UNT_SAFETYWALL, [0.2, 0.9, 1.0]],
	[SU.UNT_PNEUMA, [0.75, 0.9, 1.0]],
	[SU.UNT_FOGWALL, [0.8, 0.8, 0.8]],
	[SU.UNT_QUAGMIRE, [0.75, 0.35, 1.0]],
	...[
		SU.UNT_TRAP,
		SU.UNT_BLASTMINE,
		SU.UNT_SKIDTRAP,
		SU.UNT_ANKLESNARE,
		SU.UNT_LANDMINE,
		SU.UNT_SHOCKWAVE,
		SU.UNT_SANDMAN,
		SU.UNT_FLASHER,
		SU.UNT_FREEZINGTRAP,
		SU.UNT_CLAYMORETRAP,
		SU.UNT_TALKIEBOX,
		SU.UNT_MAGENTATRAP,
		SU.UNT_COBALTTRAP,
		SU.UNT_MAIZETRAP,
		SU.UNT_VERDURETRAP,
		SU.UNT_FIRINGTRAP,
		SU.UNT_ICEBOUNDTRAP,
		SU.UNT_ELECTRICSHOCKER,
		SU.UNT_CLUSTERBOMB,
		SU.UNT_ICEMINE
	]
		.filter(id => id !== undefined)
		.map(id => [id, TRAP_COLOR])
]);

/**
 * The effect filter for low effects mode, from its settings.
 *
 * @param {object} low - lowEffects settings {enabled, weather, castle, heavyAoe, othersEffects}
 * @param {object} context - {currentMap(), myId(), isPlayer(entity)}
 * @returns {function|null} filter(init) => keep
 */
export function effectFilter(low, context, heavy = heavyEffects()) {
	if (!low || !low.enabled) return null;
	return init => {
		const id = init.effectId;
		if (ALWAYS_KEPT.has(id)) return true;
		if (low.weather && WEATHER_EFFECTS.has(id)) return false;
		// map effects (RSW emitters) carry the emitter's name as owner
		if (low.castle && typeof init.ownerAID === 'string' && isCastle(context.currentMap())) return false;
		if (low.heavyAoe && heavy.has(id)) return false;
		if (low.othersEffects) {
			const owner = init.ownerEntity;
			if (owner && context.isPlayer(owner) && owner.GID !== context.myId()) return false;
		}
		return true;
	};
}

/** What the settings ask of the renderers (VisualOptions.set). */
export function visualOptions(get, context, heavy) {
	const low = {
		enabled: get('lowEffects', 'enabled') === true,
		weather: get('lowEffects', 'weather') === true,
		castle: get('lowEffects', 'castle') === true,
		heavyAoe: get('lowEffects', 'heavyAoe') === true,
		othersEffects: get('lowEffects', 'othersEffects') === true
	};
	return {
		noFog: get('noFog', 'enabled') === true,
		brightMaps: get('brightMaps', 'enabled') === true,
		flatGround: get('flatMap', 'enabled') === true,
		hideProps: get('flatMap', 'hideProps') === true,
		propAlpha: get('transparentProps', 'enabled') === true ? PROP_ALPHA : 1,
		cellGrid: get('cellGrid', 'enabled') === true,
		castCircles: get('castCircles', 'enabled') === true,
		hideWeather: low.enabled && low.weather,
		effectFilter: effectFilter(low, context, heavy)
	};
}

/**
 * Follows the ground units the server sends and keeps a marker on each marked one while trap markers are on.
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
		if (!MARKED_UNITS.has(unit)) {
			this.disappear(uid);
			return;
		}
		const u = { unit, x, y };
		this.units.set(uid, u);
		if (this.enabled) this._show(uid, u);
	}

	/** A unit changed its look (a trap went off): it's marked only while it's still a marked unit. */
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
		this.markers.add(uid, u.x, u.y, MARKED_UNITS.get(u.unit));
	}
}

/**
 * Starts the display helpers.
 *
 * @param {object} options
 * @param {HelperSettingsClient} options.settings
 * @param {object} options.network - Network (onPacket)
 * @param {object} options.packets - PACKET
 * @param {object} options.context - {currentMap(), myId(), isPlayer(entity)}
 * @param {function} [options.onApplied] - after each change reaches the renderers
 */
export function startVisualHelpers({ settings, network, packets, context, onApplied }) {
	const heavy = heavyEffects();
	const traps = new TrapMarkers();

	const apply = () => {
		const before = { filter: VisualOptions.effectFilter, weather: VisualOptions.hideWeather };
		VisualOptions.set(visualOptions((section, key) => settings.get(section, key), context, heavy));
		traps.setEnabled(settings.get('trapMarkers', 'enabled') === true);
		if (onApplied) onApplied(before);
	};
	settings.onChange(apply);
	apply();

	const zc = packets.ZC;
	for (const name of ['SKILL_ENTRY', 'SKILL_ENTRY2', 'SKILL_ENTRY3', 'SKILL_ENTRY4', 'SKILL_ENTRY5']) {
		if (zc[name] && zc[name].id)
			network.onPacket(zc[name], pkt => traps.appear(pkt.AID, pkt.job, pkt.xPos, pkt.yPos));
	}
	if (zc.SKILL_DISAPPEAR && zc.SKILL_DISAPPEAR.id)
		network.onPacket(zc.SKILL_DISAPPEAR, pkt => traps.disappear(pkt.AID));
	for (const name of ['NPCACK_MAPMOVE', 'NPCACK_SERVERMOVE', 'NPCACK_SERVERMOVE2']) {
		if (zc[name] && zc[name].id) network.onPacket(zc[name], () => traps.reset());
	}
	for (const name of ['SPRITE_CHANGE2', 'SPRITE_CHANGE']) {
		if (zc[name] && zc[name].id)
			network.onPacket(zc[name], pkt => {
				if (pkt.type === 0) traps.changed(pkt.GID, pkt.value);
			});
	}
	return { apply, traps };
}
