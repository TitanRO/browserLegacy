// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { withoutAddedGlobalGetters } from '../../src/Utils/EmscriptenGlobals.js';

const names = [];
const define = (name, get) => {
	names.push(name);
	Object.defineProperty(globalThis, name, { configurable: true, get });
};

describe('withoutAddedGlobalGetters', () => {
	afterEach(() => {
		names.splice(0).forEach(n => delete globalThis[n]);
	});

	it('removes the getters the set-up adds, and keeps everything else', async () => {
		globalThis.__keptValue = 1;
		names.push('__keptValue');
		const result = await withoutAddedGlobalGetters(async () => {
			define('__addedGetter', () => 'reports a missing symbol');
			globalThis.__addedValue = 2;
			names.push('__addedValue');
			return 'state';
		});
		expect(result).toBe('state');
		expect(Object.getOwnPropertyDescriptor(globalThis, '__addedGetter')).toBeUndefined();
		expect(globalThis.__addedValue).toBe(2);
		expect(globalThis.__keptValue).toBe(1);
	});

	it('removes a getter the set-up replaced, keeps one it left alone', async () => {
		define('__replaced', () => 'old module');
		const untouched = () => 'other';
		define('__untouched', untouched);
		await withoutAddedGlobalGetters(async () => define('__replaced', () => 'new module'));
		expect(Object.getOwnPropertyDescriptor(globalThis, '__replaced')).toBeUndefined();
		expect(Object.getOwnPropertyDescriptor(globalThis, '__untouched').get).toBe(untouched);
	});

	it('cleans up when the set-up fails', async () => {
		await expect(
			withoutAddedGlobalGetters(async () => {
				define('__failed', () => 1);
				throw new Error('no wasm');
			})
		).rejects.toThrow('no wasm');
		expect(Object.getOwnPropertyDescriptor(globalThis, '__failed')).toBeUndefined();
	});

});
