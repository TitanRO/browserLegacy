/**
 * The site's stat calculator against the game server: tests/site/calc-cases.json holds characters (job, levels,
 * stats, a weapon, a shield) with the status window the server computed for them, written together with
 * titanro/site/calc/data.json by TitanRO's server tools (tools/calc/export.py in titanro2). Every field must match.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { statusWindow, jobById } from '../../titanro/site/calc/calc.js';
import { tiersOf, treeOf, setLevel } from '../../titanro/site/calc/skilltree.js';
import { normalAttack, mobList, weaponSkills, skillAttack, skillTimes } from '../../titanro/site/calc/damage.js';
import { itemMap, sumEquipment, AMMO_OF } from '../../titanro/site/calc/items.js';
import { withPassives } from '../../titanro/site/calc/passives.js';
import { withBuffs } from '../../titanro/site/calc/buffs.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'titanro/site/calc/data.json'), 'utf8'));
const { cases, source } = JSON.parse(fs.readFileSync(path.join(root, 'tests/site/calc-cases.json'), 'utf8'));

/**
 * A normal attack (`got`, damage.js normalAttack) against the server's record of it (`e`): the min run (every roll
 * at its lowest, once with no critical chance: a hit; once as it comes: a critical hit when the character has any
 * critical chance), and its sample of seeded attacks: the largest hit and critical hit seen, how many missed, were
 * critical, or hit twice (`multi`). The min run's rolls at 0 always trigger Double Attack; a double critical hit
 * counts as a hit in the sample.
 */
/**
 * A skill's cast time and after-cast delay against the server's (`e.cast`, `e.delay`). The cast time may be 1 ms off
 * (0.05 % for long ones): the server's square root (built with -ffast-math) isn't exact. A delay at the attack motion
 * has the ASPD tolerance.
 */
function checkTimes(id, input, [sid, lv], amotion, e, failures) {
	if (e.cast == null) return;
	const t = skillTimes(data, input, sid, lv, amotion);
	if (Math.abs(t.cast - e.cast) > Math.max(1, Math.ceil(e.cast * 0.0005))) failures.push(`${id} cast: server ${e.cast}, calculator ${t.cast}`);
	const eq = input.eq || {};
	const tol = t.delay === amotion && (eq.aspdRate || eq.aspdHaste) ? 1 : 0;
	if (Math.abs(t.delay - e.delay) > tol) failures.push(`${id} delay: server ${e.delay}, calculator ${t.delay}`);
}

function checkNormal(id, got, e, failures) {
	const katar = got.minTotal - got.min > 0 || got.maxTotal - got.max > 0;
	const twice = got.double ? 2 : 1;
	if (e.hit_kind === 'hit' && got.min * twice !== e.hit) failures.push(`${id} hit: server ${e.hit}, calculator ${got.min * twice}`);
	if (e.min_kind === 'crit' && got.critMin * twice !== e.min) failures.push(`${id} crit: server ${e.min}, calculator ${got.critMin * twice}`);
	const top = got.double ? Math.max(got.maxTotal + got.max, got.critTotal + got.crit) : got.maxTotal;
	if (e.hit_max != null && (e.hit_max > top || e.hit_max < got.minTotal)) failures.push(`${id} hit seen ${e.hit_max} outside ${got.minTotal}-${top}${katar ? ' (katar)' : ''}`);
	if (e.crit_max != null && e.crit_max > got.critTotal) failures.push(`${id} crit seen ${e.crit_max} above ${got.critTotal}`);
	if (e.n) {
		const pd = got.double ? got.double.rate : 0;
		const pc = got.critRate;
		const pm = (1 - pc) * ((1 - pd) * (1 - got.hitRate) + pd * (1 - (got.double ? got.double.hitRate : 0)));
		const tol = (p) => 4 * Math.sqrt(e.n * p * (1 - p)) + 3;
		if (Math.abs(e.crits - e.n * pc * (1 - pd)) > tol(pc * (1 - pd))) failures.push(`${id} crits: server ${e.crits}/${e.n}, calculator ${(pc * (1 - pd) * 100).toFixed(1)} %`);
		if (Math.abs(e.miss - e.n * pm) > tol(pm)) failures.push(`${id} misses: server ${e.miss}/${e.n}, calculator ${(pm * 100).toFixed(1)} %`);
		if (e.multi != null) {
			const pt = got.double ? pd * (pc + (1 - pc) * got.double.hitRate) : 0;
			if (Math.abs(e.multi - e.n * pt) > tol(pt)) failures.push(`${id} double hits: server ${e.multi}/${e.n}, calculator ${(pt * 100).toFixed(1)} %`);
		}
	}
}

describe('stat calculator', () => {
	it('uses tables and cases from the same server build', () => {
		expect(source.titanro2).toBe(data.source.titanro2);
		expect(cases.length).toBeGreaterThan(data.jobs.length);
	});

	it('matches the server status window for every case', () => {
		const failures = [];
		for (const c of cases) {
			const got = statusWindow(data, c.input);
			for (const [field, want] of Object.entries(c.status)) {
				if (got[field] !== want) failures.push(`${c.id} ${field}: server ${want}, calculator ${got[field]}`);
			}
		}
		if (failures.length) console.log(failures.length + ' differences; by field: ' + JSON.stringify(failures.reduce((m, f) => { const k = f.split(' ')[1]; m[k] = (m[k] || 0) + 1; return m; }, {})));
		expect(failures.slice(0, 40)).toEqual([]);
	});
});

describe('skill tree simulator', () => {
	const knight = jobById(data, 7);
	const tree = treeOf(knight);

	it('splits a job into the tiers it comes from, with job levels less one as points', () => {
		const tiers = tiersOf(data, knight);
		expect(tiers.map((t) => t.job.id)).toEqual([0, 1, 7]);
		expect(tiers.map((t) => t.points)).toEqual([9, 49, 49]);
		expect(tiers[1].skills).toContain(5); // Bash: a Swordsman skill
	});

	it('raises prerequisites and unlearns what needs a lowered skill', () => {
		const bowlingBash = 62;
		let levels = setLevel(tree, new Map(), bowlingBash, 1);
		for (const [rid, rlv] of tree.get(bowlingBash).need) expect(levels.get(rid)).toBeGreaterThanOrEqual(rlv);
		levels = setLevel(tree, levels, 5, 0); // Bash
		expect(levels.has(bowlingBash)).toBe(false);
	});
});

/** A case's input with its passive skills and buffs added to the equipment totals, as the page does. */
function prepared(input) {
	if (!input.passives && !input.buffs) return input;
	let eq = withPassives(data, input.eq, input.passives, input.job);
	if (input.buffs) eq = withBuffs(data, eq, input.buffs, input.weapon ? input.weapon.type : 0, new Map(), input.performers);
	return { ...input, eq };
}

describe('damage calculator (normal attacks)', () => {
	const mobs = new Map(mobList(JSON.parse(fs.readFileSync(path.join(root, 'titanro/site/calc/mobs.json'), 'utf8'))).map((m) => [m.id, m]));
	const damage = JSON.parse(fs.readFileSync(path.join(root, 'tests/site/damage-cases.json'), 'utf8'));

	it('uses cases from the same server build', () => {
		expect(damage.source.titanro2).toBe(data.source.titanro2);
		expect(damage.cases.length).toBeGreaterThan(1000);
	});

	// Cases whose id starts with "da" have Double Attack (input.passives).
	it('matches the server: lowest hit, critical hit, highest seen, hit, critical and double attack rates', () => {
		const failures = [];
		let doubles = 0;
		let buffed = 0;
		for (const c of damage.cases) {
			if (c.skill) continue;
			const got = normalAttack(data, prepared(c.input), mobs.get(c.mob));
			if (got.double) doubles++;
			if (c.input.buffs) {
				buffed++;
				// the status window with the buffs; ASPD may be 1 ms off with a haste (the server's delay before it
				// isn't a whole number)
				const input = prepared(c.input);
				const w = statusWindow(data, input);
				for (const [field, want] of Object.entries(c.status || {})) {
					const tol = field === 'amotion' && input.eq.aspdHaste ? 1 : 0;
					if (Math.abs(w[field] - want) > tol) failures.push(`${c.id} ${field}: server ${want}, calculator ${w[field]}`);
				}
			}
			checkNormal(c.id, got, c.expect, failures);
		}
		expect(doubles).toBeGreaterThan(100);
		expect(buffed).toBeGreaterThan(300);
		expect(failures.slice(0, 40)).toEqual([]);
	});

	// Weapon skills: the server's min run (no critical hit) and the highest damage in its sample, for every skill
	// the calculator offers (weaponSkills); a skill whose formula the calculator lacks is left out there.
	it('matches the server for every weapon skill it offers', () => {
		const offered = new Set(weaponSkills(data));
		const failures = [];
		let checked = 0;
		for (const c of damage.cases) {
			if (!c.skill || !offered.has(c.skill[0])) continue;
			const got = skillAttack(data, prepared(c.input), mobs.get(c.mob), c.skill[0], c.skill[1]);
			const e = c.expect;
			checked++;
			// a skill that raises the critical chance (Focused Arrow Strike) may land its min run as a critical hit
			if (e.hit_kind === 'crit' && got.crit != null) {
				if (got.crit !== e.hit) failures.push(`${c.id}: server critical ${e.hit}, calculator ${got.crit}`);
			} else if (e.hit_kind !== 'hit') failures.push(`${c.id}: server min run was ${e.hit_kind}`);
			else if (got.min !== e.hit) failures.push(`${c.id}: server ${e.hit}, calculator ${got.min}`);
			if (e.hit_max != null && e.hit_max > got.max) failures.push(`${c.id}: server hit ${e.hit_max}, above ${got.max}`);
			const prep = prepared(c.input);
			checkTimes(c.id, prep, c.skill, statusWindow(data, prep).amotion, e, failures);
		}
		expect(checked).toBeGreaterThan(offered.size * 3);
		expect(failures.slice(0, 40)).toEqual([]);
	});
});

describe('equipment and cards', () => {
	const itemsJson = JSON.parse(fs.readFileSync(path.join(root, 'titanro/site/calc/items.json'), 'utf8'));
	const items = itemMap(itemsJson);
	const mobs = new Map(mobList(JSON.parse(fs.readFileSync(path.join(root, 'titanro/site/calc/mobs.json'), 'utf8'))).map((m) => [m.id, m]));
	const equip = JSON.parse(fs.readFileSync(path.join(root, 'tests/site/equip-cases.json'), 'utf8'));

	it('uses items and cases from the same server build', () => {
		expect(itemsJson.source.titanro2).toBe(data.source.titanro2);
		expect(equip.source.titanro2).toBe(data.source.titanro2);
	});

	// Characters in random equipment and cards: the status window and a normal attack, as the server computed them.
	// Builds whose id starts with "s" start from a set (a Hercules combo or a set written in an item's script); "a"
	// builds shoot each kind of ammunition, and other bows and guns mostly have some too; "e" builds wield each
	// elemental weapon, "n" builds (and a third of the "e" ones) have a weapon endowment (input.buffs), over the
	// weapon's and the ammunition's element.
	// A build with anything the calculator marks "not counted" is left out (it says so on the page). ASPD may be 1 ms
	// off when equipment changes it by a percentage (the server's rounding there isn't understood yet).
	it('matches the server for every build whose items it counts', () => {
		const failures = [];
		let checked = 0;
		let sets = 0;
		let ammo = 0;
		let skills = 0;
		let elemental = 0;
		let endowed = 0;
		let perjob = 0;
		const offered = new Set(weaponSkills(data));
		for (const c of equip.cases) {
			const equips = c.input.equips.map((e) => ({ item: items.get(e.item), refine: e.refine, cards: e.cards.map((x) => items.get(x)) }));
			const eq = sumEquipment(data, equips, itemsJson.combos, null, data.jobs.findIndex((j) => j.id === c.input.job));
			if (eq.notCounted.length) continue;
			checked++;
			if (c.id.startsWith('s')) sets++;
			if (c.id.startsWith('pj')) perjob++;
			const w = equips.find((e) => e.item.type === 4);
			const input = {
				job: c.input.job, blv: c.input.blv, jlv: c.input.jlv, stats: c.input.stats, eq,
				weapon: w ? { type: w.item.sub, atk: w.item.atk, matk: w.item.matk, wlv: w.item.wlv, refine: w.refine } : null,
				shield: equips.some((e) => e.item.type === 5 && e.item.loc & 32)
			};
			if (c.input.buffs) {
				input.buffs = c.input.buffs;
				input.eq = withBuffs(data, eq, c.input.buffs, input.weapon ? input.weapon.type : 0);
				endowed++;
			}
			if (c.id.startsWith('e')) elemental++;
			const got = statusWindow(data, input);
			for (const [field, want] of Object.entries(c.status)) {
				const tol = field === 'amotion' && eq.aspdRate ? 1 : 0;
				if (Math.abs(got[field] - want) > tol) failures.push(`${c.id} ${field}: server ${want}, calculator ${got[field]}`);
			}
			const a = normalAttack(data, input, mobs.get(c.mob));
			if (input.weapon && AMMO_OF[input.weapon.type] && equips.some((e) => e.item.type === 10)) ammo++;
			checkNormal(c.id, a, c.expect, failures);
			if (c.skill && c.skill_expect) {
				// the build's weapon skill, when the calculator offers it: damage, cast time, after-cast delay
				skills++;
				const se = c.skill_expect;
				const r = offered.has(c.skill[0]) ? skillAttack(data, input, mobs.get(c.mob), c.skill[0], c.skill[1]) : null;
				if (r && se.hit_kind === 'hit' && r.min !== se.hit) failures.push(`${c.id} skill ${c.skill}: server ${se.hit}, calculator ${r.min}`);
				if (r && se.hit_kind === 'crit' && r.crit != null && r.crit !== se.hit) failures.push(`${c.id} skill ${c.skill}: server critical ${se.hit}, calculator ${r.crit}`);
				if (r && se.hit_max != null && se.hit_max > r.max) failures.push(`${c.id} skill ${c.skill}: server hit ${se.hit_max}, above ${r.max}`);
				checkTimes(`${c.id} skill ${c.skill}`, input, c.skill, got.amotion, se, failures);
			}
		}
		expect(checked).toBeGreaterThan(400);
		expect(sets).toBeGreaterThan(50);
		expect(ammo).toBeGreaterThan(60);
		expect(skills).toBeGreaterThan(200);
		expect(elemental).toBeGreaterThan(25);
		expect(endowed).toBeGreaterThan(50);
		expect(perjob).toBeGreaterThan(150);
		expect(failures.slice(0, 40)).toEqual([]);
	});
});

describe('passive skills', () => {
	const passive = JSON.parse(fs.readFileSync(path.join(root, 'tests/site/passive-cases.json'), 'utf8'));

	it('uses cases from the same server build', () => {
		expect(passive.source.titanro2).toBe(data.source.titanro2);
		expect(passive.cases.length).toBeGreaterThan(200);
	});

	// Characters with random levels of their job's passive skills, bare-handed: the status window as the server
	// computed it.
	it('matches the server status window', () => {
		const failures = [];
		for (const c of passive.cases) {
			const eq = withPassives(data, null, c.input.passives, c.input.job);
			const got = statusWindow(data, { ...c.input, eq });
			for (const [field, want] of Object.entries(c.status)) {
				if (got[field] !== want) failures.push(`${c.id} ${field}: server ${want}, calculator ${got[field]}`);
			}
		}
		expect(failures.slice(0, 40)).toEqual([]);
	});
});
