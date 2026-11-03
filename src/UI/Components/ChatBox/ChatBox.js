/**
 * UI/Components/ChatBox/ChatBox.js
 *
 * ChatBox windows
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
	var Renderer           = require('Renderer/Renderer');
	var Client             = require('Core/Client');
	var Events             = require('Core/Events');
	var Preferences        = require('Core/Preferences');
	var KEYS               = require('Controls/KeyEventHandler');
	var Mouse         	   = require('Controls/MouseEventHandler');
	var BattleMode         = require('Controls/BattleMode');
	var History            = require('./History');
	var UIManager          = require('UI/UIManager');
	var UIComponent        = require('UI/UIComponent');
	var ContextMenu        = require('UI/Components/ContextMenu/ContextMenu');
	var htmlText           = require('text!./ChatBox.html');
	var cssText            = require('text!./ChatBox.css');
	var Commands     = require('Controls/ProcessCommand');
	var ChatBoxSettings  = require('UI/Components/ChatBoxSettings/ChatBoxSettings');
	var DOM             = require('Utils/DOM');


	/**
	 * @var {number} max message in the chatbox
	 */
	var MAX_MSG = 400;
	var MAX_LENGTH = 100;
	var MAGIC_NUMBER = 3*14;


	/**
	 * @var {History} message cached in history
	 */
	var _historyMessage = new History();


	/**
	 * @var {History} nickname cached in history
	 */
	var _historyNickName = new History(true);



	/**
	 * @var {number} Chatbox position's index
	 */
	var _heightIndex = 2;


	/**
	 * @var {Preferences} structure
	 */
	var _preferences = Preferences.get('ChatBox', {
		x:      0,
		y:      Infinity,
		height: 2,
		magnet_top: false,
		magnet_bottom: true,
		magnet_left: true,
		magnet_right: false,
		tabs: [],
		tabOption: [],
		activeTab: 0

	}, 1.0);


	/**
	 * Create Basic Info component
	 */
	var ChatBox = new UIComponent( 'ChatBox', htmlText, cssText );


	/**
	 * Constants
	 */
	ChatBox.TYPE = {
		SELF:     1 << 0,
		PUBLIC:   1 << 1,
		PRIVATE:  1 << 2,
		PARTY:    1 << 3,
		GUILD:    1 << 4,
		ANNOUNCE: 1 << 5,
		ERROR:    1 << 6,
		INFO:     1 << 7,
		BLUE:     1 << 8, // TODO: find a better name
		ADMIN:    1 << 9,
		MAIL:     1 << 10,
	};

	ChatBox.FILTER = {
		PUBLIC_LOG:		0,
		PUBLIC_CHAT:	1,
		WHISPER:		2,
		PARTY:			3,
		GUILD:			4,
		ITEM:			5,
		EQUIP:			6,
		STATUS:			7,
		PARTY_ITEM:		8,
		PARTY_STATUS:	9,
		SKILL_FAIL:		10,
		PARTY_SETUP:	11,
		EQUIP_DAMAGE:	12,
		WOE:			13,
		PARTY_SEARCH:	14,
		BATTLE:			15,
		PARTY_BATTLE:	16,
		EXP:			17,
		PARTY_EXP:		18,
		QUEST:			19,
		BATTLEFIELD:	20,
		CLAN:			21,
		//CALL:			22, // Display Call messages
	};

	/**
	 * @var {number} target message ?
	 */
	ChatBox.sendTo = ChatBox.TYPE.PUBLIC;


	/**
	 * Storage to cache the private messages
	 * Ugly system used by official client, can lead to errors
	 */
	ChatBox.PrivateMessageStorage = {
		nick: '',
		msg:  ''
	};

	ChatBox.lastTabID = -1;
	ChatBox.tabCount = 0;
	ChatBox.activeTab = 0;

	ChatBox.tabs = [];

	/**
	 * Initialize UI
	 */
	ChatBox.init = function init()
	{
		_heightIndex = _preferences.height - 1;
		ChatBox.updateHeight();

		this.ui.addEventListener('mouseover', function(){
			Mouse.intersect = false;
		});
		this.ui.addEventListener('mouseout', function() {
			Mouse.intersect = true;
		});

		DOM.setCss(this.ui, {
			top:  Math.min( Math.max( 0, _preferences.y - this.ui.offsetHeight), Renderer.height - this.ui.offsetHeight),
			left: Math.min( Math.max( 0, _preferences.x), Renderer.width  - this.ui.offsetWidth)
		});

		this.magnet.TOP = _preferences.magnet_top;
		this.magnet.BOTTOM = _preferences.magnet_bottom;
		this.magnet.LEFT = _preferences.magnet_left;
		this.magnet.RIGHT = _preferences.magnet_right;

		this.draggable( this.ui.querySelector('.input') );
		this.draggable( this.ui.querySelector('.battlemode') );

		// Sorry for this un-documented code (see UIComponent for more informations)
		this.__mouseStopBlock = this.ui.querySelector('.input');

		// Setting chatbox scrollbar
		Client.loadFiles([DB.INTERFACE_PATH + 'basic_interface/dialscr_down.bmp', DB.INTERFACE_PATH + 'basic_interface/dialscr_up.bmp'], function( down, up ){
			var _cbStyleEl = document.querySelector('style') || document.createElement('style');
			if (!_cbStyleEl.parentNode) document.head.appendChild(_cbStyleEl);
			_cbStyleEl.textContent += [
				'#chatbox .content::-webkit-scrollbar { width: 10px; height: 10px;}',
				'#chatbox .content::-webkit-scrollbar-button:vertical:start:increment,',
				'#chatbox .content::-webkit-scrollbar-button:vertical:end:decrement { display: none;}',
				'#chatbox .content::-webkit-scrollbar-corner:vertical { display:none;}',
				'#chatbox .content::-webkit-scrollbar-resizer:vertical { display:none;}',
				'#chatbox .content::-webkit-scrollbar-button:start:decrement,',
				'#chatbox .content::-webkit-scrollbar-button:end:increment { display: block; border:none;}',
				'#chatbox .content::-webkit-scrollbar-button:vertical:increment { background: url('+ down +') no-repeat; height:10px;}',
				'#chatbox .content::-webkit-scrollbar-button:vertical:decrement { background: url('+ up +') no-repeat; height:10px;}',
				'#chatbox .content::-webkit-scrollbar-track-piece:vertical { background:black; border:none;}',
				'#chatbox .content::-webkit-scrollbar-thumb:vertical { background:grey; -webkit-border-image:none; border-color:transparent;border-width: 0px 0; }'
			].join('\n');
		});

		// Input selection
		this.ui.querySelector('.input input').addEventListener('mousedown', function( event ){
			this.select();
			event.stopImmediatePropagation();
			return false;
		});

		this.ui.querySelector('.input .message').addEventListener('blur', function(){
			Events.setTimeout(function(){
				if (!document.activeElement.tagName.match(/input|select|textarea/i)) {
					this.ui.querySelector('.input .message').focus();
				}
			}.bind(this), 1);
		}.bind(this));

		this.ui.querySelector('.input .message').maxLength = MAX_LENGTH;

		this.ui.querySelector('.input .username').addEventListener('blur', function(){
			Events.setTimeout(function(){
				if (!document.activeElement.tagName.match(/input|select|textarea/i)) {
					this.ui.querySelector('.input .username').focus();
				}
			}.bind(this), 1);
		}.bind(this));

		// Validate information dragged into text field
		var _chatTextInputs = this.ui.querySelectorAll('input[type=text]');
		_chatTextInputs.forEach(function(input) {
			input.addEventListener('drop', onDropText);
			input.addEventListener('dragover', stopPropagation);
		});

		// Tab name inputs are created dynamically in addNewTab()
		DOM.addDelegatedEvent(this.ui, 'dblclick', '.header input', function(){
			this.type = 'text';
			this.select();
		});
		DOM.addDelegatedEvent(this.ui, 'blur', '.header input', function(){
			this.type = 'button';
		});
		DOM.addDelegatedEvent(this.ui, 'keyup', '.header tr td div.on input', function(){
			ChatBoxSettings.updateTab(ChatBox.activeTab, this.value);
		});

		// Private message selection
		var _pmList = this.ui.querySelector('.input .list');
		_pmList.addEventListener('click', function(){
			var names = _historyNickName.list;
			var i, count = names.length;
			var pos = DOM.getOffset(this);
			var ui = ContextMenu.ui.querySelector('.menu');

			if (!count) {
				ChatBox.addText( DB.getMessage(192), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
				return;
			}

			ContextMenu.remove();
			ContextMenu.append();

			for (i = 0; i < count; ++i) {
				ContextMenu.addElement(names[i], onPrivateMessageUserSelection(names[i]));
			}

			ContextMenu.addElement('', onPrivateMessageUserSelection(''));
			ui.style.top = (pos.top - ui.offsetHeight - 5) + 'px';
			ui.style.left = (pos.left - ui.offsetWidth - 5) + 'px';
		});
		_pmList.addEventListener('mousedown', function(event){
			event.stopImmediatePropagation();
			return false;
		});

		this.ui.querySelector('.draggable').addEventListener('mousedown', function(event){
			event.stopImmediatePropagation();
			return false;
		});

		// Send message to...
		var _filterBtn = this.ui.querySelector('.input .filter');
		_filterBtn.addEventListener('click', function(){
			var pos = DOM.getOffset(this);
			var ui = ContextMenu.ui.querySelector('.menu');

			ContextMenu.remove();
			ContextMenu.append();

			ContextMenu.addElement(DB.getMessage(85),  onChangeTargetMessage(ChatBox.TYPE.PUBLIC));
			ContextMenu.addElement(DB.getMessage(86),  onChangeTargetMessage(ChatBox.TYPE.PARTY));
			ContextMenu.addElement(DB.getMessage(437), onChangeTargetMessage(ChatBox.TYPE.GUILD));

			ui.style.top = (pos.top - ui.offsetHeight - 5) + 'px';
			ui.style.left = (pos.left - ui.offsetWidth + 25) + 'px';
		});
		_filterBtn.addEventListener('mousedown', function(event){
			event.stopImmediatePropagation();
			return false;
		});

		// Change size
		this.ui.querySelector('.input .size').addEventListener('click', function( event ){
			ChatBox.updateHeight(true);
			event.stopImmediatePropagation();
			return false;
		});

		// Scroll feature should block at each line (.content elements are created in addNewTab)
		DOM.addDelegatedEvent(this.ui, 'mousewheel', '.content', onScroll);
		DOM.addDelegatedEvent(this.ui, 'DOMMouseScroll', '.content', onScroll);

		this.ui.querySelector('.battlemode .bmtoggle').addEventListener('click', function ( event ){
			DOM.toggleDisplay(ChatBox.ui.querySelector('.input'));
			DOM.toggleDisplay(ChatBox.ui.querySelector('.battlemode'));
		});

		this.ui.querySelector('.chat-function .battleopt2').addEventListener('click', function( event ){
			if(ChatBox.tabCount <= 5){
				ChatBox.addNewTab();
				ChatBox.onAppend();
			}
		});

		DOM.addDelegatedEvent(this.ui, 'click', 'table.header tr td.tab', function( event ){
			event.stopImmediatePropagation();
			var currentElem = event.currentTarget;
			if(ChatBox.activeTab !== currentElem.dataset.tab - 1){
				ChatBox.switchTab(currentElem.dataset.tab);
			}
		});

		this.ui.querySelector('.chat-function .wndminib').addEventListener('click', function(){
			if(ChatBox.tabCount > 1){
				ChatBox.removeTab();
			}
		});

		this.ui.querySelector('.chat-function .chatmode').addEventListener('click', function(){
			ChatBox.toggleChat();
		});

		this.ui.querySelector('.chat-function .battleopt').addEventListener('click', function(){
			ChatBox.toggleChatBattleOption();
		});

		// Init settings window as well
		ChatBoxSettings.append();


		if(_preferences.tabs.length > 0 && _preferences.tabs.length == _preferences.tabOption.length){
			// Load saved tabs
			for(var i = 0; i < _preferences.tabs.length; i++){
				if(_preferences.tabs[i] && _preferences.tabOption[i]){
					ChatBox.addNewTab(_preferences.tabs[i].name, _preferences.tabOption[i]);
				}
			}

			// Switch to last active tab
			if(ChatBox.tabs[_preferences.activeTab]){
				this.switchTab(_preferences.activeTab);
			}
		} else {
			// Default tabs
			var firstTab = ChatBox.addNewTab(DB.getMessage(1291), [
				ChatBox.FILTER.PUBLIC_LOG,
				ChatBox.FILTER.PUBLIC_CHAT,
				ChatBox.FILTER.WHISPER,
				ChatBox.FILTER.PARTY,
				ChatBox.FILTER.GUILD,
				ChatBox.FILTER.ITEM,
				ChatBox.FILTER.EQUIP,
				ChatBox.FILTER.STATUS,
				ChatBox.FILTER.PARTY_ITEM,
				ChatBox.FILTER.PARTY_STATUS,
				ChatBox.FILTER.SKILL_FAIL,
				ChatBox.FILTER.PARTY_SETUP,
				ChatBox.FILTER.EQUIP_DAMAGE,
				ChatBox.FILTER.WOE,
				ChatBox.FILTER.PARTY_SEARCH,
				ChatBox.FILTER.QUEST,
				ChatBox.FILTER.BATTLEFIELD,
				ChatBox.FILTER.CLAN
			]); // Public Log

			ChatBox.addNewTab(DB.getMessage(1292)); // Battle Log

			// switch to first
			ChatBox.switchTab(firstTab);
		}

		// dialog box size
		makeResizableDiv()
		
		Commands.add('savechat', 'Saves current chat tab to txt file.', function(){ ChatBox.saveCurrentTabChat(); return; }, ['sc'], false );
	};


	/**
	 * Clean up the box
	 */
	ChatBox.clean = function Clean()
	{
		var matches, i, count;

		matches = this.ui.querySelector('.content').innerHTML.match(/(blob:[^"]+)/g);

		if (matches) {
			for (i = 0, count = matches.length; i < count; ++i) {
				window.URL.revokeObjectURL(matches[i]);
			}
		}

		this.ui.querySelector('.content').innerHTML = '';
		this.ui.querySelector('.input .message').value = '';
		this.ui.querySelector('.input .username').value = '';

		_historyMessage.clear();
		_historyNickName.clear();
	};

	ChatBox.toggleChatBattleOption = function toggleChatBattleOption(){
		var tabName = this.ui.querySelector('.header tr td div.on input').value;
		ChatBoxSettings.toggle();
		ChatBoxSettings.updateTab(this.activeTab, tabName);
	}

	ChatBox.removeTab = function removeTab() {
		this.ui.querySelector('table.header tr td.tab[data-tab="'+ this.activeTab +'"]').remove();
		this.ui.querySelector('.body .content[data-content="'+ this.activeTab +'"]').remove();

		var tabName= '';
		var _tabs = this.ui.querySelectorAll('table.header tr td.tab');
		var _elem = _tabs[_tabs.length - 1];

		// Use delete instead of splice to avoid ID messup and make our life eastier.
		delete ChatBoxSettings.tabOption[this.activeTab];
		delete this.tabs[this.activeTab];
		this.tabCount--;

		ChatBox.switchTab(_elem.dataset.tab);

		tabName = this.ui.querySelector('.header tr td div.on input').value;
		ChatBoxSettings.updateTab(this.activeTab, tabName);
	}

	ChatBox.addNewTab = function addNewTab(name, settings){

		// Default settings
		if(!name){
			name = 'New Tab';
		}
		if(!settings){
			settings = [
				ChatBox.FILTER.PUBLIC_LOG,
				ChatBox.FILTER.PUBLIC_CHAT,
				ChatBox.FILTER.WHISPER,
				ChatBox.FILTER.PARTY,
				ChatBox.FILTER.GUILD,
				ChatBox.FILTER.ITEM,
				ChatBox.FILTER.EQUIP,
				ChatBox.FILTER.STATUS,
				ChatBox.FILTER.PARTY_ITEM,
				ChatBox.FILTER.PARTY_STATUS,
				ChatBox.FILTER.SKILL_FAIL,
				ChatBox.FILTER.PARTY_SETUP,
				ChatBox.FILTER.EQUIP_DAMAGE,
				ChatBox.FILTER.WOE,
				ChatBox.FILTER.PARTY_SEARCH,
				ChatBox.FILTER.BATTLE,
				ChatBox.FILTER.PARTY_BATTLE,
				ChatBox.FILTER.EXP,
				ChatBox.FILTER.PARTY_EXP,
				ChatBox.FILTER.QUEST,
				ChatBox.FILTER.BATTLEFIELD,
				ChatBox.FILTER.CLAN
			];
		}

		var tabName = name;
		var tabID = ++this.lastTabID;

		var tab = {};
		tab.id = tabID;
		tab.name = tabName;

		// Store prev height
		//var height = this.ui.querySelector('.contentwrapper').offsetHeight;

		// Remove current active state (no tabs yet on first call — querySelectorAll is safe)
		this.ui.querySelectorAll('table.header tr td.tab div').forEach(function(el) {
			el.classList.remove('on');
		});
		this.ui.querySelectorAll('.body .content').forEach(function(el) {
			el.classList.remove('active');
		});

		// Add new elements as active
		this.ui.querySelector('table.header tr .opttab').insertAdjacentHTML('beforebegin', `
			<td class="tab" data-tab="${tabID}">
				<div class="on">
					<input type="text" value="${tabName}"/>
				</div>
			</td>
		`);

		this.ui.querySelector('table.header tr td.tab[data-tab="'+tabID+'"] div input').addEventListener('change', function(){
			ChatBox.tabs[tabID].name = this.value;
		});

		this.ui.querySelector('.body .contentwrapper').insertAdjacentHTML('beforeend',
			`<div class="content active" data-content="${tabID}"></div>`
		);

		ChatBoxSettings.tabOption[tabID] = settings;

		this.tabs[tabID] = tab;
		this.activeTab = tabID;

		this.tabCount++;

		ChatBoxSettings.updateTab(this.activeTab, tabName);

		return tabID;
	}

	ChatBox.switchTab = function switchTab(tabID){
		var tabName = '';

		this.ui.querySelectorAll('table.header tr td.tab div').forEach(function(el) {
			el.classList.remove('on');
		});
		this.ui.querySelectorAll('.body .content').forEach(function(el) {
			el.classList.remove('active');
		});

		this.activeTab = tabID;

		var activeTabDiv = this.ui.querySelector('table.header tr td.tab[data-tab="'+ this.activeTab +'"] div');
		if (activeTabDiv) {
			activeTabDiv.classList.add('on');
		}
		var activeContent = this.ui.querySelector('.body .content[data-content="'+ this.activeTab +'"]');
		if (activeContent) {
			activeContent.classList.add('active');
			activeContent.scrollTop = activeContent.scrollHeight;
		}

		tabName = this.ui.querySelector('.header tr td div.on input').value;

		ChatBoxSettings.updateTab(this.activeTab, tabName);
	}

	/**
	 * Once append to HTML
	 */
	ChatBox.onAppend = function OnAppend()
	{
		// Focus the input
		this.ui.querySelector('.input .message').focus();

		var content = this.ui.querySelector('.content.active');
		content.scrollTop = content.scrollHeight;
	};


	/**
	 * Stop custom scroll
	 */
	ChatBox.onRemove = function OnRemove()
	{
		if (this._scrollHandler && this._scrollContent) {
			this._scrollContent.removeEventListener('scroll', this._scrollHandler);
			this._scrollHandler = null;
			this._scrollContent = null;
		}

		_preferences.y      = parseInt(this.ui.style.top, 10) + this.ui.offsetHeight;
		_preferences.x      = parseInt(this.ui.style.left, 10);
		_preferences.height = _heightIndex;
		_preferences.magnet_top = this.magnet.TOP;
		_preferences.magnet_bottom = this.magnet.BOTTOM;
		_preferences.magnet_left = this.magnet.LEFT;
		_preferences.magnet_right = this.magnet.RIGHT;

		_preferences.tabs = this.tabs;
		_preferences.tabOption = ChatBoxSettings.tabOption;
		_preferences.activeTab = this.activeTab;

		_preferences.save();

		this.lastTabID = -1;
		this.activeTab = 0;
	};


	/**
	 * BattleMode processing
	 *
	 * @param {number} key id to check
	 * @return {boolean} found a shortcut ?
	 */
	ChatBox.processBattleMode = function processBattleMode( keyId )
	{
		// Direct process
		if (DOM.isVisible(this.ui.querySelector('.battlemode')) ||
			KEYS.ALT || KEYS.SHIFT || KEYS.CTRL ||
			(keyId >= KEYS.F1 && keyId <= KEYS.F24)) {
			return BattleMode.process(keyId);
		}
/*
		var messageBox = this.ui.querySelector('.input .message');
		var text       = messageBox.value;

		var messageBoxUser = this.ui.querySelector('.input .username');
		var text2       = messageBoxUser.value;

		// Hacky, need to wait the browser to add text in the input
		// If there is no change, send the shortcut.
		Events.setTimeout(function(){
			// Nothing rendered, can process the shortcut
			if ((messageBox.value === text) && (messageBoxUser.value === text2)) {
				BattleMode.process(keyId);
			}
		}.bind(this), 4);*/

		return false;
	};


	/**
	 * Key Event Handler
	 *
	 * @param {object} event - KeyEventHandler
	 * @return {boolean}
	 */
	ChatBox.onKeyDown = function OnKeyDown( event )
	{
		var messageBox = this.ui.querySelector('.input .message');
		var nickBox    = this.ui.querySelector('.input .username');
		switch (event.which) {

			// Battle mode system
			default:
				if ((event.target.tagName && !event.target.tagName.match(/input|select|textarea/i)) || (event.which >= KEYS.F1 && event.which <= KEYS.F24) || KEYS.ALT || KEYS.SHIFT || KEYS.CTRL){
					if (ChatBox.processBattleMode(event.which)) {
						event.stopImmediatePropagation();
						return false;
					}
				}
				return true;

			// Switch from user name, to message input
			case KEYS.TAB:
				if (document.activeElement === messageBox) {
					nickBox.select();
					nickBox.focus();
					break;
				}

				if (document.activeElement === nickBox) {
					messageBox.select();
					messageBox.focus();
					break;
				}
				return true;

			// Get back message from history
			case KEYS.UP:
				if (!document.getElementById('NpcMenu')) {
					if (document.activeElement === messageBox) {
						messageBox.value = _historyMessage.previous();
						messageBox.select();
						break;
					}

					if (document.activeElement === nickBox) {
						nickBox.value = _historyNickName.previous();
						nickBox.select();
						break;
					}
				}
				return true;

			// Message from history
			case KEYS.DOWN:
				if (!document.getElementById('NpcMenu')) {
					if (document.activeElement === messageBox) {
						messageBox.value = _historyMessage.next();
						messageBox.select();
						break;
					}

					if (document.activeElement === nickBox) {
						nickBox.value = _historyNickName.next();
						nickBox.select();
						break;
					}
				}
				return true;

			// Update chat height
			case KEYS.F10:
				this.updateHeight(false);
				// scroll down when resize
				var activeContent = this.ui.querySelector('.content[data-content="'+ this.activeTab +'"]');
				if (activeContent) {
					activeContent.scrollTop = activeContent.scrollHeight;
				}
				break;

			// Send message
			case KEYS.ENTER:
				if (document.activeElement.tagName === 'INPUT' &&
				    document.activeElement !== messageBox) {
					return true;
				}

				if (document.getElementById('NpcMenu') || document.getElementById('NpcBox')) {
					return true;
				}

				messageBox.focus();
				this.submit();
				break;
		}

		event.stopImmediatePropagation();
		return false;
	};

	ChatBox.toggleChat = function toggleChat(){
		var messageBox = this.ui.querySelector('.input .message');

		if (document.activeElement.tagName === 'INPUT' &&
		    document.activeElement !== messageBox) {
			return true;
		}

		if (document.getElementById('NpcMenu') || document.getElementById('NpcBox')) {
			return true;
		}

		messageBox.focus();
		this.submit();
	}


	/**
	 * Process ChatBox message
	 */
	ChatBox.submit = function Submit()
	{
		var input = this.ui.querySelector('.input');
		var $user = input.querySelector('.username');
		var $text = input.querySelector('.message');

		var user = $user.value;
		var text = $text.value;
		var isChatOn = false;

		// Battle mode
		if (!text.length) {
			DOM.toggleDisplay(input);
			DOM.toggleDisplay(this.ui.querySelector('.battlemode'));
			if (DOM.isVisible(input)) {
				isChatOn = true;
				$text.focus();
			}
			var chatmode = isChatOn ? 'on' : 'off';
			Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/chatmode_'+chatmode+'.bmp', function( data ){
				var chatmodeBtn = ChatBox.ui.querySelector('.chat-function .chatmode');
				if (chatmodeBtn) {
					chatmodeBtn.style.backgroundImage = 'url('+ data +')';
				}
			});

			return;
		}

		// Private message
		if (user.length && text[0] !== '/') {
			this.PrivateMessageStorage.nick = user;
			this.PrivateMessageStorage.msg  = text;
			_historyNickName.push(user);
			_historyNickName.previous();
		}

		// Save in history
		_historyMessage.push(text);

		$text.value = '';

		// Command
		if (text[0] === '/') {
			Commands.processCommand.call(this, text.substr(1) );
			return;
		}

		this.onRequestTalk( user, text, ChatBox.sendTo );
	};


	/**
	 * Add text to chatbox
	 *
	 * @param {string} text
	 * @param {number} colorType
	 * @param {string} color
	 * @param {boolean} default false, html or text ?
	 * @param {number} filterType
	 */
	ChatBox.addText = function addText( text, colorType, filterType, color, override )
	{
		// Backward compatibility for older calls without filter
		if(isNaN(filterType)){
			filterType = ChatBox.FILTER.PUBLIC_LOG;
		}

		this.tabs.forEach((tab, TabNum) => {
			var content = this.ui.querySelector('.content[data-content="'+ TabNum +'"]');
			var chatTabOption = ChatBoxSettings.tabOption[TabNum];

			if(!chatTabOption.includes(filterType)){
				return;
			}

			if (!color) {
				if ((colorType & ChatBox.TYPE.PUBLIC) && (colorType & ChatBox.TYPE.SELF)) {
					color = '#00FF00';
				}
				else if (colorType & ChatBox.TYPE.PARTY) {
					color = ( colorType & ChatBox.TYPE.SELF ) ? 'rgb(200, 200, 100)' : 'rgb(230,215,200)';
				}
				else if (colorType & ChatBox.TYPE.GUILD) {
					color = 'rgb(180, 255, 180)';
				}
				else if (colorType & ChatBox.TYPE.PRIVATE) {
					color = '#FFFF00';
				}
				else if (colorType & ChatBox.TYPE.ERROR) {
					color = '#FF0000';
				}
				else if (colorType & ChatBox.TYPE.INFO) {
					color = '#FFFF63';
				}
				else if (colorType & ChatBox.TYPE.BLUE) {
					color = '#00FFFF';
				}
				else if (colorType & ChatBox.TYPE.ADMIN) {
					color = '#FFFF00';
				}
				else if (colorType & ChatBox.TYPE.MAIL) {
					color = '#F4D293';
				}
				else {
					color = 'white';
				}
			}

			var div = document.createElement('div');
			div.style.color = color;
			if (!override) {
				div.textContent = text;
			} else {
				div.innerHTML = text;
			}
			content.appendChild(div);


			// If there is too many line, remove the older one
			if (content.childElementCount > MAX_MSG) {
				var element, matches;
				var i, count;

				//Check if theres any blob url object to be released from buffer (Check Controls/ScreenShot.js)
				element = content.firstElementChild;

				matches = element.innerHTML.match(/(blob:[^"]+)/g);

				if (matches) {
					for (i = 0, count = matches.length; i < count; ++i) {
						window.URL.revokeObjectURL(matches[i]);
					}
				}

				element.remove();
			}


			// Function to determine whether to scroll down or not
			function shouldScrollDown(container, messageHeight, height) {
				// Tolerance could be a few pixels to account for nearly at the bottom situations
				const tolerance = 5;

				// The user is considered at the bottom if the current scrollTop, plus the height of the container,
				// plus any potential new message height, is within the tolerance of the total scrollable height.
				const atBottom = container.scrollTop + height + messageHeight >= container.scrollHeight - tolerance;

				// If there is no scrollbar (content does not overflow), or the user is at the bottom, return true.
				if (height >= container.scrollHeight || atBottom) {
					return true;
				}

				// In other cases, return false as we do not want to auto-scroll down
				return false;
			}

			const lastMessageHeight = this.ui.querySelector('.content[data-content="'+ TabNum +'"] > div:last-child').scrollHeight;

			if (shouldScrollDown(content, lastMessageHeight, content.offsetHeight)) {
				content.scrollTop = content.scrollHeight;
			}
		});
	};


	/**
	 * Change chatbox's height
	 */
	ChatBox.updateHeight = function changeHeight( AlwaysVisible )
	{
		var HeightList = [ 0, 0, MAGIC_NUMBER, MAGIC_NUMBER*2, MAGIC_NUMBER*3, MAGIC_NUMBER*4, MAGIC_NUMBER*5 ];
		_heightIndex   = (_heightIndex + 1) % HeightList.length;

		var content   = this.ui.querySelector('.contentwrapper');
		var height     = HeightList[ _heightIndex ];
		var top        = parseInt(this.ui.style.top, 10);

		this.ui.style.top = (top - (height - content.offsetHeight)) + 'px';
		content.style.height = height ? height + 'px' : '';

		// Don't remove UI
		if (_heightIndex === 0 && AlwaysVisible) {
			_heightIndex++;
		}

		switch (_heightIndex) {
			case 0:
				this.ui.style.display = 'none';
				break;

			case 1:
				this.ui.style.display = '';
				this.ui.querySelector('.header, .body').style.display = 'none';
				this.ui.querySelector('.input').classList.add('fix');
				break;

			default:
				this.ui.querySelector('.input').classList.remove('fix');
				this.ui.querySelector('.header, .body').style.display = '';
				break;
		}

		var activeContent = this.ui.querySelector('.content[data-content="'+ this.activeTab +'"]');
		if (activeContent) {
			activeContent.scrollTop = activeContent.scrollHeight;
		}
	};


	/**
	 * Save user name to nick name history
	 *
	 * @param {string} nick name
	 */
	ChatBox.saveNickName = function saveNickName( pseudo )
	{
		_historyNickName.push(pseudo);
	};
	
	/**
	 * Save chat from current tab into a file.
	 */
	ChatBox.saveCurrentTabChat = function saveCurrentTabChat(){
		
		var timezone, date, data, url;
		
		// Create a date
		var tzoffset = (new Date()).getTimezoneOffset() * 60000; //offset in milliseconds
    	var localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
		localISOTime = localISOTime.replace('T', ' ');
		timezone = (new Date().getTimezoneOffset() / 60);
		date     = localISOTime + ' (GMT ' + (timezone > 0 ? '-' : '+') + Math.abs(timezone).toString() + ')'; //GMT
		
		data = '<html><head><title>Chat History</title><style> body { background-color: DarkSlateGray; } </style></head><body>'
		data += this.ui.querySelector('.content[data-content="'+ ChatBox.activeTab +'"]').outerHTML;
		data += '</body></html>';
		
		// We create a local file
		url = window.URL.createObjectURL(new Blob([data], {type: 'text/plain'}));
		
		ChatBox.addText('Chat History ['+ ChatBox.tabs[ChatBox.activeTab].name +'] ' + date + ' can be saved by <a style="color:#F88" download="ChatHistory ['+ ChatBox.tabs[ChatBox.activeTab].name +'] (' + date.replace('/', '-') + ').html" href="'+ url +'" target="_blank">clicking here</a>.', ChatBox.TYPE.PUBLIC, ChatBox.FILTER.PUBLIC_LOG, null, true);
	};


	/**
	 * Update scroll by block (14px)
	 */
	function onScroll( event )
	{
		var delta;

		if (event.wheelDelta) {
			delta = event.wheelDelta / 120 ;
			if (window.opera) {
				delta = -delta;
			}
		}
		else if (event.detail) {
			delta = -event.detail;
		}

		this.scrollTop = Math.floor(this.scrollTop/14) * 14 - (delta * 14);
		return false;
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
		 return true;
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
	 * Change private message nick name
	 *
	 * @param {string} nick name
	 * @return {function} callback closure
	 */
	function onPrivateMessageUserSelection(name)
	{
		return function onPrivateMessageUserSelectionClosure()
		{
			ChatBox.ui.querySelector('.input .username').value = name;
		};
	}


	/**
	 * Change target of global chat (party, guild)
	 *
	 * @param {number} type constant
	 */
	function onChangeTargetMessage(type)
	{
		return function onChangeTargetMessageClosure()
		{
			var $input = ChatBox.ui.querySelector('.input .message');

			$input.classList.remove('guild party');

			if (type & ChatBox.TYPE.PARTY) {
				$input.classList.add('party');
			}
			else if (type & ChatBox.TYPE.GUILD) {
				$input.classList.add('guild');
			}

			ChatBox.sendTo = type;
		};
	}

	function makeResizableDiv() {
		const resizers = document.querySelectorAll('.draggable')
		let original_height = 0;
		let original_y = 0;
		let original_mouse_y = 0;
		for (let i = 0;i < resizers.length; i++) {
			const currentResizer = resizers[i];

			currentResizer.addEventListener('mousedown', function(e) {
				e.preventDefault();
				original_height = ChatBox.ui.querySelector('.contentwrapper').offsetHeight;
				original_y = parseInt( ChatBox.ui.style.top, 10) + original_height;
				original_mouse_y = e.pageY;
				window.addEventListener('mousemove', resize);
				window.addEventListener('mouseup', stopResize);
			})

			function resize(e) {
				if (currentResizer.classList.contains('draggable')) {
					const height = fixHeight(original_height - (e.pageY - original_mouse_y));
					if (height > MAGIC_NUMBER) {
						ChatBox.ui.style.top = (original_y - height) + 'px';
						ChatBox.ui.querySelector('.contentwrapper').style.height = height + 'px';
					}
				}
				var activeContent = ChatBox.ui.querySelector('.content[data-content="'+ ChatBox.activeTab +'"]');
				if (activeContent) {
					activeContent.scrollTop = activeContent.scrollHeight;
				}
			}

			function fixHeight(height){
				return  Math.floor(height/MAGIC_NUMBER)*MAGIC_NUMBER;
			}

			function stopResize() {
				window.removeEventListener('mousemove', resize);
			}
		}
	  }


	/**
	 * Create componentand export it
	 */
	return UIManager.addComponent(ChatBox);
});
