/**
 * TitanRO calculator: passive skills. data.json `passives` holds, per passive skill and level, what the game server
 * gives in the status window: the stats it adds (`param`) and the flat bonuses beyond what those stats change
 * (fields named as the equipment totals of items.js), measured on the server with and without the skill
 * (TitanRO's tools/calc/export.py), with "<skill>@<job>" tables for the jobs that get other values; null for a level the calculator can't take as flat bonuses. Skills that change
 * only damage (masteries) or nothing in the status window aren't listed. tests/site/calc.test.js checks random
 * characters with passive skills against the server (tests/site/passive-cases.json).
 */
import { NO_EQUIPMENT } from './calc.js';

/** The skills of `levels` ({skill id: level}) that data.json lists for job `jobId`: [id, level, bonuses or null]. */
export function passiveEffects(data, levels, jobId) {
	const all = data.passives || {};
	const out = [];
	for (const [id, lv] of Object.entries(levels || {})) {
		const table = all[`${id}@${jobId}`] || all[id];
		if (!table || !lv) continue;
		out.push([Number(id), lv, table[Math.min(lv, table.length) - 1]]);
	}
	return out;
}

/** The equipment totals `eq` (items.js sumEquipment, or none) with the passive skills' bonuses added. */
export function withPassives(data, eq, levels, jobId, names = new Map()) {
	const base = eq || NO_EQUIPMENT;
	const t = { ...base, param: base.param.slice(), notCounted: base.notCounted.slice() };
	for (const [id, lv, b] of passiveEffects(data, levels, jobId)) {
		if (!b) {
			t.notCounted.push(`${names.get(id) || 'Skill ' + id} Lv ${lv}: not counted`);
			continue;
		}
		b.param.forEach((v, i) => { t.param[i] += v; });
		for (const [k, v] of Object.entries(b)) if (k !== 'param') t[k] = (t[k] || 0) + v;
	}
	return t;
}
