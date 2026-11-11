/**
 * UI/Components/ChatBoxSettings/ChatBoxSettings.js
 *
 * Chat Box Settings
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

import DB from 'DB/DBManager.js';
import Preferences from 'Core/Preferences.js';
import Renderer from 'Renderer/Renderer.js';
import Client from 'Core/Client.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import {
	CHAT_FONT_FAMILIES,
	CHAT_FONT_LABELS,
	CHAT_FONT_SIZE,
	UI_FONT_STACK,
	fontInstalled
} from 'UI/Components/ChatBox/ChatFonts.js';
import htmlText from './ChatBoxSettings.html?raw';
import cssText from './ChatBoxSettings.css?raw';

/**
 * Create Component
 */
const ChatBoxSettings = new GUIComponent('ChatBoxSettings', cssText);

/**
 * Render HTML
 */
ChatBoxSettings.render = () => htmlText;

/**
 * @var {boolean} is ChatBoxSettings open ? (Temporary fix)
 */
ChatBoxSettings.isOpen = false;

ChatBoxSettings.tabOption = [];

ChatBoxSettings.activeTab = 0;

/**
 * @var {Preference} structure to save
 */
const _preferences = Preferences.get(
	'ChatBoxSettings',
	{
		x: 480,
		y: 200
	},
	1.0
);

/**
 * The active tab's font and type tags, and how to change them: ChatBox fills these in (it owns the tabs; this window
 * only shows and edits them). `onFiltersChanged` runs after the player changes a tab's filters.
 */
ChatBoxSettings.styleOf = () => null;
ChatBoxSettings.setStyle = () => {};
ChatBoxSettings.onFiltersChanged = () => {};

/**
 * Initialize UI
 */
ChatBoxSettings.init = function init() {
	const root = this.getRoot();

	const closeBtn = root.querySelector('.close');
	if (closeBtn) {
		closeBtn.addEventListener('click', () => {
			this._host.style.display = 'none';
		});
	}

	// Event delegation for option buttons
	const listOption = root.querySelector('.listoption');
	if (listOption) {
		listOption.addEventListener('click', event => {
			const btn = event.target.closest('button');
			if (btn) {
				onClickOption(btn);
			}
		});
	}

	root.querySelector('.allon')?.addEventListener('click', () => setAllFilters(true));
	root.querySelector('.alloff')?.addEventListener('click', () => setAllFilters(false));
	root.querySelector('.typetags')?.addEventListener('click', () => {
		const style = ChatBoxSettings.styleOf(ChatBoxSettings.activeTab);
		if (style) ChatBoxSettings.setStyle(ChatBoxSettings.activeTab, { typeTags: !style.typeTags });
		updateStyle();
	});

	root.querySelector('.smaller')?.addEventListener('click', () => stepSize(-1));
	root.querySelector('.larger')?.addEventListener('click', () => stepSize(1));
	root.querySelector('.reset')?.addEventListener('click', () => {
		ChatBoxSettings.setStyle(ChatBoxSettings.activeTab, { font: { size: null } });
		updateStyle();
	});

	const families = root.querySelector('.families');
	if (families) {
		for (const [id, label] of Object.entries(CHAT_FONT_LABELS)) {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.dataset.family = id;
			const face = CHAT_FONT_FAMILIES[id];
			const installed = fontInstalled(face);
			btn.textContent = installed ? label : `${label} (not installed)`;
			btn.disabled = !installed;
			if (face && installed) btn.style.fontFamily = `"${face}", ${UI_FONT_STACK}`;
			families.appendChild(btn);
		}
		families.addEventListener('click', event => {
			const btn = event.target.closest('button');
			if (!btn || btn.disabled) return;
			ChatBoxSettings.setStyle(ChatBoxSettings.activeTab, { font: { family: btn.dataset.family } });
			updateStyle();
		});
	}

	this.draggable('.titlebar');
};

/**
 * @returns {Array<number>} the id of every filter in the list
 */
function filterIds() {
	const buttons = ChatBoxSettings.getRoot().querySelectorAll('.listoption button');
	return Array.from(buttons, btn => parseInt(btn.getAttribute('data-id'), 10));
}

/** Every filter of the active tab on, or every one off. */
function setAllFilters(on) {
	ChatBoxSettings.tabOption[ChatBoxSettings.activeTab] = on ? filterIds() : [];
	ChatBoxSettings.updateTab(
		ChatBoxSettings.activeTab,
		ChatBoxSettings.getRoot().querySelector('.tabname').textContent
	);
	ChatBoxSettings.onFiltersChanged();
}

/** One pixel bigger or smaller; from the default, the step starts at the chat's 12 px. */
function stepSize(delta) {
	const style = ChatBoxSettings.styleOf(ChatBoxSettings.activeTab);
	if (!style) return;
	const current = Number.isInteger(style.font?.size) ? style.font.size : DEFAULT_SIZE;
	const size = Math.min(Math.max(current + delta, CHAT_FONT_SIZE.min), CHAT_FONT_SIZE.max);
	ChatBoxSettings.setStyle(ChatBoxSettings.activeTab, { font: { size } });
	updateStyle();
}

/** The chat's own size (12 px), where - and + start from a tab without a size. */
const DEFAULT_SIZE = 12;

/** Shows the active tab's size, family and type tags. */
function updateStyle() {
	const root = ChatBoxSettings.getRoot();
	const style = ChatBoxSettings.styleOf(ChatBoxSettings.activeTab);
	const size = style && Number.isInteger(style.font?.size) ? style.font.size : null;
	const sizeEl = root.querySelector('.font-size .size');
	if (sizeEl) sizeEl.textContent = size ? `${size} px` : 'Default';
	const smaller = root.querySelector('.smaller');
	const larger = root.querySelector('.larger');
	if (smaller) smaller.disabled = size !== null && size <= CHAT_FONT_SIZE.min;
	if (larger) larger.disabled = size !== null && size >= CHAT_FONT_SIZE.max;
	const family = style?.font?.family || 'default';
	root.querySelectorAll('.families button').forEach(btn => {
		const picked = btn.dataset.family === family;
		btn.classList.toggle('on', picked);
		Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/grp_' + (picked ? 'online' : 'offline') + '.bmp', data => {
			btn.style.backgroundImage = 'url(' + data + ')';
		});
	});
	const check = root.querySelector('.typetags .check');
	if (check) {
		Client.loadFile(`${DB.INTERFACE_PATH}checkbox_${style?.typeTags ? 1 : 0}.bmp`, data => {
			check.style.backgroundImage = `url(${data})`;
		});
	}
}

/**
 * Once in HTML
 */
ChatBoxSettings.onAppend = function onAppend() {
	const rect = this._host.getBoundingClientRect();
	this._host.style.top = Math.min(Math.max(0, _preferences.y), Renderer.height - rect.height) + 'px';
	this._host.style.left = Math.min(Math.max(0, _preferences.x), Renderer.width - rect.width) + 'px';
	this._host.style.display = 'none';
};

/**
 * Key Event Handler
 */
ChatBoxSettings.onKeyDown = function onKeyDown(event) {};

/**
 * Handle option button click
 */
function onClickOption(btn) {
	const dataId = parseInt(btn.getAttribute('data-id'), 10);
	const isOn = !btn.classList.contains('on');
	btn.classList.toggle('on', isOn);

	Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/grp_' + (isOn ? 'online' : 'offline') + '.bmp', data => {
		btn.style.backgroundImage = 'url(' + data + ')';
	});

	if (!isNaN(dataId)) {
		const list = (ChatBoxSettings.tabOption[ChatBoxSettings.activeTab] ||= []);
		const idsIndex = list.indexOf(dataId);
		if (idsIndex > -1) {
			list.splice(idsIndex, 1);
		} else {
			list.push(dataId);
		}
	}
	ChatBoxSettings.onFiltersChanged();
}

ChatBoxSettings.toggle = function toggle() {
	if (this._host.style.display === 'none') {
		this.ui.show();
	} else {
		this.ui.hide();
	}
};

ChatBoxSettings.updateTab = function updateTab(tabID, tabName) {
	const root = this.getRoot();
	const optList = ChatBoxSettings.tabOption[tabID];
	const buttons = root.querySelectorAll('.content .listoption button');

	this.activeTab = tabID;

	root.querySelector('.tabname').textContent = tabName;

	buttons.forEach(btn => {
		const id = parseInt(btn.getAttribute('data-id'), 10);
		const on = !!(optList && optList.includes(id));
		btn.classList.toggle('on', on);
		Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/grp_' + (on ? 'online' : 'offline') + '.bmp', data => {
			btn.style.backgroundImage = 'url(' + data + ')';
		});
	});

	updateStyle();
};

ChatBoxSettings.onRemove = function onRemove() {
	_preferences.y = parseInt(this._host.style.top, 10) || 0;
	_preferences.x = parseInt(this._host.style.left, 10) || 0;
	_preferences.save();
};

ChatBoxSettings.mouseMode = GUIComponent.MouseMode.STOP;

/**
 * Create component and export it
 */
export default UIManager.addComponent(ChatBoxSettings);
