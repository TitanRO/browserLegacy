import { describe, it, expect } from 'vitest';
import TextEncoding from 'Utils/CodepageManager.js';
import BinaryWriter from 'Utils/BinaryWriter.js';
import BinaryReader from 'Utils/BinaryReader.js';

const utf8 = str => Uint8Array.from(new TextEncoder().encode(str));

describe('UTF-8 text', () => {
	it('decodes a name cut in the middle of its last character as UTF-8, not as the fallback charset', () => {
		const name = utf8('가나다라마바사아'); // 24 bytes
		expect(TextEncoding.decodeFullField(name.subarray(0, 23))).toBe('가나다라마바사');
		expect(TextEncoding.decodeFullField(utf8('Joãoã').subarray(0, 6))).toBe('João');
		expect(new BinaryReader(name.slice(0, 23)).readString(23)).toBe('가나다라마바사');
	});

	it('still falls back to the legacy charset for bytes that are not UTF-8', () => {
		TextEncoding.setCharset('windows-1252');
		expect(TextEncoding.decode(new Uint8Array([0x4a, 0x6f, 0x73, 0xe9]), 'utf-8')).toBe('José');
		expect(TextEncoding.decodeFullField(new Uint8Array([0x4a, 0x6f, 0x73, 0xe9]))).toBe('José');
	});

	it('decodes text tables as UTF-8 first, then in their own charset', () => {
		expect(TextEncoding.decodeText(utf8('Poção ő 한국어'), 'windows-1252')).toBe('Poção ő 한국어');
		expect(TextEncoding.decodeText(new Uint8Array([0xbb, 0xe7, 0xb0, 0xfa]), 'windows-949')).toBe('사과');
	});

	it('decodes UTF-8 inside a larger buffer, and a cut-short character in the fallback charset', () => {
		const packet = utf8('xxHangul 한국어xx');
		expect(TextEncoding.decodeText(packet.subarray(2, packet.length - 2), 'windows-1252')).toBe('Hangul 한국어');
		expect(TextEncoding.decodeText(utf8('한').subarray(0, 2), 'windows-1252')).toBe('í•');
	});

	it('cuts strings to a byte limit at character boundaries', () => {
		expect(TextEncoding.fitUtf8('가나다라마바사아', 23)).toBe('가나다라마바사');
		expect(TextEncoding.fitUtf8('Conceição', 7)).toBe('Concei');
		expect(TextEncoding.fitUtf8('Short', 23)).toBe('Short');
		expect(Array.from(TextEncoding.encodeUtf8Fit('ãã', 3))).toEqual([0xc3, 0xa3]);
	});

	it('writes a fixed-size field with whole characters only', () => {
		const writer = new BinaryWriter(24);
		writer.writeString('가나다라마바사아', 23);
		const bytes = new Uint8Array(writer.buffer);
		expect(Array.from(bytes.subarray(21))).toEqual([0, 0, 0]); // 23-byte field: 7 syllables, then zeros
		expect(new TextDecoder().decode(bytes.subarray(0, 21))).toBe('가나다라마바사');
	});
});
