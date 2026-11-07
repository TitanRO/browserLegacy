/**
 * Utils/ByteLimit.js
 *
 * Text fields the server stores in a fixed number of bytes (names, titles) take at most that many bytes of UTF-8:
 * an input or textarea with `data-maxbytes="N"` is cut back to its longest prefix of whole characters that fits.
 * `maxlength` counts characters, so it can't do this once a character can take 2 or 3 bytes (accented letters,
 * Hangul).
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

import TextEncoding from 'Utils/CodepageManager.js';

/**
 * Cuts the field's value to its byte limit, keeping the caret where it was when it's still inside the text.
 *
 * @param {HTMLInputElement|HTMLTextAreaElement} field
 */
function enforce(field) {
	const max = parseInt(field.dataset.maxbytes, 10);
	if (!(max > 0)) {
		return;
	}
	const value = field.value;
	const fitted = TextEncoding.fitUtf8(value, max);
	if (fitted !== value) {
		const caret = Math.min(field.selectionStart ?? fitted.length, fitted.length);
		field.value = fitted;
		field.setSelectionRange?.(caret, caret);
	}
}

/**
 * Installs the listener once. Events from fields inside UI components' shadow roots reach the document retargeted,
 * so the field is the first node of the event's composed path.
 */
function install() {
	if (install.done) {
		return;
	}
	install.done = true;
	document.addEventListener(
		'input',
		event => {
			const field = event.composedPath ? event.composedPath()[0] : event.target;
			if (field && field.dataset && field.dataset.maxbytes !== undefined) {
				enforce(field);
			}
		},
		true
	);
}

export default { install, enforce };
