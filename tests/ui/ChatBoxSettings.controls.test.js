import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	class MockGUIComponent {
		constructor(name) {
			this.name = name;
			this._host = document.createElement('div');
			this.ui = { show: vi.fn(), hide: vi.fn() };
		}

		getRoot() {
			return this._host;
		}

		draggable() {}
	}
	MockGUIComponent.MouseMode = { STOP: 'stop' };

	return { MockGUIComponent };
});

vi.mock('DB/DBManager.js', () => ({ default: { INTERFACE_PATH: '' } }));
vi.mock('Core/Preferences.js', () => ({
	default: {
		get: (_name, defaults) => ({ ...defaults, save: vi.fn() })
	}
}));
vi.mock('Renderer/Renderer.js', () => ({ default: { width: 1200, height: 800 } }));
vi.mock('Core/Client.js', () => ({
	default: {
		loadFile(path, callback) {
			callback?.(path);
		}
	}
}));
vi.mock('Controls/MouseEventHandler.js', () => ({ default: { screen: { x: 0, y: 0 } } }));
vi.mock('UI/UIManager.js', () => ({ default: { addComponent: c => c } }));
vi.mock('UI/GUIComponent.js', () => ({ default: mocks.MockGUIComponent }));

const ChatBoxSettings = (await import('UI/Components/ChatBoxSettings/ChatBoxSettings.js')).default;

const host = ChatBoxSettings._host;
host.innerHTML = ChatBoxSettings.render();
ChatBoxSettings.init();

const filters = () => [...host.querySelectorAll('.listoption button')];
const click = selector => host.querySelector(selector).click();

describe('ChatBoxSettings - filters, type tags and font', () => {
	let tab;
	let changed;

	beforeEach(() => {
		tab = { name: 'Public', font: { size: null, family: 'default' }, typeTags: false };
		changed = 0;
		ChatBoxSettings.styleOf = () => tab;
		ChatBoxSettings.setStyle = (_id, change) => {
			if (change.font) tab.font = { ...tab.font, ...change.font };
			if (typeof change.typeTags === 'boolean') tab.typeTags = change.typeTags;
		};
		ChatBoxSettings.onFiltersChanged = () => changed++;
		ChatBoxSettings.tabOption = [[1, 2]];
		ChatBoxSettings.updateTab(0, 'Public');
	});

	it('lays the filters out in two columns: all 22 message types', () => {
		expect(filters()).toHaveLength(22);
	});

	it('All on turns every filter of the tab on, All off every one off', () => {
		click('.allon');
		expect(ChatBoxSettings.tabOption[0]).toHaveLength(filters().length);
		expect(filters().every(btn => btn.classList.contains('on'))).toBe(true);
		click('.alloff');
		expect(ChatBoxSettings.tabOption[0]).toEqual([]);
		expect(filters().some(btn => btn.classList.contains('on'))).toBe(false);
		expect(changed).toBe(2);
	});

	it('a filter click toggles it and reports the change', () => {
		filters()[0].click();
		expect(ChatBoxSettings.tabOption[0]).toEqual([1, 2, 0]);
		expect(changed).toBe(1);
	});

	it('Show type tags toggles the tab\'s tags', () => {
		click('.typetags');
		expect(tab.typeTags).toBe(true);
		click('.typetags');
		expect(tab.typeTags).toBe(false);
	});

	it('- and + step the size by 1 px from the default 12, within 10-20; Reset goes back to the default', () => {
		click('.larger');
		expect(tab.font.size).toBe(13);
		expect(host.querySelector('.font-size .size').textContent).toBe('13 px');
		for (let i = 0; i < 20; i++) click('.larger');
		expect(tab.font.size).toBe(20);
		expect(host.querySelector('.larger').disabled).toBe(true);
		for (let i = 0; i < 20; i++) click('.smaller');
		expect(tab.font.size).toBe(10);
		click('.reset');
		expect(tab.font.size).toBe(null);
		expect(host.querySelector('.font-size .size').textContent).toBe('Default');
	});

	it('lists the eight families; one this computer lacks is greyed out and cannot be picked', () => {
		const families = [...host.querySelectorAll('.families button')];
		expect(families.map(b => b.dataset.family)).toEqual([
			'default', 'segoe', 'tahoma', 'verdana', 'arial', 'consolas', 'courier', 'gulim'
		]);
		// jsdom measures no fonts: every named family counts as not installed
		const segoe = families[1];
		expect(segoe.disabled).toBe(true);
		expect(segoe.textContent).toBe('Segoe UI (not installed)');
		segoe.click();
		expect(tab.font.family).toBe('default');
		expect(families[0].disabled).toBe(false);
		expect(families[0].classList.contains('on')).toBe(true);
	});
});
