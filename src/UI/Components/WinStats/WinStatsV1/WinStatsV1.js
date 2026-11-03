/**
 * UI/Components/WinStats/WinStatsV1.js
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

	var htmlText           = require('text!./WinStatsV1.html');
	var cssText            = require('text!./WinStatsV1.css');

	/**
	 * Create component
	 */
	var WinStatsV1 = new UIComponent( 'WinStatsV1', htmlText, cssText );


	function qs(selector)
	{
		return DOM.qs(WinStatsV1.ui, selector);
	}


	function qsa(selector)
	{
		return DOM.qsa(WinStatsV1.ui, selector);
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
	WinStatsV1.init = function init()
	{
		this.statuspoint = 0;

		qsa('.up button').forEach(function(btn) {
			btn.addEventListener('mousedown', function() {
				switch (this.className) {
					case 'str': WinStatsV1.onRequestUpdate( 13, 1 ); break;
					case 'agi': WinStatsV1.onRequestUpdate( 14, 1 ); break;
					case 'vit': WinStatsV1.onRequestUpdate( 15, 1 ); break;
					case 'int': WinStatsV1.onRequestUpdate( 16, 1 ); break;
					case 'dex': WinStatsV1.onRequestUpdate( 17, 1 ); break;
					case 'luk': WinStatsV1.onRequestUpdate( 18, 1 ); break;
				}
			});
		});
	};

	/**
	 * Stack to store things if the UI is not in html
	 */
	WinStatsV1.stack = [];


	/**
	 * Execute elements in memory
	 */
	WinStatsV1.onAppend = function onAppend()
	{
		var i, count;

		for (i = 0, count = this.stack.length; i < count; ++i) {
			this.update.apply( this, this.stack[i]);
		}

		this.stack.length = 0;
	};


	/**
	 * Update UI elements
	 *
	 * @param {string} type identifier
	 * @param {number} val1
	 * @param {number} val2 (optional)
	 */
	WinStatsV1.update = function update( type, val )
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
						opacity: val && WinStatsV1.t_statuspoint > 1 ? 1 : 0,
						pointerEvents: val && WinStatsV1.t_statuspoint > 1 ? 'initial' : 'none'
					});
				}
				break;
		}
	};

	/**
	 * Abstract method to define
	 */
	WinStatsV1.onRequestUpdate = function onRequestUpdate(/*id, amount*/){};

	return UIManager.addComponent(WinStatsV1);
});
