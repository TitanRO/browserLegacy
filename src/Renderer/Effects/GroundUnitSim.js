/**
 * Renderer/Effects/GroundUnitSim.js
 *
 * Placement numbers of the ground skill unit effects the official client
 * (kRO 2025-07-16) builds in code rather than from a .str file, without any
 * WebGL, so they can be tested on their own. DB/Effects/GroundUnitEffects.js
 * turns them into effect rows.
 *
 * Official world units: 5 to a cell. Ticks: 60 a second. r(k) is a whole
 * number from 0 to k - 1.
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

/** Official world units in one cell. */
export const UNITS_PER_CELL = 5;

const rad = deg => (deg * Math.PI) / 180;
const r = (random, k) => Math.floor(random() * k);

/**
 * The flames of effects 916-918 (Demonic Fire, its Fire Expansion fields and
 * the Insignias): one flame sprite on each of the first 20 ticks, flame k at
 * k * 18 degrees, 6 units out on even ticks and 12 on odd ones. Even flames are
 * scaled 0.40 + r(11) * 0.03, odd ones 0.50 + r(11) * 0.03.
 *
 * @param {function} [random] source of numbers in [0, 1)
 * @return {Array<{x: number, y: number, scale: number, tick: number}>} offsets in cells
 */
export function flameRing(random = Math.random) {
	const flames = [];
	for (let k = 0; k < 20; k++) {
		const even = k % 2 === 0;
		const radius = (even ? 6 : 12) / UNITS_PER_CELL;
		const angle = rad(k * 18);
		flames.push({
			x: radius * Math.sin(angle),
			y: radius * Math.cos(angle),
			scale: (even ? 0.4 : 0.5) + r(random, 11) * 0.03,
			tick: k
		});
	}
	return flames;
}

/**
 * Cells the official client covers for a cell-range unit effect (Zenkai):
 * every cell from -range to +range on both axes, 6 units apart, each moved by
 * r(11) * 0.2 - 1 units on both axes.
 *
 * @param {number} range unit range from the server
 * @param {function} [random]
 * @return {Array<{x: number, y: number}>} offsets in cells
 */
export function cellRangeSpots(range, random = Math.random) {
	const spots = [];
	const n = Math.max(0, Math.floor(range) || 0);
	for (let j = -n; j <= n; j++) {
		for (let i = -n; i <= n; i++) {
			spots.push({
				x: (i * 6 + r(random, 11) * 0.2 - 1) / UNITS_PER_CELL,
				y: (j * 6 + r(random, 11) * 0.2 - 1) / UNITS_PER_CELL
			});
		}
	}
	return spots;
}

/**
 * Cloud Kill's (effect 1080) cloud: every 9 ticks one particle3 sprite at each
 * point of a grid from -10 to +10 units, 4 units apart (6 x 6), each moved
 * 2 + r(6) units in a random direction, scaled (40 + r(50)) / 170, rising for
 * 40 ticks.
 *
 * @return {Array<{x: number, y: number}>} grid points in cells
 */
export function cloudKillGrid() {
	const points = [];
	for (let y = -10; y < 11; y += 4) {
		for (let x = -10; x < 11; x += 4) {
			points.push({ x: x / UNITS_PER_CELL, y: y / UNITS_PER_CELL });
		}
	}
	return points;
}

/**
 * Power of Gaia's (effect 1088) light: a 3 x 3 grid, 5 units apart.
 *
 * @return {Array<{x: number, y: number}>} offsets in cells
 */
export function gaiaGrid() {
	const points = [];
	for (let y = -5; y < 10; y += 5) {
		for (let x = -5; x < 10; x += 5) {
			points.push({ x: x / UNITS_PER_CELL, y: y / UNITS_PER_CELL });
		}
	}
	return points;
}
