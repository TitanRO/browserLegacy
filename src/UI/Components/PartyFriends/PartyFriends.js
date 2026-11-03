/**
 * UI/Components/PartyFriends/PartyFriends.js
 *
 * Manage interface for parties and friends
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
	var DB                   = require('DB/DBManager');
	var Preferences          = require('Core/Preferences');
	var Client               = require('Core/Client');
	var Renderer             = require('Renderer/Renderer');
	var Session              = require('Engine/SessionStorage');
	var Mouse                = require('Controls/MouseEventHandler');
	var UIManager            = require('UI/UIManager');
	var UIComponent          = require('UI/UIComponent');
	var PartyHelper          = require('UI/Components/PartyFriends/PartyHelper');
	var ContextMenu          = require('UI/Components/ContextMenu/ContextMenu');
	var Mail 				 = require('UI/Components/Mail/Mail');
	var ChatBox              = require('UI/Components/ChatBox/ChatBox');
	var htmlText             = require('text!./PartyFriends.html');
	var cssText              = require('text!./PartyFriends.css');
	var getModule            = require;
	var DOM             = require('Utils/DOM');


	/**
	 * Create Component
	 */
	var PartyFriends = new UIComponent('PartyFriends', htmlText, cssText );


	/**
	 * @var {number} index of selection
	 */
	var _index = -1;


	/**
	 * @var {Array} friends list
	 */
	var _friends = [];


	/**
	 * @var {Array} party list
	 */
	var _party = [];


	/**
	 * @var {Object} party setup
	 */
	var _options = {
		exp_share:         0,
		item_share:        0,
		item_sharing_type: 0
	};

	/**
	 * @var {Preferences} structure
	 */
	var _preferences = Preferences.get('PartyFriends', {
		x:        200,
		y:        200,
		width:    12,
		height:   6,
		show:     false,
		friend:   true,
		lock:     false
	}, 1.0);


	/**
	 * Initialize the component (event listener, etc.)
	 */
	PartyFriends.init = function init()
	{
		// Start loading the helper
		PartyHelper.prepare();

		// Avoid drag drop problems
		this.ui.querySelector('.base').addEventListener('mousedown', function(event){
			event.stopImmediatePropagation();
			return false;
		});

		// Bind buttons
		this.ui.querySelector('.close').addEventListener('click', onClose);
		this.ui.querySelector('.lock').addEventListener('mousedown', onToggleLock);
		this.ui.querySelector('.switchtab.off').addEventListener('mousedown', onChangeTab);
		this.ui.querySelector('.remove').addEventListener('mousedown', onRequestRemoveSelection);
		this.ui.querySelector('.privatemessage').addEventListener('mousedown', onRequestPrivateMessage);
		this.ui.querySelector('.leave').addEventListener('mousedown', onRequestLeaveParty);
		this.ui.querySelector('.resize').addEventListener('mousedown', onResize);

		this.ui.querySelector('.mail').addEventListener('mousedown', onOpenMailCreationWindow);
		this.ui.querySelector('.party.create').addEventListener('mousedown', onOpenPartyCreationWindow);
		this.ui.querySelector('.party.add').addEventListener('mousedown', onOpenPartyInviteWindow);
		this.ui.querySelector('.info').addEventListener('mousedown', onOpenPartyOptionWindow);

		var _pfContent = this.ui.querySelector('.content');
		DOM.addDelegatedEvent(_pfContent, 'contextmenu', '.name', onRightClickInfo);
		DOM.addDelegatedEvent(_pfContent, 'mousedown', '.name', onSelectionChange);

		this.draggable(this.ui.querySelector('.titlebar'));
	};


	/**
	 * Once append to the DOM, start to position the UI
	 */
	PartyFriends.onAppend = function onAppend()
	{
		// Initialize the tab
		_preferences.friend = !_preferences.friend;
		onChangeTab();

		// Lock features
		if (_preferences.lock) {
			this.ui.querySelector('.lock.on').style.display = '';
			this.ui.querySelector('.lock.off').style.display = 'none';
		}
		else {
			this.ui.querySelector('.lock.on').style.display = 'none';
			this.ui.querySelector('.lock.off').style.display = '';
		}

		this.resize( _preferences.width, _preferences.height);

		DOM.setCss(this.ui, {
			top:  Math.min( Math.max( 0, _preferences.y), Renderer.height - this.ui.offsetHeight),
			left: Math.min( Math.max( 0, _preferences.x), Renderer.width  - this.ui.offsetWidth)
		});

		if (!_preferences.show) {
			this.ui.style.display = 'none';
		}
	};


	/**
	 * Clean up UI
	 */
	PartyFriends.clean = function clean()
	{
		_party.length   = 0;
		_friends.length = 0;
		_index          = -1;

		_options.exp_share         = 0;
		_options.item_share        = 0;
		_options.item_sharing_type = 0;

		this.ui.querySelector('.partyname').textContent = '';
		this.ui.querySelector('.friendcount').textContent = '0';
		this.ui.querySelector('.content .party, .content .friend').innerHTML = '';

		// Reset buttons
		_preferences.friend = !_preferences.friend;
		onChangeTab();
	};


	/**
	 * Removing the UI from window, save preferences
	 *
	 */
	PartyFriends.onRemove = function onRemove()
	{
		// Save preferences
		_preferences.show   = DOM.isVisible(this.ui);
		_preferences.y      = parseInt(this.ui.style.top, 10);
		_preferences.x      = parseInt(this.ui.style.left, 10);
		_preferences.save();
	};


	/**
	 * Window Shortcuts
	 */
	PartyFriends.onShortCut = function onShurtCut( key )
	{
		switch (key.cmd) {
			case 'FRIEND':
				if (_preferences.friend) {
					DOM.toggleDisplay(this.ui);
				}
				else {
					_preferences.friend = false;
					onChangeTab();
					this.ui.style.display = '';
				}

				if (DOM.isVisible(this.ui)) {
					this.focus();
				}
				break;

			case 'PARTY':
				if (!_preferences.friend) {
					DOM.toggleDisplay(this.ui);
				}
				else {
					_preferences.friend = true;
					onChangeTab();
					this.ui.style.display = '';
				}

				if (DOM.isVisible(this.ui)) {
					this.focus();
				}
				break;
		}
	};


	/**
	 * Show/Hide UI
	 */
	PartyFriends.toggle = function toggle()
	{
		DOM.toggleDisplay(this.ui);

		if (DOM.isVisible(this.ui)) {
			this.focus();
		}
	};


	/**
	 * Set friends to UI
	 *
	 * @param {Array} friends list
	 */
	PartyFriends.setFriends = function setFriends( friends )
	{
		var i, count = friends.length;
		var ui = this.ui.querySelector('.content .friend');

		_friends.length = friends.length;
		ui.innerHTML = '';

		for (i = 0; i < count; i++) {
			_friends[i] = friends[i];
			ui.insertAdjacentHTML('beforeend',
				'<div class="node'+ (friends[i].State === 0 ? ' online' : '') +'">' +
					'<span class="name">' + DOM.escapeHtml(friends[i].Name) + '</span>' +
				'</div>'
			);
		}

		this.ui.querySelector('.friendcount').textContent = count;
		_index = -1;
	};


	/**
	 * Update friend (online/offline) state
	 *
	 * @param {number} index
	 * @param {boolean} state
	 */
	PartyFriends.updateFriendState = function updateFriendState( index, state)
	{
		var node = this.ui.querySelectorAll('.content .friend .node')[index];

		_friends[index].State = state;

		if (state) {
			node.style.backgroundImage = '';
			ChatBox.addText( DB.getMessage(1042).replace('%s', _friends[index].Name), ChatBox.TYPE.BLUE, ChatBox.FILTER.PUBLIC_LOG);
			return;
		}

		ChatBox.addText( DB.getMessage(1041).replace('%s', _friends[index].Name), ChatBox.TYPE.BLUE, ChatBox.FILTER.PUBLIC_LOG);
		Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/grp_online.bmp', function(url){
			node.style.backgroundImage = 'url(' + url + ')';
		});
	};


	/**
	 * Update/Add a friend to the list
	 *
	 * @param {number} index
	 * @param {object} friend data
	 */
	PartyFriends.updateFriend = function updateFriend(idx, friend)
	{
		// Add it
		if (!_friends[idx]) {
			_friends[idx] = {};

			this.ui.querySelector('.content .friend').insertAdjacentHTML('beforeend',
				'<div class="node">' +
					'<span class="name"></span>' +
				'</div>'
			);

			this.ui.querySelector('.friendcount').textContent = _friends.length;
		}

		_friends[idx].Name   = friend.Name;
		_friends[idx].GID    = friend.GID;
		_friends[idx].AID    = friend.AID;
		_friends[idx].State  = friend.State || 0;

		var node = this.ui.querySelectorAll('.content .friend .node')[idx];
		node.querySelector('.name').textContent = friend.Name;

		Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/grp_online.bmp', function(url){
			node.style.backgroundImage = 'url(' + url + ')';
		});
	};


	/**
	 * Remove friend from list
	 *
	 * @param {number} index
	 */
	PartyFriends.removeFriend = function removeFriend(index)
	{
		_friends.splice(index, 1);
		this.ui.querySelectorAll('.content .friend .node')[index].remove();
		this.ui.querySelector('.friendcount').textContent = _friends.length;

		if (_index === index) {
			_index = -1;
		}
	};


	/**
	 * Add members to party
	 *
	 * @param {string} party name
	 * @param {Array} member list
	 */
	PartyFriends.setParty = function setParty(name, members)
	{
		this.ui.querySelector('.partyname').textContent = '('+name+')';
		this.ui.querySelector('.content .party').innerHTML = '';
		Session.isPartyLeader = false;

		this.ui.querySelector('.party.create').style.display = 'none';
		this.ui.querySelector('.party.leave').style.display = '';

		var i, count = members.length;

		_party.length = 0;
		for (i = 0; i < count; i++) {
			PartyFriends.addPartyMember(members[i]);
		}

		_index = -1;
	};


	/**
	 * Add a new party member to the list
	 *
	 * @param {object} player information
	 */
	PartyFriends.addPartyMember = function addPartyMember( player )
	{
		var role = player.role || player.Role || 0;
		var i, count = _party.length;
		var node, texture, ctx;

		// Check if we are the leader
		if (player.AID === Session.AID) {
			Session.isPartyLeader = (role === 0);
			if (Session.isPartyLeader) {
				this.ui.querySelector('.party.add').style.display = '';
			}
			else {
				this.ui.querySelector('.party.add').style.display = 'none';
			}
		}

		// Search for duplicates entries
		for (i = 0; i < count; ++i) {
			// No GID, need to compare using charactername (wtf)
			if (_party[i].AID === player.AID && _party[i].characterName === player.characterName) {
				break;
			}
		}

		// Update
		if (i < count) {
			node = this.ui.querySelectorAll('.content .party .node')[i];
			node.classList.remove('leader online');

			if (role === 0) {
				node.classList.add('leader');
			}
			if (player.state === 0) {
				node.classList.add('online');
			}

			node.style.backgroundImage = '';
			node.querySelector('.name').textContent = player.characterName;
			node.querySelector('.map').textContent = '('+DB.getMapName(player.mapName)+')';
		}

		// Create
		else {
			player = Object.assign({}, player);

			_party.push(player);
			this.ui.querySelector('.content .party').insertAdjacentHTML('beforeend',
				'<div class="node'+ (role === 0 ? ' leader' : '') + (player.state === 0 ? ' online' : '') + '">' +
					'<span class="name">' + DOM.escapeHtml(player.characterName) + '</span>' +
					'<span class="map">(' + DOM.escapeHtml(DB.getMapName(player.mapName)) + ')</span>' +
					'<canvas class="life" width="60" height="5"></canvas> <span class="hp"></span>' +
				'</div>'
			);

			node = this.ui.querySelectorAll('.content .party .node')[i];
		}

		ctx = node.querySelector('canvas').getContext('2d');
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		node.querySelector('.hp').textContent = '';

		// Update life
		if (player.life && player.life.display) {
			ctx.drawImage(player.life.canvas, 0, 0, 60, 5, 0, 0, 60, 5);
			node.querySelector('.hp').textContent = player.life.hp + '/' + player.life.hp_max;
		}

		// Add texture
		texture = role === 0 && player.state === 0 ? 'grp_leader.bmp' : player.state === 0 ? 'grp_online.bmp' : '';
		if (texture) {
			Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/' + texture, function(url){
				node.style.backgroundImage = 'url(' + url + ')';
			});
		}
	};


	/**
	 * Remove a character from list
	 *
	 * @param {number} account id
	 * @param {string} character name
	 */
	PartyFriends.removePartyMember = function removePartyMember( AID, characterName )
	{
		if (AID === Session.AID) {
			_party.length = 0;

			this.ui.querySelector('.content .party').innerHTML = '';
			this.ui.querySelector('.partyname').textContent = '';
			this.ui.querySelector('.party.create').style.display = '';
			this.ui.querySelector('.party.leave, .party.add').style.display = 'none';

			ChatBox.addText( DB.getMessage(84), ChatBox.TYPE.BLUE, ChatBox.FILTER.PARTY_SETUP);
			return;
		}

		var i, count = _party.length;

		for (i = 0; i < count; ++i) {
			// Why Gravity doesn't send the GID ? Meaning we can't have the same
			// character name twice (even in the same account).
			if (_party[i].AID === AID && _party[i].characterName === characterName) {
				_party.splice(i, 1);
				this.ui.querySelectorAll('.content .party .node')[i].remove();
				break;
			}
		}
	};


	/**
	 * Extend inventory window size
	 *
	 * @param {number} width
	 * @param {number} height
	 */
	PartyFriends.resize = function resize( width, height )
	{
		width  = Math.min( Math.max(width, 12), 13);
		height = Math.min( Math.max(height, 6), 12);

		_preferences.width  = width;
		_preferences.height = height;
		_preferences.save();

		var content = this.ui.querySelector('.content');
		content.style.width = width * 20 + 'px';
		content.style.height = height * 20 + 'px';
	};


	/**
	 * Update player life in interface
	 *
	 * @param {number} account id
	 * @param {canvas} canvas life element
	 * @param {number} hp
	 * @param {number} maxhp
	 */
	PartyFriends.updateMemberLife = function updateMemberLife(AID, canvas, hp, maxhp)
	{
		var i, count = _party.length;
		var node, ctx;

		for (i = 0; i < count; ++i) {
			// No GID data, so have to check for the online character in
			// the account (since we can have multiple players in a team
			// using the same account).
			if (_party[i].AID === AID && _party[i].state === 0) {
				node = this.ui.querySelectorAll('.content .party .node')[i];
				ctx  = node.querySelector('canvas').getContext('2d');

				ctx.drawImage(canvas, 0, 0, 60, 5, 0, 0, 60, 5);
				node.querySelector('.hp').textContent = hp + '/' + maxhp;
				break;
			}
		}
	};


	/**
	 * Update party options
	 *
	 * @param {boolean} exp share option
	 * @param {boolean} item share option
	 * @param {boolean} item sharing option
	 */
	PartyFriends.setOptions = function setOptions( exp_share, item_share, item_sharing_type)
	{
		if (exp_share !== undefined)
			_options.exp_share         = exp_share;
		if (item_share !== undefined)
			_options.item_share        = item_share;
		if (item_sharing_type !== undefined)
			_options.item_sharing_type = item_sharing_type;
	};


	/**
	 * Check if character is a group member
	 *
	 * @param {string} character name
	 */
	PartyFriends.isGroupMember = function isGroupMember( characterName )
	{
		let count = _party.length;
		for (let i = 0; i < count; ++i) {
			// No GID, need to compare using charactername (wtf)
			if (_party[i].characterName === characterName) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Resizing UI
	 */
	function onResize()
	{
		var ui      = PartyFriends.ui;
		var top     = DOM.getPosition(ui).top;
		var left    = DOM.getPosition(ui).left;
		var lastWidth  = 0;
		var lastHeight = 0;
		var _Interval;

		function resizing()
		{
			var extraX = -20;
			var extraY =  25 + 21;

			var w = Math.floor( (Mouse.screen.x - left - extraX) / 20 );
			var h = Math.floor( (Mouse.screen.y - top  - extraY) / 20 );

			// Maximum and minimum window size
			w = Math.min( Math.max(w, 12), 13);
			h = Math.min( Math.max(h,  6), 12);

			if (w === lastWidth && h === lastHeight) {
				return;
			}

			PartyFriends.resize( w, h );
			lastWidth  = w;
			lastHeight = h;
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


	/**
	 * Close the window
	 */
	function onClose()
	{
		PartyFriends.ui.style.display = 'none';
	}


	/**
	 * Enable or disable the lock features
	 */
	function onToggleLock()
	{
		_preferences.lock = !_preferences.lock;
		_preferences.save();

		if (_preferences.lock) {
			PartyFriends.ui.querySelector('.lock.on').style.display = '';
			PartyFriends.ui.querySelector('.lock.off').style.display = 'none';
		}
		else {
			PartyFriends.ui.querySelector('.lock.on').style.display = 'none';
			PartyFriends.ui.querySelector('.lock.off').style.display = '';
		}
	}


	/**
	 * Move to the other tab (Friend -> Party or Party -> Friend)
	 */
	function onChangeTab()
	{
		var ui = PartyFriends.ui;

		_preferences.friend = !_preferences.friend;
		_preferences.save();

		// Initialize the tab
		if (_preferences.friend) {
			ui.querySelector('.friend').style.display = '';
			ui.querySelector('.party').style.display = 'none';
		}
		else {
			ui.querySelector('.friend').style.display = 'none';
			ui.querySelector('.party').style.display = '';

			if (Session.hasParty) {
				ui.querySelector('.party.create').style.display = 'none';

				if (!Session.isPartyLeader) {
					ui.querySelector('.party.add').style.display = 'none';
				}
			}
			else {
				ui.querySelector('.party.add, .party.leave').style.display = 'none';
			}
		}

		ui.querySelectorAll('.content .selection').forEach(function(el) {
			el.classList.remove('selection');
		});
		_index = -1;
	}


	/**
	 * Ask confirmation to remove a character from the list
	 */
	function onRequestRemoveSelection()
	{
		if (_index < 0 || _preferences.lock || (_preferences.friend && !_friends[_index]) || (!_preferences.friend && !_party[_index])) {
			return;
		}

		var text = _preferences.friend ? DB.getMessage(356) : DB.getMessage(363);

		// Are you sure that you want to delete/expel ?
		UIManager.showPromptBox( text, 'ok', 'cancel', function(){
			if (_preferences.friend) {
				PartyFriends.onRemoveFriend(_index);
			}
			else {
				PartyFriends.onExpelMember( _party[_index].AID, _party[_index].characterName);
			}
		});
	}


	/**
	 * Add nick name to chatbox
	 * Or open a new conversation window (todo)
	 */
	function onRequestPrivateMessage()
	{
		if (_index < 0 || _preferences.lock) {
			return;
		}

		if (_preferences.friend) {
			ChatBox.ui.querySelector('.username').value = _friends[_index].Name;
		}
		else {
			ChatBox.ui.querySelector('.username').value = _party[_index].characterName;
		}

		ChatBox.ui.querySelector('.message').select();
	}


	 /**
	 * Add nick name to chatbox while clicking on player character sprite
	 */
	 PartyFriends.onOpenChat1to1 = function onOpenChat1to1(name)
	 {
		ChatBox.ui.querySelector('.username').value = name;
		ChatBox.ui.querySelector('.message').select();
	 }

	/**
	 * Right click on a character
	 */
	function onRightClickInfo()
	{
		if (_preferences.lock) {
			return;
		}

		ContextMenu.remove();
		ContextMenu.append();

		if (_preferences.friend) {
			ContextMenu.addElement( DB.getMessage(360), onRequestPrivateMessage);

			if (_friends[_index].GID !== Session.GID) {
				ContextMenu.addElement( DB.getMessage(351), onRequestRemoveSelection);
			}
		}
		else {
			ContextMenu.addElement( DB.getMessage(129), onRequestInformation);

			if (_party[_index].GID === Session.GID) {
				ContextMenu.addElement( DB.getMessage(2055), onRequestLeaveParty);
			}
			else {
				ContextMenu.addElement( DB.getMessage(360), onRequestPrivateMessage);

				if (Session.isPartyLeader) {
					ContextMenu.addElement( DB.getMessage(97),   onRequestRemoveSelection);
					ContextMenu.addElement( DB.getMessage(1532), onRequestPartyDelegation);
				}
			}
		}
	}


	/**
	 * Request player information
	 * (Not implemented yet in official client)
	 */
	function onRequestInformation()
	{
		if (_preferences.lock) {
			return;
		}

		// Not implemented yet
		UIManager.showMessageBox( DB.getMessage(191), 'ok');
	}


	/**
	 * Request to leave a party
	 */
	function onRequestLeaveParty()
	{
		if (_preferences.lock) {
			return;
		}

		// Are you sure that you want to leave ?
		UIManager.showPromptBox( DB.getMessage(357), 'ok', 'cancel', function(){
			PartyFriends.onRequestLeave();
		});
	}


	/**
	 * Request to change party leader
	 * (need to be the leader)
	 */
	function onRequestPartyDelegation()
	{
		if (_preferences.lock) {
			return;
		}

		// Do you want to delegate the real party?
		UIManager.showPromptBox( DB.getMessage(1532), 'ok', 'cancel', function(){
			PartyFriends.onRequestChangeLeader( _party[_index].AID );
		});
	}


	/**
	 * Change selection (click on a friend/party)
	 */
	function onSelectionChange(event)
	{
		PartyFriends.ui.querySelectorAll('.content .selection').forEach(function(el) {
			el.classList.remove('selection');
		});
		this.classList.add('selection');

		_index = DOM.indexAmongSiblings(this);

		var SkillTargetSelection = getModule('UI/Components/SkillTargetSelection/SkillTargetSelection');
		if (SkillTargetSelection.__active && !_preferences.friend) {
			var player = _party[_index];

			if (player.state === 0) {
				SkillTargetSelection.intersectEntityId(player.AID);
			}

			SkillTargetSelection.remove();
			event.stopImmediatePropagation();
			return false;
		}
	}

	/**
	 * Request to create a team (open the window)
	 */
	 function onOpenMailCreationWindow()
	 {
		let recipient = PartyFriends.ui.querySelector('.content .selection').textContent;

		// redirect tela
		Mail.replyNewMailFriends(recipient);
	 }


	/**
	 * Request to create a team (open the window)
	 */
	function onOpenPartyCreationWindow()
	{
		if (PartyHelper.__active && PartyHelper.getType() === PartyHelper.Type.CREATE) {
			PartyHelper.remove();
			return;
		}

		PartyHelper.append();
		PartyHelper.setType(PartyHelper.Type.CREATE);
	}


	/**
	 * Request to open invitation window
	 */
	function onOpenPartyInviteWindow()
	{
		if (PartyHelper.__active && PartyHelper.getType() === PartyHelper.Type.INVITE) {
			PartyHelper.remove();
			return;
		}

		PartyHelper.append();
		PartyHelper.setType(PartyHelper.Type.INVITE);
	}


	/**
	 * Request to open invitation window
	 */
	function onOpenPartyOptionWindow()
	{
		if (_preferences.friend) {
			return;
		}

		if (PartyHelper.__active && PartyHelper.getType() === PartyHelper.Type.SETUP) {
			PartyHelper.remove();
			return;
		}

		PartyHelper.append();
		PartyHelper.setType(PartyHelper.Type.SETUP);
		PartyHelper.setOptions(_options, Session.isPartyLeader);
	}


	/**
	 * Callbacks to define
	 */
	PartyFriends.onRemoveFriend         = function(){};
	PartyFriends.onRequestLeave         = function(){};
	PartyFriends.onExpelMember          = function(){};
	PartyFriends.onRequestChangeLeader  = function(){};
	PartyFriends.onRequestAddingMember  = function(){};
	PartyFriends.onRequestPartyCreation = function(){};
	PartyFriends.onRequestSettingUpdate = function(){};


	/**
	 * Export
	 */
	return UIManager.addComponent(PartyFriends);
});
