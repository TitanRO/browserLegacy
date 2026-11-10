/**
 * TitanRO skill tree simulator: the server's skill trees from data.json (each job's tree as the game server has it,
 * with its max levels, job level needs and prerequisites).
 *
 * A job's skills are split into tiers by the job they come from (novice, first, second, third job: the job's
 * lineage); each tier has the job levels of its job, less one, as skill points. Quest skills don't take points.
 */

export function skillMap(data) {
	return new Map(data.skills.map((s) => [s.id, s]));
}

/** Family skills (Baby, Call Parent, ...): from adoption, not skill points; the simulator leaves them out. */
function isFamilySkill(skill) {
	return !!skill && skill.name.startsWith('WE_');
}

/** The job's tree as Map(skill id -> {id, max, joblv, need: [[id, lv], ...]}). */
export function treeOf(job) {
	return new Map(job.tree.map(([id, max, joblv, need]) => [id, { id, max, joblv, need }]));
}

/**
 * The tiers of a job: [{job, skills: [skill id, ...], points}], from the novice tier up. A tier's skills are the ones
 * its job's tree adds to the tier below it; the last tier's job is `job` itself.
 */
export function tiersOf(data, job) {
	const jobs = new Map(data.jobs.map((j) => [j.id, j]));
	const skillInfo = skillMap(data);
	const own = treeOf(job);
	const ids = [];
	for (const id of job.lineage) if (id >= 0 && jobs.has(id) && !ids.includes(id)) ids.push(id);
	if (!ids.includes(job.id)) ids.push(job.id);
	const tiers = [];
	const seen = new Set();
	for (const id of ids) {
		const j = jobs.get(id);
		const skills = [];
		for (const [sid] of id === job.id ? own : treeOf(j)) {
			if (!seen.has(sid) && own.has(sid) && !isFamilySkill(skillInfo.get(sid))) {
				seen.add(sid);
				skills.push(sid);
			}
		}
		if (skills.length) tiers.push({ job: j, skills, points: j.maxjlv - 1 });
	}
	// A tier with nothing to spend points on (a Summoner's novice tier: First Aid only) joins the next one.
	for (let i = 0; i < tiers.length - 1; i++) {
		if (tiers[i].skills.every((sid) => skillInfo.get(sid)?.quest)) {
			tiers[i + 1].skills.unshift(...tiers[i].skills);
			tiers.splice(i--, 1);
		}
	}
	return tiers;
}

/** Skill points used per tier (quest skills excluded). */
export function pointsUsed(data, tiers, levels) {
	const skills = skillMap(data);
	return tiers.map((t) => t.skills.reduce((n, id) => n + (skills.get(id)?.quest ? 0 : levels.get(id) || 0), 0));
}

/**
 * Sets a skill's level and keeps the build valid: raising it raises its prerequisites to the levels it needs;
 * lowering it unlearns the skills that need it at more than the new level. Returns the new levels map.
 */
export function setLevel(tree, levels, id, lv) {
	const next = new Map(levels);
	const entry = tree.get(id);
	if (!entry) return next;
	lv = Math.max(0, Math.min(lv, entry.max));
	const raise = (sid, want) => {
		const e = tree.get(sid);
		if (!e) return;
		if ((next.get(sid) || 0) < want) next.set(sid, Math.min(want, e.max));
		for (const [rid, rlv] of e.need) raise(rid, rlv);
	};
	const lower = (sid) => {
		const have = next.get(sid) || 0;
		for (const e of tree.values()) {
			if (!next.get(e.id)) continue;
			for (const [rid, rlv] of e.need) {
				if (rid === sid && have < rlv) {
					next.delete(e.id);
					lower(e.id);
				}
			}
		}
	};
	if (lv > 0) {
		next.set(id, lv);
		for (const [rid, rlv] of entry.need) raise(rid, rlv);
	} else {
		next.delete(id);
	}
	lower(id);
	return next;
}
