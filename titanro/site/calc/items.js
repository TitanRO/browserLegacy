/**
 * TitanRO calculator: equipment, cards and their bonuses. items.json lists every item and card with the bonuses the
 * game server's own script evaluation gives it (exported by TitanRO's server tools: each script run on the server, its
 * bonus calls recorded). Items whose bonuses depend on the job only are evaluated for every job that wears them
 * (`perjob`: groups of jobs and their bonuses); items that depend on level, stats, skills or another slot's refine
 * are marked `varies` and not counted. Sets count once: Hercules' combos (items.json `combos`) and sets written in an
 * item's own script (`partners`: the items it checks for; `sets`: what it adds with each group of them worn, as the
 * server evaluated it). tests/site/calc.test.js checks equipped characters against the server
 * (tests/site/equip-cases.json), a fifth of them built around a set.
 */

/** Equipment slots: [key, label, item location bits]. */
export const SLOTS = [
	['weapon', 'Weapon', 2],
	['shield', 'Shield', 32],
	['armor', 'Armor', 16],
	['garment', 'Garment', 4],
	['shoes', 'Footgear', 64],
	['top', 'Upper headgear', 256],
	['mid', 'Middle headgear', 512],
	['low', 'Lower headgear', 1],
	['acc1', 'Accessory', 8 | 128],
	['acc2', 'Accessory', 8 | 128],
	['ammo', 'Ammunition', 32768]
];

const IT_AMMO = 10;
/** The ammunition type (item subtype) each shooting weapon type loads (battle_check_arrows): bows arrows, guns
 * bullets, grenade launchers grenades. */
export const AMMO_OF = { 11: 1, 17: 3, 18: 3, 19: 3, 20: 3, 21: 5 };

const IT_WEAPON = 4;

/**
 * Items whose effect in some builds differs from their recorded bonuses (found by tests/site's server cases): shown
 * as not counted until the difference is understood.
 */
const UNVERIFIED = new Set([20742]);
const IT_CARD = 6;

/** items.json rows as objects (keyed by id). */
export function itemMap(items) {
	const map = new Map();
	for (const row of items.items) {
		const it = Object.fromEntries(items.columns.map((c, i) => [c, row[i]]));
		it.jobBits = BigInt('0x' + it.jobs);
		// an item whose bonuses depend on the job: per group of jobs (bitmask over data.jobs), what they get
		if (it.bonuses.perjob) it.perjob = it.bonuses.perjob.map(([mask, b]) => [BigInt('0x' + mask), b]);
		map.set(it.id, it);
	}
	return map;
}

/** Whether the job at index `jobIndex` of data.jobs can equip the item. */
export function canEquip(item, jobIndex) {
	return item.type === IT_CARD || ((item.jobBits >> BigInt(jobIndex)) & 1n) === 1n;
}

/**
 * The bonus list of an item at a refine level, or null when it depends on the wearer. An item whose bonuses depend on
 * the job takes those of the group holding `jobIndex` (data.jobs index); null without one.
 */
export function itemBonuses(item, refine, jobIndex = null) {
	let b = item.bonuses;
	if (b.disabled) return [];
	if (b.perjob) {
		const groups = item.perjob || b.perjob.map(([mask, x]) => [BigInt('0x' + mask), x]);
		const g = jobIndex == null ? null : groups.find(([mask]) => ((mask >> BigInt(jobIndex)) & 1n) === 1n);
		if (!g) return null;
		b = g[1];
	}
	if (b.fixed) return b.fixed;
	if (b.ref) return b.ref[Math.min(refine || 0, b.ref.length - 1)];
	return null;
}

// Race ids (the server's enum Race) and their masks (map->race_id2mask)
const RC_MAX = 14;
const RC_BOSS = 12;
const RC_NONBOSS = 13;
const RACE_COMBOS = {
	15: 0b00111111111 | (1 << 10) | (1 << 11), // RC_NONDEMIHUMAN: all but Demi-Human, both players
	16: 0b01111111111, // RC_NONPLAYER: base races
	17: (1 << 7) | (1 << 10), // RC_DEMIPLAYER
	18: 0b01101111111, // RC_NONDEMIPLAYER
	19: (1 << 10) | (1 << 11), // RC_PLAYERS
	255: (1 << RC_BOSS) | (1 << RC_NONBOSS) // RC_ALL
};
RACE_COMBOS[15] = RACE_COMBOS[18] | RACE_COMBOS[19];
function raceMask(race) {
	if (race >= 0 && race < RC_MAX) return 1 << race;
	return RACE_COMBOS[race] || 0;
}

/** Bonuses that change nothing the calculator shows (defense, healing, casting, drops, ...): listed as "other". */
const OTHER = new Set([
	'SP_SUBELE', 'SP_SUBRACE', 'SP_SUBSIZE', 'SP_SKILL_HEAL', 'SP_SKILL_HEAL2', 'SP_RESEFF', 'SP_ADD_MONSTER_DROP_ITEM',
	'SP_VARCASTRATE', 'SP_FIXCASTRATE', 'SP_DELAYRATE', 'SP_UNBREAKABLE_WEAPON', 'SP_UNBREAKABLE_HELM',
	'SP_UNBREAKABLE_ARMOR', 'SP_UNBREAKABLE_GARMENT', 'SP_UNBREAKABLE_SHOES', 'SP_UNBREAKABLE_SHIELD', 'SP_SKILL_USE_SP',
	'SP_SKILL_USE_SP_RATE', 'SP_AUTOSPELL', 'SP_AUTOSPELL_WHENHIT', 'SP_AUTOSPELL_ONSKILL', 'SP_EXP_ADDRACE',
	'SP_SUB_DEF_ELE', 'SP_MAGIC_SUB_DEF_ELE', 'SP_SKILL_COOLDOWN', 'SP_ADDEFF', 'SP_ADDEFF2', 'SP_ADDEFF_WHENHIT',
	'SP_HP_GAIN_VALUE', 'SP_SP_GAIN_VALUE', 'SP_SP_GAIN_RACE', 'SP_MAGIC_HP_GAIN_VALUE', 'SP_MAGIC_SP_GAIN_VALUE',
	'SP_ADD_HEAL_RATE', 'SP_ADD_HEAL2_RATE', 'SP_LONG_ATK_DEF', 'SP_NEAR_ATK_DEF', 'SP_MAGIC_ATK_DEF', 'SP_MISC_ATK_DEF',
	'SP_SHORT_WEAPON_DAMAGE_RETURN', 'SP_LONG_WEAPON_DAMAGE_RETURN', 'SP_MAGIC_DAMAGE_RETURN', 'SP_HP_RECOV_RATE',
	'SP_SP_RECOV_RATE', 'SP_SPRATE', 'SP_HPRATE', 'SP_SPEED_RATE', 'SP_SPEED_ADDRATE', 'SP_HP_DRAIN_RATE',
	'SP_SP_DRAIN_RATE', 'SP_HP_DRAIN_VALUE', 'SP_SP_DRAIN_VALUE', 'SP_MAGIC_ADDRACE', 'SP_MAGIC_ADDELE',
	'SP_MAGIC_ADDSIZE', 'SP_MAGIC_ATK_ELE', 'SP_IGNORE_MDEF_RATE', 'SP_IGNORE_MDEF_ELE', 'SP_MATK_RATE', 'SP_ADD_STEAL_RATE',
	'SP_GET_ZENY_NUM', 'SP_ADD_GET_ZENY_NUM', 'SP_ITEMHEAL_RATE', 'SP_ITEMGROUPHEALRATE', 'SP_WEAPON_COMA_ELE',
	'SP_WEAPON_COMA_RACE', 'SP_BREAK_WEAPON_RATE', 'SP_BREAK_ARMOR_RATE', 'SP_NO_KNOCKBACK', 'SP_NO_GEMSTONE',
	'SP_INTRAVISION', 'SP_NO_WALK_DELAY', 'SP_UNSTRIPABLE', 'SP_UNSTRIPABLE_WEAPON', 'SP_UNSTRIPABLE_ARMOR',
	'SP_UNSTRIPABLE_HELM', 'SP_UNSTRIPABLE_SHIELD', 'SP_SP_VANISH_RATE', 'SP_HP_VANISH_RATE', 'SP_NO_SIZEFIX_X',
	'SP_ADD_ITEM_HEAL_RATE', 'SP_SKILL_VARIABLECAST', 'SP_SKILL_FIXEDCAST', 'SP_FIXCASTRATE', 'SP_VARCASTRATE',
	'SP_CASTRATE', 'SP_ADD_FIXEDCAST', 'SP_ADD_VARIABLECAST', 'SP_HP_LOSS_RATE', 'SP_SP_LOSS_RATE', 'SP_HP_REGEN_RATE',
	'SP_SP_REGEN_RATE', 'SP_SP_GAIN_RACE_ATTACK', 'SP_HP_GAIN_RACE_ATTACK', 'SP_ADD_DEF_MONSTER', 'SP_ADD_MDEF_MONSTER',
	'SP_ADD_MDAMAGE_CLASS', 'SP_ADD_ITEM_GROUP_HEAL_RATE', 'SP_ADD_SKILL_BLOW', 'SP_SKILL_USE_SP_RATE'
]);

/**
 * Sums the bonuses of equipped items (each {item, refine, cards: [card items]}; `weaponType` the weapon type when no
 * weapon item is worn, for the ammunition): the totals the calculator applies,
 * the item DEF and refine DEF, and per item what isn't counted (`notCounted`) or doesn't show here (`other`).
 */
export function sumEquipment(data, equips, combos = [], weaponType = null, jobIndex = null) {
	const t = {
		param: [0, 0, 0, 0, 0, 0], // from equipment and cards
		paramEquip: [0, 0, 0, 0, 0, 0], // from equipment scripts only (not cards): auriga adds VIT/INT to MaxHP/SP
		maxhp: 0, maxsp: 0, hprate: 100, sprate: 100,
		def: 0, mdef: 0, hit: 0, flee: 0, flee2: 0, cri: 0,
		equipAtk: 0, watk: 0, latk: 0, ematk: 0, aspdRate: 0, aspdAdd: 0,
		atkRate: 0, critAtkRate: 0, longAtkRate: 0,
		addrace: new Array(RC_MAX).fill(0), addele: new Array(10).fill(0), addsize: [0, 0, 0],
		ignoreDef: new Array(RC_MAX).fill(0), weaponEle: 0, arrowAtk: 0, arrowCri: 0, doubleRate: 0, doubleAddRate: 0,
		varCastRate: 0, fixCastRate: 0, addVarCast: 0, addFixCast: 0, delayRate: 0,
		skillCast: {}, skillFixCastRate: {}, skillVarCast: {}, skillFixCast: {}, skillAtk: {},
		refineDef: 0, notCounted: [], other: []
	};
	const weapon = equips.find((e) => e && e.item && e.item.type === IT_WEAPON);
	const wtype = weapon ? weapon.item.sub : weaponType; // the weapon slot's, else the page's weapon type
	// what's worn (cards count), for sets
	const have = new Map();
	const names = new Map();
	const off = new Set(); // disabled on field maps: no set with them counts
	for (const e of equips) {
		if (!e || !e.item) continue;
		if (e.item.bonuses.disabled) off.add(e.item.id);
		for (const x of [e.item].concat((e.cards || []).filter(Boolean))) {
			have.set(x.id, (have.get(x.id) || 0) + 1);
			names.set(x.id, x.name);
		}
	}
	for (const e of equips) {
		if (!e || !e.item) continue;
		const it = e.item;
		const disabled = !!it.bonuses.disabled; // the item gives nothing on field maps; its cards still count
		if (it.type === IT_AMMO) {
			// ammunition counts in a weapon that shoots it (a bow's arrows, a gun's bullets): its ATK and its script
			// (lr_flag 2): its element becomes the weapon's, its Critical counts for its attacks only
			if (AMMO_OF[wtype] !== it.sub) {
				t.other.push(`${it.name}: not shot by this weapon`);
				continue;
			}
			t.arrowAtk += it.atk;
		}
		if (disabled) t.other.push(`${it.name}: disabled on field maps`);
		if (!disabled && it.type !== IT_WEAPON && it.type !== IT_CARD) {
			t.def += it.def;
			if (it.refinable && e.refine) t.refineDef += data.refine_armor[e.refine];
		}
		// a shield's own script (lr_flag 3) gives no weapon-hand bonuses; its cards go to the left hand (lr_flag 1),
		// whose race/element/size % the server adds to the right hand's (left_cardfix_to_right)
		const shield = it.type !== IT_WEAPON && (it.loc & 32) !== 0;
		const sources = (disabled ? [] : [[it, e.refine, false]]).concat((e.cards || []).filter(Boolean).map((c) => [c, e.refine, true]));
		for (const [src, refine, isCard] of sources) {
			if (UNVERIFIED.has(src.id)) {
				t.notCounted.push(`${src.name}: not verified against the server yet`);
				continue;
			}
			if (src.bonuses.onequip) t.notCounted.push(`${src.name}: an effect started when it's put on`);
			const list = itemBonuses(src, refine, jobIndex);
			if (list === null) {
				t.notCounted.push(`${src.name}: depends on the wearer`);
				continue;
			}
			const where = it.type === IT_AMMO ? 'ammo' : shield ? (isCard ? 'card' : 'script') : '';
			for (const b of list) apply(t, b, src, isCard, where);
			// a set written in its own script: what it adds with the worn items it checks for
			const worn = (src.bonuses.partners || []).filter((id) => (have.get(id) || 0) > (id === src.id ? 1 : 0)); // itself: a second one
			if (worn.length) {
				const set = (src.bonuses.sets || []).find(([p]) => p.length === worn.length && p.every((id) => worn.includes(id)));
				if (set) for (const b of set[1]) apply(t, b, src, isCard, where);
				else t.notCounted.push(`${src.name}: a set effect with other worn items`);
			}
		}
	}
	// item combos (sets): every listed item equipped (cards count), each combo once; the server runs their scripts
	// after the equipment's, as neither an equipment script nor a weapon hand's (stats count as a card's)
	for (const [ids, b] of combos) {
		const need = new Map();
		for (const id of ids) need.set(id, (need.get(id) || 0) + 1);
		if (![...need].every(([id, n]) => (have.get(id) || 0) >= n) || ids.some((id) => off.has(id))) continue;
		const label = 'Set bonus (' + ids.map((id) => names.get(id) || id).join(' + ') + ')';
		if (!b.fixed) {
			t.notCounted.push(label + ': depends on the wearer');
			continue;
		}
		for (const x of b.fixed) apply(t, x, { name: label }, true, '');
	}
	t.def += Math.trunc((t.refineDef + 50) / 100);
	return t;
}

/** Bonuses kept in the hand's weapon data (Hercules' right_weapon / left_weapon): the left hand's don't count here. */
const WEAPON_HAND = new Set(['SP_ADDRACE', 'SP_ADDELE', 'SP_ADDSIZE', 'SP_ATK1', 'SP_ATKELE', 'SP_ADDRACE2', 'SP_ADD_DAMAGE_CLASS']);

/** Cast and delay bonuses, kept as the server keeps them (pc_bonus / pc_bonus2 with RENEWAL_CAST). */
const CAST_BONUS = new Set(['SP_VARCASTRATE', 'SP_CASTRATE', 'SP_FIXCASTRATE', 'SP_ADD_VARIABLECAST', 'SP_ADD_FIXEDCAST',
	'SP_SKILL_VARIABLECAST', 'SP_SKILL_FIXEDCAST', 'SP_DELAYRATE']);
function castBonus(t, name, args) {
	const val = args[args.length - 1];
	const per = args.length > 1 ? args[0] : null; // bonus2: one skill
	const add = (o, k, v) => { o[k] = (o[k] || 0) + v; };
	switch (name) {
		case 'SP_VARCASTRATE': if (per === null) t.varCastRate -= val; else add(t.skillCast, per, -val); return;
		case 'SP_CASTRATE': add(t.skillCast, per, val); return; // bonus2 bCastrate: the same per-skill rate, other sign
		case 'SP_FIXCASTRATE': if (per === null) t.fixCastRate -= val; else add(t.skillFixCastRate, per, -val); return;
		case 'SP_ADD_VARIABLECAST': t.addVarCast += val; return;
		case 'SP_ADD_FIXEDCAST': t.addFixCast += val; return;
		case 'SP_SKILL_VARIABLECAST': add(t.skillVarCast, per, val); return;
		case 'SP_SKILL_FIXEDCAST': add(t.skillFixCast, per, val); return;
		case 'SP_DELAYRATE': t.delayRate += val; return;
	}
}

// battle flags (Hercules map/battle.h)
const BF_WEAPON = 0x0001, BF_MAGIC = 0x0002, BF_MISC = 0x0004, BF_SHORT = 0x0010, BF_LONG = 0x0040, BF_SKILL = 0x0100, BF_NORMAL = 0x0200;
const BF_WEAPONMASK = 0x000f, BF_RANGEMASK = 0x00f0, BF_SKILLMASK = 0x0f00;
/** Whether bonus3 bAddEle's flag, completed as pc_bonus_addele does, covers every weapon attack. */
function addEleCovers(flag) {
	let f = flag;
	if (!(f & BF_RANGEMASK)) f |= BF_SHORT | BF_LONG;
	if (!(f & BF_WEAPONMASK)) f |= BF_WEAPON;
	if (!(f & BF_SKILLMASK)) {
		if (f & (BF_MAGIC | BF_MISC)) f |= BF_SKILL;
		if (f & BF_WEAPON) f |= BF_NORMAL | BF_SKILL;
	}
	return (f & BF_WEAPON) !== 0 && (f & BF_SHORT) !== 0 && (f & BF_LONG) !== 0 && (f & BF_NORMAL) !== 0 && (f & BF_SKILL) !== 0;
}

function apply(t, b, src, isCard, shield = '') {
	const [name, ...args] = b;
	if (shield === 'script' && WEAPON_HAND.has(name)) return;
	if (shield === 'card' && (name === 'SP_ATK1' || name === 'SP_ATKELE')) {
		if (name === 'SP_ATK1') t.latk += args[args.length - 1]; // the left hand's weapon ATK: in the status window only
		return;
	}
	const val = args[args.length - 1];
	if (shield === 'ammo' && name === 'SP_CRITICAL') {
		t.arrowCri += val * 10;
		return;
	}
	if (CAST_BONUS.has(name) && !(name === 'SP_CASTRATE' && args.length < 2)) {
		if (shield === 'ammo') return; // not from ammunition (lr_flag 2)
		castBonus(t, name, args);
		return;
	}
	if (name === 'SP_SKILL_ATK') {
		if (shield !== 'ammo') t.skillAtk[args[0]] = (t.skillAtk[args[0]] || 0) + val; // bonus2 bSkillAtk: one skill's damage %
		return;
	}
	if (name === 'SP_DOUBLE_RATE' || name === 'SP_DOUBLE_ADD_RATE') {
		if (shield) return; // the weapon hand's only (lr_flag 0)
		if (name === 'SP_DOUBLE_RATE') t.doubleRate = Math.max(t.doubleRate, val);
		else t.doubleAddRate += val;
		return;
	}
	const a1 = args[0];
	const a2 = args[1];
	const stat = ['SP_STR', 'SP_AGI', 'SP_VIT', 'SP_INT', 'SP_DEX', 'SP_LUK'].indexOf(name);
	if (stat >= 0) {
		t.param[stat] += val;
		if (!isCard) t.paramEquip[stat] += val;
		return;
	}
	switch (name) {
		case 'SP_ALL_STATS':
			for (let i = 0; i < 6; i++) { t.param[i] += val; if (!isCard) t.paramEquip[i] += val; }
			return;
		case 'SP_AGI_VIT':
			t.param[1] += val; t.param[2] += val;
			if (!isCard) { t.paramEquip[1] += val; t.paramEquip[2] += val; }
			return;
		case 'SP_MAXHP': t.maxhp += val; return;
		case 'SP_MAXSP': t.maxsp += val; return;
		case 'SP_MAXHPRATE': t.hprate += val; return;
		case 'SP_MAXSPRATE': t.sprate += val; return;
		case 'SP_DEF1': t.def += val; return;
		case 'SP_MDEF1': t.mdef += val; return;
		case 'SP_HIT': t.hit += val; return;
		case 'SP_FLEE1': t.flee += val; return;
		case 'SP_FLEE2': t.flee2 += val * 10; return;
		case 'SP_CRITICAL': t.cri += val * 10; return;
		case 'SP_BASE_ATK': t.equipAtk += val; return;
		case 'SP_ATK1': t.watk += val; return;
		case 'SP_EMATK': t.ematk += val; return;
		case 'SP_ASPD_RATE': t.aspdRate += val; return;
		case 'SP_ASPD': t.aspdAdd -= 10 * val; return;
		case 'SP_ATK_RATE': t.atkRate += val; return;
		case 'SP_CRIT_ATK_RATE': t.critAtkRate += val; return;
		case 'SP_LONG_ATK_RATE': t.longAtkRate += val; return;
		case 'SP_ATKELE': t.weaponEle = val; return;
		case 'SP_ADDRACE': {
			const m = raceMask(a1);
			for (let r = 0; r < RC_MAX; r++) if (m & (1 << r)) t.addrace[r] += val;
			return;
		}
		case 'SP_ADDELE': {
			// bonus2 bAddEle,e,n; bonus3 bAddEle,e,n,flag (the rate is the second value): the flag as the server completes
			// it (pc_bonus_addele) must cover weapon attacks, near and far, normal and skill, for the calculator to count it
			let rate = val;
			if (args.length >= 3) {
				rate = args[1];
				if (!addEleCovers(args[2])) {
					t.notCounted.push(`${src.name}: element damage for some attacks only`);
					return;
				}
			}
			if (a1 === 255) for (let e = 0; e < 10; e++) t.addele[e] += rate; // ELE_ALL
			else if (a1 >= 0 && a1 < 10) t.addele[a1] += rate;
			return;
		}
		case 'SP_ADDSIZE':
			if (a1 === 3) for (let z = 0; z < 3; z++) t.addsize[z] += val; // Size_All
			else if (a1 >= 0 && a1 < 3) t.addsize[a1] += val;
			return;
		case 'SP_IGNORE_DEF_RATE': {
			const m = raceMask(a1);
			for (let r = 0; r < RC_MAX; r++) if (m & (1 << r)) t.ignoreDef[r] += val;
			return;
		}
		default:
			(OTHER.has(name) ? t.other : t.notCounted).push(`${src.name}: ${name.replace(/^SP_/, '')}${a2 === undefined ? '' : ''}`);
	}
}

export { RC_BOSS, RC_NONBOSS };
