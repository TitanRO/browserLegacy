/**
 * Plugins/Helpers/GroundTimers.js
 *
 * Effect countdown timers (effectTimers.enabled, off by default), as the Windows client's (TitanRONet.dll timers.rs):
 * a countdown over Pneuma, Safety Wall, Land Protector, Fire Wall and Ice Wall, only when the client saw the cast.
 *
 * ZC_NOTIFY_GROUNDSKILL (skill, level, cell) comes when a ground skill goes off, its units right after. A unit of a timed
 * skill near a cast seen in the last JOIN_MS joins it; a unit with no such cast (already there when it came into view)
 * gets no timer. The countdown runs for the skill's duration at that level (TitanRO's skill_db) and goes with its last
 * unit. A Fire Wall cast with a Violent Gale field in view nearby gets no timer (its caster may have stood in it, which
 * makes it last 1.5x). Nothing is ever an estimate.
 *
 * @author Trojal
 */

export const JOIN_MS = 1500;
const JOIN_CELLS = 5;
const GALE_CELLS = 12;
const UNT_VIOLENTGALE = 0x9c;

export const AL_PNEUMA = 25;
export const MG_SAFETYWALL = 12;
export const MG_FIREWALL = 18;
export const WZ_ICEWALL = 87;
export const SA_LANDPROTECTOR = 288;

/** A timed skill's [unit type, duration ms] at `level`, or null. */
export function timed(skill, level) {
	const lv = Math.max(1, Math.min(10, level | 0));
	switch (skill) {
		case AL_PNEUMA:
			return [0x85, 10000];
		case MG_SAFETYWALL:
			return [0x7e, 5000 * lv];
		case MG_FIREWALL:
			return [0x7f, 4000 + 1000 * lv];
		case WZ_ICEWALL:
			return [0x8d, 5000 * lv];
		case SA_LANDPROTECTOR:
			return [0x9d, 120000 + 45000 * lv];
		default:
			return null;
	}
}

/** "9", or "2:45" from a minute up (whole seconds, rounded up). */
export function countdown(ms) {
	const s = Math.ceil(ms / 1000);
	return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : String(s);
}

export class GroundTimers {
	constructor() {
		this.casts = [];
		this.gale = new Map(); // unit id -> [x, y]
	}

	groundSkill(skill, level, x, y, now) {
		const t = timed(skill, level);
		if (!t) return;
		if (skill === MG_FIREWALL) {
			for (const [gx, gy] of this.gale.values()) {
				if (Math.abs(gx - x) <= GALE_CELLS && Math.abs(gy - y) <= GALE_CELLS) return;
			}
		}
		this.casts.push({ unitType: t[0], x, y, at: now, end: now + t[1], units: new Set(), joined: false });
	}

	unit(id, unitType, x, y, now) {
		if (unitType === UNT_VIOLENTGALE) this.gale.set(id, [x, y]);
		for (let i = this.casts.length - 1; i >= 0; i--) {
			const c = this.casts[i];
			if (
				c.unitType === unitType &&
				now - c.at <= JOIN_MS &&
				Math.abs(c.x - x) <= JOIN_CELLS &&
				Math.abs(c.y - y) <= JOIN_CELLS
			) {
				c.units.add(id);
				c.joined = true;
				return;
			}
		}
	}

	unitGone(id) {
		this.gale.delete(id);
		for (const c of this.casts) c.units.delete(id);
		this.casts = this.casts.filter(c => !c.joined || c.units.size > 0);
	}

	clear() {
		this.casts = [];
		this.gale.clear();
	}

	/** [{x, y, text}] at `now`; casts out of time, or whose units never came, are dropped. */
	labels(now) {
		this.casts = this.casts.filter(c => now < c.end && (c.units.size > 0 || now - c.at <= JOIN_MS));
		return this.casts.filter(c => c.units.size > 0).map(c => ({ x: c.x, y: c.y, text: countdown(c.end - now) }));
	}
}
