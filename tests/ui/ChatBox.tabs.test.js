import { beforeEach, describe, expect, it, vi } from 'vitest';

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
		INTERFACE_PATH: '',
		getMessage: (id, defaultText) => (defaultText !== undefined ? defaultText : `NO MSG ${id}`)
	}
}));
vi.mock('Renderer/Renderer.js', () => ({ default: { width: 1200, height: 800, tick: 0, render: vi.fn(), stop: vi.fn() } }));
vi.mock('Renderer/EntityManager.js', () => ({ default: { get: vi.fn(), getOverEntity: vi.fn() } }));
vi.mock('Core/Client.js', () => ({
	default: {
		loadFile(_path, callback) {
			callback?.('');
		},
		loadFiles(_paths, callback) {
			callback?.('');
		}
	}
}));
vi.mock('Core/Events.js', () => ({ default: { setTimeout: vi.fn(), clearTimeout: vi.fn() } }));
vi.mock('Core/Preferences.js', () => ({
	default: {
		get: (_name, defaults) => ({ ...defaults, save: vi.fn() })
	}
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
	default: { remove: vi.fn(), append: vi.fn(), addElement: vi.fn() }
}));
vi.mock('UI/Components/ChatBoxSettings/ChatBoxSettings.js', () => ({
	default: { updateTab: vi.fn(), getTabs: () => [], tabOption: [] }
}));

const ChatBox = (await import('UI/Components/ChatBox/ChatBox.js')).default;

/**
 * The tabs are built once and stay in the window across a remove: a counter
 * reset there gave the next new tab the id of an existing one.
 */
describe('ChatBox tabs after the window is removed and shown again', () => {
	const tabIds = () => [...ChatBox._host.querySelectorAll('td.tab')].map(td => td.dataset.tab);

	beforeEach(() => {
		document.body.innerHTML = '';
		const host = document.createElement('div');
		host.innerHTML = ChatBox.render();
		document.body.appendChild(host);
		ChatBox._host = host;
		ChatBox.magnet = {};
		ChatBox.tabs = [];
		ChatBox.tabCount = 0;
		ChatBox.lastTabID = -1;
		ChatBox.activeTab = 0;

		ChatBox.addNewTab('Public Log');
		ChatBox.addNewTab('Battle Log');
		ChatBox.switchTab('1');
		ChatBox.onRemove();
	});

	it('gives a new tab an id of its own', () => {
		const id = ChatBox.addNewTab();

		expect(tabIds()).toEqual(['0', '1', '2']);
		expect(ChatBox.tabs[0].name).toBe('Public Log');
		expect(ChatBox.tabs[id].name).toBe('New Tab');
	});

	it('shows chat in a new tab', async () => {
		const id = ChatBox.addNewTab();
		ChatBox.addText('hello', ChatBox.TYPE.PUBLIC, ChatBox.FILTER.PUBLIC_CHAT);
		await new Promise(requestAnimationFrame);

		const content = [...ChatBox._host.querySelectorAll('.body .content')].pop();
		expect(content.dataset.content).toBe(String(id));
		expect(content.textContent).toBe('hello');
	});

	it('closes the tab on screen, not the first one', () => {
		ChatBox.removeTab();

		expect(tabIds()).toEqual(['0']);
	});
});

describe('ChatBox tabs in the account settings', () => {
	beforeEach(() => {
		document.body.innerHTML = '';
		const host = document.createElement('div');
		host.innerHTML = ChatBox.render();
		document.body.appendChild(host);
		ChatBox._host = host;
		ChatBox.magnet = {};
		ChatBox.tabs = [];
		ChatBox.tabCount = 0;
		ChatBox.lastTabID = -1;
		ChatBox.activeTab = 0;
	});

	it('exports the tabs in order with their filters, font and type tags; imports them back', () => {
		ChatBox.addNewTab('Regular Chat', [3, 1]);
		const battle = ChatBox.addNewTab('Battle Log', [15], { font: { size: 14, family: 'consolas' }, typeTags: true });
		ChatBox.switchTab(battle);
		const chat = ChatBox.exportChat();
		expect(chat).toEqual({
			tabs: [
				{ name: 'Regular Chat', filters: [1, 3], font: { size: null, family: 'default' }, typeTags: false, window: null },
				{ name: 'Battle Log', filters: [15], font: { size: 14, family: 'consolas' }, typeTags: true, window: null }
			],
			active: 1
		});

		ChatBox.importChat({ tabs: [{ name: 'Only', filters: [2], font: { size: 16, family: 'default' } }], active: 0 });
		expect(ChatBox._host.querySelectorAll('td.tab')).toHaveLength(1);
		expect(ChatBox.exportChat().tabs[0]).toEqual({
			name: 'Only', filters: [2], font: { size: 16, family: 'default' }, typeTags: false, window: null
		});
		const content = ChatBox._host.querySelector('.body .content');
		expect(content.style.fontSize).toBe('16px');
		expect(content.style.lineHeight).toBe('18px');
	});

	it('a tab with type tags puts [type] before each line', async () => {
		const id = ChatBox.addNewTab('Tagged', [ChatBox.FILTER.PARTY], { typeTags: true });
		ChatBox.addText('hi', ChatBox.TYPE.PARTY, ChatBox.FILTER.PARTY);
		await new Promise(requestAnimationFrame);
		const content = ChatBox._host.querySelector(`.body .content[data-content="${id}"]`);
		expect(content.textContent).toBe('[Party] hi');
	});

	it('tells the listeners when the player changes a tab\'s style', () => {
		const id = ChatBox.addNewTab('T', []);
		let calls = 0;
		const stop = ChatBox.onChatChange(() => calls++);
		ChatBox.setTabStyle(id, { font: { size: 18 } });
		stop();
		expect(calls).toBe(1);
		expect(ChatBox.tabs[id].font).toEqual({ size: 18, family: 'default' });
	});
});
