/**
 * Plugins/Helpers/Keys.js
 *
 * Helper key bindings as the helper settings write them (the same in both clients): optional Ctrl, Alt and Shift, in
 * that order, and a key A-Z, 0-9 or F1-F12, e.g. "Ctrl+H", "Alt+Shift+7", "F11"; "" is unbound. Matched by the
 * physical key (KeyboardEvent.code), so they work on any keyboard layout, as the Windows client's do.
 *
 * @author Trojal
 */

const PATTERN = /^(Ctrl\+)?(Alt\+)?(Shift\+)?([A-Z0-9]|F(?:[1-9]|1[0-2]))$/;

/** {ctrl, alt, shift, code} for a binding, or null for none (or one this client can't read). */
export function parseKey(binding) {
	const match = typeof binding === 'string' ? PATTERN.exec(binding) : null;
	if (!match) return null;
	const key = match[4];
	const code = /^[A-Z]$/.test(key) ? `Key${key}` : /^[0-9]$/.test(key) ? `Digit${key}` : key;
	return { ctrl: !!match[1], alt: !!match[2], shift: !!match[3], code };
}

/** Whether the keyboard event is the binding. */
export function matchesKey(event, binding) {
	const key = parseKey(binding);
	return (
		!!key &&
		event.code === key.code &&
		!!event.ctrlKey === key.ctrl &&
		!!event.altKey === key.alt &&
		!!event.shiftKey === key.shift &&
		!event.metaKey
	);
}

/** Whether the event comes from a text field (the chat box and other inputs are in shadow roots). */
export function isTyping(event) {
	const target = (event.composedPath && event.composedPath()[0]) || event.target;
	if (!target || !target.tagName) return false;
	const tag = target.tagName.toUpperCase();
	return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!target.isContentEditable;
}
