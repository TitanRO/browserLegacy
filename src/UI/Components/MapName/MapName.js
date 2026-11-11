/**
 * UI/Components/MapName/MapName.js
 *
 * Map name notification overlay
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault, AoShinHo
 */

import DB from 'DB/DBManager.js';
import UIManager from 'UI/UIManager.js';
import GUIComponent from 'UI/GUIComponent.js';
import htmlText from './MapName.html?raw';
import cssText from './MapName.css?raw';
import Client from 'Core/Client.js';

/**
 * Create Component
 */
const MapName = new GUIComponent('MapName', cssText);

MapName.render = () => htmlText;

/**
 * Mouse can cross this UI
 */
MapName.mouseMode = GUIComponent.MouseMode.CROSS;

/**
 * @var {array} _mapinfo
 */
let _mapinfo = [];

/**
 * Previous map check vars
 */
let _currMap = '';
let _prevMap = '';
let _newMap = false;
/**
 * Timeout ID for fade-out
 *
 * @type {number|null}
 */
let _fadeTimeoutId = null;
/**
 * Timeout ID for removal
 *
 * @type {number|null}
 */
let _removeTimeoutId = null;

/**
 * Initialize UI
 */
MapName.init = function init() {};

/**
 * Append MapName
 */
MapName.onAppend = function onAppend() {
	// The browser's timers, not Events': Events counts from the last frame drawn, and entering the game after
	// login draws none for seconds, so its 6 s was already over at the first frame and the banner never showed.
	if (_fadeTimeoutId !== null) clearTimeout(_fadeTimeoutId);
	if (_removeTimeoutId !== null) clearTimeout(_removeTimeoutId);
	_fadeTimeoutId = null;
	_removeTimeoutId = null;

	if (_mapinfo && _mapinfo.notifyEnter && _newMap) {
		// The fade-in starts on the next frame, once the banner was laid out at :host's opacity 0 (reading
		// offsetHeight here forced a layout of every window just appended with it, ~50 ms when entering the game)
		const host = this._host;
		requestAnimationFrame(() => {
			host.style.opacity = '1';
		});

		// After 5s, start fade-out (CSS transition handles the animation)
		_fadeTimeoutId = setTimeout(() => {
			this._host.style.opacity = '0';
		}, 5000);

		// After 6s (5s wait + 1s CSS transition), remove
		_removeTimeoutId = setTimeout(() => {
			MapName.remove();
		}, 6000);
	} else {
		MapName.remove();
	}
};

/**
 * Set map
 *
 * @param {string} mapname
 */
MapName.setMap = function setMap(mapname) {
	if (!this.__loaded) {
		this.prepare();
	}

	const root = this.getRoot();

	_prevMap = _currMap;
	_currMap = mapname;
	_newMap = _currMap !== _prevMap;

	_mapinfo = DB.getMapInfo(mapname.replace('.gat', '.rsw'));

	const mapbg = root.querySelector('.mapbg');
	if (_mapinfo && _mapinfo.backgroundBmp) {
		Client.loadFile(`${DB.INTERFACE_PATH}display_mapname/${_mapinfo.backgroundBmp}.png`, dataURI => {
			mapbg.style.backgroundImage = `url('${dataURI}')`;
		});
	} else {
		mapbg.style.backgroundImage = 'none';
	}

	const mapsubtitle = root.querySelector('.mapsubtitle');
	if (_mapinfo && _mapinfo.signName && _mapinfo.signName.subTitle) {
		mapsubtitle.textContent = _mapinfo.signName.subTitle;
	} else {
		mapsubtitle.textContent = '';
	}

	const maptitle = root.querySelector('.maptitle');
	if (_mapinfo && _mapinfo.signName && _mapinfo.signName.mainTitle) {
		maptitle.textContent = _mapinfo.signName.mainTitle;
	} else {
		maptitle.textContent = '';
	}
};

/**
 * Remove MapName from window (and so clean up items)
 */
MapName.onRemove = function OnRemove() {
	const root = this.getRoot();
	if (!root) return;

	root.querySelector('.mapbg').style.backgroundImage = 'none';
	root.querySelector('.mapsubtitle').textContent = '';
	root.querySelector('.maptitle').textContent = '';
};

/**
 * Resets the state of the MapName component.
 */
MapName.resetState = function () {
	_currMap = '';
	_prevMap = '';
	_newMap = false;
};

/**
 * Create component and export it
 */
export default UIManager.addComponent(MapName);
