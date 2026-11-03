/**
 * UI/Components/BasicInfoV3/BasicInfoV3.js
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
	var Bank               = require('UI/Components/Bank/Bank');
	var Escape             = require('UI/Components/Escape/Escape');
	var WorldMap           = require('UI/Components/WorldMap/WorldMap');
	var Rodex              = require('UI/Components/Rodex/Rodex');
	var WinStats           = require('UI/Components/WinStats/WinStats');

	// Version Dependent UIs
	var SkillList = require('UI/Components/SkillList/SkillList');
	var Quest     = require('UI/Components/Quest/Quest');


	var htmlText           = require('text!./BasicInfoV3.html');
	var cssText            = require('text!./BasicInfoV3.css');
	/**
	 * Create Basic Info component
	 */
	var BasicInfoV3 = new UIComponent( 'BasicInfoV3', htmlText, cssText );


	function qs(selector)
	{
		return DOM.qs(BasicInfoV3.ui, selector);
	}


	function qsa(selector)
	{
		return DOM.qsa(BasicInfoV3.ui, selector);
	}


	function setText(selector, value)
	{
		qsa(selector).forEach(function(el) {
			el.textContent = value;
		});
	}


	function toggleSizeClass()
	{
		if (BasicInfoV3.ui.classList.contains('large')) {
			BasicInfoV3.ui.classList.remove('large');
			BasicInfoV3.ui.classList.add('small');
		}
		else {
			BasicInfoV3.ui.classList.remove('small');
			BasicInfoV3.ui.classList.add('large');
		}
	}


	/**
	 * Stored data
	 */
	BasicInfoV3.base_exp      = 0;
	BasicInfoV3.base_exp_next = 1;
	BasicInfoV3.job_exp       = 0;
	BasicInfoV3.job_exp_next  =-1;
	BasicInfoV3.weight        = 0;
	BasicInfoV3.weight_max    = 1;


	/**
	 * @var {Preferences} structure
	 */
	var _preferences = Preferences.get('BasicInfoV3', {
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
	BasicInfoV3.init = function init()
	{

		// Don't activate drag drop when clicking on buttons
		qsa('.topbar div').forEach(function(el) {
			el.addEventListener('mousedown', function( event ){
				event.stopImmediatePropagation();
			});
		});

		var right = qs('.topbar .right');
		if (right) {
			right.addEventListener('click', BasicInfoV3.toggleMode.bind(this));
		}

		var toggleBtns = qs('.toggle_btns');
		if (toggleBtns) {
			toggleBtns.addEventListener('mousedown', BasicInfoV3.toggleButtons.bind(this));
		}

		qsa('.buttons div').forEach(function(btn) {
			btn.addEventListener('mousedown', function(){
				switch (this.id) {
					case 'item':
						Inventory.getUI().toggle();
						break;

					case 'info':
						WinStats.getUI().toggle();
						break;

					case 'equip':
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

					case 'bank':
						Bank.toggle();
						break;

					case 'quest':
						Quest.getUI().toggle();
						break;

					case 'mail':
						Rodex.toggle();
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
	BasicInfoV3.onAppend = function onAppend()
	{
		// Apply preferences
		DOM.setCss(this.ui, {
			top:  Math.min( Math.max( 0, _preferences.y), Renderer.height - this.ui.offsetHeight) + 'px',
			left: Math.min( Math.max( 0, _preferences.x), Renderer.width  - this.ui.offsetWidth) + 'px'
		});

		this.magnet.TOP = _preferences.magnet_top;
		this.magnet.BOTTOM = _preferences.magnet_bottom;
		this.magnet.LEFT = _preferences.magnet_left;
		this.magnet.RIGHT = _preferences.magnet_right;

		// large/small window
		this.ui.classList.remove('small', 'large');
		if (_preferences.reduce) {
			this.ui.classList.add('small');
		}
		else {
			this.ui.classList.add('large');
		}

		if (_preferences.buttons) {
			DOM.show(qs('.buttons'));
			DOM.hide(qs('.btn_open'));
			DOM.show(qs('.btn_close'));
		}
		else {
			DOM.hide(qs('.buttons'));
			DOM.show(qs('.btn_open'));
			DOM.hide(qs('.btn_close'));
		}

		DOM.hide(qs('#battle'));
		DOM.hide(qs('#navigation'));
		DOM.hide(qs('#battle'));
		DOM.hide(qs('#replay'));
		DOM.hide(qs('#achievment'));
	};


	/**
	 * Once remove, save preferences
	 */
	BasicInfoV3.onRemove = function onRemove()
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
	BasicInfoV3.onShortCut = function onShortCut( key )
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
	BasicInfoV3.toggleMode = function toggleMode()
	{
		var type;

		toggleSizeClass();

		if (_preferences.buttons) {
			DOM.show(qs('.buttons'));
			DOM.hide(qs('#btn_open'));
			DOM.show(qs('.btn_close'));
		}
		else {
			DOM.hide(qs('.buttons'));
			DOM.show(qs('.btn_open'));
			DOM.hide(qs('.btn_close'));
		}
	};


	/**
	 * Toggle the list of buttons
	 */
	BasicInfoV3.toggleButtons = function toggleButtons( event )
	{
		var type;
		var buttons = qs('.buttons');

		_preferences.buttons = buttons ? !DOM.isVisible(buttons) : false;

		if (_preferences.buttons) {
			DOM.show(qs('.buttons'));
			DOM.hide(qs('#btn_open'));
			DOM.show(qs('.btn_close'));
		}
		else {
			DOM.hide(qs('.buttons'));
			DOM.show(qs('.btn_open'));
			DOM.hide(qs('.btn_close'));
		}

		event.stopImmediatePropagation();
	};


	/**
	 * Update UI elements
	 *
	 * @param {string} type identifier
	 * @param {number} val1
	 * @param {number} val2 (optional)
	 */
	BasicInfoV3.update = function update( type, val1, val2 )
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
	return UIManager.addComponent(BasicInfoV3);
});
