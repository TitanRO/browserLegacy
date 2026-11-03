/**
 * UI/Components/InventoryV0/InventoryV0.js
 *
 * Chararacter Inventory
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
	var ItemType           = require('DB/Items/ItemType');
	var Client             = require('Core/Client');
	var Preferences        = require('Core/Preferences');
	var Renderer           = require('Renderer/Renderer');
	var Mouse              = require('Controls/MouseEventHandler');
	var UIManager          = require('UI/UIManager');
	var UIComponent        = require('UI/UIComponent');
	var CartItems          = require('UI/Components/CartItems/CartItems');
	var InputBox           = require('UI/Components/InputBox/InputBox');
	var ItemInfo           = require('UI/Components/ItemInfo/ItemInfo');
	var Equipment          = require('UI/Components/Equipment/Equipment');
	var Storage   	       = require('UI/Components/Storage/Storage');
	var UIVersionManager   = require('UI/UIVersionManager');
	var htmlText           = require('text!./InventoryV0.html');
	var cssText            = require('text!./InventoryV0.css');
	var getModule          = require;
	var DOM             = require('Utils/DOM');


	/**
	 * Create Component
	 */
	var InventoryV0 = new UIComponent( 'InventoryV0', htmlText, cssText );


	/**
	 * Tab constant
	 */
	InventoryV0.TAB = {
		USABLE: 0,
		EQUIP:  1,
		ETC:    2
	};


	/**
	 * Store inventory items
	 */
	InventoryV0.list = [];


	/**
	 * Store new items
	 */
	InventoryV0.newItems = [];
	InventoryV0.equippedItems = [];


	/**
	 * @var {number} used to remember the window height
	 */
	var _realSize = 0;


	/**
	 * @var {Preferences} structure
	 */
	var _preferences = Preferences.get('InventoryV0', {
		x:        0,
		y:        UIVersionManager.getInventoryVersion() > 0 ? 172 : 120,
		width:    7,
		height:   4,
		show:     false,
		reduce:   false,
		tab:      InventoryV0.TAB.USABLE,
		magnet_top: false,
		magnet_bottom: false,
		magnet_left: true,
		magnet_right: false
	}, 1.0);


	/**
	 * Initialize UI
	 */
	InventoryV0.init = function Init()
	{
		// Bind buttons
		this.ui.querySelector('.titlebar .base').addEventListener('mousedown', stopPropagation);
		this.ui.querySelector('.titlebar .mini').addEventListener('click', onToggleReduction);
		Array.from(this.ui.querySelectorAll('.tabs button')).forEach(function(btn){ btn.addEventListener('mousedown', onSwitchTab); });
		this.ui.querySelector('.footer .extend').addEventListener('mousedown', onResize);
		this.ui.querySelector('.titlebar .close').addEventListener('click', function(){
			InventoryV0.ui.style.display = 'none';
		});

		// on drop item
		this.ui.addEventListener('drop', onDrop);
		this.ui.addEventListener('dragover', stopPropagation);
		// Items event
		var _invContent = this.ui.querySelector('.container .content');
		_invContent.addEventListener('mousewheel', onScroll);
		_invContent.addEventListener('DOMMouseScroll', onScroll);
		DOM.addDelegatedEvent(_invContent, 'mouseover', '.item', onItemOver);
		DOM.addDelegatedEvent(_invContent, 'mouseout', '.item', onItemOut);
		DOM.addDelegatedEvent(_invContent, 'dragstart', '.item', onItemDragStart);
		DOM.addDelegatedEvent(_invContent, 'dragend', '.item', onItemDragEnd);
		DOM.addDelegatedEvent(_invContent, 'contextmenu', '.item', onItemInfo);
		DOM.addDelegatedEvent(_invContent, 'dblclick', '.item', onItemUsed);

		this.ui.querySelector('.ncnt').textContent = 0;
		this.ui.querySelector('.mcnt').textContent = 100;

		this.draggable(this.ui.querySelector('.titlebar'));
	};


	/**
	 * Apply preferences once append to body
	 */
	InventoryV0.onAppend = function OnAppend()
	{
		// Apply preferences
		if (!_preferences.show) {
			this.ui.style.display = 'none';
		}

		Client.loadFile( DB.INTERFACE_PATH + 'basic_interface/tab_itm_0'+ (_preferences.tab+1) +'.bmp', function(data){
			InventoryV0.ui.querySelector('.tabs').style.backgroundImage = 'url("' + data + '")';
		});

		this.resize( _preferences.width, _preferences.height );

		DOM.setCss(this.ui, {
			top:  Math.min( Math.max( 0, _preferences.y), Renderer.height - this.ui.offsetHeight),
			left: Math.min( Math.max( 0, _preferences.x), Renderer.width  - this.ui.offsetWidth)
		});

		this.magnet.TOP = _preferences.magnet_top;
		this.magnet.BOTTOM = _preferences.magnet_bottom;
		this.magnet.LEFT = _preferences.magnet_left;
		this.magnet.RIGHT = _preferences.magnet_right;

		_realSize = _preferences.reduce ? 0 : this.ui.offsetHeight;
		DOM.trigger(this.ui.querySelector('.titlebar .mini'), 'mousedown');
	};


	/**
	 * Remove Inventory from window (and so clean up items)
	 */
	InventoryV0.onRemove = function OnRemove()
	{
		this.ui.querySelector('.container .content').innerHTML = '';
		this.list.length = 0;
		InventoryV0.newItems.length = 0; // Clear the new items array
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
	InventoryV0.onShortCut = function onShurtCut( key )
	{
		switch (key.cmd) {
			case 'TOGGLE':
				DOM.toggleDisplay(this.ui);
				if (DOM.isVisible(this.ui)) {
					this.focus();
				}
				else {
					// Chrome bug
					// when clicking double clicking an a weapon to equip
					// the item disapear, if you don't move the mouse and
					// triggered ALT+E then, the window disapear and you
					// can't trigger the scene anymore
					this.ui.dispatchEvent(new CustomEvent('mouseleave'));
					this.clearNewItems(); // Clear new items
				}
				break;
		}

		var BasicInfo = getModule('UI/Components/BasicInfo/BasicInfo');
		var changeUI = BasicInfo.getUI().ui.querySelector('#item .btn_overlay');
		if (changeUI) { // Only applicable to BasicInfoV4 and BasicInfoV5
			changeUI.style.display = 'none';
		}
	};


	/**
	 * Show/Hide UI
	 */
	InventoryV0.toggle = function toggle() {
		DOM.toggleDisplay(this.ui);
		if (DOM.isVisible(this.ui)) {
			this.focus();
		} else {
			this.ui.dispatchEvent(new CustomEvent('mouseleave'));
			this.clearNewItems(); // Clear new items
		}

		var BasicInfo = getModule('UI/Components/BasicInfo/BasicInfo');
		var changeUI = BasicInfo.getUI().ui.querySelector('#item .btn_overlay');
		if (changeUI) { // Only applicable to BasicInfoV4 and BasicInfoV5
			changeUI.style.display = 'none';
		}
	};


	/**
	 * Clear newItems array
	 */
	InventoryV0.clearNewItems = function clearNewItems() {
	    this.newItems = [];
	    this.ui.querySelectorAll('.new_item').forEach(function(el) {
	    	el.style.backgroundImage = '';
	    });
	};


	/**
	 * Extend inventory window size
	 *
	 * @param {number} width
	 * @param {number} height
	 */
	InventoryV0.resize = function Resize( width, height )
	{
		width  = Math.min( Math.max(width,  6), 9);
		height = Math.min( Math.max(height, 2), 6);

		DOM.setCss(this.ui.querySelector('.container .content'), {
			width:  width  * 32 + 13, // 13 = scrollbar
			height: height * 32
		});

		DOM.setCss(this.ui, {
			width:  23 + 16 + 16 + width  * 32,
			height: 31 + 19      + height * 32
		});
	};


	/**
	 * Get item object
	 *
	 * @param {number} id
	 * @returns {Item}
	 */
	InventoryV0.getItemById = function GetItemById( id )
	{
		var i, count;
		var list = InventoryV0.list;

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
	InventoryV0.getItemByIndex = function getItemByIndex( index )
	{
		var i, count;
		var list = InventoryV0.list;

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
	InventoryV0.setItems = function SetItems(items)
	{
		var i, count;

		for (i = 0, count = items.length; i < count ; ++i) {
			var object= this.getItemByIndex(items[i].index);
			if(object){
				var item=this.removeItem(object.index,object.count);
			}
			if(this.addItemSub(items[i])){
				this.list.push(items[i]);
				this.ui.querySelector('.ncnt').textContent = this.list.length + Equipment.getUI().getNumber();
				this.onUpdateItem(items[i].ITID, items[i].count ? items[i].count : 1);
			}


		}

	};


	/**
	 * Insert Item to inventory
	 *
	 * @param {object} Item
	 */
	InventoryV0.addItem = function AddItem( item )
	{
		var object = this.getItemByIndex(item.index);

		// Check if the item was equipped
    	var equippedIndex = InventoryV0.equippedItems.indexOf(item.index);
    	if (equippedIndex !== -1) {
    	    // Remove from equipped tracker
    	    InventoryV0.equippedItems.splice(equippedIndex, 1);
    	} else {
    	    // Mark as new item
    	    InventoryV0.newItems.push(item.index);

			var BasicInfo = getModule('UI/Components/BasicInfo/BasicInfo');
			var changeUI = BasicInfo.getUI().ui.querySelector('#item .btn_overlay');
			if (changeUI) {	// Only applicable to BasicInfoV4 and BasicInfoV5
				changeUI.style.display = '';
			}
		}

		if (object) {
			// Handle NaN values (equips)
			if (isNaN(object.count)) {
				object.count = 1;
			}
			if (isNaN(item.count)) {
				item.count = 1;
			}
			object.count += item.count;
			this.ui.querySelector('.item[data-index="'+ item.index +'"] .count').textContent =  object.count ;
			this.onUpdateItem(object.ITID, object.count);
			// Replace the existing index in newItems to maintain it as new
			var indexPosition = InventoryV0.newItems.indexOf(item.index);
			if (indexPosition !== -1) {
				InventoryV0.newItems.splice(indexPosition, 1, item.index);
			} else {
				InventoryV0.newItems.push(item.index);
			}
			onAddNewItem();
			return;
		}

		object = Object.assign({}, item);
		if (this.addItemSub(object)) {
			this.list.push(object);
			this.ui.querySelector('.ncnt').textContent = this.list.length + Equipment.getUI().getNumber();
			this.onUpdateItem(object.ITID, object.count);
		}

		function onAddNewItem() {
			var tab;
			switch (item.type) {
				case ItemType.HEALING:
				case ItemType.USABLE:
				case ItemType.DELAYCONSUME:
				case ItemType.CASH:
					tab = InventoryV0.TAB.USABLE;
					break;

				case ItemType.WEAPON:
				case ItemType.ARMOR:
				case ItemType.PETEGG:
				case ItemType.PETARMOR:
				case ItemType.SHADOWGEAR:
					tab = InventoryV0.TAB.EQUIP;
					break;

				default:
				case ItemType.ETC:
				case ItemType.CARD:
				case ItemType.AMMO:
					tab = InventoryV0.TAB.ETC;
					break;
			}

			if (tab === _preferences.tab) {
				Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/new_item.bmp', function (data) {
        	        InventoryV0.ui.querySelector('.item[data-index="'+ item.index +'"] .new_item').style.backgroundImage = 'url(' + data + ')';
        	    });
			}
		}
	};


	/**
	 * Check if item index is in newItems list
	 *
	 * @param {number} index - Item index to check
	 * @returns {boolean} - True if item index is in newItems list, false otherwise
	 */
	InventoryV0.isNewItem = function isNewItem(index) {
	    return InventoryV0.newItems.includes(index);
	};


	/**
	 * Add item to inventory
	 *
	 * @param {object} Item
	 */
	InventoryV0.addItemSub = function AddItemSub( item )
	{
		var tab;
		switch (item.type) {
			case ItemType.HEALING:
			case ItemType.USABLE:
			case ItemType.DELAYCONSUME:
			case ItemType.CASH:
				tab = InventoryV0.TAB.USABLE;
				break;

			case ItemType.WEAPON:
			case ItemType.ARMOR:
			case ItemType.PETEGG:
			case ItemType.PETARMOR:
			case ItemType.SHADOWGEAR:
				tab = InventoryV0.TAB.EQUIP;
				break;

			default:
			case ItemType.ETC:
			case ItemType.CARD:
			case ItemType.AMMO:
				tab = InventoryV0.TAB.ETC;
				break;
		}

		// Equip item (if not arrow)
		if (item.WearState && item.type !== ItemType.AMMO && item.type !== ItemType.CARD) {
			Equipment.getUI().equip(item, item.WearState);
			return false;
		}

		if (tab === _preferences.tab) {
			var it      = DB.getItemInfo( item.ITID );
			var content = this.ui.querySelector('.container .content');

			content.insertAdjacentHTML('beforeend',
				'<div class="item" data-index="'+ item.index +'" draggable="true">' +
					'<div class="new_item"></div>' +
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

			if (InventoryV0.isNewItem(item.index)) {
				Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/new_item.bmp', function (data) {
            	    content.querySelector('.item[data-index="'+ item.index +'"] .new_item').style.backgroundImage = 'url(' + data + ')';
            	});
			} else {
				content.querySelector('.item[data-index="'+ item.index +'"] .new_item').style.backgroundImage = '';
			}
		}

		return true;
	};


	/**
	 * Remove item from inventory
	 *
	 * @param {number} index in inventory
	 * @param {number} count
	 */
	InventoryV0.removeItem = function RemoveItem( index, count )
	{
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
				this.onUpdateItem(item.ITID, item.count);
				return item;
			}
		}

		this.list.splice( this.list.indexOf(item), 1 );
		this.ui.querySelector('.item[data-index="'+ item.index +'"]').remove();
		this.ui.querySelector('.ncnt').textContent = this.list.length + Equipment.getUI().getNumber();
		this.onUpdateItem(item.ITID, 0);

		var content = this.ui.querySelector('.container .content');
		if (content.offsetHeight === content.scrollHeight) {
			this.ui.querySelector('.hide').style.display = '';
		}

		return item;
	};


	/**
	 * Remove item from inventory
	 *
	 * @param {number} index in inventory
	 * @param {number} count
	 */
	InventoryV0.updateItem = function UpdateItem( index, count )
	{
		var item = this.getItemByIndex(index);

		if (!item) {
			return;
		}

		item.count = count;

		// Update quantity
		if (item.count > 0) {
			this.ui.querySelector('.item[data-index="'+ item.index +'"] .count').textContent =  item.count ;
			this.onUpdateItem(item.ITID, item.count);
			return;
		}

		// no quantity, remove
		this.list.splice( this.list.indexOf(item), 1 );
		this.ui.querySelector('.item[data-index="'+ item.index +'"]').remove();
		this.ui.querySelector('.ncnt').textContent = this.list.length + Equipment.getUI().getNumber();
		this.onUpdateItem(item.ITID, 0);

		var content = this.ui.querySelector('.container .content');
		if (content.offsetHeight === content.scrollHeight) {
			this.ui.querySelector('.hide').style.display = '';
		}
	};


	/**
	 * Use an item
	 *
	 * @param {Item} item
	 */
	InventoryV0.useItem = function UseItem( item )
	{
		switch (item.type) {

			// Usable item
			case ItemType.HEALING:
			case ItemType.USABLE:
			case ItemType.CASH:
				InventoryV0.onUseItem( item.index );
				break;

			// Use card
			case ItemType.CARD:
				InventoryV0.onUseCard( item.index );
				break;

			case ItemType.DELAYCONSUME:
				break;

			// Equip item
			case ItemType.WEAPON:
			case ItemType.ARMOR:
			case ItemType.SHADOWGEAR:
			case ItemType.PETARMOR:
			case ItemType.AMMO:
				if (item.IsIdentified && !item.IsDamaged) {
					InventoryV0.onEquipItem( item.index, item.location );
				}
				break;
		}

		return;
	};


	/**
	 * Stop event propagation
	 */
	function stopPropagation( event )
	{
		event.stopImmediatePropagation();
		return false;
	};


	/**
	 * Extend inventory window size
	 */
	function onResize()
	{
		var ui      = InventoryV0.ui;
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

			InventoryV0.resize( w, h );
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
		var _onResizeEnd = function(event){
			if (event.which === 1) {
				clearInterval(_Interval);
				window.removeEventListener('mouseup', _onResizeEnd);
			}
		};
		window.addEventListener('mouseup', _onResizeEnd);
	};


	/**
	 * Modify tab, filter display entries
	 */
	function onSwitchTab()
	{
		var idx          = DOM.indexAmongSiblings(this);
		_preferences.tab = parseInt(idx, 10);

		Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/tab_itm_0'+ (idx+1) +'.bmp', function(data){
			InventoryV0.ui.querySelector('.tabs').style.backgroundImage = 'url(' + data + ')';
			requestFilter();
		});
	};


	/**
	 * Hide/show inventory's content
	 */
	function onToggleReduction()
	{
		var ui = InventoryV0.ui;

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
	};


	/**
	 * Update tab, reset inventory content
	 */
	function requestFilter()
	{
		InventoryV0.ui.querySelector('.container .content').innerHTML = '';

		var list = InventoryV0.list;
		var i, count;

		for (i = 0, count = list.length; i < count; ++i) {
			InventoryV0.addItemSub( list[i] );
		}
	};


	/**
	 * Drop an item from storage to inventory
	 *
	 * @param {event}
	 */
	function onDrop( event )
	{
		var item, data;
		event.stopImmediatePropagation();

		try {
			data = JSON.parse(event.dataTransfer.getData('Text'));
			item = data.data;
		}
		catch(e) {
			return false;
		}

		// Just allow item from storage
		if (data.type !== 'item' || (data.from !== 'Storage' && data.from !== 'CartItems' && data.from !== 'Mail' && data.from !== 'WriteRodex')) {
			return false;
		}

		// Have to specify how much
		if (item.count > 1)
		{
			InputBox.append();
			InputBox.setType('number', false, item.count);

			InputBox.onSubmitRequest = function OnSubmitRequest( count )
			{
				InputBox.remove();

					switch(data.from)
					{
					case 'Storage':
						getModule('UI/Components/Storage/Storage').reqRemoveItem(
							item.index,
							parseInt(count, 10 )
							);
						break;

					case 'CartItems':
						getModule('UI/Components/CartItems/CartItems').reqRemoveItem(
							item.index,
							parseInt(count, 10 )
							);
						break;

					case 'Mail':
						getModule('UI/Components/Mail/Mail').reqRemoveItem(
							item.index,
							parseInt(count, 10 )
							);
						break;

					case 'WriteRodex':
						getModule('UI/Components/Rodex/WriteRodex').requestRemoveItemRodex(
							item.index,
							parseInt(count, 10 )
							);
						break;

					}
			};
			return false;
		}

		switch(data.from)
		{
			case 'Storage':
				getModule('UI/Components/Storage/Storage').reqRemoveItem( item.index, 1 );
				break;

			case 'CartItems':
				getModule('UI/Components/CartItems/CartItems').reqRemoveItem( item.index, 1 );
				break;

			case 'Mail':
				getModule('UI/Components/Mail/Mail').reqRemoveItem( item.index, 1 );
				break;

			case 'WriteRodex':
				getModule('UI/Components/Rodex/WriteRodex').requestRemoveItemRodex( item.index, 1 );
				break;
		}

		return false;
	};


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
	};


	/**
	 * Show item name when mouse is over
	 */
	function onItemOver()
	{
		var idx  = parseInt( this.getAttribute('data-index'), 10);
		var item = InventoryV0.getItemByIndex(idx);

		if (!item) {
			return;
		}

		let quantity = ' ea';
		if (item.Options && (item.type === ItemType.WEAPON || item.type === ItemType.ARMOR || item.type === ItemType.SHADOWGEAR) &&
			item.Options.filter(Option => Option.index !== 0).length > 0)
		{
			quantity = ' Quantity';
		}

		// Get back data
		var pos     = DOM.getPosition(this);
		var overlay = InventoryV0.ui.querySelector('.overlay');

		// Display box
		overlay.style.display = '';
		DOM.setCss(overlay, {top: pos.top, left:pos.left+35});
		overlay.textContent = DB.getItemName(item) + ': ' + (item.count || 1) + quantity;

		if (item.IsIdentified) {
			overlay.classList.remove('grey');
		}
		else {
			overlay.classList.add('grey');
		}
	};


	/**
	 * Hide the item name
	 */
	function onItemOut()
	{
		InventoryV0.ui.querySelector('.overlay').style.display = 'none';
	};


	/**
	 * Start dragging an item
	 */
	function onItemDragStart( event )
	{
		var index = parseInt(this.getAttribute('data-index'), 10);
		var item  = InventoryV0.getItemByIndex(index);

		if (!item) {
			return;
		}

		// Set image to the drag drop element
		var img   = new Image();
		var url = this.querySelector('.icon').style.backgroundImage.match(/\((.*?)\)/)[1].replace(/('|")/g,'');
		img.src   = url.replace(/^\"/, '').replace(/\"$/, '');

		event.dataTransfer.setDragImage( img, 12, 12 );
		event.dataTransfer.setData('Text',
			JSON.stringify( window._OBJ_DRAG_ = {
				type: 'item',
				from: 'Inventory',
				data:  item
			})
		);

		onItemOut();
	};


	/**
	 * Stop dragging an item
	 *
	 */
	function onItemDragEnd()
	{
		delete window._OBJ_DRAG_;
	};


	/**
	 * Get item info (open description window)
	 */
	function onItemInfo( event )
	{
		event.stopImmediatePropagation();

		var index = parseInt(this.getAttribute('data-index'), 10);
		var item  = InventoryV0.getItemByIndex(index);

		if (!item) {
			return false;
		}

		// If right click w/ alt (Request Transfer Item)
		if (event.altKey && event.which === 3) {
			event.stopImmediatePropagation();
			transferItemToOtherUI(item);
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
	};


	/**
	 * Alt Right Click Request Transfer
	 */
	function transferItemToOtherUI(item)
	{
		var isStorageOpen = Storage.ui ? DOM.isVisible(Storage.ui) : false;
		var isCartOpen = CartItems.ui ? DOM.isVisible(CartItems.ui) : false;

		if (!item) {
			return false;
		}

		var count = item.count || 1;

		if (isStorageOpen) {
			Storage.reqAddItem(item.index, count);
		} else if (isCartOpen) {
			InventoryV0.reqMoveItemToCart(item.index, count);
		}

		return true;
	};


	/**
	 * Ask to use an item
	 */
	function onItemUsed( event )
	{
		var index = parseInt(this.getAttribute('data-index'), 10);
		var item  = InventoryV0.getItemByIndex(index);

		if (item) {
			InventoryV0.useItem(item);
			onItemOut();
		}

		event.stopImmediatePropagation();
		return false;
	};


	/**
	 * functions to define
	 */
	InventoryV0.onUseItem    = function OnUseItem(/* index */){};
	InventoryV0.onUseCard    = function onUseCard(/* index */){};
	InventoryV0.onEquipItem  = function OnEquipItem(/* index, location */){};
	InventoryV0.onUpdateItem = function OnUpdateItem(/* index, amount */){};
	InventoryV0.reqMoveItemToCart = function reqMoveItemToCart(/* index, amount */){};


	/**
	 * Create component and export it
	 */
	return UIManager.addComponent(InventoryV0);
});
