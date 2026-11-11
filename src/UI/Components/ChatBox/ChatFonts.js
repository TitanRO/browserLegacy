/**
 * UI/Components/ChatBox/ChatFonts.js
 *
 * The font families a chat tab may use (account-service CHAT_FONT_FAMILIES, the same list as the Windows client), and
 * whether this computer has each one. A family the player picked but this computer lacks is drawn in the chat's own
 * font, and the settings window shows it greyed as "(not installed)": the setting is kept, so a computer that has it
 * draws it again.
 *
 * Detection is a width test: a test string is measured in the family with each generic family behind it; if any width
 * differs from the generic family alone, the family is installed. (document.fonts.check() can't tell: it answers true
 * for a local font it doesn't know, since nothing needs loading.)
 */

/** id -> the CSS family name; `default` is the chat's own font. */
export const CHAT_FONT_FAMILIES = {
	default: null,
	segoe: 'Segoe UI',
	tahoma: 'Tahoma',
	verdana: 'Verdana',
	arial: 'Arial',
	consolas: 'Consolas',
	courier: 'Courier New',
	gulim: 'Gulim'
};

/** The labels in the settings window. */
export const CHAT_FONT_LABELS = {
	default: 'Default (UI font)',
	segoe: 'Segoe UI',
	tahoma: 'Tahoma',
	verdana: 'Verdana',
	arial: 'Arial',
	consolas: 'Consolas',
	courier: 'Courier New',
	gulim: 'Gulim'
};

/** Pixel sizes a tab may use; null is the chat's default size. */
export const CHAT_FONT_SIZE = { min: 10, max: 20 };

/** The chat's own font (UI/Common.css), behind every family so a missing one falls back to it. */
export const UI_FONT_STACK = "'SCDream', Arial, 'Liberation Sans', Arimo, sans-serif";

const TEST = 'mmmmmmmmmmlli1WQ@#가나다';
const cache = new Map();

/**
 * @param {string} family - a CSS family name, e.g. "Consolas"
 * @param {function} [canvas] - makes a 2D context (tests)
 * @returns {boolean} this computer has it
 */
export function fontInstalled(family, canvas = defaultCanvas) {
	if (!family) return true;
	if (cache.has(family)) return cache.get(family);
	let installed = false;
	try {
		const ctx = canvas();
		if (ctx) {
			for (const generic of ['monospace', 'serif', 'sans-serif']) {
				ctx.font = `32px ${generic}`;
				const plain = ctx.measureText(TEST).width;
				ctx.font = `32px "${family}", ${generic}`;
				if (ctx.measureText(TEST).width !== plain) {
					installed = true;
					break;
				}
			}
		}
	} catch {
		installed = false;
	}
	cache.set(family, installed);
	return installed;
}

function defaultCanvas() {
	return document.createElement('canvas').getContext('2d');
}

/** Forget what was measured (tests). */
export function clearFontCache() {
	cache.clear();
}

/**
 * The CSS for a tab's font: {fontSize, lineHeight, fontFamily}; empty strings leave the chat's own.
 * @param {{size: number|null, family: string}} font
 * @param {function} [installed]
 */
export function tabFontCss(font, installed = fontInstalled) {
	const size =
		font && Number.isInteger(font.size)
			? Math.min(Math.max(font.size, CHAT_FONT_SIZE.min), CHAT_FONT_SIZE.max)
			: null;
	const family = font && CHAT_FONT_FAMILIES[font.family];
	return {
		fontSize: size ? `${size}px` : '',
		lineHeight: size ? `${size + 2}px` : '',
		fontFamily: family && installed(family) ? `"${family}", ${UI_FONT_STACK}` : ''
	};
}
