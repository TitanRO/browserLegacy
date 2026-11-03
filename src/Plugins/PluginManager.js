/**
 * Plugins/PluginManager.js
 *
 * Plugin Manager - Load and execute plugins
 * Plugins have to be globals, can not be server specific (multiple server in one clientinfo)
 * You alter memory, so you can't restore it if you change server.
 *
 * It's a work in progress, and subject to changes.
 *
 * To add plugins use the "plugins" param to list plugins in the ROBrowser Config. Plugins must be located in the /Plugin/ folder.
 *
 * Usage:
 * 		plugins: {
 *					<plugin_1_name>: '<plugin_1_path>',
 *					<plugin_2_name>: '<plugin_2_path>',
 *					<plugin_3_name>: '<plugin_3_path>',
 *					...
 *					<plugin_n_name>: '<plugin_n_path>'
 *				},
 *
 * Example:
 * 		plugins:		{ KeyboardControl: 'KeyToMove_v1/KeyToMove' },
 *
 *
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

import Configs from 'Core/Configs.js';

/**
 * Plugins found under src/Plugins at build time, keyed by path ('./Name/Name.js' -> lazy loader).
 *
 * Vite bundles these into the build (they are only evaluated when a configured plugin imports them), so a plugin
 * can import client modules with the usual aliases ('Core/Preferences.js'). A plugin loaded at runtime from a
 * separate file can't: the browser can't resolve those bare specifiers, and it would get its own module copies.
 * Without Vite (native ES modules) import.meta.glob doesn't exist, and every plugin falls back to a runtime import.
 */
let _bundled = {};
try {
	_bundled = import.meta.glob(['./**/*.js', './**/*.mjs', '!./PluginManager.js', '!./**/*.test.js']);
} catch (_e) {
	_bundled = {};
}

/**
 * Plugin namespace
 */
const Plugins = {};

/**
 * @var {Array} plugin list
 */
Plugins.list = [];

/**
 * @var {boolean} track if plugins have been initialized
 */
let _initialized = false;

/**
 * Initialize plugins
 */
Plugins.init = function init(context) {
	if (_initialized) {
		return;
	}
	_initialized = true;

	const paths = [];
	const params = [];

	this.list = Configs.get('plugins', {});

	for (const [_pluginName, value] of Object.entries(this.list)) {
		if (typeof value === 'string' || value instanceof String) {
			// Only Path is provided as string
			paths.push('./' + value);
			params.push(null);
		} else if (typeof value === 'object' && value !== null) {
			// Path and parameters are provided as well
			if (value.path) {
				paths.push('./' + value.path);

				if (value.pars) {
					params.push(value.pars);
				} else {
					params.push(null);
				}
			}
		}
	}

	const _count = paths.length;

	// Dynamic plugin loading in ESM
	paths.forEach((pluginPath, i) => {
		// Ensure .js extension for native ES module resolution (Vite resolves it automatically)
		let resolvedPath = pluginPath;
		if (!resolvedPath.endsWith('.js') && !resolvedPath.endsWith('.mjs')) {
			resolvedPath += '.js';
		}
		// Prefer the bundled copy; fall back to loading the file at runtime (plugins added after the build)
		const load = _bundled[resolvedPath] || (() => import(/* @vite-ignore */ resolvedPath));
		load()
			.then(module => {
				const plugin = module.default || module;
				if (typeof plugin === 'function') {
					if (plugin(params[i])) {
						console.log('[PluginManager] Initialized plugin: ' + pluginPath);
					} else {
						console.error('[PluginManager] Failed to intialize plugin: ' + pluginPath);
					}
				}
			})
			.catch(err => {
				console.error('[PluginManager] Error loading plugin: ' + pluginPath, err);
			});
	});
};

/**
 * Export
 */
export default Plugins;
