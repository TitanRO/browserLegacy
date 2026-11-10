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
