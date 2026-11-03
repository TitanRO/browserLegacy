/**
 * UI/Components/ShortCuts/ShortCuts.js
 *
 * Chararacter ShortCuts
 *
 * @author Francisco Wallison
 *
 */
 define(function(require)
 {
	 'use strict';


	 /**
	  * Dependencies
	  */
	 var DB                 = require('DB/DBManager');
	 var Preferences        = require('Core/Preferences');
	 var Renderer           = require('Renderer/Renderer');
	 var Mouse              = require('Controls/MouseEventHandler');
	 var UIManager          = require('UI/UIManager');
	 var UIComponent        = require('UI/UIComponent');
	 var Emoticons          = require('UI/Components/Emoticons/Emoticons');
	 var ItemInfo           = require('UI/Components/ItemInfo/ItemInfo');
	 var htmlText           = require('text!./ShortCuts.html');
	 var cssText            = require('text!./ShortCuts.css');
	 var DOM                = require('Utils/DOM');
	 var ChatBox      		= require('UI/Components/ChatBox/ChatBox');
	 var Network            = require('Network/NetworkManager');
	 var PACKET             = require('Network/PacketStructure');
	 var getModule    		= require;


	 /**
	  * Create Component
	  */
	 var ShortCuts = new UIComponent( 'ShortCuts', htmlText, cssText );

	/**
	 * @var {Preferences} structure
	 */
	var _MACRO_INIT = Preferences.get('_MACRO_CMD', {
		Num_1:  '/hide'	,
		Num_2:  '/?'	,
		Num_3:  '/ho'	,
		Num_4:  '/lv'	,
		Num_5:  '/swt'	,
		Num_6:  '/ic'	,
		Num_7:  '/an'	,
		Num_8:  '/ag'	,
		Num_9:  '/$'	,
		Num_0:  '/...'
	}, 1.0);

	// Fixed, can't change them
	var _FLAG_INIT = {
		Num_1:  13, //ET_FLAG
		Num_2:  35, //ET_INDONESIA_FLAG
		Num_3:  48, // ET_PH_FLAG
		Num_4:  49, //ET_MY_FLAG
		Num_5:  50, //ET_SI_FLAG
		Num_6:  51, //ET_BR_FLAG
		Num_7:  64, //ET_INDIA_FLAG
		Num_8:  66, //ET_FLAG8
		Num_9:  67 //ET_FLAG9
	};

	 /**
	  * Store ShortCuts items
	  */
	 ShortCuts.list = [];


	 /**
	  * @var {number} used to remember the window height
	  */
	 var _realSize = 0;


	 /**
	  * @var {Preferences} structure
	  */
	 var _preferences = Preferences.get('ShortCuts', {
		 x:        0,
		 y:        172,
		 width:    7,
		 height:   4,
		 show:     false,
		 reduce:   false,
		 magnet_top: false,
		 magnet_bottom: false,
		 magnet_left: true,
		 magnet_right: false
	 }, 1.0);


	 /**
	  * Initialize UI
	  */
	 ShortCuts.init = function Init()
	 {

		this.ui.querySelector('.footer button').addEventListener('mousedown', function(){
			if( this.className == 'emoticons')
				Emoticons.onShortCut({cmd: 'TOGGLE'})
		});

		this.ui.querySelector('.close').addEventListener('click', onClose);
		this.ui.querySelector('.macro input').addEventListener('mousedown', function(){
			// this.focus();
			var _macro = document.querySelector(".macro_"); if (_macro) _macro.classList.remove('input_macro_focus');
			this.classList.add('input_macro_focus');

			this.select();
		});

		var _macroInputs = this.ui.querySelectorAll('input[type=text]');
		_macroInputs.forEach(function(input) {
			input.addEventListener('drop', onDropText);
			input.addEventListener('dragover', stopPropagation);
		});

		addValuesAlt(this)
		loadValuesAlt()

		this.draggable(this.ui.querySelector('.titlebar'));
	 };


	 /**
	  * Apply preferences once append to body
	  */
	 ShortCuts.onAppend = function OnAppend()
	 {
		if (!_preferences.show) {
			this.ui.style.display = 'none';
		}

		DOM.setCss(this.ui, {
			top:  Math.min( Math.max( 0, _preferences.y), Renderer.height - this.ui.offsetHeight),
			left: Math.min( Math.max( 0, _preferences.x), Renderer.width  - this.ui.offsetWidth)
		});
	 };


	 /**
	  * Remove ShortCuts from window (and so clean up items)
	  */
	 ShortCuts.onRemove = function OnRemove()
	 {
		 var content = this.ui.querySelector('.container .content');
		 if (content) {
			 content.innerHTML = '';
		 }
		 this.list.length = 0;
		 ItemInfo.remove();

		 // Save preferences
		 _preferences.show   =  DOM.isVisible(this.ui);
		 _preferences.reduce = !!_realSize;
		 _preferences.y      =  parseInt(this.ui.style.top, 10);
		 _preferences.x      =  parseInt(this.ui.style.left, 10);
		 _preferences.width  =  Math.floor( (this.ui.offsetWidth  - (23 + 16 + 16 - 30)) / 32 );
		 _preferences.height =  Math.floor( (this.ui.offsetHeight - (31 + 19 - 30     )) / 32 );
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
	 ShortCuts.onShortCut = function onShurtCut( key )
	 {
		switch (key.cmd) {
			case 'TOGGLE':
				DOM.toggleDisplay(this.ui);
				// Remove input focus
				var _macro = document.querySelector(".macro_"); if (_macro) _macro.classList.remove('input_macro_focus');
				if (DOM.isVisible(this.ui)) {
					this.focus();
				}
				break;
			// Macros
			case 'EXECUTE_MACRO_1':
				executeCmd(1);
				break;
			case 'EXECUTE_MACRO_2':
				executeCmd(2);
				break;
			case 'EXECUTE_MACRO_3':
				executeCmd(3);
				break;
			case 'EXECUTE_MACRO_4':
				executeCmd(4);
				break;
			case 'EXECUTE_MACRO_5':
				executeCmd(5);
				break;
			case 'EXECUTE_MACRO_6':
				executeCmd(6);
				break;
			case 'EXECUTE_MACRO_7':
				executeCmd(7);
				break;
			case 'EXECUTE_MACRO_8':
				executeCmd(8);
				break;
			case 'EXECUTE_MACRO_9':
				executeCmd(9);
				break;
			case 'EXECUTE_MACRO_0':
				executeCmd(0);
				break;

			// Flags
			case 'EXECUTE_FLAG_1':
				executeFlag(1);
				break;
			case 'EXECUTE_FLAG_2':
				executeFlag(2);
				break;
			case 'EXECUTE_FLAG_3':
				executeFlag(3);
				break;
			case 'EXECUTE_FLAG_4':
				executeFlag(4);
				break;
			case 'EXECUTE_FLAG_5':
				executeFlag(5);
				break;
			case 'EXECUTE_FLAG_6':
				executeFlag(6);
				break;
			case 'EXECUTE_FLAG_7':
				executeFlag(7);
				break;
			case 'EXECUTE_FLAG_8':
				executeFlag(8);
				break;
			case 'EXECUTE_FLAG_9':
				executeFlag(9);
				break;
		}
	 };


	 /**
	  * Extend ShortCuts window size
	  *
	  * @param {number} width
	  * @param {number} height
	  */
	 ShortCuts.resize = function Resize( width, height )
	 {
		 width  = Math.min( Math.max(width,  6), 9);
		 height = Math.min( Math.max(height, 2), 6);

		 var content = this.ui.querySelector('.container .content');
		 content.style.width = (width * 32 + 13) + 'px'; // 13 = scrollbar
		 content.style.height = (height * 32) + 'px';

		 DOM.setCss(this.ui, {
			 width:  23 + 16 + 16 + width  * 32,
			 height: 31 + 19      + height * 32
		 });
	 };


	/**
	 * Exit window
	 */
	function onClose()
	{
		ShortCuts.ui.style.display = 'none';
	}


	 /**
	  * Extend ShortCuts window size
	  */
	 function onResize()
	 {
		 var ui      = ShortCuts.ui;
		 var content = ui.querySelector('.container .content');
		 var hide    = ui.querySelector('.hide');
		 var top     = DOM.getPosition(ui).top;
		 var left    = DOM.getPosition(ui).left;
		 var lastWidth  = 0;
		 var lastHeight = 0;
		 var _Interval;

		 function resizing()
		 {
			 var extraX = 23 + 16 + 16 - 30;
			 var extraY = 31 + 19 - 30;

			 var w = Math.floor( (Mouse.screen.x - left - extraX) / 32 );
			 var h = Math.floor( (Mouse.screen.y - top  - extraY) / 32 );

			 // Maximum and minimum window size
			 w = Math.min( Math.max(w, 6), 9);
			 h = Math.min( Math.max(h, 2), 6);

			 if (w === lastWidth && h === lastHeight) {
				 return;
			 }

			 ShortCuts.resize( w, h );
			 lastWidth  = w;
			 lastHeight = h;

			 //Show or hide scrollbar
			 if (content.offsetHeight === content.scrollHeight) {
				 hide.style.display = '';
			 }
			 else {
				 hide.style.display = 'none';
			 }
		 }

		 // Start resizing
		 _Interval = setInterval( resizing, 30);

		 // Stop resizing on left click
		 var _resizeHandler = function(event){
			if (event.which === 1) {
				clearInterval(_Interval);
				window.removeEventListener('mouseup', _resizeHandler);
			}
		};
		window.addEventListener('mouseup', _resizeHandler);
	 }

	 function executeCmd(value){
		var command = _MACRO_INIT[`Num_${value}`];

		// Nothing to submit
		if (command.length < 1 || command == '/hide') {
			return;
		}

		// Process commands
		if( command[0] == '/' ){
			getModule('Controls/ProcessCommand').processCommand.call( ChatBox, command.substr(1) );
			return;
		}

		ChatBox.onRequestTalk('', command, ChatBox.sendTo);
	 }

	 function executeFlag(value){
		var command = _FLAG_INIT[`Num_${value}`];

		// Nothing to submit
		if (command.length < 1) {
			return;
		}

		var pkt =
		pkt = new PACKET.CZ.REQ_EMOTION();
		pkt.type = command;
		Network.sendPacket(pkt);
		return;
	 }

	 function loadValuesAlt(){
		var length = (Object.keys(_MACRO_INIT).length - 3);
		for (let index = 0; index < length; index++) {
			var element = _MACRO_INIT[`Num_${index}`];
			(document.getElementById('macro_' + index) || {}).value = element;
		}
	 }

	 function addValuesAlt(element){
		element.ui.querySelector('.macro input').addEventListener('blur', function(){
			var index = this.getAttribute('id').split("macro_")[1]
			_MACRO_INIT[`Num_${index}`] = this.value
			_MACRO_INIT.save();
		});
	 }

	 /**
	 * Validate the type of information being dropped into the text field
	 */
	  function onDropText( event )
	  {
		  event.stopImmediatePropagation();
		  var data;
		  try {
			 data = JSON.parse(event.dataTransfer.getData('Text'));
		  }
		  catch(e) {
			  return false;
		  }

		  // Valid if the message type
		  if (data.type == 'item') {
			  return false;
		  }

		  event.currentTarget.value = data;
		  return false;
	  }

		/**
		 * Stop event propagation
		*/
		function stopPropagation( event )
		{
			event.stopImmediatePropagation();
			return false;
		}


	 /**
	  * Create component and export it
	  */
	 return UIManager.addComponent(ShortCuts);
 });

