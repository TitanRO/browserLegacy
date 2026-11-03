/**
 * UI/Components/ChatRoomCreate/ChatRoomCreate.js
 *
 * Character room setup UI
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
	var DB          = require('DB/DBManager');
	var KEYS        = require('Controls/KeyEventHandler');
	var Renderer    = require('Renderer/Renderer');
	var Preferences = require('Core/Preferences');
	var UIManager   = require('UI/UIManager');
	var UIComponent = require('UI/UIComponent');
	var htmlText    = require('text!./ChatRoomCreate.html');
	var cssText     = require('text!./ChatRoomCreate.css');
	var DOM             = require('Utils/DOM');


	/**
	 * Create Component
	 */
	var ChatRoomCreate = new UIComponent( 'ChatRoomCreate', htmlText, cssText );


	/**
	 * @var {string} chat room title
	 */
	ChatRoomCreate.title = '';


	/**
	 * @var {number} chat room limit
	 */
	ChatRoomCreate.limit = 20;


	/**
	 * @var {number} type
	 * 0 = Private
	 * 1 = Public
	 */
	ChatRoomCreate.type = 1;


	/**
	 * @var {string} password
	 */
	ChatRoomCreate.password = '';


	/**
	 * @var {Preference} structure to save
	 */
	var _preferences = Preferences.get('ChatRoomCreate', {
		x:        480,
		y:        200,
		show:   false
	}, 1.0);


	/**
	 * Initialize UI
	 */
	ChatRoomCreate.init = function init()
	{
		// Bindings
		DOM.addDelegatedEvent(this.ui, 'mousedown', '.close, .cancel', stopPropagation);
		DOM.addDelegatedEvent(this.ui, 'click', '.close, .cancel', this.hide.bind(this));
		this.ui.querySelector('.ok').addEventListener('click', parseChatSetup.bind(this) );
		this.ui.querySelector('.setup').addEventListener('submit', function() {
			return false;
		});

		this.ui.querySelectorAll('input, select').forEach(function(el){
			el.addEventListener('mousedown', function(event){
				event.stopImmediatePropagation();
			});
		});

		this.draggable(this.ui.querySelector('.titlebar'));
		this.ui.style.display = 'none';
	};


	/**
	 * Once append to body
	 */
	ChatRoomCreate.onAppend = function OnAppend()
	{
		if (!_preferences.show) {
			this.ui.style.display = 'none';
		}

		DOM.setCss(this.ui, {
			top:  Math.min( Math.max( 0, _preferences.y), Renderer.height - this.ui.offsetHeight),
			left: Math.min( Math.max( 0, _preferences.x), Renderer.width  - this.ui.offsetWidth)
		});

		// Note: jQuery._data keydown reordering removed (not possible with native events)
	};


	/**
	 * Once removed from DOM, save preferences
	 */
	ChatRoomCreate.onRemove = function OnRemove()
	{
		_preferences.show   =  DOM.isVisible(this.ui);
		_preferences.y      =  parseInt(this.ui.style.top, 10);
		_preferences.x      =  parseInt(this.ui.style.left, 10);
		_preferences.save();
	};


	/**
	 * Show the setup for room creation
	 */
	ChatRoomCreate.show = function showSetup()
	{
		this.ui.style.display = '';
		this.ui.querySelector('.title').focus();

		_preferences.show = true;
	};


	/**
	 * Hide the setup ui
	 */
	ChatRoomCreate.hide = function hideSetup()
	{
		this.ui.style.display = 'none';
		this.ui.querySelector('.setup').reset();

		_preferences.show = false;
	};


	/**
	 * Key Listener
	 *
	 * @param {object} event
	 * @return {boolean}
	 */
	ChatRoomCreate.onKeyDown = function onKeyDown( event )
	{
		if (DOM.isVisible(this.ui)) {
			if (event.which === KEYS.ENTER) {
				parseChatSetup.call(this);
				event.stopImmediatePropagation();
				return false;
			}
			else if (event.which === KEYS.ESCAPE) {
				this.ui.style.display = 'none';
				event.stopImmediatePropagation();
				return false;
			}
		}

		return true;
	};


	/**
	 * Process shortcut
	 *
	 * @param {object} key
	 */
	ChatRoomCreate.onShortCut = function onShurtCut( key )
	{
		switch (key.cmd) {
			case 'TOGGLE':
				ChatRoomCreate.toggle();
				break;
		}
	};

	ChatRoomCreate.toggle = function toggle()
	{
		DOM.toggleDisplay(this.ui);
		if (DOM.isVisible(this.ui)) {
			this.focus();
		}
	};


	/**
	 * Stop event propagation
	 */
	function stopPropagation( event )
	{
		event.stopImmediatePropagation();
		return false;
	}

	/**
	 * Parse and send chat room request
	 */
	function parseChatSetup()
	{
		this.title    = this.ui.querySelector('input[name=title]').value;
		this.limit    = parseInt( this.ui.querySelector('select[name=limit]').value, 10);
		this.type     = parseInt( this.ui.querySelector('input[name=public]:checked').value, 10);
		this.password = this.ui.querySelector('input[name=password]').value;

		if (this.title.length < 1) {
			var overlay       = document.createElement('div');
			overlay.className = 'win_popup_overlay';
			document.body.appendChild(overlay);

			var popup = UIManager.showMessageBox( DB.getMessage(13), 'ok', function(){
				document.body.removeChild(overlay);
			}, true);

			popup.ui.style.top = (parseInt(this.ui.style.top, 10) - 120) + 'px';
			popup.ui.style.left = parseInt(this.ui.style.left, 10) + 'px';
			return;
		}

		this.requestRoom();
		this.ui.style.display = 'none';
	}


	/**
	 * Pseudo functions :)
	 */
	ChatRoomCreate.requestRoom = function requestRoom(){};


	/**
	 * Create component and export it
	 */
	return UIManager.addComponent(ChatRoomCreate);
});
