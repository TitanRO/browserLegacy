/**
 * Plugins/Helpers/ChatSync.js
 *
 * The chat window's tabs (names, filters, per-tab font, type tags) kept in the master account's helper settings
 * (account-service `chat` section), so they follow the player between computers and the Windows client.
 *
 * Who wins (design doc "Chat window and chat settings modernization", decision 7):
 * - The account is the source. Once the account's settings are known (the service answered; or, without a helper
 *   token, the browser's own copy) and the chat box has its tabs, the account's tabs replace the box's. If the account
 *   has none yet, the box's tabs are uploaded: the first client to start wins.
 * - After that, every change the player makes sends the whole tab list (last write wins). A change another client
 *   makes during this session is not taken in; the next start reads it.
 * - A helper token that comes after a decision made from the browser's copy (a guest's) leads to one more decision
 *   from the account's settings when the service answers.
 *
 * @author Trojal
 */

/**
 * @param {object} options
 * @param {object} options.settings - the HelperSettingsClient
 * @param {object} options.chatBox - ChatBox (exportChat, importChat, onChatChange)
 * @returns {{decided: function(): boolean, stop: function()}}
 */
export function startChatSync({ settings, chatBox }) {
	let decided = false;
	/** Decided from the account's settings (not only the browser's, before a helper token came). */
	let fromAccount = false;
	let applying = false;

	const known = () => !settings.signedIn || settings.answered;
	const hasTabs = () => chatBox.exportChat().tabs.length > 0;

	function upload() {
		const chat = chatBox.exportChat();
		if (chat.tabs.length) settings.set({ chat: { tabs: chat.tabs, active: chat.active } });
	}

	function decide() {
		if (decided || !known() || !hasTabs()) return;
		decided = true;
		fromAccount = settings.signedIn && settings.answered;
		const chat = settings.get('chat', 'tabs');
		if (Array.isArray(chat) && chat.length) {
			applying = true;
			try {
				chatBox.importChat({ tabs: chat, active: settings.get('chat', 'active') || 0 });
			} finally {
				applying = false;
			}
		} else {
			upload();
		}
	}

	const stopChat = chatBox.onChatChange(() => {
		if (applying) return;
		if (!decided) decide();
		else upload();
	});
	const stopSettings = settings.onChange(() => {
		// a helper token that came after a decision from the browser's copy: decide again, once, from the account's
		if (decided && !fromAccount && settings.signedIn && settings.answered) decided = false;
		if (!decided) decide();
	});
	decide();

	return {
		decided: () => decided,
		stop() {
			stopChat();
			stopSettings();
		}
	};
}
