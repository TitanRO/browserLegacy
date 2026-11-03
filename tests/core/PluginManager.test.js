/**
 * PluginManager: plugins under src/Plugins are bundled (import.meta.glob), so they can import client modules
 * by alias; paths that aren't bundled fall back to a runtime import.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({ plugins: {} }));

vi.mock('Core/Configs.js', () => ({
	default: { get: (key, def) => (key === 'plugins' ? mocks.plugins : def) }
}));

async function loadManager() {
	vi.resetModules();
	return (await import('Plugins/PluginManager.js')).default;
}

describe('PluginManager', () => {
	let log, error;

	beforeEach(() => {
		localStorage.clear();
		log = vi.spyOn(console, 'log').mockImplementation(() => {});
		error = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('initializes a bundled plugin that imports client modules by alias', async () => {
		mocks.plugins = { DefaultSettings: 'DefaultSettings/DefaultSettings' };
		const Plugins = await loadManager();
		Plugins.init();

		await vi.waitFor(() =>
			expect(log).toHaveBeenCalledWith('[PluginManager] Initialized plugin: ./DefaultSettings/DefaultSettings')
		);
		const Audio = (await import('Preferences/Audio.js')).default;
		expect(Audio.BGM.volume).toBe(0.1);
		expect(error).not.toHaveBeenCalled();
	});

	it('accepts { path, pars } entries and an explicit .js extension', async () => {
		mocks.plugins = { DefaultSettings: { path: 'DefaultSettings/DefaultSettings.js', pars: { a: 1 } } };
		const Plugins = await loadManager();
		Plugins.init();

		await vi.waitFor(() =>
			expect(log).toHaveBeenCalledWith('[PluginManager] Initialized plugin: ./DefaultSettings/DefaultSettings.js')
		);
	});

	it('reports a plugin that is neither bundled nor loadable at runtime', async () => {
		mocks.plugins = { Missing: 'Missing/Missing' };
		const Plugins = await loadManager();
		Plugins.init();

		await vi.waitFor(() =>
			expect(error).toHaveBeenCalledWith('[PluginManager] Error loading plugin: ./Missing/Missing', expect.anything())
		);
	});

	it('initializes only once', async () => {
		mocks.plugins = { DefaultSettings: 'DefaultSettings/DefaultSettings' };
		const Plugins = await loadManager();
		Plugins.init();
		Plugins.init();

		await vi.waitFor(() => expect(log).toHaveBeenCalled());
		await new Promise(r => setTimeout(r, 20));
		expect(log.mock.calls.filter(c => String(c[0]).includes('Initialized plugin'))).toHaveLength(1);
	});
});
