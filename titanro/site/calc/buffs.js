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
export const BUFF_ORDER = [34, 29, 33, 75, 66, 2041, 2042, 155, 111, 112, 113, 45, 60, 258, 355, 380, 383, 8, 2428, 68, 138, 280, 281, 282, 283];
/** Buffs that need a weapon type ({skill id: [weapon types]}); the server ends them with another weapon. */
export const BUFF_WEAPONS = { 60: [3], 258: [5], 111: [6, 7, 8, 9] };

/** Dance with Wug (Wanderer/Minstrel song): its effects depend on the party's chorus bonus. */
export const WM_DANCE_WITH_WUG = 2428;

/**
 * The chorus bonus of a party with `performers` Minstrels and Wanderers (Hercules battle_calc_chorusbonus): 0 with
 * fewer than 3, then one more for each, at most 5 (7 or more).
 */
export function chorusBonus(performers) {
	const n = Math.trunc(performers) || 0;
	return n < 3 ? 0 : Math.min(n - 2, 5);
}

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
export function withBuffs(data, eq, levels, weaponType, names = new Map(), performers = 0) {
	const base = eq || NO_EQUIPMENT;
	const t = { ...base, buffParam: (base.buffParam || [0, 0, 0, 0, 0, 0]).slice(), notCounted: base.notCounted.slice() };
	if (levels && levels[WM_DANCE_WITH_WUG] > 0) {
		// Dance with Wug, as auriga_stats counts it: 2 + the chorus bonus % ASPD (a haste: the strongest counts), and
		// 20 + 10 x the chorus bonus % off fixed cast times (the largest of such reductions counts); the Warg skills'
		// damage in damage.js
		const chorus = chorusBonus(performers);
		t.aspdHaste = Math.max(t.aspdHaste || 0, 2 + chorus);
		t.fixCastLargest = Math.max(t.fixCastLargest || 0, 20 + 10 * chorus);
	}
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
