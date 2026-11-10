/**
 * Plugins/Helpers/InfoCore.js
 *
 * The information panels' state and text (Build-in roadmap track A): target, exp tracker, loot alerts, damage log
 * and MVP timers. The Windows client (TitanRONet.dll: combat.rs, exp.rs, loot.rs, mvp.rs, info.rs) keeps the same
 * state with the same rules, so both clients show the same numbers. Events are plain objects made from the packets
 * (InfoPanels.js): {type: 'Entered', aid}, {type: 'MapChange'}, {type: 'Param', varID, value}, {type: 'Unit', id, kind,
 * job, level, hp, maxHp, boss, name}, {type: 'UnitGone', id, how}, {type: 'Homunculus', id}, {type: 'Mercenary', id},
 * {type: 'Damage', source, target, damage, skill}, {type: 'ItemDrop', floorId, item, count}.
 *
 * Fairness (the roadmap's rules): the target's HP is only what the server sends (it fills a monster's HP only when
 * its HP bar shows: normal monsters and MVPs once damaged, never the Emperium or WoE guardians); the damage log counts
 * only the player's own character, homunculus and mercenary, never other players.
 *
 * @author Trojal
 */

export const SP = { BASEEXP: 1, JOBEXP: 2, BASELEVEL: 11, ZENY: 20, NEXTBASEEXP: 22, NEXTJOBEXP: 23, JOBLEVEL: 55 };
export const KIND = { PLAYER: 0, MONSTER: 5, HOMUNCULUS: 8, MERCENARY: 9 };

/** 1234 -> "1,234"; 12345 -> "12.3k"; 12345678 -> "12.3M" (as the Windows client writes them). */
export function shortNumber(n) {
	const a = Math.abs(n);
	if (a >= 1e9) return (n / 1e9).toFixed(1) + 'B';
	if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
	if (a >= 1e4) return (n / 1e3).toFixed(1) + 'k';
	const whole = Math.round(n);
	return (whole < 0 ? '-' : '') + String(Math.abs(whole)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Seconds as "1h 05m", "12m 30s", "45s". */
export function duration(secs) {
	const s = Math.round(Math.max(0, secs));
	if (s >= 100 * 3600) return '99h+';
	const pad = v => String(v).padStart(2, '0');
	if (s >= 3600) return `${Math.floor(s / 3600)}h ${pad(Math.floor((s % 3600) / 60))}m`;
	if (s >= 60) return `${Math.floor(s / 60)}m ${pad(s % 60)}s`;
	return `${s}s`;
}

class Track {
	constructor() {
		this.exp = null;
		this.next = null;
		this.level = null;
		this.nextBeforeLevel = null;
		this.gained = 0;
	}
	setExp(value) {
		let gain = 0;
		if (this.exp !== null) {
			if (value >= this.exp) gain = value - this.exp;
			else {
				if (this.nextBeforeLevel !== null && this.nextBeforeLevel >= this.exp) {
					gain = this.nextBeforeLevel - this.exp + value;
				}
				this.nextBeforeLevel = null;
			}
		}
		this.exp = value;
		this.gained += gain;
		return gain;
	}
	setLevel(value) {
		if (this.level !== null && value > this.level) this.nextBeforeLevel = this.next;
		this.level = value;
	}
	percent() {
		return this.exp !== null && this.next > 0 ? (this.exp * 100) / this.next : null;
	}
}

/**
 * Base and job exp per hour, zeny per hour, time to level. Gains are increases; on a level up the rest of the old
 * level counts; a drop without a level up (death penalty) counts nothing. Rates count from the first gain.
 */
export class ExpTracker {
	constructor() {
		this.clear();
	}
	clear() {
		this.base = new Track();
		this.job = new Track();
		this.zeny = null;
		this.zenyGained = 0;
		this.since = null;
	}
	param(varID, value, now) {
		let gain = 0;
		switch (varID) {
			case SP.BASEEXP:
				gain = this.base.setExp(value);
				break;
			case SP.JOBEXP:
				gain = this.job.setExp(value);
				break;
			case SP.NEXTBASEEXP:
				this.base.next = value;
				break;
			case SP.NEXTJOBEXP:
				this.job.next = value;
				break;
			case SP.BASELEVEL:
				this.base.setLevel(value);
				break;
			case SP.JOBLEVEL:
				this.job.setLevel(value);
				break;
			case SP.ZENY:
				if (this.zeny !== null && value > this.zeny) gain = value - this.zeny;
				this.zeny = value;
				this.zenyGained += gain;
				break;
		}
		if (gain > 0 && this.since === null) this.since = now;
	}
	reset() {
		this.base.gained = 0;
		this.job.gained = 0;
		this.zenyGained = 0;
		this.since = null;
	}
	report(now) {
		const elapsed = this.since === null ? 0 : Math.max(0, now - this.since);
		// under a minute the rates jump around too much to mean anything
		const hours = Math.max(elapsed / 3600, 60 / 3600);
		const basePerHour = this.base.gained / hours;
		const jobPerHour = this.job.gained / hours;
		const pct = (t, rate) => (t.next > 0 ? (rate * 100) / t.next : null);
		const eta = (t, rate) =>
			t.exp !== null && t.next > 0 && rate > 0 ? (Math.max(0, t.next - t.exp) / rate) * 3600 : null;
		return {
			elapsed,
			baseGained: this.base.gained,
			jobGained: this.job.gained,
			zenyGained: this.zenyGained,
			basePerHour,
			jobPerHour,
			zenyPerHour: this.zenyGained / hours,
			basePercentPerHour: pct(this.base, basePerHour),
			jobPercentPerHour: pct(this.job, jobPerHour),
			basePercent: this.base.percent(),
			jobPercent: this.job.percent(),
			baseEta: eta(this.base, basePerHour),
			jobEta: eta(this.job, jobPerHour)
		};
	}
}

const LOG_LINES = 8;
const IDLE_GAP = 5;
const MAX_UNITS = 2048;
export const OWN_NAMES = { player: 'You', homunculus: 'Homunculus', mercenary: 'Mercenary' };

/** The target and the damage log. */
export class Combat {
	constructor() {
		this.me = null;
		this.homunculus = null;
		this.mercenary = null;
		this.units = new Map();
		this.target = null;
		this.resetDamage();
	}
	own(id) {
		if (id === this.me) return 'player';
		if (id === this.homunculus) return 'homunculus';
		if (id === this.mercenary) return 'mercenary';
		return null;
	}
	isMonster(id) {
		const u = this.units.get(id);
		return !!u && u.kind === KIND.MONSTER;
	}
	dead(id) {
		const u = this.units.get(id);
		return !u || u.dead;
	}
	event(e, now) {
		switch (e.type) {
			case 'Entered':
				if (this.me !== e.aid) {
					const me = e.aid;
					Object.assign(this, new Combat());
					this.me = me;
				} else {
					this.units.clear();
					this.target = null;
				}
				return true;
			case 'MapChange':
				this.units.clear();
				this.target = null;
				return true;
			case 'Homunculus':
				this.homunculus = e.id;
				return false;
			case 'Mercenary':
				this.mercenary = e.id;
				return false;
			case 'Unit': {
				if (this.units.size >= MAX_UNITS && !this.units.has(e.id)) this.units.clear();
				const u = {
					kind: e.kind,
					job: e.job,
					level: e.level,
					name: e.name,
					hp: e.hp,
					maxHp: e.maxHp,
					boss: !!e.boss,
					dead: false
				};
				this.units.set(e.id, u);
				return this.target === e.id;
			}
			case 'UnitGone':
				if (e.how === 1) {
					const u = this.units.get(e.id);
					if (u) {
						u.dead = true;
						if (u.hp > 0) u.hp = 0;
					}
					return this.target === e.id;
				}
				if (this.target !== e.id) this.units.delete(e.id);
				return false;
			case 'Damage':
				return this.hit(e.source, e.target, e.skill || 0, e.damage, now);
		}
		return false;
	}
	hit(source, target, skill, damage, now) {
		let changed = false;
		if (source === this.me && this.isMonster(target)) {
			changed = this.target !== target;
			this.target = target;
		} else if (target === this.me && this.isMonster(source) && (this.target === null || this.dead(this.target))) {
			changed = this.target !== source;
			this.target = source;
		}
		const by = this.own(source);
		if (!by || damage <= 0 || target === this.me || this.own(target)) return changed;
		if (this.lastHit !== null) this.fighting += Math.min(Math.max(now - this.lastHit, 0), IDLE_GAP);
		this.lastHit = now;
		const key = by + ':' + skill;
		const t = this.totals.get(key) || { by, skill, damage: 0, hits: 0 };
		t.damage += damage;
		t.hits += 1;
		this.totals.set(key, t);
		const u = this.units.get(target);
		this.log.push({ at: now, by, skill, damage, target: u ? u.name : '' });
		if (this.log.length > LOG_LINES) this.log.shift();
		return true;
	}
	targetUnit() {
		if (this.target === null) return null;
		const unit = this.units.get(this.target);
		return unit ? { id: this.target, unit } : null;
	}
	sortedTotals() {
		const order = { player: 0, homunculus: 1, mercenary: 2 };
		return [...this.totals.values()].sort(
			(a, b) => b.damage - a.damage || order[a.by] - order[b.by] || a.skill - b.skill
		);
	}
	totalDamage() {
		let sum = 0;
		for (const t of this.totals.values()) sum += t.damage;
		return sum;
	}
	/** Damage per second of fighting (pauses over 5 s don't count; the first hit's second does). */
	dps() {
		return this.totalDamage() / (this.fighting + 1);
	}
	resetDamage() {
		this.log = [];
		this.totals = new Map();
		this.fighting = 0;
		this.lastHit = null;
	}
}

/** The target panel's text: [name line, HP line]. */
export function targetText(t) {
	if (!t) return ['No target'];
	const u = t.unit;
	let name = `${u.name} (Lv ${u.level})`;
	if (u.boss) name += ' MVP';
	let hp;
	if (u.dead) hp = 'Dead';
	else if (u.maxHp > 0 && u.hp >= 0)
		hp = `HP ${((u.hp * 100) / u.maxHp).toFixed(1)}%  ${shortNumber(u.hp)} / ${shortNumber(u.maxHp)}`;
	else hp = 'HP 100%';
	return [name, hp];
}

/**
 * The rarity list (droprates.json, written by the Windows client repo's droprates.py from the server's databases):
 * {"<item id>": [best rate in 1/10000, card 0|1, "name"]}.
 */
export function alertReason(rates, rules, id) {
	if (rules.watch.has(id)) return 'watched';
	const item = rates[id];
	if (!item) return null;
	if (item[1] && rules.cards) return 'card';
	if (item[0] <= rules.maxRatePercent * 100 + 1e-9) return 'rare';
	return null;
}

export const LOOT_LINES = 6;

export class LootLog {
	constructor() {
		this.drops = [];
		this.seen = [];
	}
	drop(rates, rules, floorId, item, count, now, name) {
		const reason = alertReason(rates, rules, item);
		if (!reason || this.seen.includes(floorId)) return null;
		this.seen.push(floorId);
		if (this.seen.length > 64) this.seen.shift();
		const d = { at: now, item, name: name || (rates[item] ? rates[item][2] : `Item #${item}`), count, reason };
		this.drops.push(d);
		if (this.drops.length > LOOT_LINES) this.drops.shift();
		return d;
	}
	clear() {
		this.drops = [];
	}
}

/** The loot rules from the helper settings' lootAlerts section. */
export function lootRules(section) {
	const s = section || {};
	return {
		cards: s.cards !== false,
		maxRatePercent: typeof s.maxRatePercent === 'number' ? s.maxRatePercent : 0.1,
		watch: new Set(Array.isArray(s.watchList) ? s.watchList : [])
	};
}

const minutes = secs => {
	const m = Math.floor((Math.max(0, secs) + 59) / 60);
	return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m` : `${m}m`;
};

export const MVP_LINES = 12;

/**
 * The MVP timer panel's lines from the account service's GET /v1/public/mvps answer ({now, mvps: [...]}, Unix
 * seconds), with `skew` = the server's clock minus ours: [{text, alive}], due soonest first, then the alive ones.
 */
export function mvpLines(list, localNow) {
	if (!list) return [{ text: 'Loading...', alive: false }];
	const now = localNow + list.skew;
	const dead = list.mvps.filter(m => !m.alive);
	dead.sort((a, b) => (a.from ?? Infinity) - (b.from ?? Infinity) || a.name.localeCompare(b.name));
	const out = dead.map(m => {
		let when;
		if (m.from != null && m.to != null && now < m.from) when = `in ${minutes(m.from - now)}-${minutes(m.to - now)}`;
		else if (m.from != null && m.to != null && now <= m.to) when = `due, latest ${minutes(m.to - now)}`;
		else when = 'due';
		return { text: `${m.name} (${m.map}) ${when}`, alive: false };
	});
	const alive = list.mvps.filter(m => m.alive).sort((a, b) => a.name.localeCompare(b.name));
	for (const m of alive) out.push({ text: `${m.name} (${m.map}) alive`, alive: true });
	if (!out.length) out.push({ text: 'No MVPs', alive: false });
	return out.slice(0, MVP_LINES);
}

/** The panels' text, the same lines as the Windows client's. */
export function expLines(tracker, now) {
	const r = tracker.report(now);
	const rate = (perHour, pct) =>
		pct === null ? `${shortNumber(perHour)}/h` : `${shortNumber(perHour)}/h (${pct.toFixed(2)}%/h)`;
	const eta = e => (e === null ? '-' : duration(e));
	return [
		`Base ${rate(r.basePerHour, r.basePercentPerHour)}`,
		`  next level in ${eta(r.baseEta)}`,
		`Job  ${rate(r.jobPerHour, r.jobPercentPerHour)}`,
		`  next level in ${eta(r.jobEta)}`,
		`Zeny ${shortNumber(r.zenyPerHour)}/h`,
		`Session ${duration(r.elapsed)}`
	];
}

export function damageLines(combat, skillName) {
	const name = s => (s === 0 ? 'Attack' : skillName(s));
	const lines = [`DPS ${shortNumber(combat.dps())}   total ${shortNumber(combat.totalDamage())}`];
	for (const t of combat.sortedTotals().slice(0, 4)) {
		const who = t.by === 'player' ? '' : OWN_NAMES[t.by] + ': ';
		lines.push(`${who}${name(t.skill)} ${shortNumber(t.damage)} (${t.hits} hits)`);
	}
	for (const h of combat.log.slice().reverse().slice(0, 4))
		lines.push(`${name(h.skill)} ${shortNumber(h.damage)} > ${h.target}`);
	return lines;
}
