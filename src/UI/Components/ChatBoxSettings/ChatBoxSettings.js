/**
 * UI/Components/ChatBoxSettings/ChatBoxSettings.js
 *
 * Chat Box Settings
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 */
define(function(require)
{
	'use strict';

	/**
	 * Dependencies
	 */
	var DB           = require('DB/DBManager');
	var Preferences  = require('Core/Preferences');
	var Renderer     = require('Renderer/Renderer');
	var Client       = require('Core/Client');
	var Mouse        = require('Controls/MouseEventHandler');
	var UIManager    = require('UI/UIManager');
	var UIComponent  = require('UI/UIComponent');
	var htmlText     = require('text!./ChatBoxSettings.html');
	var cssText      = require('text!./ChatBoxSettings.css');
	var DOM             = require('Utils/DOM');
	/**
	 * Create Component
	 */
	var ChatBoxSettings = new UIComponent( 'ChatBoxSettings', htmlText, cssText );


	/**
	 * @var {boolean} is ChatBoxSettings open ? (Temporary fix)
	 */
	ChatBoxSettings.isOpen = false;

	ChatBoxSettings.tabOption = [];
	
	ChatBoxSettings.activeTab = 0;

	/**
	 * @var {Preference} structure to save
	 */
	var _preferences = Preferences.get('ChatBoxSettings', {
		x:        480,
		y:        200,
		width:    7,
		height:   4
	}, 1.0);


	/**
	 * Initialize UI
	 */
	ChatBoxSettings.init = function init()
	{
		var extendBtn = this.ui.querySelector('.extend');
		if (extendBtn) {
			extendBtn.addEventListener('mousedown', onResize);
		}

		this.ui.querySelector('.close').addEventListener('click', function(){
			ChatBoxSettings.ui.style.display = 'none';
		});

		DOM.addDelegatedEvent(this.ui, 'click', '.content .listoption button', onClickOption);
		this.draggable(this.ui.querySelector('.titlebar'));
	};


	/**
	 * Initialize UI
	 */
	ChatBoxSettings.onAppend = function onAppend()
	{
		//resize( _preferences.width, _preferences.height );

		DOM.setCss(this.ui, {
			top:  Math.min( Math.max( 0, _preferences.y), Renderer.height - this.ui.offsetHeight),
			left: Math.min( Math.max( 0, _preferences.x), Renderer.width  - this.ui.offsetWidth)
		});
	};

	/**
	 * Key Event Handler
	 *
	 * @param {object} event - KeyEventHandler
	 * @return {boolean}
	 */
	ChatBoxSettings.onKeyDown = function onKeyDown( event ){};

	function onClickOption(evt){
		var _elem = evt.currentTarget;
		var _dataId = _elem.getAttribute('data-id');
		var isOn = false;
		
		if(!_elem){
			return;
		}

		isOn = _elem.classList.contains('on');

		if(isOn){
			_elem.classList.remove('on');
			isOn = false;
		}else{
			_elem.classList.add('on');
			isOn = true;
		}

		Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/grp_'+(isOn?'online':'offline')+'.bmp', function( data ){
			_elem.style.backgroundImage = 'url(' + data + ')';
		});

		if(!isNaN(_dataId)){
			var idsIndex = ChatBoxSettings.tabOption[ChatBoxSettings.activeTab].indexOf(_dataId);

			if(idsIndex > -1){
				ChatBoxSettings.tabOption[ChatBoxSettings.activeTab].splice(idsIndex, 1);
			} else {
				ChatBoxSettings.tabOption[ChatBoxSettings.activeTab].push(_dataId);
			}
		}
	}


	/**
	 * Resize ChatBoxSettings
	 */
	function onResize()
	{
		var ui         = ChatBoxSettings.ui;
		var top        = DOM.getPosition(ui).top;
		var left       = DOM.getPosition(ui).left;
		var lastWidth  = 0;
		var lastHeight = 0;
		var _Interval;

		function resizeProcess()
		{
			var extraX = 23 + 16 + 16 - 30;
			var extraY = 31 + 19 - 30;

			var w = Math.floor( (Mouse.screen.x - left - extraX) / 32 );
			var h = Math.floor( (Mouse.screen.y - top  - extraY) / 32 );

			// Maximum and minimum window size
			w = Math.min( Math.max(w, 7), 14);
			h = Math.min( Math.max(h, 3), 8);

			if (w === lastWidth && h === lastHeight) {
				return;
			}

			resize( w, h );
			lastWidth  = w;
			lastHeight = h;
		}

		// Start resizing
		_Interval = setInterval( resizeProcess, 30);

		// Stop resizing
		var _cbsResizeHandler = function(event){
			// Only on left click
			if ( event.which === 1 ) {
				clearInterval(_Interval);
				window.removeEventListener('mouseup', _cbsResizeHandler);
			}
		};
		window.addEventListener('mouseup', _cbsResizeHandler);
	}

	ChatBoxSettings.toggle = function toggle(){
		DOM.toggleDisplay(this.ui);
	};
	
	ChatBoxSettings.updateTab = function updateTab(tabID, tabName){
		var optList = ChatBoxSettings.tabOption[tabID];

		this.activeTab = tabID;

		this.ui.querySelector('.tabname').innerHTML = tabName;

		Array.prototype.forEach.call(this.ui.querySelectorAll('.content .listoption button'), function(_elem) {
			_elem.classList.remove('on');
			Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/grp_offline.bmp', function( data ){
				_elem.style.backgroundImage = 'url(' + data + ')';
			});
		});

		Array.prototype.forEach.call(this.ui.querySelectorAll('.content .listoption button'), function(_elem){
			var id = _elem.getAttribute('data-id');

			if(optList.includes(id)){
				Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/grp_online.bmp', function( data ){
					_elem.style.backgroundImage = 'url(' + data + ')';
				});
				_elem.classList.add('on');
			}
		});
		
	};


	/**
	 * Extend inventory window size
	 */
	function resize( width, height )
	{
		width  = Math.min( Math.max(width,  7), 14);
		height = Math.min( Math.max(height, 3), 8);

		ChatBoxSettings.ui.style.width = 23 + 16 + 16 + width  * 32;
		var content = ChatBoxSettings.ui.querySelector('.content');
		if (content) {
			content.style.height = (height * 32) + 'px';
		}
	}


	/**
	 * Create component and export it
	 */
	return UIManager.addComponent(ChatBoxSettings);
});
