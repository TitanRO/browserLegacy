/**
 * UI/Components/WinStats/WinStats.js
 *
 * Chararacter Statistiques Informations
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */
define(function(require)
{
	'use strict';


	/**
	 * Dependencies
	 */
	var DOM                = require('Utils/DOM');
	var UIComponent        = require('UI/UIComponent');
	var UIManager          = require('UI/UIManager');
	var Session            = require('Engine/SessionStorage');
	var Preferences        = require('Core/Preferences');
	var Renderer           = require('Renderer/Renderer');

	var htmlText           = require('text!./WinStats.html');
	var cssText            = require('text!./WinStats.css');

	/**
	 * Create component
	 */
	var WinStats = new UIComponent( 'WinStats', htmlText, cssText );


	function qs(selector)
	{
		return DOM.qs(WinStats.ui, selector);
	}


	function qsa(selector)
	{
		return DOM.qsa(WinStats.ui, selector);
	}


	function setText(selector, value)
	{
		qsa(selector).forEach(function(el) {
			el.textContent = value;
		});
	}


	/**
	 * @var {Preferences} structure
	 */
		var _preferences = Preferences.get('WinStats', {
			x:        0,
			y:        233,
			show:     false,
			reduce:   false,
	}, 1.0);

	/**
	 * Initialize UI
	 */
	WinStats.init = function init()
	{
		this.statuspoint = 0;

		qsa('.up button').forEach(function(btn) {
			btn.addEventListener('mousedown', function() {
				switch (this.className) {
					case 'str': WinStats.onRequestUpdate( 13, 1 ); break;
					case 'agi': WinStats.onRequestUpdate( 14, 1 ); break;
					case 'vit': WinStats.onRequestUpdate( 15, 1 ); break;
					case 'int': WinStats.onRequestUpdate( 16, 1 ); break;
					case 'dex': WinStats.onRequestUpdate( 17, 1 ); break;
					case 'luk': WinStats.onRequestUpdate( 18, 1 ); break;
				}
			});
		});

		var mini = qs('.titlebar .mini');
		if (mini) {
			mini.addEventListener('click', function() {
				DOM.toggleDisplay(qs('.panel'));
			});
		}

		var closeBtn = qs('.titlebar .close');
		if (closeBtn) {
			closeBtn.addEventListener('click', function() {
				DOM.hide(WinStats.ui);
			});
		}

		this.draggable(qs('.titlebar'));
	};

	/**
	 * Stack to store things if the UI is not in html
	 */
	WinStats.stack = [];

	WinStats.append = function append(target) {
		// ignoring target, to for WinStats not to be attached to equipment window
		UIComponent.prototype.append.call(this);
	}


	/**
	 * Execute elements in memory
	 */
	WinStats.onAppend = function onAppend()
	{
		var i, count;

		for (i = 0, count = this.stack.length; i < count; ++i) {
			this.update.apply( this, this.stack[i]);
		}

		this.stack.length = 0;

		DOM.setCss(this.ui, {
			top:  Math.min( Math.max( 0, _preferences.y), Renderer.height - this.ui.offsetHeight) + 'px',
			left: Math.min( Math.max( 0, _preferences.x), Renderer.width  - this.ui.offsetWidth) + 'px'
		});

		if (!_preferences.show) {
			DOM.hide(this.ui);
		}

	};


	/**
	 * Update UI elements
	 *
	 * @param {string} type identifier
	 * @param {number} val1
	 * @param {number} val2 (optional)
	 */
	WinStats.update = function update( type, val )
	{
		var str, btn;

		if (!this.__loaded) {
			this.stack.push(arguments);
			return;
		}

		switch (type) {
			case 'statuspoint':
				this.statuspoint = val;
				qsa('.requirements div').forEach(function(div) {
					btn = qs('.up .' + div.className);
					if (btn) {
						DOM.setCss(btn, {
							opacity: parseInt(div.textContent, 10) <= val ? 1 : 0,
							pointerEvents: parseInt(div.textContent, 10) <= val ? 'initial' : 'none'
						});
					}
				});
				setText('.' + type, val);
				break;

			case 'guildname':
			case 'atak':
			case 'matak':
			case 'def':
			case 'mdef':
			case 'hit':
			case 'flee':
			case 'critical':
				setText('.' + type, val);
				break;

			case 'aspd':
				setText('.' + type, Math.floor(200 - val / 10));
				break;

			case 'matak2':
				if (!Session.isRenewal) {
					setText('.' + type, '~ ' + val);
					break;
				}
			case 'atak2':
			case 'def2':
			case 'mdef2':
			case 'flee2':
				str = val < 0 ? '- ' + (-val) : '+ ' + val;
				setText('.' + type, str);
				break;

			case 'str':
			case 'agi':
			case 'vit':
			case 'int':
			case 'dex':
			case 'luk':
				setText('.stats .' + type, val);
				break;

			case 'str2':
			case 'agi2':
			case 'vit2':
			case 'int2':
			case 'dex2':
			case 'luk2':
				str = val < 0 ? '- ' + (-val) : val > 0 ? '+' + val : '';
				setText('.bonus .' + type.replace('2', ''), str);
				break;

			case 'str3':
			case 'agi3':
			case 'vit3':
			case 'int3':
			case 'dex3':
			case 'luk3':
				setText('.requirements .' + type.replace('3', ''), val);
				btn = qs('.up .' + type.replace('3', ''));
				if (btn) {
					DOM.setCss(btn, {
						opacity: val <= this.statuspoint ? 1 : 0,
						pointerEvents: val <= this.statuspoint ? 'initial' : 'none'
					});
				}
				break;
		}
	};

	/**
	 * Start/stop rendering character in UI
	 */
	WinStats.toggle = function toggle()
	{
		DOM.toggleDisplay(this.ui);

		if (DOM.isVisible(this.ui)) {
			this.focus();
		}
	};

	/**
	 * Process shortcut
	 *
	 * @param {object} key
	 */
	WinStats.onShortCut = function onShurtCut( key )
	{
		switch (key.cmd) {
			case 'TOGGLE':
				DOM.toggleDisplay(this.ui);
				break;
		}
	};

	/**
	 * Remove WinStats window
	 */
	WinStats.onRemove = function onRemove()
	{
		var panel;

		// Save preferences
		if (_preferences) {
			panel = qs('.panel');
			_preferences.show   =  DOM.isVisible(this.ui);
			_preferences.reduce =  panel ? panel.style.display === 'none' : false;
			_preferences.y      =  parseInt(this.ui.style.top, 10);
			_preferences.x      =  parseInt(this.ui.style.left, 10);
			_preferences.save();
		}
	};

	/**
	 * Abstract method to define
	 */
	WinStats.onRequestUpdate = function onRequestUpdate(/*id, amount*/){};


	return UIManager.addComponent(WinStats);
});
