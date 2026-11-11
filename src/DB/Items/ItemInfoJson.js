/**
 * DB/Items/ItemInfoJson.js
 *
 * The client's item table prebuilt as JSON (SystemEN/itemInfo.json next to SystemEN/itemInfo.lua, made by TitanRO
 * sysops' client-sync from the same Lua in the same Lua 5.1): the client reads it instead of running 23 MB of Lua.
 *
 *   {"format": 1, "lang": "<code>" or "", "source": "...",
 *    "items": {"<id>": [unidentifiedDisplayName, unidentifiedResourceName, identifiedDisplayName,
 *                       identifiedResourceName, [unidentifiedDescriptionName...], [identifiedDescriptionName...],
 *                       slotCount, ClassNum, EffectID, costume, PackageID], ...}}
 *
 * Its strings are the Lua strings' bytes, so the file is read one character per byte and each string is decoded as
 * the Lua loader decodes it. "lang" must be the language whose files are loaded (grfhost's lang/<code>/ in the remote
 * client's URL, '' for the release's): grfhost serves the release's file when a language pack lacks one.
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

/**
 * The JSON table that stands for an item info Lua file: SystemEN/itemInfo.lua -> SystemEN/itemInfo.json.
 *
 * @param {string} filename
 * @returns {string|null}
 */
export function itemInfoJsonPath(filename) {
	return /\.lu[ab]$/i.test(filename) ? filename.replace(/\.lu[ab]$/i, '.json') : null;
}

/**
 * The language whose client files are loaded: grfhost's lang/<code>/ at the end of the remote client's URL, or ''.
 *
 * @param {string} remoteClient
 * @returns {string}
 */
export function loadedLanguage(remoteClient) {
	const match = /\/lang\/([A-Za-z0-9-]{2,16})\/?$/.exec(String(remoteClient || ''));
	return match ? match[1] : '';
}

/**
 * Lets the browser run (input, rendering) before the next slice of a long job: scheduler.yield where there is one,
 * else a zero-delay timeout.
 *
 * @returns {Promise<void>}
 */
export function yieldToBrowser() {
	if (typeof globalThis.scheduler?.yield === 'function') {
		return globalThis.scheduler.yield();
	}
	return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Bytes as a string of one character per byte.
 *
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function latin1(bytes) {
	const parts = [];
	for (let i = 0; i < bytes.length; i += 0x8000) {
		parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)));
	}
	return parts.join('');
}

/**
 * As latin1, a slice of `budget` ms at a time (a 15 MB table takes ~150 ms in one go).
 *
 * @param {Uint8Array} bytes
 * @param {function(): Promise<void>} pause
 * @param {number} budget
 * @returns {Promise<string>}
 */
export async function latin1Sliced(bytes, pause = yieldToBrowser, budget = 10) {
	const parts = [];
	let sliceStart = performance.now();
	for (let i = 0; i < bytes.length; i += 0x8000) {
		parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)));
		if (performance.now() - sliceStart > budget) {
			await pause();
			sliceStart = performance.now();
		}
	}
	return parts.join('');
}

/**
 * A string of one character per byte, as bytes.
 *
 * @param {string} str
 * @returns {Uint8Array}
 */
export function bytesOf(str) {
	const bytes = new Uint8Array(str.length);
	for (let i = 0; i < str.length; i++) {
		bytes[i] = str.charCodeAt(i);
	}
	return bytes;
}

/**
 * Defines `key` on `obj` as `make()`, computed the first time it is read (then a plain property); assigning it first
 * replaces it.
 *
 * @param {object} obj
 * @param {string} key
 * @param {function(): *} make
 */
function lazyProperty(obj, key, make) {
	Object.defineProperty(obj, key, {
		configurable: true,
		enumerable: true,
		get() {
			const value = make();
			Object.defineProperty(this, key, { value, writable: true, enumerable: true, configurable: true });
			return value;
		},
		set(value) {
			Object.defineProperty(this, key, { value, writable: true, enumerable: true, configurable: true });
		}
	});
}

/**
 * Fills the item table from a prebuilt JSON table, as the Lua loader's AddItem* calls do. The work is cut into
 * slices of `budget` ms with the browser running in between (the table is 15 MB of JSON for 28,000 items), and the
 * descriptions (340,000 lines) are decoded when an item's description is first read.
 *
 * @param {Uint8Array} data - The JSON file.
 * @param {object} options
 * @param {string} options.language - The language whose files are loaded ('' for the release's).
 * @param {object} options.itemTable - The table to fill.
 * @param {function(Uint8Array): string} options.decodeText - Decodes display strings.
 * @param {function(Uint8Array): string} options.decodeName - Decodes resource names.
 * @param {function(): Promise<void>} [options.pause] - Yields to the browser between slices.
 * @param {number} [options.budget] - Milliseconds a slice may run.
 * @returns {Promise<number>} The number of items, or 0 when the table is not this language's or not this format.
 */
export async function applyItemInfoJson(
	data,
	{ language, itemTable, decodeText, decodeName, pause = yieldToBrowser, budget = 10 }
) {
	const table = JSON.parse(await latin1Sliced(data, pause, budget));
	if (!table || table.format !== 1 || table.lang !== language || typeof table.items !== 'object') {
		return 0;
	}
	const text = s => (typeof s === 'string' ? decodeText(bytesOf(s)) : s);
	const name = s => (typeof s === 'string' ? decodeName(bytesOf(s)) : s);
	let count = 0;
	let sliceStart = performance.now();
	for (const id in table.items) {
		const [
			unDisplay,
			unResource,
			display,
			resource,
			unDesc,
			desc,
			slotCount,
			classNum,
			effectId,
			costume,
			packageId
		] = table.items[id];
		const item = {
			...(typeof itemTable[id] === 'object' && itemTable[id]),
			unidentifiedDisplayName: text(unDisplay),
			unidentifiedResourceName: name(unResource),
			identifiedDisplayName: text(display),
			identifiedResourceName: name(resource),
			EffectID: effectId ?? null,
			costume: costume ?? null,
			PackageID: packageId ?? null,
			slotCount: slotCount,
			ClassNum: classNum
		};
		lazyProperty(item, 'unidentifiedDescriptionName', () => (unDesc || []).map(text));
		lazyProperty(item, 'identifiedDescriptionName', () => (desc || []).map(text));
		itemTable[id] = item;
		count++;
		if (performance.now() - sliceStart > budget) {
			await pause();
			sliceStart = performance.now();
		}
	}
	return count;
}
