/**
 * Plugins/Helpers/HelperPanels.js
 *
 * Helper panels (Build-in roadmap F2): small game windows (exp, loot log, target HP, ...) that look and behave like the
 * game's own: the client's window frame and title bar (basic_interface art), dragged by the title bar, closed with its
 * button. The Windows client builds the same panels as native client windows.
 *
 * Each panel's place and whether it's open are helper settings (`panels.<id>`), and a feature setting turns the panel
 * on (e.g. zonePanel.enabled), so they follow the player between clients. Two key bindings from the settings: `keys.panels` shows or
 * hides every panel that's on, and `keys.helperWindow` opens the "TitanRO helpers" window, which turns panels on and
 * off.
 *
 * @author Trojal
 */

import GUIComponent from 'UI/GUIComponent.js';
import UIManager from 'UI/UIManager.js';
import { isTyping, matchesKey } from './Keys.js';
import cssText from './HelperPanel.css?raw';

const PREFIX = 'TitanROHelper_';

const frame = (title, cls) => `
<div class="helper-window ${cls}">
	<div class="titlebar" data-background="basic_interface/titlebar_mid.bmp">
		<div class="left">
			<button class="base" data-background="basic_interface/sys_base_off.bmp" data-hover="basic_interface/sys_base_on.bmp"></button>
			<span class="text"></span>
		</div>
		<div class="right">
			<button class="base close" data-background="basic_interface/sys_close_off.bmp" data-hover="basic_interface/sys_close_on.bmp"></button>
		</div>
		<div class="clear"></div>
	</div>
	<div class="body"></div>
</div>`;

/** A game window for a helper: title bar, close button, a body the panel fills. */
function makeWindow(name, title, width, onClose, onMoved) {
	const component = new GUIComponent(name, cssText);
	component.render = () => frame(title, name);
	component.init = function init() {
		const root = this.getRoot();
		root.querySelector('.titlebar .text').textContent = title;
		this._host.style.width = width + 'px';
		root.querySelector('.titlebar .base:not(.close)').addEventListener('mousedown', event =>
			event.stopImmediatePropagation()
		);
		root.querySelector('.close').addEventListener('click', event => {
			event.preventDefault();
			event.stopImmediatePropagation();
			onClose();
		});
		root.querySelector('.helper-window').addEventListener('contextmenu', event => event.preventDefault());
		this.draggable('.titlebar');
		// the game's drag ends on a mouseup over the window; the place is read once it has moved there
		root.querySelector('.titlebar').addEventListener('mouseup', () => setTimeout(onMoved, 0));
	};
	component.body = () => component.getRoot().querySelector('.body');
	return UIManager.addComponent(component);
}

export class HelperPanels {
	/**
	 * @param {object} options
	 * @param {HelperSettingsClient} options.settings
	 * @param {function} options.inGame - whether a map is loaded (panels and keys only work then)
	 * @param {Window} [options.window]
	 */
	constructor({ settings, inGame, window: win }) {
		this.settings = settings;
		this.inGame = inGame;
		this.panels = new Map();
		this._win = win || globalThis.window;
		this._options = null;
		settings.onChange(() => this.refresh());
		this._win.addEventListener('keydown', event => this._onKeyDown(event), true);
	}

	/**
	 * A panel:
	 *   id      - its settings id (panels.<id>): a-z, then letters and digits
	 *   title   - the title bar's text
	 *   width   - pixels
	 *   enabled - [section, key] of the setting that turns it on
	 *   mount(body) - fills the body once; may return {update(), unmount()}
	 */
	register(definition) {
		const panel = { ...definition, view: null };
		panel.window = makeWindow(
			PREFIX + definition.id,
			definition.title,
			definition.width || 180,
			() => this.setOpen(definition.id, false),
			() => this._saveMoved(panel)
		);
		panel.window.onAppend = () => {
			const { x, y } = this.settings.panel(definition.id);
			panel.window._host.style.left = x + 'px';
			panel.window._host.style.top = y + 'px';
			if (!panel.view) panel.view = definition.mount(panel.window.body()) || {};
			if (panel.view.update) panel.view.update();
		};
		panel.window.onRemove = () => this._saveMoved(panel);
		this.panels.set(definition.id, panel);
		this.refresh();
		return panel;
	}

	enabled(id) {
		const panel = this.panels.get(id);
		return !!panel && this.settings.get(panel.enabled[0], panel.enabled[1]) === true;
	}

	/** Shown: turned on, open, and in the game. */
	shown(id) {
		return this.enabled(id) && this.settings.panel(id).visible && this.inGame();
	}

	/** Opens or closes a panel (saved). */
	setOpen(id, open) {
		this.settings.set({ panels: { [id]: { visible: !!open } } });
	}

	/** Turns a panel's feature on or off; turning it on opens it. */
	setEnabled(id, on) {
		const panel = this.panels.get(id);
		if (!panel) return;
		this.settings.set({
			[panel.enabled[0]]: { [panel.enabled[1]]: !!on },
			...(on ? { panels: { [id]: { visible: true } } } : {})
		});
	}

	/** keys.panels: hides every open panel, or opens every panel that's on when none is open. */
	toggleAll() {
		const on = [...this.panels.keys()].filter(id => this.enabled(id));
		const anyOpen = on.some(id => this.settings.panel(id).visible);
		if (!on.length) return;
		this.settings.set({ panels: Object.fromEntries(on.map(id => [id, { visible: !anyOpen }])) });
	}

	/** Shows what should be shown and hides the rest (after a settings change, and on entering a map). */
	refresh() {
		for (const [id, panel] of this.panels) {
			const show = this.shown(id);
			if (show && !panel.window.__active) panel.window.append();
			else if (!show && panel.window.__active) panel.window.remove();
			else if (show && panel.view && panel.view.update) panel.view.update();
		}
		if (this._options && this._options.__active) this._renderOptions();
	}

	/** Called on every change of map or zone, so panels can show it. */
	update() {
		for (const panel of this.panels.values())
			if (panel.view && panel.view.update && panel.window.__active) panel.view.update();
	}

	/** The "TitanRO helpers" window: every panel, with a box to turn it on. */
	toggleOptions() {
		if (!this._options) {
			this._options = makeWindow(
				PREFIX + 'Options',
				'TitanRO helpers',
				200,
				() => this._options.remove(),
				() => {}
			);
			this._options.onAppend = () => {
				const host = this._options._host;
				host.style.left = Math.max(0, Math.round((this._win.innerWidth - 200) / 2)) + 'px';
				host.style.top = '120px';
				this._renderOptions();
			};
		}
		if (this._options.__active) this._options.remove();
		else this._options.append();
	}

	_renderOptions() {
		const body = this._options.body();
		body.textContent = '';
		const list = document.createElement('div');
		list.className = 'options';
		for (const [id, panel] of this.panels) {
			const label = document.createElement('label');
			const box = document.createElement('input');
			box.type = 'checkbox';
			box.checked = this.enabled(id);
			box.addEventListener('change', () => this.setEnabled(id, box.checked));
			label.append(box, ' ' + panel.title);
			list.append(label);
		}
		const hint = document.createElement('div');
		hint.className = 'hint';
		hint.textContent = (this.settings.get('keys', 'panels') || '') + ': show or hide the panels';
		body.append(list, hint);
	}

	_saveMoved(panel) {
		const host = panel.window._host;
		if (!host || !panel.window.__active) return;
		const x = parseInt(host.style.left, 10);
		const y = parseInt(host.style.top, 10);
		const saved = this.settings.panel(panel.id);
		if (Number.isFinite(x) && Number.isFinite(y) && (x !== saved.x || y !== saved.y)) {
			this.settings.set({ panels: { [panel.id]: { x, y } } });
		}
	}

	_onKeyDown(event) {
		if (!this.inGame() || isTyping(event)) return;
		const keys = this.settings.settings.keys || {};
		let handled = false;
		if (matchesKey(event, keys.helperWindow)) {
			this.toggleOptions();
			handled = true;
		} else if (matchesKey(event, keys.panels)) {
			this.toggleAll();
			handled = true;
		}
		if (handled) {
			event.preventDefault();
			event.stopImmediatePropagation();
		}
	}
}
