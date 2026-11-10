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
import { normalAttack, mobList } from '../../titanro/site/calc/damage.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'titanro/site/calc/data.json'), 'utf8'));
const { cases, source } = JSON.parse(fs.readFileSync(path.join(root, 'tests/site/calc-cases.json'), 'utf8'));

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

describe('damage calculator (normal attacks)', () => {
	const mobs = new Map(mobList(JSON.parse(fs.readFileSync(path.join(root, 'titanro/site/calc/mobs.json'), 'utf8'))).map((m) => [m.id, m]));
	const damage = JSON.parse(fs.readFileSync(path.join(root, 'tests/site/damage-cases.json'), 'utf8'));

	it('uses cases from the same server build', () => {
		expect(damage.source.titanro2).toBe(data.source.titanro2);
		expect(damage.cases.length).toBeGreaterThan(1000);
	});

	// The server's min run: every roll at its lowest, once with no critical chance (a hit) and once as it comes
	// (a critical hit when the character has any critical chance: a roll at 0 passes every check). Its sample of
	// seeded attacks: the largest hit and critical hit seen, and how many missed or were critical.
	it('matches the server: lowest hit, critical hit, highest seen, hit and critical rates', () => {
		const failures = [];
		for (const c of damage.cases) {
			const mob = mobs.get(c.mob);
			const got = normalAttack(data, c.input, mob);
			const e = c.expect;
			if (e.hit_kind === 'hit' && got.min !== e.hit) failures.push(`${c.id} hit: server ${e.hit}, calculator ${got.min}`);
			if (e.min_kind === 'crit' && got.critMin !== e.min) failures.push(`${c.id} crit: server ${e.min}, calculator ${got.critMin}`);
			if (e.hit_max != null && (e.hit_max > got.maxTotal || e.hit_max < got.minTotal)) failures.push(`${c.id} hit seen ${e.hit_max} outside ${got.minTotal}-${got.maxTotal}`);
			if (e.crit_max != null && e.crit_max > got.critTotal) failures.push(`${c.id} crit seen ${e.crit_max} above ${got.critTotal}`);
			if (e.n) {
				const pc = got.critRate;
				const pm = (1 - pc) * (1 - got.hitRate);
				const tol = (p) => 4 * Math.sqrt(e.n * p * (1 - p)) + 3;
				if (Math.abs(e.crits - e.n * pc) > tol(pc)) failures.push(`${c.id} crits: server ${e.crits}/${e.n}, calculator ${(pc * 100).toFixed(1)} %`);
				if (Math.abs(e.miss - e.n * pm) > tol(pm)) failures.push(`${c.id} misses: server ${e.miss}/${e.n}, calculator ${(pm * 100).toFixed(1)} %`);
			}
		}
		expect(failures.slice(0, 40)).toEqual([]);
	});
});
