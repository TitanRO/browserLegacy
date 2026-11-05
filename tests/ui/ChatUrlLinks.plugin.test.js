/**
 * tests/ui/ChatUrlLinks.plugin.test.js
 *
 * With the ChatUrlLinks plugin, a received line holding a <URL>label<INFO>url</INFO></URL> link (e.g. the
 * quickstart plugin's invite link) shows the label as a link opening the URL in a new tab. Only http(s) URLs become
 * links; the rest stays text, and item links keep working.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	class MockGUIComponent {
		constructor(name) {
			this.name = name;
			this._host = document.createElement('div');
			this.ui = { show: vi.fn(), hide: vi.fn(), is: vi.fn(() => true) };
		}

		getRoot() {
			return this._host;
		}

		draggable() {}

		focus() {}

		parseHTML() {}
	}
	MockGUIComponent.MouseMode = { CROSS: 'cross', DEFAULT: 'default' };

	return { MockGUIComponent };
});

vi.mock('DB/DBManager.js', () => ({
	default: {
		getMessage: id => `msg-${id}`,
		getItemInfo: () => ({ identifiedDisplayName: 'Item' }),
		parseItemLink: link => ({ name: (/<ITEM>(.*?)<INFO>/.exec(link) || [, 'Item'])[1] })
	}
}));
vi.mock('Renderer/Renderer.js', () => ({ default: { width: 1200, height: 800, tick: 0, render: vi.fn(), stop: vi.fn() } }));
vi.mock('Renderer/EntityManager.js', () => ({ default: { get: vi.fn(), getOverEntity: vi.fn() } }));
vi.mock('Core/Client.js', () => ({
	default: {
		loadFile: vi.fn(),
		loadFiles: vi.fn(),
		getFile: vi.fn(),
		getFiles: vi.fn(),
		search: vi.fn()
	}
}));
vi.mock('Core/Events.js', () => ({ default: { setTimeout: vi.fn(), clearTimeout: vi.fn() } }));
vi.mock('Core/Preferences.js', () => ({
	default: { get: () => ({ save: vi.fn(), tabs: [] }) }
}));
vi.mock('Core/Configs.js', () => ({ default: { get: vi.fn() } }));
vi.mock('Controls/MouseEventHandler.js', () => ({ default: { screen: { x: 0, y: 0 } } }));
vi.mock('Controls/BattleMode.js', () => ({ default: { process: vi.fn(() => false) } }));
vi.mock('Controls/ProcessCommand.js', () => ({ default: vi.fn() }));
vi.mock('UI/CursorManager.js', () => ({ default: { setType: vi.fn(), ACTION: {} } }));
vi.mock('UI/GUIComponent.js', () => ({ default: mocks.MockGUIComponent }));
vi.mock('UI/UIManager.js', () => ({ default: { addComponent: c => c, showMessageBox: vi.fn() } }));
vi.mock('UI/Elements/Elements.js', () => ({}));
vi.mock('UI/Components/ContextMenu/ContextMenu.js', () => ({
	default: { remove: vi.fn(), addElement: vi.fn(), append: vi.fn() }
}));
vi.mock('UI/Components/ChatBoxSettings/ChatBoxSettings.js', () => ({
	default: { updateTab: vi.fn(), getTabs: () => [], tabOption: [] }
}));

const ChatBox = (await import('UI/Components/ChatBox/ChatBox.js')).default;
const ChatUrlLinks = (await import('Plugins/ChatUrlLinks/ChatUrlLinks.js')).default;

function mountChatBox() {
	const host = document.createElement('div');
	host.innerHTML = ChatBox.render();
	document.body.appendChild(host);
	ChatBox._host = host;
	ChatBox._shadow = null;
	return host;
}

describe('ChatUrlLinks plugin — URL links in a received line', () => {
	let root;
	let tab;

	beforeAll(() => {
		ChatUrlLinks();
	});

	beforeEach(() => {
		document.body.innerHTML = '';
		vi.stubGlobal('requestAnimationFrame', cb => cb());
		root = mountChatBox();
		tab = ChatBox.addNewTab();
	});

	function add(text) {
		ChatBox.addText(text, ChatBox.TYPE.PUBLIC, ChatBox.FILTER.PUBLIC_CHAT);
		return root.querySelector(`.content[data-content="${tab}"] div:last-child`);
	}

	it('renders the label as a link to the URL, opening in a new tab', () => {
		const line = add('Invite link: <URL>Open invite<INFO>https://play.titanro.net/?invite=abc</INFO></URL>');

		const a = line.querySelector('a.url-link');
		expect(a.getAttribute('href')).toBe('https://play.titanro.net/?invite=abc');
		expect(a.getAttribute('title')).toBe('https://play.titanro.net/?invite=abc');
		expect(a.getAttribute('target')).toBe('_blank');
		expect(a.getAttribute('rel')).toBe('noopener noreferrer');
		expect(line.textContent).toBe('Invite link: Open invite');
	});

	it('drops the in-game browser size older clients put after the URL', () => {
		const a = add('<URL>site<INFO>https://example.com/,800,600</INFO></URL>').querySelector('a.url-link');

		expect(a.getAttribute('href')).toBe('https://example.com/');
	});

	it('shows a link to anything but http(s) as plain text', () => {
		const line = add('<URL>click me<INFO>javascript:alert(1)</INFO></URL>');

		expect(line.querySelector('a')).toBeNull();
		expect(line.textContent).toBe('click me');
	});

	it('keeps tags and quotes in the label and URL from becoming HTML', () => {
		const line = add('<b>hi</b> <URL><b>x</b><INFO>https://e.com/" onmouseover="alert(1)</INFO></URL>');

		expect(line.querySelector('b')).toBeNull();
		expect(line.querySelector('[onmouseover]')).toBeNull();
	});

	it('renders URL and item links in the same line', () => {
		const line = add('<ITEML>01</ITEML> at <URL>shop<INFO>https://e.com/</INFO></URL>');

		expect(line.querySelectorAll('span.item-link')).toHaveLength(1);
		expect(line.querySelectorAll('a.url-link')).toHaveLength(1);
		expect(line.textContent).toBe('<Item> at shop');
	});

	it('leaves a line without links as plain text', () => {
		const line = add('<b>hi</b> & bye');

		expect(line.querySelector('b')).toBeNull();
		expect(line.textContent).toBe('<b>hi</b> & bye');
	});
});
