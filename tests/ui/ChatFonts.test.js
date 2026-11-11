import { beforeEach, describe, expect, it } from 'vitest';
import { clearFontCache, fontInstalled, tabFontCss, UI_FONT_STACK } from 'UI/Components/ChatBox/ChatFonts.js';

/** A canvas whose text width depends on whether the first family is one it "has". */
function fakeCanvas(installed) {
	return () => {
		const ctx = { font: '' };
		ctx.measureText = text => {
			const first = /"([^"]+)"/.exec(ctx.font);
			const generic = ctx.font.split(' ').pop();
			const base = { monospace: 10, serif: 9, 'sans-serif': 8 }[generic] || 7;
			return { width: text.length * (first && installed.includes(first[1]) ? base + 1 : base) };
		};
		return ctx;
	};
}

describe('ChatFonts', () => {
	beforeEach(() => clearFontCache());

	it('finds a family by the width of text drawn in it', () => {
		expect(fontInstalled('Consolas', fakeCanvas(['Consolas']))).toBe(true);
		expect(fontInstalled('Gulim', fakeCanvas(['Consolas']))).toBe(false);
		expect(fontInstalled(null)).toBe(true);
	});

	it('a tab font: size and line height, and the family before the chat\'s own', () => {
		const has = () => true;
		expect(tabFontCss({ size: 14, family: 'consolas' }, has)).toEqual({
			fontSize: '14px',
			lineHeight: '16px',
			fontFamily: `"Consolas", ${UI_FONT_STACK}`
		});
		expect(tabFontCss({ size: null, family: 'default' }, has)).toEqual({ fontSize: '', lineHeight: '', fontFamily: '' });
	});

	it('a missing family draws in the chat\'s own font; sizes stay within 10-20', () => {
		expect(tabFontCss({ size: 25, family: 'gulim' }, () => false)).toEqual({
			fontSize: '20px',
			lineHeight: '22px',
			fontFamily: ''
		});
	});
});
