/**
 * TitanRO damage calculator: a character's normal attack on a monster, with the game server's formulas and tables
 * (data.json, mobs.json). tests/site/calc.test.js checks it against the damage the server computed for the same
 * characters and monsters (tests/site/damage-cases.json).
 *
 * Counted: status ATK, the weapon (ATK, level, refine and over-refine), size and element modifiers (neutral attacks),
 * the monster's DEF, the critical bonus, hit and critical chances. Not counted: cards, item bonuses, skills, buffs,
 * arrows and elemental weapons.
 */
import { jobById, jobBonus, STATS } from './calc.js';

const W_BOW = 11;
const W_KATAR = 16;
const DEX_WEAPONS = new Set([11, 13, 14, 17, 18, 19, 20, 21]);
const GUNS = new Set([17, 18, 19, 20, 21]);
const ELE_NEUTRAL = 0;
const MIN_HITRATE = 5;
const MAX_HITRATE = 100;
const f = Math.fround;

/** mobs.json rows as objects. */
export function mobList(mobs) {
	return mobs.mobs.map((row) => Object.fromEntries(mobs.columns.map((c, i) => [c, row[i]])));
}

function totals(job, input) {
	const bonus = jobBonus(job, input.jlv);
	const total = {};
	STATS.forEach((s, i) => {
		total[s] = input.stats[s] + bonus[i];
	});
	return total;
}

/** Status ATK (the status window's left ATK). */
function statusAtk(total, type) {
	const dex = DEX_WEAPONS.has(type);
	return Math.floor((dex ? total.dex : total.str) + (dex ? total.str : total.dex) / 5 + total.luk / 3);
}

/**
 * Weapon ATK before size and element: auriga RR's roll from a DEX-raised minimum to the weapon level's maximum, plus
 * the Str (Dex) bonus, refine ATK and over-refine. `roll` 'min' | 'max'.
 */
function weaponAtk(data, total, weapon, roll, overRoll = roll) {
	if (!weapon || !weapon.atk) return 0;
	const type = weapon.type;
	const dex = total.dex;
	const dstr = DEX_WEAPONS.has(type) ? dex : total.str;
	const ddstr = Math.trunc(dstr / 10);
	const bonus = dstr + Math.trunc((ddstr * ddstr) / 3);
	const wlv = Math.min(weapon.wlv, data.refine.length);
	let cost = 0;
	if (wlv > 0) cost = Math.max(0, Math.trunc((weapon.atk * 2) / 3) - Math.trunc((ddstr * ddstr * 4) / wlv));
	let max = Math.trunc((weapon.atk * (100 + wlv * 10)) / 100) - cost;
	let min = Math.trunc((weapon.atk * 5 + dex * (wlv * 3 + 18) + 14) / 15) - cost;
	if (min > max) min = max;
	min += bonus;
	max += bonus;
	let atk = roll === 'max' ? max : min;
	const refine = weapon.refine || 0;
	if (refine) atk += data.refine[wlv - 1][refine];
	if (type !== W_BOW && !GUNS.has(type) && refine && wlv >= 1) {
		const over = data.overrefine[wlv - 1][refine];
		if (over > 0) atk += overRoll === 'max' ? over : 1;
	}
	return Math.max(atk, 0);
}

function attrRatio(data, mob) {
	return data.attr_fix[Math.max(mob.element_lv, 1) - 1][ELE_NEUTRAL][mob.element];
}

/** Renewal DEF: hard DEF as a share, soft DEF off flat (float steps as the server's). */
function applyDef(damage, mob) {
	const def1 = Math.max(mob.def, 0);
	const vitDef = Math.max(mob.def2, 1);
	return Math.trunc(f(f(f(f(100 - f(f(def1 / f(def1 + 400)) * 90)) / 100) * damage) - vitDef));
}

function hitDamage(data, job, input, total, mob, roll, critical, overRoll = roll) {
	const type = input.weapon ? input.weapon.type : 0;
	const ratio = attrRatio(data, mob);
	const ele = (d) => d + Math.trunc((d * (ratio - 100)) / 100);
	const batk = ele(statusAtk(total, type));
	let weapon = weaponAtk(data, total, input.weapon, critical ? 'max' : roll, overRoll);
	weapon = Math.trunc((weapon * data.size_fix[mob.size][type]) / 100);
	weapon = ele(weapon);
	if (mob.plant) return 1; // plants take 1 damage a hit
	let damage = applyDef(batk + weapon, mob);
	if (damage < 1) damage = ratio > 0 ? 1 : 0; // a hit does at least 1, unless the element can't hurt the monster
	if (critical) damage += Math.trunc((damage * 40) / 100);
	return damage;
}

/**
 * A normal attack of `input` (the stat calculator's input) on `mob` (a mobList row): {min, max} damage of a hit,
 * the critical hit's damage, hit and critical chances (0..1), and the character's total stats.
 */
export function normalAttack(data, input, mob) {
	const job = typeof input.job === 'object' ? input.job : jobById(data, input.job);
	const total = totals(job, input);
	const type = input.weapon ? input.weapon.type : 0;
	const blv = input.blv;
	const hit = blv + total.dex + Math.floor(total.luk / 3) + 175;
	const hitRate = Math.min(Math.max(hit - mob.flee, MIN_HITRATE), MAX_HITRATE) / 100;
	let cri = 10 + Math.floor(total.luk / 3) * 10;
	if (type === W_KATAR) cri *= 2;
	cri -= Math.trunc(mob.lv / 15) + 2 * mob.luk;
	const critRate = Math.min(Math.max(cri, 0), 1000) / 1000;
	// a katar's normal attack adds a second hit of 1 % (+ 2 % per Double Attack level, not counted here)
	const katar = (d) => (type === W_KATAR ? Math.trunc(d / 100) : 0);
	const min = hitDamage(data, job, input, total, mob, 'min', false);
	const max = hitDamage(data, job, input, total, mob, 'max', false);
	const crit = hitDamage(data, job, input, total, mob, 'max', true);
	return {
		min,
		max,
		crit,
		minTotal: min + katar(min),
		maxTotal: max + katar(max),
		critTotal: crit + katar(crit),
		max: hitDamage(data, job, input, total, mob, 'max', false),
		crit: hitDamage(data, job, input, total, mob, 'max', true),
		critMin: hitDamage(data, job, input, total, mob, 'max', true, 'min'),
		hitRate,
		critRate,
		total
	};
}
