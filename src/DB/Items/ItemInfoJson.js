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
 * A string of one character per byte, as bytes.
 *
 * @param {string} str
 * @returns {Uint8Array}
 */
function bytesOf(str) {
	const bytes = new Uint8Array(str.length);
	for (let i = 0; i < str.length; i++) {
		bytes[i] = str.charCodeAt(i);
	}
	return bytes;
}

/**
 * Fills the item table from a prebuilt JSON table, as the Lua loader's AddItem* calls do.
 *
 * @param {Uint8Array} data - The JSON file.
 * @param {object} options
 * @param {string} options.language - The language whose files are loaded ('' for the release's).
 * @param {object} options.itemTable - The table to fill.
 * @param {function(Uint8Array): string} options.decodeText - Decodes display strings.
 * @param {function(Uint8Array): string} options.decodeName - Decodes resource names.
 * @returns {number} The number of items, or 0 when the table is not this language's or not this format.
 */
export function applyItemInfoJson(data, { language, itemTable, decodeText, decodeName }) {
	const table = JSON.parse(latin1(data));
	if (!table || table.format !== 1 || table.lang !== language || typeof table.items !== 'object') {
		return 0;
	}
	const text = s => (typeof s === 'string' ? decodeText(bytesOf(s)) : s);
	const name = s => (typeof s === 'string' ? decodeName(bytesOf(s)) : s);
	let count = 0;
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
		itemTable[id] = {
			...(typeof itemTable[id] === 'object' && itemTable[id]),
			unidentifiedDisplayName: text(unDisplay),
			unidentifiedResourceName: name(unResource),
			identifiedDisplayName: text(display),
			identifiedResourceName: name(resource),
			unidentifiedDescriptionName: (unDesc || []).map(text),
			identifiedDescriptionName: (desc || []).map(text),
			EffectID: effectId ?? null,
			costume: costume ?? null,
			PackageID: packageId ?? null,
			slotCount: slotCount,
			ClassNum: classNum
		};
		count++;
	}
	return count;
}
