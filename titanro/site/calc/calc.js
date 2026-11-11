/**
 * TitanRO stat calculator: a character's status window, from data.json (the game server's own tables, exported by
 * TitanRO's server tools) and the server's formulas. tests/site/calc.test.js checks every field against what the
 * server computes for the same characters (tests/site/calc-cases.json).
 *
 * Inputs: { job, blv, jlv, stats: {str, agi, vit, int, dex, luk}, weapon?: {type, atk, matk, wlv, refine},
 * shield?: bool, equipDef?, equipMdef? }. Equipment beyond a weapon's ATK/MATK and a shield (cards, item bonuses,
 * buffs and passive skills) isn't counted.
 */

export const STATS = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];

export const WEAPON_TYPES = [
	'Bare hands', 'Dagger', 'One-handed sword', 'Two-handed sword', 'One-handed spear', 'Two-handed spear',
	'One-handed axe', 'Two-handed axe', 'Mace', 'Two-handed mace', 'Staff', 'Bow', 'Knuckle', 'Instrument', 'Whip',
	'Book', 'Katar', 'Revolver', 'Rifle', 'Gatling gun', 'Shotgun', 'Grenade launcher', 'Huuma shuriken',
	'Two-handed staff'
];

const W_BOW = 11;
/** Bows, instruments, whips and guns use DEX where other weapons use STR. */
const DEX_WEAPONS = new Set([11, 13, 14, 17, 18, 19, 20, 21]);

/** Doram (Summoner, Baby Summoner) jobs: perfect dodge from LUK x 1.2. */
const SUMMONER_JOBS = new Set([4218, 4220]);

export function jobById(data, id) {
	return data.jobs.find((j) => j.id === id);
}

/** Status points needed to raise a stat from `from` to `to` (renewal costs). */
export function statCost(from, to) {
	let sp = 0;
	for (let low = from; low < to; low++) sp += low < 100 ? 2 + Math.floor((low - 1) / 10) : 16 + 4 * Math.floor((low - 100) / 5);
	return sp;
}

/** Status points a character of this job and base level has in all (stats all at 1). */
export function totalStatPoints(data, job, blv) {
	return data.statp[blv] + (job.upper ? 52 : 0);
}

export function spentStatPoints(stats) {
	return STATS.reduce((n, s) => n + statCost(1, stats[s]), 0);
}

/** The job's stat bonus at a job level: [str, agi, vit, int, dex, luk]. */
export function jobBonus(job, jlv) {
	return job.bonus[Math.min(Math.max(jlv, 1), job.maxjlv) - 1];
}

function clampInt(v, lo, hi) {
	return Math.min(Math.max(v, lo), hi);
}

/** The attack delay (ms x 10, as the server's amotion): auriga RR's ASPD formula with the job's base for the weapon. */
export function attackDelay(data, job, input, total, eq = NO_EQUIPMENT) {
	const type = input.weapon ? input.weapon.type : 0;
	const base = job.aspd[type];
	if (!base) return null; // the job can't use this weapon type
	const penalty = base > 144 ? 100 - (base - 144) * 2 : 100;
	const agi = total.agi;
	const dex = total.dex;
	const s = DEX_WEAPONS.has(type)
		? Math.sqrt(agi * (10 - 1 / 400) + Math.floor(dex * 9) / 49)
		: Math.sqrt(agi * (10 + 10 / 111) + Math.floor(dex * 9) / 49);
	let amotion = 2000 - Math.trunc(base + (s * penalty) / 100) * 10;
	if (input.shield && job.shield) amotion += job.shield;
	// equipment: ASPD + % (bAspdRate) and ASPD + n (bAspd, -10 ms each)
	if (eq.aspdRate) amotion = (amotion * (100 - eq.aspdRate)) / 100;
	amotion += eq.aspdAdd;
	amotion = Math.ceil(amotion);
	let min = job.maxaspd;
	if (input.blv < 100) min = Math.max(min, data.max_aspd);
	return clampInt(amotion, min, 2000);
}

/**
 * The status window for `input`, with the same fields as the server's (the mechanics probe's status record):
 * atk1 (status ATK) + atk2 (weapon ATK), matk1 (weapon MATK) + matk2 (status MATK), def1/def2 (soft/hard DEF),
 * mdef1/mdef2, hit, flee1, flee2 (perfect dodge), cri, amotion, max_hp, max_sp and the total stats.
 */
export const NO_EQUIPMENT = {
	param: [0, 0, 0, 0, 0, 0], paramEquip: [0, 0, 0, 0, 0, 0], maxhp: 0, maxsp: 0, hprate: 100, sprate: 100,
	def: 0, mdef: 0, hit: 0, flee: 0, flee2: 0, cri: 0, equipAtk: 0, watk: 0, latk: 0, ematk: 0, aspdRate: 0, aspdAdd: 0,
	atkRate: 0, critAtkRate: 0, longAtkRate: 0, addrace: new Array(14).fill(0), addele: new Array(10).fill(0),
	addsize: [0, 0, 0], ignoreDef: new Array(14).fill(0), weaponEle: 0, arrowAtk: 0, arrowCri: 0, doubleRate: 0, doubleAddRate: 0,
	varCastRate: 0, fixCastRate: 0, addVarCast: 0, addFixCast: 0, delayRate: 0, skillCast: {}, skillFixCastRate: {},
	skillVarCast: {}, skillFixCast: {}, notCounted: [], other: []
};

/**
 * The character as the formulas need it: job, levels, total stats, weapon ({type, atk, matk, wlv, refine}), shield,
 * and the equipment's summed bonuses (`eq`, from items.js sumEquipment; none when input.eq is absent).
 */
export function resolve(data, input) {
	const job = typeof input.job === 'object' ? input.job : jobById(data, input.job);
	if (!job) throw new Error('unknown job ' + input.job);
	const blv = clampInt(input.blv, 1, job.maxblv);
	const jlv = clampInt(input.jlv, 1, job.maxjlv);
	const eq = input.eq || NO_EQUIPMENT;
	const bonus = jobBonus(job, jlv);
	const total = {};
	STATS.forEach((s, i) => {
		total[s] = input.stats[s] + bonus[i] + eq.param[i];
	});
	let weapon = input.weapon || null;
	if (weapon && eq.watk) weapon = { ...weapon, atk: weapon.atk + eq.watk };
	return { job, blv, jlv, total, weapon, shield: !!input.shield, eq };
}

export function statusWindow(data, input) {
	const { job, blv, total, weapon, shield, eq } = resolve(data, input);
	const type = weapon ? weapon.type : 0;
	const dexWeapon = DEX_WEAPONS.has(type);

	// status ATK: Str (Dex for bows, instruments, whips and guns) + Dex (Str) / 5 + Luk / 3
	const main = dexWeapon ? total.dex : total.str;
	const second = dexWeapon ? total.str : total.dex;
	const atk1 = Math.floor(main + second / 5 + total.luk / 3);

	let atk2 = eq.equipAtk + (eq.latk || 0);
	let matk1 = eq.ematk;
	if (weapon) {
		const refine = weapon.refine ? data.refine[Math.min(weapon.wlv, data.refine.length) - 1][weapon.refine] : 0;
		atk2 += weapon.atk + refine;
		matk1 += weapon.matk + (type !== W_BOW ? refine : 0);
	}

	const matk2 = total.int + Math.floor(Math.floor(total.int / 7) ** 2 / 3) + Math.floor(total.dex / 5) + Math.floor(total.luk / 3);

	const def1 = Math.floor((blv + total.vit) / 2 + total.agi / 5);
	const mdef1 = Math.floor(total.int + blv / 4 + (total.dex + total.vit) / 5);
	const hit = blv + total.dex + Math.floor(total.luk / 3) + 175 + eq.hit;
	const flee1 = blv + total.agi + Math.floor(total.luk / 5) + 100 + eq.flee;
	const flee2 = Math.floor(((SUMMONER_JOBS.has(job.id) ? Math.floor((total.luk * 120) / 100) + 10 : total.luk + 10) * 1 + eq.flee2) / 10);
	const cri = 10 + Math.floor(total.luk / 3) * 10 + eq.cri;

	const rate = job.upper ? 125 : job.baby ? 70 : 100;
	const hpBase = data.tables[job.hp][blv - 1];
	const spBase = data.tables[job.sp][blv - 1];
	// auriga: the base with VIT (INT) %, the class rate; VIT (INT) from equipment scripts (not cards) once more, flat
	let maxHp = Math.floor((Math.floor((hpBase * (100 + total.vit)) / 100) * rate) / 100) + eq.paramEquip[2];
	let maxSp = Math.floor(((Math.floor((spBase * (100 + total.int)) / 100) + eq.paramEquip[3]) * rate) / 100);
	maxHp = Math.max(0, maxHp + eq.maxhp);
	maxSp = Math.max(0, maxSp + eq.maxsp);
	if (eq.hprate !== 100) maxHp = Math.floor((maxHp * Math.max(eq.hprate, 0)) / 100);
	if (eq.sprate !== 100) maxSp = Math.floor((maxSp * Math.max(eq.sprate, 0)) / 100);
	maxHp = Math.max(maxHp, 1);
	maxSp = Math.max(maxSp, 1);

	return {
		atk1,
		atk2,
		matk1,
		matk2,
		def1,
		def2: (input.equipDef || 0) + eq.def,
		mdef1,
		mdef2: Math.max((input.equipMdef || 0) + eq.mdef, 0), // the client gets 0 for less (clif_updatestatus)
		hit,
		flee1,
		flee2,
		cri: Math.floor(cri / 10),
		amotion: attackDelay(data, job, { ...input, blv, shield, weapon }, total, eq),
		max_hp: maxHp,
		max_sp: maxSp,
		...total
	};
}

/** ASPD as the client shows it (200 - delay / 10). */
export function aspd(amotion) {
	return amotion == null ? null : Math.floor((2000 - amotion) / 10);
}
