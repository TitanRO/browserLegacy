/**
 * TitanRO damage calculator: a character's normal attack on a monster, with the game server's formulas and tables
 * (data.json, mobs.json). tests/site/calc.test.js checks it against the damage the server computed for the same
 * characters and monsters (tests/site/damage-cases.json).
 *
 * Counted: status ATK, the weapon (ATK, level, refine and over-refine), size and element modifiers (neutral attacks),
 * the monster's DEF, the critical bonus, hit and critical chances, equipment, cards and ammunition (items.js).
 */
import { resolve } from './calc.js';
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
function weaponDamage(data, c, mob, roll, overRoll, ele, nk = 0, equipAtk = true) {
	const type = c.weapon ? c.weapon.type : 0;
	let d = weaponAtk(data, c.total, c.weapon, roll, overRoll);
	// Weapon Perfection: no size penalty
	if (!buffLv(c, BS_WEAPONPERFECT)) d = Math.trunc((d * data.size_fix[mob.size][type]) / 100);
	if (LONG_WEAPONS.has(type)) d += c.eq.arrowAtk || 0; // the ammunition's ATK, after the size fix
	if (c.eq.atkRate) d += Math.trunc((d * c.eq.atkRate) / 100);
	if (equipAtk) d += c.eq.equipAtk;
	if (!(nk & NK_NO_ELEFIX)) d = eleFix(data, d, ele, mob);
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
	let cri = 10 + Math.floor(total.luk / 3) * 10 + eq.cri;
	if (type === W_KATAR) cri *= 2;
	if (LONG_WEAPONS.has(type)) cri += eq.arrowCri || 0; // the ammunition's Critical
	cri -= Math.trunc(mob.lv / 15) + 2 * mob.luk;
	const critRate = Math.min(Math.max(cri, 0), 1000) / 1000;
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
	52, 56, 62, 153, 212, 230, 251, 253, 266, 271, 365, 379, 382, 397, 480, 490, 501, 503, 507, 514, 521, 523, 524, 544,
	2008, 2261, 2477, 2553, 2559, 2570, 2582, 2593, 3007, 3010, 5004, 5032,
	// counters, reflects, traps and area effects; spirit spheres, cart weight and rage counters the probe's characters
	// don't have
	61, 121, 139, 252, 267, 372, 390, 428, 429, 430, 485, 2314, 2476
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

function skillHitDamage(data, c, mob, skillId, lv, roll, passives) {
	const sk = data.weapon_skills[skillId];
	const [ratio, skillEle, num] = sk.lv[lv - 1];
	const type = c.weapon ? c.weapon.type : 0;
	const ele = skillEle >= 0 ? skillEle : attackEle(c); // -1: the weapon's (or an endowment's) element
	if (mob.plant) return num > 1 ? num : 1;
	const batk = sk.nk & NK_NO_ELEFIX ? statusAtk(c.total, type) : eleFix(data, statusAtk(c.total, type), ELE_NEUTRAL, mob);
	const warg = skillId === RA_WUGDASH || skillId === RA_WUGSTRIKE || skillId === RA_WUGBITE;
	// the warg's ATK leaves the equipment's ATK + out (jRO; arrow ATK counts)
	let damage = batk + weaponDamage(data, c, mob, roll, roll, ele, sk.nk, !warg);
	// Tooth of Wug: 10 ATK a level on the Warg skills, before the ratio (jRO; auriga_stats cuts Hercules' 30 to that)
	if (warg) damage += 10 * ((passives && passives[RA_TOOTHOFWUG]) || 0);
	damage += buffAtk(c);
	// Dance with Wug on Warg Strike (and Warg Dash): 10 x level x (2 + the chorus bonus) % more ratio
	const dance = warg ? buffLv(c, WM_DANCE_WITH_WUG) : 0;
	const danceStep = dance ? dance * (2 + chorusBonus(c.performers)) : 0;
	const danceRatio = skillId === RA_WUGBITE ? 0 : 10 * danceStep;
	damage = Math.trunc((damage * (ratio + buffRatio(c) + danceRatio)) / 100);
	// and 2 x level x (2 + the chorus bonus) ATK on the three Warg skills, after the ratio (Hercules battle.cpp)
	damage += 2 * danceStep;
	const skillAtk = (c.eq.skillAtk && c.eq.skillAtk[skillId]) || 0; // the equipment's damage % for this skill
	if (skillAtk) damage += Math.trunc((damage * skillAtk) / 100);
	if (c.eq.longAtkRate && longSkill(sk, lv, skillId)) damage += Math.trunc((damage * c.eq.longAtkRate) / 100);
	if (!(sk.nk & NK_IGNORE_DEF)) damage = applyDef(damage, defOf(c, mob));
	damage += 20 * buffLv(c, LK_AURABLADE);
	const hurts = data.attr_fix[Math.max(mob.element_lv, 1) - 1][ele][mob.element] > 0;
	if (damage < 0) damage = 0;
	if (num > 1) damage *= num;
	// a skill that is Neutral in the skill db (not the weapon's element) takes the element table once more (Hercules
	// renewal's forced Neutral skills: Warg Strike, Warg Bite, ...)
	if (skillEle === ELE_NEUTRAL) damage = eleFix(data, damage, ELE_NEUTRAL, mob);
	if (damage < 1) damage = hurts ? 1 : 0; // at least 1 for the whole attack
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

/** A weapon skill (`skillId` at `lv`) of `input` on `mob`: {min, max} damage, hits, hit chance. */
export function skillAttack(data, input, mob, skillId, lv) {
	const c = { ...resolve(data, input), buffs: input.buffs, performers: input.performers };
	const sk = data.weapon_skills[skillId];
	if (!sk || lv < 1 || lv > sk.lv.length || SPECIAL_SKILLS.has(skillId)) return null;
	const hit = c.blv + c.total.dex + Math.floor(c.total.luk / 3) + 175 + c.eq.hit;
	return {
		min: skillHitDamage(data, c, mob, skillId, lv, 'min', input.passives),
		max: skillHitDamage(data, c, mob, skillId, lv, 'max', input.passives),
		hits: Math.abs(sk.lv[lv - 1][2]) || 1,
		hitRate: sk.nk & 0x40 ? 1 : Math.min(Math.max(hit - mob.flee, MIN_HITRATE), MAX_HITRATE) / 100
	};
}
