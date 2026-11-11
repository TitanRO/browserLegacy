/**
 * TitanRO calculator: party and self buffs. data.json `buffs` holds, per buff skill and level, what the game server
 * gives in the status window: the stats it adds (`param`, counted the way the server counts a status effect's
 * stats), flat bonuses (fields named as the equipment totals of items.js), `aspdHaste` (the status-effect ASPD %)
 * and `vitDefRate` (Angelus), measured on the server with and without the buff (TitanRO's tools/calc/export.py);
 * null for a level that depends on the caster (their job level or stats). ATTACK_BUFFS change attacks only
 * (damage.js). tests/site/calc.test.js checks normal attacks with buffs against the server.
 */
import { NO_EQUIPMENT, jobById, jobBonus } from './calc.js';

/** The buffs the calculator offers, in the order the page lists them. */
export const BUFF_ORDER = [34, 29, 33, 75, 66, 2041, 2042, 155, 111, 112, 113, 45, 60, 258, 355, 380, 383, 8,
	319, 320, 321, 322, 327, 329, 330, 2350, 2351, 2381, 2382, 2431, 5007, 2428, 68, 138, 280, 281, 282, 283];
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

const AC_CONCENTRATION = 45;
const AB_CLEMENTIA = 2041;
const AB_CANTO = 2042;
const BA_POEMBRAGI = 321;
const BA_APPLEIDUN = 322;
const DC_FORTUNEKISS = 329;
const DC_SERVICEFORYOU = 330;
const WA_SWING_DANCE = 2350;
const WA_SYMPHONY_OF_LOVER = 2351;
const MI_RUSH_WINDMILL = 2381;
const MI_ECHOSONG = 2382;
const WM_LERADS_DEW = 2431;
const WM_FRIGG_SONG = 5007;
/** Buffs counted by formula (the caster's or the character's own levels and stats), not data.json's table. */
export const FORMULA_BUFFS = new Set([AC_CONCENTRATION, AB_CLEMENTIA, AB_CANTO, BA_APPLEIDUN, DC_SERVICEFORYOU, WA_SWING_DANCE,
	WA_SYMPHONY_OF_LOVER, MI_RUSH_WINDMILL, MI_ECHOSONG, WM_LERADS_DEW, WM_FRIGG_SONG]);
/** Songs that end each other (one of each group at a time): the Bard and Dancer songs; the Voice Lesson songs. */
export const SONG_GROUPS = [[319, 320, 321, 322, 327, 329, 330], [2350, 2351, 2352, 2381, 2382]];

/** The buffs whose strength the page asks the caster's levels for: {skill id: the caster inputs it reads}. */
export const BUFF_CASTER = {
	[AB_CLEMENTIA]: ['blessing', 'jlv'], [AB_CANTO]: ['incagi', 'jlv'],
	[WA_SWING_DANCE]: ['lesson'], [WA_SYMPHONY_OF_LOVER]: ['lesson'], [MI_RUSH_WINDMILL]: ['lesson'], [MI_ECHOSONG]: ['lesson']
};

/**
 * What the formula buffs read: the character's job level and base + job-bonus stats ([str, agi, vit, int, dex,
 * luk]), and the caster's levels (`caster`: blessing, incagi, jlv: an Arch Bishop's Blessing and Increase AGI levels
 * and job level; lesson: a Wanderer's or Minstrel's Voice Lesson level).
 */
export function buffContext(data, input, caster = {}) {
	const job = typeof input.job === 'object' ? input.job : jobById(data, input.job);
	const bonus = job ? jobBonus(job, input.jlv) : [0, 0, 0, 0, 0, 0];
	const base = ['str', 'agi', 'vit', 'int', 'dex', 'luk'].map((k, i) => input.stats[k] + bonus[i]);
	return { jlv: input.jlv, base, caster };
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
export function withBuffs(data, eq, levels, weaponType, names = new Map(), performers = 0, ctx = null) {
	const base = eq || NO_EQUIPMENT;
	const t = { ...base, buffParam: (base.buffParam || [0, 0, 0, 0, 0, 0]).slice(), notCounted: base.notCounted.slice() };
	const lv = (id) => (levels && levels[id] > 0 ? levels[id] : 0);
	const caster = (ctx && ctx.caster) || {};
	const lesson = Math.max(0, Math.trunc(caster.lesson) || 0);
	const jlv = ctx ? ctx.jlv : 50;
	// MaxHP / MaxSP after the equipment's rates, in the server's order (status_calc_maxhp): Apple of Idun %, Lerad's
	// Dew, Frigg's Song %
	t.scMaxHp = [];
	if (lv(BA_APPLEIDUN)) t.scMaxHp.push(['rate', lv(BA_APPLEIDUN) < 10 ? 9 + lv(BA_APPLEIDUN) : 20]);
	if (lv(WM_LERADS_DEW)) t.scMaxHp.push(['add', 200 * lv(WM_LERADS_DEW) + 300 * chorusBonus(performers)]);
	if (lv(WM_FRIGG_SONG)) t.scMaxHp.push(['rate', 5 * lv(WM_FRIGG_SONG)]);
	t.scMaxSpRate = lv(DC_SERVICEFORYOU) ? (lv(DC_SERVICEFORYOU) < 10 ? 9 + lv(DC_SERVICEFORYOU) : 20) : 0;
	// the Wanderer and Minstrel songs: 5 / 12 / 6 / 6 % a level + the Voice Lesson level + the character's job level
	if (lv(WA_SWING_DANCE)) t.aspdHaste = Math.max(t.aspdHaste || 0, 5 * lv(WA_SWING_DANCE) + lesson);
	if (lv(WA_SYMPHONY_OF_LOVER)) t.mdefRate = 12 * lv(WA_SYMPHONY_OF_LOVER) + lesson + Math.trunc(jlv / 4);
	if (lv(MI_RUSH_WINDMILL)) t.watk = (t.watk || 0) + 6 * lv(MI_RUSH_WINDMILL) + lesson + Math.trunc(jlv / 5);
	if (lv(MI_ECHOSONG)) t.defRate = 6 * lv(MI_ECHOSONG) + lesson + Math.trunc(jlv / 4);
	// Concentration: 2 + level % of AGI and DEX, of the base and job bonus (not the equipment's)
	if (lv(AC_CONCENTRATION) && ctx) {
		const pct = 2 + lv(AC_CONCENTRATION);
		t.buffParam[1] += Math.trunc((ctx.base[1] * pct) / 100);
		t.buffParam[4] += Math.trunc((ctx.base[4] * pct) / 100);
	}
	// Clementia and Canto Candidus: Blessing and Increase AGI at the caster's level + their job level / 10
	const blessing = Math.max(lv(AB_CLEMENTIA) ? (caster.blessing || 0) + Math.trunc((caster.jlv || 0) / 10) : 0, 0);
	const incagi = lv(AB_CANTO) ? (caster.incagi || 0) + Math.trunc((caster.jlv || 0) / 10) : 0;
	// Fortune's Kiss: 2 % a level more critical damage (battle.cpp, on critical hits)
	if (lv(DC_FORTUNEKISS)) t.critAtkRate = (t.critAtkRate || 0) + 2 * lv(DC_FORTUNEKISS);
	// Poem of Bragi: 2 % a level off variable cast time, 3 % a level off after-cast delay (damage.js skillTimes)
	if (lv(BA_POEMBRAGI)) t.bragi = lv(BA_POEMBRAGI);
	if (levels && levels[WM_DANCE_WITH_WUG] > 0) {
		// Dance with Wug, as auriga_stats counts it: 2 + the chorus bonus % ASPD (a haste: the strongest counts), and
		// 20 + 10 x the chorus bonus % off fixed cast times (the largest of such reductions counts); the Warg skills'
		// damage in damage.js
		const chorus = chorusBonus(performers);
		t.aspdHaste = Math.max(t.aspdHaste || 0, 2 + chorus);
		t.fixCastLargest = Math.max(t.fixCastLargest || 0, 20 + 10 * chorus);
	}
	// Clementia is Blessing and Canto Candidus Increase AGI (one status effect each): the server compares the levels
	// they start with (the caster's Blessing / Increase AGI level, before the job level part), a lower one doesn't
	// replace a higher one
	const clementia = lv(AB_CLEMENTIA) > 0 && (caster.blessing || 0) >= lv(34);
	const canto = lv(AB_CANTO) > 0 && (caster.incagi || 0) >= lv(29);
	if (clementia) {
		t.buffParam[0] += blessing; t.buffParam[3] += blessing; t.buffParam[4] += blessing;
	}
	if (canto) t.buffParam[1] += 2 + incagi;
	for (const [id, lv, b] of buffEffects(data, levels, weaponType)) {
		if (FORMULA_BUFFS.has(id)) continue;
		if ((id === 34 && clementia) || (id === 29 && canto)) continue;
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
