/**
 * UI/Components/WinStats/WinStatsV3.js
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
	var DB                 = require('DB/DBManager');
	var Client             = require('Core/Client');
	var DOM                = require('Utils/DOM');
	var UIComponent        = require('UI/UIComponent');
	var UIManager          = require('UI/UIManager');
	var Session            = require('Engine/SessionStorage');
	var Preferences        = require('Core/Preferences');
	var Renderer           = require('Renderer/Renderer');

	var htmlText           = require('text!./WinStatsV3.html');
	var cssText            = require('text!./WinStatsV3.css');

	/**
	 * Create component
	 */
	var WinStatsV3 = new UIComponent( 'WinStatsV3', htmlText, cssText );

	/**
	 * @var {Preferences} structure
	 */
	var _preferences = Preferences.get('WinStatsV3', {
		x:        0,
		y:        233,
		show:     false,
		reduce:   false
	}, 2.0);


	function qs(selector)
	{
		return DOM.qs(WinStatsV3.ui, selector);
	}


	function qsa(selector)
	{
		return DOM.qsa(WinStatsV3.ui, selector);
	}


	function setText(selector, value)
	{
		qsa(selector).forEach(function(el) {
			el.textContent = value;
		});
	}


	/**
	 * Initialize UI
	 */
	WinStatsV3.init = function init()
	{
		this.statuspoint = 0;
		this.t_statuspoint = 0;

		qsa('.up button').forEach(function(btn) {
			btn.addEventListener('mousedown', function() {
				switch (this.className) {
					case 'str': WinStatsV3.onRequestUpdate( 13, 1 ); break;
					case 'agi': WinStatsV3.onRequestUpdate( 14, 1 ); break;
					case 'vit': WinStatsV3.onRequestUpdate( 15, 1 ); break;
					case 'int': WinStatsV3.onRequestUpdate( 16, 1 ); break;
					case 'dex': WinStatsV3.onRequestUpdate( 17, 1 ); break;
					case 'luk': WinStatsV3.onRequestUpdate( 18, 1 ); break;
				}
			});
		});

		qsa('.t_up button').forEach(function(btn) {
			btn.addEventListener('mousedown', function() {
				switch (this.className) {
					case 'pow': WinStatsV3.onRequestUpdate( 219, 1 ); break;
					case 'sta': WinStatsV3.onRequestUpdate( 220, 1 ); break;
					case 'wis': WinStatsV3.onRequestUpdate( 221, 1 ); break;
					case 'spl': WinStatsV3.onRequestUpdate( 222, 1 ); break;
					case 'con': WinStatsV3.onRequestUpdate( 223, 1 ); break;
					case 'crt': WinStatsV3.onRequestUpdate( 224, 1 ); break;
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
				DOM.hide(WinStatsV3.ui);
			});
		}

		this.draggable(qs('.titlebar'));

		var traitsBtn = qs('.view_traits');
		if (traitsBtn) {
			traitsBtn.addEventListener('mousedown', toggleTraits);
		}
	};


	/**
	 * Stack to store things if the UI is not in html
	 */
	WinStatsV3.stack = [];


	/**
	 * Execute elements in memory
	 */
	WinStatsV3.onAppend = function onAppend()
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
	WinStatsV3.update = function update( type, val )
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

			case 'trait_point':
				this.t_statuspoint = val;
				qsa('.t_requirements div').forEach(function(div) {
					btn = qs('.t_up .' + div.className);
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
			case 'patk':
			case 'smatk':
			case 'hplus':
			case 'crate':
			case 'res':
			case 'mres':
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
			case 'pow':
			case 'sta':
			case 'wis':
			case 'spl':
			case 'con':
			case 'crt':
				setText('.stats .' + type, val);
				break;

			case 'str2':
			case 'agi2':
			case 'vit2':
			case 'int2':
			case 'dex2':
			case 'luk2':
			case 'pow2':
			case 'sta2':
			case 'wis2':
			case 'spl2':
			case 'con2':
			case 'crt2':
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

			case 'pow3':
			case 'sta3':
			case 'wis3':
			case 'spl3':
			case 'con3':
			case 'crt3':
				setText('.t_requirements .' + type.replace('3', ''), val);
				btn = qs('.t_up .' + type.replace('3', ''));
				if (btn) {
					DOM.setCss(btn, {
						opacity: val && this.t_statuspoint > 1 ? 1 : 0,
						pointerEvents: val && this.t_statuspoint > 1 ? 'initial' : 'none'
					});
				}
				break;
		}
	};

	/**
	 * Display or not status window
	 */
	function toggleTraits()
	{
		var status = qs('.traits_component');
		var self   = qs('.view_traits');
		var state  = DOM.isVisible(status) ? 'on' : 'off';

		DOM.toggleDisplay(status);

		Client.loadFile( DB.INTERFACE_PATH + 'statuswnd/expand_' + state + '_normal.bmp', function(data){
			if (self) {
				self.style.backgroundImage = 'url(' + data + ')';
			}
		});
	}

	/**
	 * Start/stop rendering character in UI
	 */
	WinStatsV3.toggle = function toggle()
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
	WinStatsV3.onShortCut = function onShurtCut( key )
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
	WinStatsV3.onRemove = function onRemove()
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
	WinStatsV3.onRequestUpdate = function onRequestUpdate(/*id, amount*/){};


	return UIManager.addComponent(WinStatsV3);
});
