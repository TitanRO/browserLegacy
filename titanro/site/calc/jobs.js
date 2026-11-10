/** The jobs of data.json grouped for a job picker: [[group name, [job, ...]], ...]. */
export function jobGroups(data) {
	const groups = [
		['Novice and first jobs', []],
		['Second jobs', []],
		['Transcendent jobs', []],
		['Third jobs', []],
		['Baby jobs', []]
	];
	for (const j of data.jobs) {
		let g;
		if (j.baby) g = 4;
		else if (j.third) g = 3;
		else if (j.upper) g = 2;
		else if (j.lineage[2] >= 0) g = 1;
		else g = 0;
		groups[g][1].push(j);
	}
	return groups.filter(([, list]) => list.length);
}
