/**
 * DB/LuaRecipeRunner.js
 *
 * Runs a Lua table's recipe (DB/LuaRecipes.js): replays the prebuilt recording of its callbacks' calls when there is
 * one for exactly these files and this recipe, else runs the Lua. A replay runs on the main thread in slices with the
 * browser running in between; the Lua is one synchronous run (hundreds of ms for the quest and navigation tables).
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

import Client from 'Core/Client.js';
import { RECORDING_FORMAT, recipeHash, recordingPath } from 'DB/LuaRecipes.js';
import { bytesOf, latin1Sliced, yieldToBrowser } from 'DB/Items/ItemInfoJson.js';

/**
 * A file through Client.loadFile, as a promise of its bytes.
 *
 * @param {string} path
 * @returns {Promise<Uint8Array>}
 */
export function loadBytes(path) {
	return new Promise((resolve, reject) => {
		Client.loadFile(
			path,
			file => resolve(file instanceof ArrayBuffer ? new Uint8Array(file) : file),
			error => reject(new Error(error || `can't load ${path}`))
		);
	});
}

/**
 * The SHA-256 of bytes, as hex.
 *
 * @param {Uint8Array} bytes
 * @returns {Promise<string>}
 */
async function sha256(bytes) {
	const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
	return Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The recording of a recipe over these files, when it was made from these very bytes and this recipe.
 *
 * @param {import('DB/LuaRecipes.js').LuaRecipe} recipe
 * @param {Array<[string, Uint8Array]>} files
 * @param {function(string): Promise<Uint8Array>} load
 * @returns {Promise<Array|null>} Its calls, or null.
 */
export async function findRecording(recipe, files, load = loadBytes) {
	if (!globalThis.crypto?.subtle) {
		return null; // no SubtleCrypto (an insecure page): the bytes can't be checked
	}
	let data;
	try {
		data = await load(
			recordingPath(
				recipe,
				files.map(([path]) => path)
			)
		);
	} catch {
		return null;
	}
	try {
		const recording = JSON.parse(await latin1Sliced(data));
		if (
			recording?.format !== RECORDING_FORMAT ||
			recording.recipe !== recipeHash(recipe) ||
			!Array.isArray(recording.files) ||
			recording.files.length !== files.length ||
			!Array.isArray(recording.calls)
		) {
			return null;
		}
		for (let i = 0; i < files.length; i++) {
			if (recording.files[i]?.sha256 !== (await sha256(files[i][1]))) {
				return null; // made from other bytes (another release or language): the Lua decides
			}
		}
		return recording.calls;
	} catch (error) {
		console.warn('[LuaRecipe] unreadable recording', error?.message || error);
		return null;
	}
}

/**
 * Calls the recorded calls on the callbacks, a slice of `budget` ms at a time: [callback index, ...arguments], the
 * Lua strings as their bytes (Uint8Array), as the callbacks get them from Lua.
 *
 * @param {import('DB/LuaRecipes.js').LuaRecipe} recipe
 * @param {Array} calls
 * @param {Object<string, function>} callbacks
 * @param {object} [options]
 */
export async function replay(recipe, calls, callbacks, { pause = yieldToBrowser, budget = 10 } = {}) {
	const fns = recipe.callbacks.map(name => callbacks[name]);
	let sliceStart = performance.now();
	for (let i = 0; i < calls.length; i++) {
		const call = calls[i];
		const fn = fns[call[0]];
		if (!fn) {
			throw new Error(`recording calls ${recipe.callbacks[call[0]]}, which the loader doesn't have`);
		}
		const args = new Array(call.length - 1);
		for (let a = 1; a < call.length; a++) {
			args[a - 1] = typeof call[a] === 'string' ? bytesOf(call[a]) : call[a];
		}
		fn(...args);
		if (performance.now() - sliceStart > budget) {
			await pause();
			sliceStart = performance.now();
		}
	}
}

/**
 * Runs a recipe over files (each mounted under its path): the recording when there is one for them, else the Lua.
 * The caller unmounts the files.
 *
 * @param {object} lua - The client's Lua state (LuaModuleLoader).
 * @param {import('DB/LuaRecipes.js').LuaRecipe} recipe
 * @param {Array<[string, Uint8Array]>} files
 * @param {Object<string, function>} callbacks
 * @returns {Promise<boolean>} Whether the recording was replayed.
 */
export async function runLuaRecipe(lua, recipe, files, callbacks) {
	const started = performance.now();
	const calls = await findRecording(recipe, files);
	if (calls) {
		// files whose globals later Lua needs still run (small enum files)
		for (const index of recipe.keep || []) {
			const [path, bytes] = files[index];
			lua.mountFile(path, bytes);
			await lua.doFile(path);
		}
		await replay(recipe, calls, callbacks);
		console.log(
			`[LuaRecipe] ${files.map(([path]) => path).join(' + ')}: ${calls.length} calls replayed in ${Math.round(performance.now() - started)} ms`
		);
		return true;
	}
	const ctx = lua.ctx;
	for (const name of recipe.callbacks) {
		if (callbacks[name]) {
			ctx[name] = callbacks[name];
		}
	}
	for (const [path, bytes] of files) {
		lua.mountFile(path, bytes);
		await lua.doFile(path);
	}
	lua.doStringSync(recipe.driver);
	return false;
}
