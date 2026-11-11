/**
 * TitanRO calculator: party and self buffs. data.json `buffs` holds, per buff skill and level, what the game server
 * gives in the status window: the stats it adds (`param`, counted the way the server counts a status effect's
 * stats), flat bonuses (fields named as the equipment totals of items.js), `aspdHaste` (the status-effect ASPD %)
 * and `vitDefRate` (Angelus), measured on the server with and without the buff (TitanRO's tools/calc/export.py);
 * null for a level that depends on the caster (their job level or stats). ATTACK_BUFFS change attacks only
 * (damage.js). tests/site/calc.test.js checks normal attacks with buffs against the server.
 */
import { NO_EQUIPMENT } from './calc.js';

/** The buffs the calculator offers, in the order the page lists them. */
export const BUFF_ORDER = [34, 29, 33, 75, 66, 2041, 2042, 155, 111, 112, 113, 45, 60, 258, 355, 380, 383, 8, 68, 138, 280, 281, 282, 283];
/** Buffs that need a weapon type ({skill id: [weapon types]}); the server ends them with another weapon. */
export const BUFF_WEAPONS = { 60: [3], 258: [5], 111: [6, 7, 8, 9] };

/** The buffs of `levels` ({skill id: level}) that count with weapon type `weaponType`: [id, level, bonuses or null]. */
export function buffEffects(data, levels, weaponType) {
	const all = data.buffs || {};
	const out = [];
	for (const [id, lv] of Object.entries(levels || {})) {
		const table = all[id];
		if (!table || !lv) continue;
		const need = BUFF_WEAPONS[id];
		if (need && !need.includes(weaponType)) continue;
		out.push([Number(id), lv, table[Math.min(lv, table.length) - 1]]);
	}
	return out;
}

/**
 * The equipment totals `eq` with the buffs' bonuses added: their stats in `buffParam` (the server counts some
 * derived values from a status effect's stats on their own), the strongest ASPD haste, flat bonuses.
 */
export function withBuffs(data, eq, levels, weaponType, names = new Map()) {
	const base = eq || NO_EQUIPMENT;
	const t = { ...base, buffParam: (base.buffParam || [0, 0, 0, 0, 0, 0]).slice(), notCounted: base.notCounted.slice() };
	for (const [id, lv, b] of buffEffects(data, levels, weaponType)) {
		if (!b) {
			t.notCounted.push(`${names.get(id) || 'Skill ' + id} Lv ${lv}: not counted (depends on the caster)`);
			continue;
		}
		b.param.forEach((v, i) => { t.buffParam[i] += v; });
		for (const [k, v] of Object.entries(b)) {
			if (k === 'param') continue;
			if (k === 'aspdHaste') t.aspdHaste = Math.max(t.aspdHaste || 0, v);
			else t[k] = (t[k] || 0) + v;
		}
	}
	return t;
}
