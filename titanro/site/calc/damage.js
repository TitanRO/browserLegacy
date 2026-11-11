/**
 * TitanRO damage calculator: a character's normal attack on a monster, with the game server's formulas and tables
 * (data.json, mobs.json). tests/site/calc.test.js checks it against the damage the server computed for the same
 * characters and monsters (tests/site/damage-cases.json).
 *
 * Counted: status ATK, the weapon (ATK, level, refine and over-refine), size and element modifiers (neutral attacks),
 * the monster's DEF, the critical bonus, hit and critical chances, equipment, cards and ammunition (items.js).
 */
import { resolve, statusWindow } from './calc.js';
import { chorusBonus, WM_DANCE_WITH_WUG } from './buffs.js';

const W_FIST = 0;
const W_DAGGER = 1;
const W_BOW = 11;
const TF_DOUBLE = 48;
const RA_WUGDASH = 2242;
const RA_WUGSTRIKE = 2243;
const RA_WUGBITE = 2244;
const RA_TOOTHOFWUG = 2245;
/** Passive skills that change attacks (the page's passive skill panel lists them too). */
export const ATTACK_PASSIVES = new Set([TF_DOUBLE, RA_TOOTHOFWUG]);
const PR_IMPOSITIO = 66;
const BS_WEAPONPERFECT = 112;
const BS_OVERTHRUST = 113;
const LK_AURABLADE = 355;
const SN_SIGHT = 380;
/** Buffs that change attacks (input.buffs {skill id: level}); buffs.js has what they do in the status window. */
/** Weapon endowments: {skill id: element} (Aspersio, Enchant Poison, the Sage's four); one at a time. */
export const ENDOWS = { 68: 6, 138: 5, 280: 3, 281: 1, 282: 4, 283: 2 };
export const ATTACK_BUFFS = new Set([PR_IMPOSITIO, BS_WEAPONPERFECT, BS_OVERTHRUST, LK_AURABLADE, SN_SIGHT, WM_DANCE_WITH_WUG, ...Object.keys(ENDOWS).map(Number)]);

function buffLv(c, id) {
	return (c.buffs && c.buffs[id]) || 0;
}

/** The element of weapon attacks: an endowment's, over the weapon's and the ammunition's. */
function attackEle(c) {
	for (const [id, ele] of Object.entries(ENDOWS)) if (buffLv(c, id)) return ele;
	return c.eq.weaponEle || ELE_NEUTRAL;
}

/** The buffs' ATK before the ratio (Impositio: 5 a level, as a mastery) and their ratio % (Over Thrust 5 as a
 * party member gets it, True Sight 2 a level). */
function buffAtk(c) {
	return 5 * buffLv(c, PR_IMPOSITIO);
}
function buffRatio(c) {
	return (buffLv(c, BS_OVERTHRUST) ? 5 : 0) + 2 * buffLv(c, SN_SIGHT);
}
const W_KATAR = 16;
const DEX_WEAPONS = new Set([11, 13, 14, 17, 18, 19, 20, 21]);
const GUNS = new Set([17, 18, 19, 20, 21]);
/** Normal attacks from a distance (bows and guns): bLongAtkRate counts. */
const LONG_WEAPONS = new Set([11, 17, 18, 19, 20, 21]);
const RC_BOSS = 12;
const RC_NONBOSS = 13;
const NK_NO_CARDFIX_ATK = 0x08;
const ELE_NEUTRAL = 0;
const MIN_HITRATE = 5;
const MAX_HITRATE = 100;
const f = Math.fround;

/** mobs.json rows as objects. */
export function mobList(mobs) {
	return mobs.mobs.map((row) => Object.fromEntries(mobs.columns.map((c, i) => [c, row[i]])));
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
	// the server is built with -ffast-math, which computes (100 - q × 90) / 100 × damage as damage - q × 0.9 × damage
	// in floats (1 more than the plain formula at DEF 160 or 500)
	const q = f(def1 / f(def1 + 400));
	return Math.trunc(f(f(damage - f(f(q * f(0.9)) * damage)) - vitDef));
}

/** The weapon part: size, ATK %, equipment ATK, element, the card and equipment % against the monster. */
function weaponDamage(data, c, mob, roll, overRoll, ele, nk = 0, equipAtk = true, extraAtk = 0, neutralAgain = false) {
	const type = c.weapon ? c.weapon.type : 0;
	let d = weaponAtk(data, c.total, c.weapon, roll, overRoll);
	// Weapon Perfection: no size penalty
	if (!buffLv(c, BS_WEAPONPERFECT)) d = Math.trunc((d * data.size_fix[mob.size][type]) / 100);
	if (LONG_WEAPONS.has(type)) d += c.eq.arrowAtk || 0; // the ammunition's ATK, after the size fix
	if (c.eq.atkRate) d += Math.trunc((d * c.eq.atkRate) / 100);
	if (equipAtk) d += c.eq.equipAtk;
	d += extraAtk; // a skill's own ATK, with the equipment's (Envenom)
	if (!(nk & NK_NO_ELEFIX)) d = eleFix(data, d, ele, mob);
	// Cart Revolution and Arm Cannon: the element table once more, neutral (Hercules battle_calc_elefix)
	if (neutralAgain && !(nk & NK_NO_ELEFIX)) d = eleFix(data, d, ELE_NEUTRAL, mob);
	return cardFix(c.eq, d, mob, nk);
}

function eleFix(data, d, ele, mob) {
	const r = data.attr_fix[Math.max(mob.element_lv, 1) - 1][ele][mob.element];
	return d + Math.trunc((d * (r - 100)) / 100);
}

/** The attacker's card and equipment bonuses (Hercules' calc_cardfix, in thousandths). */
function cardFix(eq, d, mob, nk = 0) {
	if (nk & NK_NO_CARDFIX_ATK) return d;
	let fix = 1000;
	fix = Math.trunc((fix * (100 + eq.addrace[mob.race])) / 100);
	if (!(nk & NK_NO_ELEFIX)) fix = Math.trunc((fix * (100 + eq.addele[mob.element])) / 100);
	fix = Math.trunc((fix * (100 + eq.addsize[mob.size])) / 100);
	fix = Math.trunc((fix * (100 + eq.addrace[mob.boss ? RC_BOSS : RC_NONBOSS])) / 100);
	return fix !== 1000 ? Math.trunc((d * fix) / 1000) : d;
}

function defOf(c, mob) {
	let def1 = mob.def;
	const ignore = Math.min(c.eq.ignoreDef[mob.race] + c.eq.ignoreDef[mob.boss ? RC_BOSS : RC_NONBOSS], 100);
	if (ignore) def1 -= Math.trunc((def1 * ignore) / 100);
	return { ...mob, def: def1 };
}

function hitDamage(data, c, mob, roll, critical, overRoll = roll) {
	const type = c.weapon ? c.weapon.type : 0;
	const weaponEle = attackEle(c);
	const batk = eleFix(data, statusAtk(c.total, type), ELE_NEUTRAL, mob);
	if (mob.plant) return 1; // plants take 1 damage a hit
	let damage = batk + weaponDamage(data, c, mob, critical ? 'max' : roll, overRoll, weaponEle) + buffAtk(c);
	const ratio = 100 + buffRatio(c);
	if (ratio !== 100) damage = Math.trunc((damage * ratio) / 100);
	if (critical && c.eq.critAtkRate) damage += Math.trunc((damage * c.eq.critAtkRate) / 100);
	if (LONG_WEAPONS.has(type) && c.eq.longAtkRate) damage += Math.trunc((damage * c.eq.longAtkRate) / 100);
	damage = applyDef(damage, defOf(c, mob));
	const hurts = data.attr_fix[Math.max(mob.element_lv, 1) - 1][weaponEle][mob.element] > 0;
	if (damage < 1) damage = hurts ? 1 : 0; // a hit does at least 1, unless the element can't hurt the monster
	if (critical) damage += Math.trunc((damage * 40) / 100);
	return damage + (hurts ? 20 * buffLv(c, LK_AURABLADE) : 0); // Aura Blade: 20 a level, after everything
}

/**
 * Double Attack on a normal attack (TitanRO's auriga_stats plugin, as Hercules decides it): Double Attack with a
 * dagger (5 % a level) or the equipment's double attack chance with any weapon, the higher one; two hits. A dagger's
 * Double Attack also raises the hit chance by its level in percent of HIT - FLEE when it triggers.
 * {rate (0..1), hitAdd} or null.
 */
function doubleAttack(c, type, passives, hit, mob) {
	const lv = type === W_DAGGER ? (passives && passives[TF_DOUBLE]) || 0 : 0;
	const itemRate = type !== W_FIST ? c.eq.doubleRate + c.eq.doubleAddRate : 0;
	if (lv <= 0 && itemRate <= 0) return null;
	const chance = 5 * lv > itemRate ? 5 * lv : itemRate;
	const bonusLv = lv > 0 && 5 * lv >= itemRate ? lv : 0;
	const base = hit - mob.flee;
	return { rate: Math.min(Math.max(chance, 0), 100) / 100, hitAdd: bonusLv && base > 0 ? Math.trunc((base * bonusLv) / 100) : 0 };
}

/** The critical chance (0..1) on `mob`, x a skill's factor (`mult`) and + its own Critical in tenths (`add`). */
function critChance(c, type, mob, add = 0, mult = 1) {
	let cri = 10 + Math.floor(c.total.luk / 3) * 10 + c.eq.cri;
	if (type === W_KATAR) cri *= 2;
	if (LONG_WEAPONS.has(type)) cri += c.eq.arrowCri || 0; // the ammunition's Critical
	cri -= Math.trunc(mob.lv / 15) + 2 * mob.luk;
	cri = cri * mult + add;
	return Math.min(Math.max(cri, 0), 1000) / 1000;
}

/**
 * A normal attack of `input` (the stat calculator's input; `input.passives` {skill id: level} for ATTACK_PASSIVES)
 * on `mob` (a mobList row): {min, max} damage of a hit, the critical hit's damage, hit and critical chances (0..1),
 * Double Attack (`double`: {rate, hitRate} when it can trigger; it hits twice, critical too), and the total stats.
 */
export function normalAttack(data, input, mob) {
	const c = { ...resolve(data, input), buffs: input.buffs, performers: input.performers };
	const { total, eq } = c;
	const type = c.weapon ? c.weapon.type : 0;
	const hit = c.blv + total.dex + Math.floor(total.luk / 3) + 175 + eq.hit;
	const hitRate = Math.min(Math.max(hit - mob.flee, MIN_HITRATE), MAX_HITRATE) / 100;
	const critRate = critChance(c, type, mob);
	const da = doubleAttack(c, type, input.passives, hit, mob);
	// a katar's normal attack adds a second hit of 1 % + 2 % per Double Attack level
	const katarLv = (input.passives && input.passives[TF_DOUBLE]) || 0;
	const katar = (d) => (type === W_KATAR ? Math.trunc((d * (1 + 2 * katarLv)) / 100) : 0);
	const min = hitDamage(data, c, mob, 'min', false);
	const max = hitDamage(data, c, mob, 'max', false);
	const crit = hitDamage(data, c, mob, 'max', true);
	return {
		min,
		max,
		crit,
		minTotal: min + katar(min),
		maxTotal: max + katar(max),
		critTotal: crit + katar(crit),
		critMin: hitDamage(data, c, mob, 'max', true, 'min'),
		hitRate,
		critRate,
		double: da && { rate: da.rate, hitRate: Math.min(Math.max(hit + da.hitAdd - mob.flee, MIN_HITRATE), MAX_HITRATE) / 100 },
		total
	};
}

const NK_NO_ELEFIX = 0x10;
const NK_IGNORE_DEF = 0x20;

/**
 * Weapon skills whose damage has more to it than ratio x (status ATK + weapon) less DEF (hits by size, fixed damage,
 * spheres, cart weight, HP or SP, a second formula): the calculator leaves them out until it has their formula.
 */
const SPECIAL_SKILLS = new Set([
	251, // Shield Boomerang: its damage is an open decision (jRO design doc)
	252, 390 // Reflect Shield, Counter Instinct: they reflect the damage taken, not an attack
]);

/** The weapon skills the calculator knows: data.weapon_skills (their ratio doesn't depend on the caster), less the
 * passive ones and SPECIAL_SKILLS. */
export function weaponSkills(data) {
	const passive = new Set(data.skills.filter((s) => s.passive).map((s) => s.id));
	return Object.keys(data.weapon_skills || {})
		.map(Number)
		.filter((id) => !SPECIAL_SKILLS.has(id) && !passive.has(id));
}

const KN_BRANDISHSPEAR = 57;

/** A long-range skill (the server's battle_range_type for players: its skill db range 5 or more, a negative one as
 * its size; Brandish Spear in renewal): the equipment's long-range damage % counts. */
function longSkill(sk, lv, skillId) {
	if (skillId === KN_BRANDISHSPEAR) return true;
	const range = sk.time && sk.time[lv - 1][6];
	return range != null && Math.abs(range) >= 5;
}

const TF_POISON = 52;
const AM_ACIDTERROR = 230;
const MO_EXTREMITYFIST = 271;
const ASC_BREAKER = 379;
const CR_ACIDDEMONSTRATION = 490;
const GS_FLING = 501;
const GS_GROUNDDRIFT = 521;
const NJ_SYURIKEN = 523;
const NJ_KUNAI = 524;
const NJ_TOBIDOUGU = 522;
const KO_HAPPOKUNAI = 3007;
const KO_MAKIBISHI = 3010;
const HW_MAGICCRASHER = 365;
const LK_SPIRALPIERCE = 397;
const GS_PIERCINGSHOT = 514;
const NJ_ISSEN = 544;
const W_RIFLE = 18;
const MO_INVESTIGATE = 266;
const RK_DRAGONTRAINING = 2007;
const RK_DRAGONBREATH = 2008;
const RK_DRAGONBREATH_WATER = 5004;

/**
 * A MATK roll ('min' | 'max') as the server's status->get_matk: status MATK + the equipment's MATK, + the weapon's
 * MATK (with its refine, but a bow's) from a DEX-raised minimum to the weapon level's maximum, less a cost INT lowers
 * (auriga RR), x the equipment's MATK %, + the over-refine roll.
 */
function matkRoll(data, c, roll) {
	const t = c.total;
	const base = t.int + Math.floor(Math.floor(t.int / 7) ** 2 / 3) + Math.floor(t.dex / 5) + Math.floor(t.luk / 3) + (c.eq.ematk || 0);
	const w = c.weapon;
	if (!w) return base;
	const wlv = Math.min(w.wlv, data.refine.length);
	const refine = w.refine || 0;
	const wmatk = (w.matk || 0) + (refine && w.type !== W_BOW && wlv >= 1 ? data.refine[wlv - 1][refine] : 0);
	let atk = base;
	if (wmatk > 0) {
		const cost = wlv > 0 ? Math.max(0, Math.trunc((wmatk * 2) / 3) - Math.trunc((Math.trunc(t.int / 5) ** 2) / wlv)) : 0;
		const max = Math.trunc((wmatk * (100 + 10 * wlv)) / 100) - cost;
		const min = Math.min(Math.trunc((wmatk * 5 + t.dex * (12 + 2 * wlv)) / 15) - cost, max);
		atk += roll === 'max' ? max : min;
	}
	if (c.eq.matkRate) atk = Math.trunc((atk * Math.max(100 + c.eq.matkRate, 0)) / 100); // the equipment's MATK %
	if (refine && wlv >= 1) { // every weapon (the ATK roll leaves bows and guns out)
		const over = data.overrefine[wlv - 1][refine];
		if (over > 0) atk += roll === 'max' ? over : 1;
	}
	return atk;
}

/** Status ATK + the weapon's (size, equipment ATK, neutral; the skill's card bonuses): the acid skills' ATK. */
function plainAtk(data, c, mob, roll, nk) {
	const type = c.weapon ? c.weapon.type : 0;
	return eleFix(data, statusAtk(c.total, type), ELE_NEUTRAL, mob) + weaponDamage(data, c, mob, roll, roll, ELE_NEUTRAL, nk);
}

/**
 * Weapon skills the server computes with a formula of their own (auriga_stats' battle_calc_weapon_attack_acid_post,
 * as jRO): the damage of the attack, or undefined for the usual steps.
 */
function ownFormula(data, c, mob, skillId, lv, roll, nk) {
	const totalDef = mob.def + mob.def2;
	const totalMdef = mob.mdef + mob.mdef2;
	switch (skillId) {
	case AM_ACIDTERROR: { // (ATK + MATK) x (100 + 100 x level) % - DEF - MDEF, halved on a boss, neutral
		let d = Math.trunc(((plainAtk(data, c, mob, roll, nk) + matkRoll(data, c, roll)) * (100 + 100 * lv)) / 100) - totalDef - totalMdef;
		d = Math.max(d, 0);
		if (mob.boss) d = Math.trunc(d / 2);
		return eleFix(data, d, ELE_NEUTRAL, mob);
	}
	case CR_ACIDDEMONSTRATION: { // (ATK + MATK) x VIT x 7 / 10, - half DEF and half MDEF, / 10 x level, neutral
		let d = Math.trunc(((plainAtk(data, c, mob, roll, nk) + matkRoll(data, c, roll)) * mob.vit * 7) / 10);
		d = Math.trunc((d - (Math.trunc(totalDef / 2) + Math.trunc(totalMdef / 2))) / 10) * lv;
		return eleFix(data, Math.max(d, 0), ELE_NEUTRAL, mob);
	}
	case ASC_BREAKER: { // ATK x (300 + 50 x level) % + MATK x that %, - DEF - MDEF
		const ratio = 300 + 50 * lv;
		const d = Math.trunc((plainAtk(data, c, mob, roll, nk) * ratio) / 100) + Math.trunc((matkRoll(data, c, roll) * ratio) / 100);
		return Math.max(d - totalDef - totalMdef, 0);
	}
	case GS_GROUNDDRIFT: // ATK (status + weapon, the attack's element) x (200 + 20 x level) %, DEF
	case NJ_SYURIKEN: // (ATK + the shuriken's) x (100 + 5 x level) %, DEF (the calculator has no thrown ammunition: neutral)
	case NJ_KUNAI: { // (ATK + the kunai's + 3 x Dagger Throwing Practice) x 100 x level %, as Shuriken Throw
		const type = c.weapon ? c.weapon.type : 0;
		const batk = statusAtk(c.total, type);
		let atk = eleFix(data, batk, ELE_NEUTRAL, mob) + weaponDamage(data, c, mob, roll, roll, attackEle(c), 0);
		let ratio = 200 + 20 * lv;
		if (skillId !== GS_GROUNDDRIFT) {
			ratio = skillId === NJ_SYURIKEN ? 100 + 5 * lv : 100 * lv;
			const weapon = Math.max(atk - batk, 0);
			atk = batk + eleFix(data, weapon, ELE_NEUTRAL, mob) + (c.eq.arrowAtk || 0);
			if (skillId === NJ_KUNAI) atk += 3 * ((c.passives && c.passives[NJ_TOBIDOUGU]) || 0);
		}
		return Math.max(applyDef(Math.trunc((atk * ratio) / 100), defOf(c, mob)), 0);
	}
	case KO_HAPPOKUNAI: { // (ATK + the kunai's) x (300 + 60 x level) % - DEF, neutral without a kunai
		const d = Math.trunc(((plainAtk(data, c, mob, roll, nk) + (c.eq.arrowAtk || 0)) * (300 + 60 * lv)) / 100) - totalDef;
		return eleFix(data, Math.max(d, 0), ELE_NEUTRAL, mob);
	}
	case RK_DRAGONBREATH:
	case RK_DRAGONBREATH_WATER: {
		// (HP / 50 + MaxSP / 4) x level x (95 + 5 x Dragon Training) % x BaseLv / 100 - DEF - soft DEF, with the
		// equipment's % and the element: jRO, as the server scales Hercules' result (BaseLv / 150) to it
		const ele = data.weapon_skills[skillId].lv[lv - 1][1];
		const training = 95 + 5 * ((c.passives && c.passives[RK_DRAGONTRAINING]) || 0);
		const base = (Math.trunc(c.maxHp / 50) + Math.trunc(c.maxSp / 4)) * lv;
		const hercules = Math.trunc((Math.trunc((base * c.blv) / 150) * training) / 100);
		const jro = Math.trunc((Math.trunc((base * training) / 100) * c.blv) / 100);
		if (hercules <= 0) return 0;
		let damage = eleFix(data, cardFix(c.eq, hercules, mob, nk), ele, mob);
		if (c.eq.longAtkRate) damage += Math.trunc((damage * c.eq.longAtkRate) / 100); // a long-range attack
		const reduced = jro - totalDef;
		const d = reduced <= 0 || damage <= 0 ? 0 : Math.trunc((damage * reduced) / hercules);
		return d < 1 && data.attr_fix[Math.max(mob.element_lv, 1) - 1][ele][mob.element] > 0 ? 1 : d;
	}
	case LK_SPIRALPIERCE: {
		// jRO: 70 % of the normal attack's ATK + 70 % of the weapon's weight, x 115 / 100 / 85 % by size, x (100 + 50
		// x level) %, 5 hits; the server keeps Hercules' size steps (130 / 115 / 100 %) and scales its ratio to jRO's
		const type = c.weapon ? c.weapon.type : 0;
		let d = eleFix(data, statusAtk(c.total, type), ELE_NEUTRAL, mob) + weaponDamage(data, c, mob, roll, roll, attackEle(c));
		d = Math.trunc((d * 70) / 100) + Math.trunc((((c.weapon && c.weapon.weight) || 0) * 7) / 100);
		const hercules = [130, 115, 100][mob.size];
		d = Math.trunc((d * hercules) / 100);
		const ratio = Math.trunc(((100 + 50 * lv) * [115, 100, 85][mob.size]) / hercules);
		d = Math.trunc((d * ratio) / 100);
		const skillAtk = (c.eq.skillAtk && c.eq.skillAtk[skillId]) || 0;
		if (skillAtk) d += Math.trunc((d * skillAtk) / 100);
		d = Math.max(applyDef(d, defOf(c, mob)), 0) * 5;
		if (d < 1) d = c.attrFix[Math.max(mob.element_lv, 1) - 1][attackEle(c)][mob.element] > 0 ? 1 : 0;
		return d + (d > 0 ? 20 * buffLv(c, LK_AURABLADE) * 5 : 0); // Aura Blade on each hit
	}
	case GS_PIERCINGSHOT: {
		// the normal attack's ATK x jRO's 250 + 30 x level % with a rifle, else 200 + 20 x level %, no DEF, the
		// element once more (the server scales Hercules' 30 / 20 x (level + 5) % to it after the element)
		const rifle = c.weapon && c.weapon.type === W_RIFLE;
		const hercules = (rifle ? 30 : 20) * (lv + 5);
		const jro = rifle ? 250 + 30 * lv : 200 + 20 * lv;
		const type = c.weapon ? c.weapon.type : 0;
		let d = eleFix(data, statusAtk(c.total, type), ELE_NEUTRAL, mob) + weaponDamage(data, c, mob, roll, roll, attackEle(c));
		d = Math.trunc((d * hercules) / 100);
		const skillAtk = (c.eq.skillAtk && c.eq.skillAtk[skillId]) || 0;
		if (skillAtk) d += Math.trunc((d * skillAtk) / 100);
		if (c.eq.longAtkRate) d += Math.trunc((d * c.eq.longAtkRate) / 100);
		d = eleFix(data, Math.max(d, 0), attackEle(c), mob);
		return Math.trunc((d * jro) / hercules);
	}
	case NJ_ISSEN: { // ATK x level + HP (all of it) - DEF - soft DEF, halved on a boss, no DEF step, neutral
		const type = c.weapon ? c.weapon.type : 0;
		const atk = eleFix(data, statusAtk(c.total, type), ELE_NEUTRAL, mob) + weaponDamage(data, c, mob, roll, roll, attackEle(c));
		let d = atk ? atk * lv + c.maxHp - totalDef : -totalDef;
		if (mob.boss) d = Math.trunc(d / 2);
		return eleFix(data, Math.max(d, 0), ELE_NEUTRAL, mob);
	}
	case KO_MAKIBISHI: { // 20 x level in place of the attack's ATK, then DEF as usual
		const ele = data.weapon_skills[skillId].lv[lv - 1][1];
		const e = ele >= 0 ? ele : attackEle(c);
		let d = applyDef(20 * lv, defOf(c, mob));
		if (d < 1) d = c.attrFix[Math.max(mob.element_lv, 1) - 1][e][mob.element] > 0 ? 1 : 0;
		return d;
	}
	case GS_FLING: // the job level
		return c.jlv;
	case MO_EXTREMITYFIST: { // ATK x (800 + 10 x SP) % + 250 + 150 x level - DEF, neutral (all the SP: the maximum)
		const d = Math.trunc((plainAtk(data, c, mob, roll, nk) * (800 + 10 * c.maxSp)) / 100) + 250 + 150 * lv - totalDef;
		return eleFix(data, Math.max(d, 0), ELE_NEUTRAL, mob);
	}
	}
	return undefined;
}

const MC_CARTREVOLUTION = 153;
const NC_ARMSCANNON = 2261;
const NEUTRAL_AGAIN = new Set([MC_CARTREVOLUTION, NC_ARMSCANNON]);

const SN_SHARPSHOOTING = 382;
const PA_SHIELDCHAIN = 480;
const GS_MAGICALBULLET = 507;
const GN_CARTCANNON = 2477;
/** DEF and soft DEF off flat (Hercules renewal's flag.tdef); the element once more at the end (flag.distinct). */
const FLAT_DEF_SKILLS = new Set([PA_SHIELDCHAIN, GS_MAGICALBULLET, GN_CARTCANNON]);
/** DEF and soft DEF off flat, without the element again (flag.tdef alone). */
const FLAT_DEF_ONLY = new Set([365]);
const SU_SCAROFTAROU = 5032;
const RL_MASS_SPIRAL = 2553;
const RL_SLUGSHOT = 2570;
const SJ_NOVAEXPLOSING = 2582;
const SJ_PROMINENCEKICK = 2593;
const ELE_FIRE = 3;
const GS_BULLSEYE = 503;
const RC_BRUTE = 2;
const RC_DEMIHUMAN = 7;
/** Weapon skills that can hit critically (the server's battle_calc_weapon_attack critical check). */
// skill: [its own Critical (tenths), x the chance]: Focused Arrow Strike + 20 (jRO), Counter Attack twice the chance
const CRIT_SKILLS = new Map([[SN_SHARPSHOOTING, [200, 1]], [61, [0, 2]]]);

const KN_AUTOCOUNTER = 61;
const MO_FINGEROFFENSIVE = 267;
const WS_CARTTERMINATION = 485;
const LG_RAGEBURST = 2314;
const GN_REMODELING_CART = 2475;
const GN_CART_TORNADO = 2476;
const RL_QD_SHOT = 2559;
const MAX_CART_WEIGHT = 80000; // the server's max_cart_weight (8000, in tenths), + 5000 a Remodel Cart level

/** The caster's resources a skill reads (the page shows their inputs): spirit spheres, the cart's load, rage. */
export const SKILL_RESOURCES = new Map([
	[MO_FINGEROFFENSIVE, 'spheres'], [MC_CARTREVOLUTION, 'cart'], [WS_CARTTERMINATION, 'cart'], [GN_CART_TORNADO, 'cart'],
	[LG_RAGEBURST, 'rage']
]);

/** The cart's capacity in the server's units (tenths of the weight shown): 80000, + 5000 a Remodel Cart level. */
function cartMax(c) {
	return MAX_CART_WEIGHT + 5000 * ((c.passives && c.passives[GN_REMODELING_CART]) || 0);
}

/** The cart's load (tenths of the weight shown), within its capacity. */
function cartLoad(c) {
	return Math.min(Math.max(c.cartWeight || 0, 0), cartMax(c));
}

const KN_PIERCE = 56;
const KN_BOWLINGBASH = 62;
const RG_BACKSTAP = 212;
const CR_HOLYCROSS = 253;
const W_2HSPEAR = 5;

/**
 * A weapon skill's ratio % and hits (negative: shown as that many, dealt once) where the server's differ from the
 * skill db row: by the weapon type or the target's size.
 */
function skillRow(c, mob, skillId, lv, row) {
	let [ratio, ele, num] = row;
	const attrOf = (m, e) => c.attrFix[Math.max(m.element_lv, 1) - 1][e][m.element];
	const type = c.weapon ? c.weapon.type : 0;
	switch (skillId) {
	case KN_PIERCE: // a hit a size step: small 1, medium 2, large 3
		num = mob.size + 1;
		break;
	case KN_BOWLINGBASH: // two hits, each dealt in full (jRO)
		num = 2;
		break;
	case RG_BACKSTAP: // half the ratio with a bow
		if (type === W_BOW) ratio = Math.trunc((300 + 40 * lv) / 2);
		break;
	case CR_HOLYCROSS: // twice the level part with a two-handed spear
		if (type === W_2HSPEAR) ratio = 100 + 70 * lv;
		break;
	case GS_BULLSEYE: // 500 % on a brute or demi-human that isn't a boss
		if ((mob.race === RC_BRUTE || mob.race === RC_DEMIHUMAN) && !mob.boss) ratio += 400;
		break;
	case RL_MASS_SPIRAL: // (200 + the target's DEF, at most 500) x level, then the usual DEF
		ratio = (200 + Math.min(500, mob.def)) * lv;
		break;
	case RL_SLUGSHOT: // 1200 x level x (2 + the target's size) on a monster
		ratio = 1200 * lv * (2 + mob.size);
		break;
	case SJ_PROMINENCEKICK: { // fire in Hercules, the weapon's element in jRO: the ratio carries the change
		ratio = 650 + 50 * lv;
		const fire = attrOf(mob, ELE_FIRE);
		if (fire > 0) ratio = Math.trunc((ratio * attrOf(mob, attackEle(c))) / fire);
		ele = ELE_FIRE;
		break;
	}
	case SU_SCAROFTAROU: // twice the ratio on a boss
		if (mob.boss) ratio *= 2;
		break;
	case RL_QD_SHOT: // 1 + JobLv / 20 hits
		num = 1 + Math.trunc(c.jlv / 20);
		break;
	case WS_CARTTERMINATION: { // the cart's load / (10 x (16 - level)) x 10 % (none with an empty cart)
		const load = cartLoad(c);
		if (load > 0) ratio = Math.trunc((Math.trunc(load / Math.max(1, 10 * (16 - lv))) * 80000) / MAX_CART_WEIGHT);
		break;
	}
	case GN_CART_TORNADO: // jRO and auriga: 100 x level + 50 x Remodel Cart + the load / 10 / (150 - base STR)
		ratio = 100 * lv + 50 * ((c.passives && c.passives[GN_REMODELING_CART]) || 0)
			+ Math.trunc(Math.trunc(cartLoad(c) / 10) / (150 - Math.min(c.baseStr || 1, 130)));
		break;
	case LG_RAGEBURST: // 200 % a rage counter (at full HP), x BaseLv / 100
		ratio = Math.trunc((200 * Math.max(c.rage || 0, 0) * c.blv) / 100);
		break;
	case NC_ARMSCANNON: // jRO: 300 + 400 x level on small targets, 350 on medium, 300 on large
		ratio = 300 + [400, 350, 300][mob.size] * lv;
		break;
	}
	return [ratio, ele, num];
}

function skillHitDamage(data, c, mob, skillId, lv, roll, passives, critical = false) {
	const sk = data.weapon_skills[skillId];
	const [ratio, skillEle, num] = skillRow(c, mob, skillId, lv, sk.lv[lv - 1]);
	const type = c.weapon ? c.weapon.type : 0;
	if (mob.plant) return num > 1 ? num : 1;
	if (skillId === SJ_PROMINENCEKICK && ratio <= 0) return 0; // a weapon element that can't hurt the target
	const own = ownFormula(data, c, mob, skillId, lv, roll, sk.nk);
	if (own !== undefined) return own;
	const ele = skillEle >= 0 ? skillEle : attackEle(c); // -1: the weapon's (or an endowment's) element
	if (mob.plant) return num > 1 ? num : 1;
	let batk = sk.nk & NK_NO_ELEFIX ? statusAtk(c.total, type) : eleFix(data, statusAtk(c.total, type), ELE_NEUTRAL, mob);
	const neutralAgain = NEUTRAL_AGAIN.has(skillId);
	if (neutralAgain && !(sk.nk & NK_NO_ELEFIX)) batk = eleFix(data, batk, ELE_NEUTRAL, mob);
	const warg = skillId === RA_WUGDASH || skillId === RA_WUGSTRIKE || skillId === RA_WUGBITE;
	// the warg's ATK leaves the equipment's ATK + out (jRO; arrow ATK counts)
	let damage = batk + weaponDamage(data, c, mob, roll, roll, ele, sk.nk, !warg, skillId === TF_POISON ? 15 * lv : 0, neutralAgain);
	// Tooth of Wug: 10 ATK a level on the Warg skills, before the ratio (jRO; auriga_stats cuts Hercules' 30 to that)
	if (warg) damage += 10 * ((passives && passives[RA_TOOTHOFWUG]) || 0);
	damage += buffAtk(c);
	if (skillId === MO_INVESTIGATE) damage += Math.trunc(mob.def / 2); // half the target's hard DEF, before the ratio
	if (c.spheres > 0) damage += 3 * c.spheres; // 3 ATK a spirit sphere held (the server's mastery step)
	// Magical Bullet: a MATK roll, neutral, added to the ATK
	if (skillId === GS_MAGICALBULLET) damage += eleFix(data, matkRoll(data, c, roll), ELE_NEUTRAL, mob);
	// Shield Chain: the shield's weight / 10 + 4 x its refine, before the ratio
	if (skillId === PA_SHIELDCHAIN && c.shield) damage += Math.trunc((c.shieldWeight || 0) / 10) + 4 * (c.shieldRefine || 0);
	// Dance with Wug on Warg Strike (and Warg Dash): 10 x level x (2 + the chorus bonus) % more ratio
	const dance = warg ? buffLv(c, WM_DANCE_WITH_WUG) : 0;
	const danceStep = dance ? dance * (2 + chorusBonus(c.performers)) : 0;
	const danceRatio = skillId === RA_WUGBITE ? 0 : 10 * danceStep;
	damage = Math.trunc((damage * (ratio + buffRatio(c) + danceRatio)) / 100);
	// and 2 x level x (2 + the chorus bonus) ATK on the three Warg skills, after the ratio (Hercules battle.cpp)
	damage += 2 * danceStep;
	// Stave Crasher: a fifth of its magic attack (a MATK roll, renewal MDEF as auriga's integers), after the ratio
	if (skillId === HW_MAGICCRASHER) {
		const mdef = Math.max(mob.mdef, 0);
		const magic = Math.trunc((matkRoll(data, c, roll) * (1000 + mdef)) / (1000 + 10 * mdef)) - mob.mdef2;
		damage += Math.trunc(Math.max(magic, 0) / 5);
	}
	const skillAtk = (c.eq.skillAtk && c.eq.skillAtk[skillId]) || 0; // the equipment's damage % for this skill
	if (skillAtk) damage += Math.trunc((damage * skillAtk) / 100);
	if (critical && c.eq.critAtkRate) damage += Math.trunc((damage * c.eq.critAtkRate) / 100);
	if (c.eq.longAtkRate && longSkill(sk, lv, skillId)) damage += Math.trunc((damage * c.eq.longAtkRate) / 100);
	if (skillId === MC_CARTREVOLUTION) {
		// jRO: ATK x 150 % + ATK x the cart's weight / its capacity, DEF and soft DEF off flat
		const cart = Math.trunc((damage * cartLoad(c)) / cartMax(c));
		damage = Math.max(Math.trunc((damage * 150) / 100) + cart - (mob.def + mob.def2), 0);
	} else if (FLAT_DEF_SKILLS.has(skillId) || FLAT_DEF_ONLY.has(skillId)) damage -= defOf(c, mob).def + Math.max(mob.def2, 1);
	else if (!(sk.nk & NK_IGNORE_DEF)) damage = applyDef(damage, defOf(c, mob));
	if (critical && damage > 0) damage += Math.trunc((damage * 40) / 100); // a critical hit: 40 % more, after DEF
	damage += 20 * buffLv(c, LK_AURABLADE);
	const hurts = data.attr_fix[Math.max(mob.element_lv, 1) - 1][ele][mob.element] > 0;
	if (damage < 0) damage = 0;
	if (num > 1) damage *= num;
	// a skill that is Neutral in the skill db (not the weapon's element) takes the element table once more (Hercules
	// renewal's forced Neutral skills: Warg Strike, Warg Bite, ...)
	if (skillEle === ELE_NEUTRAL || FLAT_DEF_SKILLS.has(skillId)) damage = eleFix(data, damage, ele, mob);
	if (damage < 1) damage = hurts ? 1 : 0; // at least 1 for the whole attack
	if (skillId === PA_SHIELDCHAIN) damage *= 5; // five hits, each in full (auriga), after everything
	// Throw Spirit Sphere: a hit a sphere, up to the level, each through DEF (one with none)
	if (skillId === MO_FINGEROFFENSIVE) damage *= Math.min(Math.max(c.spheres || 0, 1), lv);
	// Nova Explosion: MaxHP / (6 - level) + MaxSP x 2 x level more, after everything (jRO)
	if (skillId === SJ_NOVAEXPLOSING) damage += Math.trunc(c.maxHp / (6 - Math.min(5, lv))) + c.maxSp * 2 * lv;
	return damage;
}

const WL_RADIUS = 2208;
/** Monk combo skills: their after-cast delay isn't reduced by AGI / DEX on this server (auriga_stats). */
const COMBO_SKILLS = new Set([263, 272, 273, 371, 372, 2326, 2329, 2593]);

/**
 * Cast time and after-cast delay of a weapon skill (ms), as the server's auriga_stats plugin computes them (auriga
 * RR's skill_castfix and jRO's delay floor): variable cast reduced by DEX + INT / 2 on a square-root curve (none at
 * 265) and the equipment's percentages added up; fixed cast with flat additions, then the largest reduction;
 * after-cast delay scaled by the equipment's delay rate, at least the attack motion. `amotion` from statusWindow.
 */
export function skillTimes(data, input, skillId, lv, amotion) {
	const c = input.total ? input : resolve(data, input);
	const sk = data.weapon_skills[skillId];
	if (!sk || !sk.time) return null;
	const [cast, fixcast, delay, cooldown, castnodex, delaynodex] = sk.time[lv - 1];
	const eq = c.eq;
	const own = (o) => (o && o[skillId]) || 0;
	// variable cast
	let time = Math.max(cast, 0);
	let skillRate = 0;
	if (!(castnodex & 4)) {
		time += eq.addVarCast + own(eq.skillVarCast);
		skillRate = own(eq.skillCast);
	}
	if (time > 0) {
		if (!(castnodex & 1)) {
			const stat = c.total.dex + Math.trunc(c.total.int / 2);
			const max = 265;
			time = stat >= max ? 0 : Math.trunc(time * f(1 - f(Math.sqrt(f(stat / max)))));
		}
		const reduce = castnodex & 4 ? 0 : eq.varCastRate;
		if (skillRate) time = (time * (100 - skillRate)) / 100;
		time = (time * (100 - reduce)) / 100;
	}
	time = Math.max(time, 0);
	// fixed cast
	let fixed = Math.max(fixcast, 0);
	if (!(castnodex & 4)) fixed += eq.addFixCast + own(eq.skillFixCast);
	if (fixed > 0) {
		const radius = (input.passives && input.passives[WL_RADIUS]) || 0;
		let largest = radius > 0 ? 5 + radius * 5 : 0;
		let added = 0;
		if (!(castnodex & 4)) {
			largest = Math.max(largest, own(eq.skillFixCastRate), eq.fixCastRate);
			added += Math.min(eq.fixCastRate, 0);
		}
		// status effects' reductions (auriga skill_castfix, not for skills that ignore status effects): Dance with Wug
		if (!(castnodex & 2)) largest = Math.max(largest, eq.fixCastLargest || 0);
		fixed = Math.trunc((fixed * (100 - Math.min(largest + added, 100))) / 100);
	}
	fixed = Math.max(fixed, 0);
	// after-cast delay
	let d = delay < 0 ? -delay + amotion : delay;
	const combo = COMBO_SKILLS.has(skillId) ? 4 * c.total.agi + 2 * c.total.dex : 0;
	d -= combo;
	if (!(delaynodex & 4) && eq.delayRate) d = Math.trunc((d * (100 + eq.delayRate)) / 100);
	d = Math.max(d, 0);
	if (combo) d = Math.min(d + combo, delay);
	return { cast: Math.trunc(time) + fixed, delay: Math.max(d, amotion), cooldown };
}

/** The hit chance (0-1) from hit - flee: Pierce's 5 x level % more, Shield Chain's 20 more (the server's hit check). */
function skillHitRate(rate, skillId, lv) {
	if (skillId === PA_SHIELDCHAIN) rate += 20; // auriga: hit - flee + 20
	if (skillId === KN_PIERCE) rate += Math.trunc((rate * 5 * lv) / 100);
	return Math.min(Math.max(rate, MIN_HITRATE), MAX_HITRATE) / 100;
}

/** A weapon skill (`skillId` at `lv`) of `input` on `mob`: {min, max} damage, hits, hit chance. */
export function skillAttack(data, input, mob, skillId, lv) {
	const c = { ...resolve(data, input), buffs: input.buffs, performers: input.performers };
	const sk = data.weapon_skills[skillId];
	if (skillId === MO_EXTREMITYFIST || skillId === RK_DRAGONBREATH || skillId === RK_DRAGONBREATH_WATER || skillId === NJ_ISSEN || skillId === SJ_NOVAEXPLOSING) {
		const w = statusWindow(data, input);
		c.maxHp = w.max_hp; // the character at full HP and SP
		c.maxSp = w.max_sp;
	}
	c.passives = input.passives;
	c.attrFix = data.attr_fix;
	c.shieldWeight = input.shieldWeight; // the shield's weight (tenths) and refine: Shield Chain
	c.shieldRefine = input.shieldRefine;
	c.cartWeight = input.cartWeight; // the cart's load (the server's units: tenths of the weight shown)
	c.spheres = input.spheres; // spirit spheres
	c.rage = input.rage; // Force of Vanguard's rage counters
	c.baseStr = input.stats ? input.stats.str : 1;
	if (!sk || lv < 1 || lv > sk.lv.length || SPECIAL_SKILLS.has(skillId)) return null;
	const hit = c.blv + c.total.dex + Math.floor(c.total.luk / 3) + 175 + c.eq.hit;
	return {
		min: skillHitDamage(data, c, mob, skillId, lv, 'min', input.passives),
		max: skillHitDamage(data, c, mob, skillId, lv, 'max', input.passives),
		// a skill that can hit critically (Focused Arrow Strike): its critical hit, every roll at its highest
		crit: CRIT_SKILLS.has(skillId) ? skillHitDamage(data, c, mob, skillId, lv, 'max', input.passives, true) : null,
		// Focused Arrow Strike: 20 Critical more (jRO; the server takes 30 off Hercules' 50)
		critRate: CRIT_SKILLS.has(skillId) ? critChance(c, c.weapon ? c.weapon.type : 0, mob, ...CRIT_SKILLS.get(skillId)) : 0,
		// Throw Spirit Sphere: a hit a sphere held, up to the level (one with none)
		hits: skillId === MO_FINGEROFFENSIVE ? Math.min(Math.max(c.spheres || 0, 1), lv) : Math.abs(skillRow(c, mob, skillId, lv, sk.lv[lv - 1])[2]) || 1,
		hitRate: sk.nk & 0x40 ? 1 : skillHitRate(hit - mob.flee, skillId, lv)
	};
}
