/**
 * UI/Components/BasicInfo/BasicInfo.js
 *
 * Chararacter Basic information windows
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
	var DOM                = require('Utils/DOM');
	var MonsterTable       = require('DB/Monsters/MonsterTable');
	var Client             = require('Core/Client');
	var Preferences        = require('Core/Preferences');
	var Renderer           = require('Renderer/Renderer');
	var Session            = require('Engine/SessionStorage');
	var UIManager          = require('UI/UIManager');
	var UIComponent        = require('UI/UIComponent');
	var Inventory          = require('UI/Components/Inventory/Inventory');
	var Equipment          = require('UI/Components/Equipment/Equipment');
	var PartyFriends       = require('UI/Components/PartyFriends/PartyFriends');
	var Guild              = require('UI/Components/Guild/Guild');
	var Escape             = require('UI/Components/Escape/Escape');
	var WorldMap           = require('UI/Components/WorldMap/WorldMap');
	var PACKETVER          = require('Network/PacketVerManager');

	// Version Dependent UIs
	var SkillList = require('UI/Components/SkillList/SkillList');
	var Quest     = require('UI/Components/Quest/Quest');

	var htmlText           = require('text!./BasicInfo.html');
	var cssText            = require('text!./BasicInfo.css');
	/**
	 * Create Basic Info component
	 */
	var BasicInfo = new UIComponent( 'BasicInfo', htmlText, cssText );


	function qs(selector)
	{
		return DOM.qs(BasicInfo.ui, selector);
	}


	function qsa(selector)
	{
		return DOM.qsa(BasicInfo.ui, selector);
	}


	function setText(selector, value)
	{
		qsa(selector).forEach(function(el) {
			el.textContent = value;
		});
	}


	function toggleSizeClass()
	{
		if (BasicInfo.ui.classList.contains('large')) {
			BasicInfo.ui.classList.remove('large');
			BasicInfo.ui.classList.add('small');
		}
		else {
			BasicInfo.ui.classList.remove('small');
			BasicInfo.ui.classList.add('large');
		}
	}


	/**
	 * Stored data
	 */
	BasicInfo.base_exp      = 0;
	BasicInfo.base_exp_next = 1;
	BasicInfo.job_exp       = 0;
	BasicInfo.job_exp_next  =-1;
	BasicInfo.weight        = 0;
	BasicInfo.weight_max    = 1;


	/**
	 * @var {Preferences} structure
	 */
	var _preferences = Preferences.get('BasicInfo', {
		x:        0,
		y:        0,
		reduce:   true,
		buttons:  true,
		magnet_top: true,
		magnet_bottom: false,
		magnet_left: true,
		magnet_right: false
	}, 1.0);


	/**
	 * Initialize UI
	 */
	BasicInfo.init = function init()
	{
		qsa('.topbar button').forEach(function(btn) {
			btn.addEventListener('mousedown', function(event) {
				event.stopImmediatePropagation();
			});
		});

		var right = qs('.topbar .right');
		if (right) {
			right.addEventListener('click', BasicInfo.toggleMode.bind(this));
		}

		var toggleBtns = qs('.toggle_btns');
		if (toggleBtns) {
			toggleBtns.addEventListener('mousedown', BasicInfo.toggleButtons.bind(this));
		}

		qsa('.buttons button').forEach(function(btn) {
			btn.addEventListener('mousedown', function() {
				switch (this.className) {
					case 'item':
						Inventory.getUI().toggle();
						break;

					case 'info':
						Equipment.getUI().toggle();
						break;

					case 'skill':
						SkillList.getUI().toggle();
						break;

					case 'option':
						Escape.toggle();
						break;

					case 'party':
						PartyFriends.toggle();
						break;

					case 'guild':
						Guild.toggle();
						break;

					case 'map':
						WorldMap.toggle();
						break;

					case 'quest':
						Quest.getUI().toggle();
						break;
				}
			});
		});

		this.draggable();
	};


	/**
	 * When append the element to html
	 * Execute elements in memory
	 */
	BasicInfo.onAppend = function onAppend()
	{
		var buttons = qs('.buttons');

		DOM.setCss(this.ui, {
			top:  Math.min( Math.max( 0, _preferences.y), Renderer.height - this.ui.offsetHeight) + 'px',
			left: Math.min( Math.max( 0, _preferences.x), Renderer.width  - this.ui.offsetWidth) + 'px'
		});

		this.magnet.TOP = _preferences.magnet_top;
		this.magnet.BOTTOM = _preferences.magnet_bottom;
		this.magnet.LEFT = _preferences.magnet_left;
		this.magnet.RIGHT = _preferences.magnet_right;

		this.ui.classList.remove('small', 'large');
		if (_preferences.reduce) {
			this.ui.classList.add('small');

			if (_preferences.buttons) {
				DOM.show(buttons);
			}
			else {
				DOM.hide(buttons);
			}
		}
		else {
			this.ui.classList.add('large');
		}
	};


	/**
	 * Once remove, save preferences
	 */
	BasicInfo.onRemove = function onRemove()
	{
		var buttons = qs('.buttons');

		_preferences.x       = parseInt(this.ui.style.left, 10);
		_preferences.y       = parseInt(this.ui.style.top, 10);
		_preferences.reduce  = this.ui.classList.contains('small');
		_preferences.buttons = buttons ? DOM.isVisible(buttons) : false;
		_preferences.magnet_top = this.magnet.TOP;
		_preferences.magnet_bottom = this.magnet.BOTTOM;
		_preferences.magnet_left = this.magnet.LEFT;
		_preferences.magnet_right = this.magnet.RIGHT;
		_preferences.save();
	};


	/**
	 * Process shortcut
	 *
	 * @param {object} key
	 */
	BasicInfo.onShortCut = function onShortCut( key )
	{
		switch (key.cmd) {
			case 'EXTEND':
				this.toggleMode();
				break;
		}
	};


	/**
	 * Switch window size
	 */
	BasicInfo.toggleMode = function toggleMode()
	{
		var type;

		toggleSizeClass();

		if (this.ui.classList.contains('large')) {
			DOM.show(qs('.buttons'));
			return;
		}

		if (_preferences.buttons) {
			DOM.show(qs('.buttons'));
			type = 'off';
		}
		else {
			DOM.hide(qs('.buttons'));
			type = 'on';
		}

		Client.loadFile( DB.INTERFACE_PATH + 'basic_interface/view' + type + '.bmp', function(url) {
			var toggle = qs('.toggle_btns');
			if (toggle) {
				toggle.style.backgroundImage = 'url(' + url + ')';
			}
		});
	};


	/**
	 * Toggle the list of buttons
	 */
	BasicInfo.toggleButtons = function toggleButtons( event )
	{
		var type;
		var buttons = qs('.buttons');

		_preferences.buttons = buttons ? !DOM.isVisible(buttons) : false;

		if (_preferences.buttons) {
			DOM.show(buttons);
			type = 'off';
		}
		else {
			DOM.hide(buttons);
			type = 'on';
		}

		Client.loadFile( DB.INTERFACE_PATH + 'basic_interface/view' + type + '.bmp', function(url){
			var toggle = qs('.toggle_btns');
			if (toggle) {
				toggle.style.backgroundImage = 'url(' + url + ')';
			}
		});

		event.stopImmediatePropagation();
	};


	/**
	 * Update UI elements
	 *
	 * @param {string} type identifier
	 * @param {number} val1
	 * @param {number} val2 (optional)
	 */
	BasicInfo.update = function update( type, val1, val2 )
	{
		var el, barDiv;

		switch (type) {
			case 'name':
			case 'blvl':
			case 'jlvl':
				setText('.' + type + '_value', val1);
				break;

			case 'zeny':
				Session.zeny = val1;

				var list = val1.toString().split('');
				var i, count = list.length;
				var str = '';

				for (i = 0; i < count; i++) {
					str = list[count-i-1] + (i && i%3 ===0 ? ',' : '') + str;
				}

				setText('.' + type + '_value', str);
				break;

			case 'job':
				Session.Character.job = val1;
				setText('.job_value', MonsterTable[val1]);
				break;

			case 'bexp':
			case 'jexp':
				el = qs('.' + type);
				if (!val2) {
					DOM.hide(el);
					break;
				}

				DOM.show(el);
				barDiv = qs('.' + type + ' div');
				if (barDiv) {
					barDiv.style.width = Math.min( 100, Math.floor(val1 * 100 / val2) ) + '%';
				}
				if (el) {
					el.title = ((val1/val2)*100).toFixed(1) + '%';
				}
				setText('.' + type + '_value', Math.min( 100, (Math.floor(val1 * 1000 / val2) * 0.1).toFixed(1)) + '%');
				break;

			case 'weight':
				setText('.weight_value', val1 / 10 | 0);
				setText('.weight_total', val2 / 10 | 0);
				el = qs('.weight');
				if (el) {
					el.style.color = val1 < (val2/2) ? '' : 'red';
					el.title = ((val1/val2)*100).toFixed(1) + '%';
				}
				break;

			case 'hp':
			case 'sp':
				var perc  = Math.floor(val1 * 100 / val2);
				var color = perc < 25 ? 'red' : 'blue';
				setText('.' + type + '_value', val1);
				setText('.' + type + '_max_value', val2);
				setText('.' + type + '_perc', perc + '%');

				if (perc <= 0) {
					barDiv = qs('.' + type + '_bar div');
					if (barDiv) {
						barDiv.style.backgroundImage = 'none';
					}
					break;
				}

				Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/gze'+ color +'_left.bmp', function(url){
					el = qs('.' + type + '_bar_left');
					if (el) {
						el.style.backgroundImage = 'url('+ url +')';
					}
				});

				Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/gze'+ color +'_mid.bmp', function(url){
					el = qs('.' + type + '_bar_middle');
					if (el) {
						DOM.setCss(el, {
							backgroundImage: 'url('+ url +')',
							width: Math.floor( Math.min( perc, 100 ) * 1.27 ) + 'px'
						});
					}
				});

				Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/gze'+ color +'_right.bmp', function(url){
					el = qs('.' + type + '_bar_right');
					if (el) {
						DOM.setCss(el, {
							backgroundImage: 'url('+ url +')',
							left: Math.floor( Math.min( perc, 100) * 1.27 ) + 'px'
						});
					}
				});
				break;
		}
	};


	/**
	 * Create component and export it
	 */
	return UIManager.addComponent(BasicInfo);
});
