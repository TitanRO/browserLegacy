/**
 * UI/Components/VendingShop/VendingShop.js
 *
 * Character VendingShop Inventory
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 * In some cases the client will send packet twice.eg NORMAL_ITEMLIST4; fixit [skybook888]
 *
 */
define(function(require)
{
	'use strict';


	/**
	 * Dependencies
	 */
	var DB                 = require('DB/DBManager');
	var Network          = require('Network/NetworkManager');
	var PACKET           = require('Network/PacketStructure');
	var Client             = require('Core/Client');
	var Preferences        = require('Core/Preferences');
	var Mouse              = require('Controls/MouseEventHandler');
	var Renderer           = require('Renderer/Renderer');
	var UIManager          = require('UI/UIManager');
	var UIComponent        = require('UI/UIComponent');
	var ItemInfo           = require('UI/Components/ItemInfo/ItemInfo');
	var Session    			= require('Engine/SessionStorage');
	var Vending          = require('UI/Components/Vending/Vending');
	var htmlText           = require('text!./VendingShop.html');
	var cssText            = require('text!./VendingShop.css');
	var getModule          = require;
	var DOM             = require('Utils/DOM');


	/**
	 * Create Component
	 */
	var VendingShop = new UIComponent( 'VendingShop', htmlText, cssText );

	/**
	 * @var {enum} Store type
	 */
	VendingShop.Type = {
		VENDING_LIST: 0,
		BUYING_LIST: 1
	};

	/**
	 * Store inventory items
	 */
	VendingShop.list = [];


	/**
	 * @var {number} used to remember the window height
	 */
	var _realSize = 0;

	/**
	 * @var {number} type (buy/sell)
	 */
	var _type;

	var _vendcount = 0;


	/**
	 * @var {Preferences} structure
	 */
	var _preferences = Preferences.get('VendingShop', {
		x:        200,
		y:        200,
		width:    8,
		height:   2,
		reduce:   false
	}, 1.0);


	/**
	 * Initialize UI
	 */
	VendingShop.init = function Init()
	{
		// Bind buttons
		this.ui.querySelector('.btn.close').addEventListener('click', function(){
			VendingShop.onSubmit();
		});
		// on drop item
		this.ui.addEventListener('drop', onDrop);
		this.ui.addEventListener('dragover', stopPropagation);
		// Items event
		var _vsContent = this.ui.querySelector('.container .content');
		_vsContent.addEventListener('mousewheel', onScroll);
		_vsContent.addEventListener('DOMMouseScroll', onScroll);
		DOM.addDelegatedEvent(_vsContent, 'mouseover', '.item', onItemOver);
		DOM.addDelegatedEvent(_vsContent, 'mouseout', '.item', onItemOut);
		DOM.addDelegatedEvent(_vsContent, 'dragstart', '.item', onItemDragStart);
		DOM.addDelegatedEvent(_vsContent, 'dragend', '.item', onItemDragEnd);
		DOM.addDelegatedEvent(_vsContent, 'contextmenu', '.item', onItemInfo);
		DOM.addDelegatedEvent(_vsContent, 'dblclick', '.item', onItemUsed);

		this.draggable(this.ui.querySelector('.titlebar'));
	};


	/**
	 * Apply preferences once append to body
	 */
	VendingShop.onAppend = function OnAppend()
	{
		this.resize( _preferences.width, _preferences.height );

		DOM.setCss(this.ui, {
			top:  Math.min( Math.max( 0, _preferences.y), Renderer.height - this.ui.offsetHeight),
			left: Math.min( Math.max( 0, _preferences.x), Renderer.width  - this.ui.offsetWidth)
		});

		_realSize = _preferences.reduce ? 0 : this.ui.offsetHeight;
		let messageText = DB.getMessage(226);
		let titleShop = Vending._shopname.length > 25 ? Vending._shopname.substring(0,25)+"..." : Vending._shopname
		this.ui.querySelector('.text.shopname').textContent = messageText+" : "+titleShop;
	};

	/**
	 * Specify the type of the shop
	 *
	 * @param {number} type (see NpcStore.Type.*)
	 */
	VendingShop.setType = function setType(type)
	{
		_type = type;
	};

	/**
	 * Remove Inventory from window (and so clean up items)
	 */
	VendingShop.onRemove = function OnRemove()
	{

		this.ui.querySelector('.container .content').innerHTML = '';
		this.list.length = 0;
		ItemInfo.remove();

		// Save preferences
		_preferences.reduce = !!_realSize;
		_preferences.y      =  parseInt(this.ui.style.top, 10);
		_preferences.x      =  parseInt(this.ui.style.left, 10);
		_preferences.width  =  Math.floor( (this.ui.offsetWidth  - (23 + 16 + 16 - 30)) / 32 );
		_preferences.height =  Math.floor( (this.ui.offsetHeight - (31 + 19 - 30     )) / 32 );
		_preferences.save();

		this.ui.style.display = 'none';

	};


	/**
	 * Extend inventory window size
	 *
	 * @param {number} width
	 * @param {number} height
	 */
	VendingShop.resize = function Resize( width, height )
	{
		width  = Math.min( Math.max(width,  6), 9);
		height = Math.min( Math.max(height, 2), 6);

		var content = this.ui.querySelector('.container .content');
		content.style.width = (width * 32 + 13) + 'px'; // 13 = scrollbar
		content.style.height = (height * 32) + 'px';

		DOM.setCss(this.ui, {
			width:  16 + 16 + width  * 32,
			height: 31 + 19      + height * 32
		});
	};


	/**
	 * Get item object
	 *
	 * @param {number} id
	 * @returns {Item}
	 */
	VendingShop.getItemById = function GetItemById( id )
	{
		var i, count;
		var list = VendingShop.list;

		for (i = 0, count = list.length; i < count; ++i) {
			if (list[i].ITID === id) {
				return list[i];
			}
		}

		return null;
	};


	/**
	 * Search in a list for an item by its index
	 *
	 * @param {number} index
	 * @returns {Item}
	 */
	VendingShop.getItemByIndex = function getItemByIndex( index )
	{
		var i, count;
		var list = VendingShop.list;

		for (i = 0, count = list.length; i < count; ++i) {
			if (list[i].index === index) {
				return list[i];
			}
		}

		return null;
	};


	/**
	 * Add items to the list
	 * if the item index is exist you should clear it;[skybook888]
	 */
	VendingShop.setItems = function setItems(items)
	{
		var i, count;

		for (i = 0, count = items.length; i < count ; ++i) {
			if(this.addItemSub(items[i])){
				this.list.push(items[i]);
			}
		}

		this.ui.style.display = '';
	};


	/**
	 * Insert Item to inventory
	 *
	 * @param {object} Item
	 */
	VendingShop.addItem = function AddItem( item )
	{
		var object = this.getItemByIndex(item.index);

		if (object) {
			object.count += item.count;
			this.ui.querySelector('.item[data-index="'+ item.index +'"] .count').textContent =  object.count ;
			return;
		}

		object = Object.assign({}, item);
		if (this.addItemSub(object)) {
			this.list.push(object);
		}
	};


	/**
	 * Add item to inventory
	 *
	 * @param {object} Item
	 */
	VendingShop.addItemSub = function AddItemSub( item )
	{
			var it      = DB.getItemInfo( item.ITID );
			var content = this.ui.querySelector('.container .content');

			content.insertAdjacentHTML('beforeend',
				'<div class="item" data-index="'+ item.index +'" draggable="true">' +
					'<div class="icon"></div>' +
					'<div class="amount"><span class="count">' + (item.count || 1) + '</span></div>' +
				'</div>'
			);

			if (content.offsetHeight < content.scrollHeight) {
				this.ui.querySelector('.hide').style.display = 'none';
			}
			else {
				this.ui.querySelector('.hide').style.display = '';
			}

			Client.loadFile( DB.INTERFACE_PATH + 'item/' + ( item.IsIdentified ? it.identifiedResourceName : it.unidentifiedResourceName ) + '.bmp', function(data){
				content.querySelector('.item[data-index="'+ item.index +'"] .icon').style.backgroundImage = 'url('+ data +')';
			});
		return true;
	};


	/**
	 * Remove item from inventory
	 *
	 * @param {number} index in inventory
	 * @param {number} count
	 */
	VendingShop.removeItem = function RemoveItem( index, count )
	{
		var i,ctr;
		var item = this.getItemByIndex(index);

		// Emulator failed to complete the operation
		// do not remove item from inventory
		if (!item || count <= 0) {
			return null;
		}


		if (item.count) {
			item.count -= count;

			if (item.count > 0) {
				this.ui.querySelector('.item[data-index="'+ item.index +'"] .count').textContent =  item.count ;
				return item;
			}
		}

		this.list.splice( this.list.indexOf(item), 1 );
		this.ui.querySelector('.item[data-index="'+ item.index +'"]').remove();

		ctr = 0;
		for(i=0; i < this.list.length; i++)
		{
			if(this.list[i].count > 0)
			{
				ctr++;
			}
		}

		if(ctr == 0)
		{
			this.onSubmit();
		}
/*
		var content = this.ui.querySelector('.container .content');
		if (content.offsetHeight === content.scrollHeight) {
			this.ui.querySelector('.hide').style.display = '';
		}
*/
		return item;
	};


	/**
	 * Remove item from inventory
	 *
	 * @param {number} index in inventory
	 * @param {number} count
	 */
	VendingShop.updateItem = function UpdateItem( index, count )
	{
		var item = this.getItemByIndex(index);

		if (!item) {
			return;
		}

		item.count = count;

		// Update quantity
		if (item.count > 0) {
			this.ui.querySelector('.item[data-index="'+ item.index +'"] .count').textContent =  item.count ;
			return;
		}

		// no quantity, remove
		this.list.splice( this.list.indexOf(item), 1 );
		this.ui.querySelector('.item[data-index="'+ item.index +'"]').remove();

		var content = this.ui.querySelector('.container .content');
		if (content.offsetHeight === content.scrollHeight) {
			this.ui.querySelector('.hide').style.display = '';
		}
	};
	
	/**
	 * Prettify zeny : 1000000 -> 1,000,000
	 *
	 * @param {number} zeny
	 * @param {boolean} use color
	 * @return {string}
	 */
	function prettyZeny( val, useStyle )
	{
		
		var list = val.toString().split('');
		var i, count = list.length;
		var str = '';

		for (i = 0; i < count; i++) {
			str = list[count-i-1] + (i && i%3 ===0 ? ',' : '') + str;
		}

		if (useStyle) {
			var style = [
				'color:#000000; text-shadow:1px 0px #00ffff;', // 0 - 9
				'color:#0000ff; text-shadow:1px 0px #ce00ce;', // 10 - 99
				'color:#0000ff; text-shadow:1px 0px #00ffff;', // 100 - 999
				'color:#ff0000; text-shadow:1px 0px #ffff00;', // 1,000 - 9,999
				'color:#ff18ff;',                              // 10,000 - 99,999
				'color:#0000ff;',                              // 100,000 - 999,999
				'color:#000000; text-shadow:1px 0px #00ff00;', // 1,000,000 - 9,999,999
				'color:#ff0000;',                              // 10,000,000 - 99,999,999
				'color:#000000; text-shadow:1px 0px #cece63;', // 100,000,000 - 999,999,999
				'color:#ff0000; text-shadow:1px 0px #ff007b;', // 1,000,000,000 - 9,999,999,999
			];
			str = '<span style="' + style[count-1] + '">' + str + '</span>';
		}

		return str;
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
	 * Hide/show inventory's content
	 */
	function onToggleReduction()
	{
		var ui = VendingShop.ui;

		if (_realSize) {
			ui.querySelector('.panel').style.display = '';
			ui.style.height = _realSize + "px";
			_realSize = 0;
		}
		else {
			_realSize = ui.offsetHeight;
			ui.style.height = 17 + "px";
			ui.querySelector('.panel').style.display = 'none';
		}
	}


	/**
	 * Update tab, reset inventory content
	 */
	function requestFilter()
	{
		VendingShop.ui.querySelector('.container .content').innerHTML = '';

		var list = VendingShop.list;
		var i, count;

		for (i = 0, count = list.length; i < count; ++i) {
			VendingShop.addItemSub( list[i] );
		}
	}


	/**
	 * Drop an item from storage to inventory
	 *
	 * @param {event}
	 */
	function onDrop( event )
	{
		event.stopImmediatePropagation();
		return false;
	}


	/**
	 * Block the scroll to move 32px at each move
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

		this.scrollTop = Math.floor(this.scrollTop/32) * 32 - (delta * 32);
		event.stopImmediatePropagation();
		return false;
	}


	/**
	 * Show item name when mouse is over
	 */
	function onItemOver()
	{
		var idx  = parseInt( this.getAttribute('data-index'), 10);
		var item = VendingShop.getItemByIndex(idx);

		if (!item) {
			return;
		}

		// Get back data
		var pos     = DOM.getPosition(this);
		var overlay = VendingShop.ui.querySelector('.overlay');

		// Display box
		overlay.style.display = '';
		overlay.style.top = pos.top; overlay.style.left = pos.left+35;
		overlay.textContent = DB.getItemName(item) + ' ' + prettyZeny(item.price, false) + ' ' + DB.getMessage(2328);

		if (item.IsIdentified) {
			overlay.classList.remove('grey');
		}
		else if(_type === VendingShop.Type.VENDING_LIST) {
			overlay.classList.add('grey');
		}
	}


	/**
	 * Hide the item name
	 */
	function onItemOut()
	{
		VendingShop.ui.querySelector('.overlay').style.display = 'none';
	}


	/**
	 * Start dragging an item
	 */
	function onItemDragStart( event )
	{
		return;
	}


	/**
	 * Stop dragging an item
	 *
	 */
	function onItemDragEnd()
	{
		delete window._OBJ_DRAG_;
	}


	/**
	 * Get item info (open description window)
	 */
	function onItemInfo( event )
	{
		event.stopImmediatePropagation();

		var index = parseInt(this.getAttribute('data-index'), 10);
		var item  = VendingShop.getItemByIndex(index);

		if (!item) {
			return false;
		}

		// Don't add the same UI twice, remove it
		if (ItemInfo.uid === item.ITID) {
			ItemInfo.remove();
			return false;
		}

		// Add ui to window
		ItemInfo.append();
		ItemInfo.uid = item.ITID;
		ItemInfo.setItem(item);

		return false;
	}


	/**
	 * Ask to use an item
	 */
	function onItemUsed( event )
	{
		var index = parseInt(this.getAttribute('data-index'), 10);
		var item  = VendingShop.getItemByIndex(index);

		if (item) {
			VendingShop.useItem(item);
			onItemOut();
		}

		event.stopImmediatePropagation();
		return false;
	}

	/**
	 * Submit data to send items
	 */
	VendingShop.onSubmit = function onSubmit()
	{
		var pkt;
		if(_type === VendingShop.Type.VENDING_LIST) {
			pkt   = new PACKET.CZ.REQ_CLOSESTORE();
		} else {
			pkt   = new PACKET.CZ.REQ_CLOSE_BUYING_STORE();
		}
		Network.sendPacket(pkt);
		this.onRemove();
	};



	/**
	 * Create component and export it
	 */
	return UIManager.addComponent(VendingShop);
});
