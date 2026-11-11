import { describe, expect, it } from 'vitest';
import TextEncoding from 'Utils/CodepageManager.js';
import { applyItemInfoJson, itemInfoJsonPath, latin1, loadedLanguage } from 'DB/Items/ItemInfoJson.js';

// A table as client-sync writes it: the Lua strings' bytes as they are (here UTF-8 display text and a CP949
// resource name), JSON read one character per byte.
const utf8 = s => Array.from(new TextEncoder().encode(s));
const cp949Potion = [0xbb, 0xa1, 0xb0, 0xa3, 0xc6, 0xf7, 0xbc, 0xc7]; // 빨간포션
const json = (lang, items) => {
	const text = `{"format":1,"lang":"${lang}","source":"x","items":${items}}`;
	return Uint8Array.from(text, c => c.charCodeAt(0));
};
const str = bytes => `"${String.fromCharCode(...bytes)}"`;
const potion = lang =>
	json(
		lang,
		`{"501":[${str(utf8('Poção'))},${str(cp949Potion)},${str(utf8('Poção Vermelha'))},${str(cp949Potion)},` +
			`[${str(utf8('Uma poção.'))}],[${str(utf8('Cura 45 HP.'))},${str(utf8('Peso: 7'))}],0,0,null,false,null]}`
	);
const options = (language, itemTable) => ({
	language,
	itemTable,
	pause: () => Promise.resolve(),
	decodeText: bytes => TextEncoding.decodeText(bytes, 'windows-1252'),
	decodeName: bytes => TextEncoding.decode(bytes, 'windows-1252')
});

describe('prebuilt item table (SystemEN/itemInfo.json)', () => {
	it('stands for the Lua item info file', () => {
		expect(itemInfoJsonPath('SystemEN/itemInfo.lua')).toBe('SystemEN/itemInfo.json');
		expect(itemInfoJsonPath('System/itemInfo_true.lub')).toBe('System/itemInfo_true.json');
		expect(itemInfoJsonPath('data/x.txt')).toBe(null);
	});

	it("takes the loaded language from the remote client's lang/<code>/", () => {
		expect(loadedLanguage('https://grf.titanro.net/')).toBe('');
		expect(loadedLanguage('https://grf.titanro.net/lang/qps-cjk/')).toBe('qps-cjk');
		expect(loadedLanguage(undefined)).toBe('');
	});

	it('fills the item table as the Lua loader does: text decoded, resource names as the bytes in the charset', async () => {
		const table = { 501: { keep: 1 } };
		expect(await applyItemInfoJson(potion('pt-BR'), options('pt-BR', table))).toBe(1);
		expect(table[501]).toEqual({
			keep: 1,
			unidentifiedDisplayName: 'Poção',
			unidentifiedResourceName: TextEncoding.decode(Uint8Array.from(cp949Potion), 'windows-1252'),
			identifiedDisplayName: 'Poção Vermelha',
			identifiedResourceName: TextEncoding.decode(Uint8Array.from(cp949Potion), 'windows-1252'),
			unidentifiedDescriptionName: ['Uma poção.'],
			identifiedDescriptionName: ['Cura 45 HP.', 'Peso: 7'],
			EffectID: null,
			costume: false,
			PackageID: null,
			slotCount: 0,
			ClassNum: 0
		});
	});

	it("isn't used for another language (the release's table served for a pack that lacks one)", async () => {
		const table = {};
		expect(await applyItemInfoJson(potion(''), options('pt-BR', table))).toBe(0);
		expect(table).toEqual({});
	});

	it('decodes descriptions when first read, and keeps one assigned before', async () => {
		const table = {};
		let decoded = 0;
		const opts = options('pt-BR', table);
		const decodeText = opts.decodeText;
		opts.decodeText = bytes => (decoded++, decodeText(bytes));
		await applyItemInfoJson(potion('pt-BR'), opts);
		expect(decoded).toBe(2); // the two display names
		expect(table[501].identifiedDescriptionName).toEqual(['Cura 45 HP.', 'Peso: 7']);
		expect(decoded).toBe(4);
		table[501].unidentifiedDescriptionName = ['set'];
		expect(table[501].unidentifiedDescriptionName).toEqual(['set']);
		expect(decoded).toBe(4);
	});

	it('yields to the browser between slices of a large table', async () => {
		const items = Array.from({ length: 3000 }, (_, i) => `"${i + 1}":["a","b","c","d",["x"],["y"],0,0,null,false,null]`);
		const text = `{"format":1,"lang":"","source":"x","items":{${items.join(',')}}}`;
		let pauses = 0;
		const table = {};
		const opts = { ...options('', table), pause: () => (pauses++, Promise.resolve()), budget: 0 };
		expect(await applyItemInfoJson(Uint8Array.from(text, c => c.charCodeAt(0)), opts)).toBe(3000);
		expect(pauses).toBeGreaterThan(100);
	});

	it('reads bytes one character per byte, also past a chunk', () => {
		const bytes = Uint8Array.from({ length: 70000 }, (_, i) => i % 256);
		const text = latin1(bytes);
		expect(text.length).toBe(70000);
		expect(text.charCodeAt(69999)).toBe(69999 % 256);
	});
});
