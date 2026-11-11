import { describe, expect, it } from 'vitest';
import { startChatSync } from 'Plugins/Helpers/ChatSync.js';

function fakeSettings({ signedIn = true, answered = false, tabs = [] } = {}) {
	const listeners = new Set();
	const s = {
		signedIn,
		answered,
		doc: { chat: { tabs, active: 0 } },
		sets: [],
		get: (section, key) => s.doc[section]?.[key],
		set(change) {
			s.sets.push(change);
			s.doc.chat = { ...s.doc.chat, ...change.chat };
		},
		onChange(fn) {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
		answer(tabs) {
			s.answered = true;
			s.doc.chat = { tabs, active: 0 };
			listeners.forEach(fn => fn(s.doc));
		}
	};
	return s;
}

function fakeChatBox(tabs) {
	const listeners = new Set();
	const box = {
		tabs,
		imported: [],
		exportChat: () => ({ tabs: box.tabs, active: 0 }),
		importChat(chat) {
			box.imported.push(chat);
			box.tabs = chat.tabs;
			listeners.forEach(fn => fn()); // importing switches tabs, which notifies
		},
		onChatChange(fn) {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
		change(next) {
			box.tabs = next;
			listeners.forEach(fn => fn());
		}
	};
	return box;
}

const local = [{ name: 'Local', filters: [0] }];
const account = [{ name: 'Account', filters: [1], font: { size: 14, family: 'consolas' } }];

describe('ChatSync: the account is the source, the first client to start wins', () => {
	it('waits for the service, then adopts the account\'s tabs', () => {
		const settings = fakeSettings();
		const box = fakeChatBox(local);
		const sync = startChatSync({ settings, chatBox: box });
		expect(sync.decided()).toBe(false);
		settings.answer(account);
		expect(box.imported).toHaveLength(1);
		expect(box.tabs).toEqual(account);
		expect(settings.sets).toHaveLength(0); // adopting doesn't save back
	});

	it('uploads the local tabs when the account has none yet', () => {
		const settings = fakeSettings();
		const box = fakeChatBox(local);
		startChatSync({ settings, chatBox: box });
		settings.answer([]);
		expect(settings.sets).toEqual([{ chat: { tabs: local, active: 0 } }]);
		expect(box.imported).toHaveLength(0);
	});

	it('after that, every change sends the whole tab list; later service answers are not taken in', () => {
		const settings = fakeSettings();
		const box = fakeChatBox(local);
		startChatSync({ settings, chatBox: box });
		settings.answer(account);
		const next = [{ name: 'Mine', filters: [2] }];
		box.change(next);
		expect(settings.sets.at(-1)).toEqual({ chat: { tabs: next, active: 0 } });
		settings.answer([{ name: 'Other PC', filters: [] }]);
		expect(box.tabs).toEqual(next);
	});

	it('a guest (no helper token) decides at once from the browser\'s copy', () => {
		const settings = fakeSettings({ signedIn: false, tabs: account });
		const box = fakeChatBox(local);
		const sync = startChatSync({ settings, chatBox: box });
		expect(sync.decided()).toBe(true);
		expect(box.tabs).toEqual(account);
	});

	it('a helper token after a guest decision: decides again from the account once it answers', () => {
		const settings = fakeSettings({ signedIn: false });
		const box = fakeChatBox(local);
		startChatSync({ settings, chatBox: box });
		expect(settings.sets).toHaveLength(1); // guest: uploaded to the browser's copy
		settings.signedIn = true;
		settings.answer(account);
		expect(box.tabs).toEqual(account);
		settings.answer([{ name: 'Later', filters: [] }]);
		expect(box.tabs).toEqual(account); // only once
	});

	it('waits for the chat box to have tabs', () => {
		const settings = fakeSettings({ answered: true, tabs: account });
		const box = fakeChatBox([]);
		const sync = startChatSync({ settings, chatBox: box });
		expect(sync.decided()).toBe(false);
		box.change(local);
		expect(sync.decided()).toBe(true);
		expect(box.tabs).toEqual(account);
	});
});
