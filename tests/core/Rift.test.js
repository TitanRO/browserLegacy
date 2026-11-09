/**
 * tests/core/Rift.test.js
 *
 * Rifts are named and planned by the vendored builder (Core/Rift/riftWasm.js) from their name alone, and their
 * files are answered by Core/Rift instead of being fetched.
 */
import { describe, expect, it } from 'vitest';
import Rift from 'Core/Rift/Rift.js';

describe('Core/Rift', () => {
	it('plans a Culvert rift from its name', async () => {
		expect(await Rift.ready()).toBe(true);
		const plan = Rift.plan('g4c405fa61a.gat');
		expect(plan.tileset).toBe('Culvert');
		expect(plan.grid).toBe(false);
		expect(plan.maps).toEqual(expect.arrayContaining(['prt_sewb1', 'prt_sewb3', 'prt_sewb4']));
	});

	it('names a rift by its tileset, never its seed', async () => {
		await Rift.ready();
		expect(Rift.mapInfo('g4c405fa61a.rsw')).toEqual({
			displayName: 'Rift: Culvert',
			notifyEnter: true,
			signName: { subTitle: 'Rift', mainTitle: 'Culvert' },
			backgroundBmp: 'dungeon'
		});
		expect(Rift.mapInfo('g4p13572468.rsw').backgroundBmp).toBe('field');
	});

	it('leaves other maps alone', async () => {
		await Rift.ready();
		expect(Rift.plan('prontera.rsw')).toBeNull();
		expect(Rift.mapInfo('prt_sewb1.rsw')).toBeNull();
		expect(Rift.plan('gzz00000000')).toBeNull(); // named like one, but no such recipe
		expect(Rift.serve('data\\prontera.rsw', () => {}, () => {})).toBe(false);
	});

	it('reads a file named like a rift as usual when it is not one', async () => {
		const calls = [];
		const get = (path, cb, notRift) => {
			calls.push([path, notRift]);
			cb(new Uint8Array([1, 2, 3]).buffer);
		};
		const buffer = await new Promise(resolve => {
			expect(Rift.serve('data\\gzz00000000.rsw', get, resolve)).toBe(true);
		});
		expect(new Uint8Array(buffer)).toEqual(new Uint8Array([1, 2, 3]));
		expect(calls).toEqual([['data\\gzz00000000.rsw', true]]);
	});

	it("falls back to the file when the rift's source maps can't be read", async () => {
		const calls = [];
		const get = (path, cb, notRift) => {
			calls.push(path);
			cb(null, "Can't get file", notRift);
		};
		const result = await new Promise(resolve => {
			Rift.serve('data\\g4k00c0ffee.gnd', get, (b, e) => resolve([b, e]));
		});
		expect(result).toEqual([null, "Can't get file"]);
		expect(calls).toContain('data\\gon_dun01.rsw');
		expect(calls[calls.length - 1]).toBe('data\\g4k00c0ffee.gnd');
	});
});
