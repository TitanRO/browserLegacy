/**
 * UI/Components/Storage/Storage.js
 *
 * Account Storage
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
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
	var InputBox           = require('UI/Components/InputBox/InputBox');
	var ItemInfo           = require('UI/Components/ItemInfo/ItemInfo');
	var htmlText           = require('text!./Storage.html');
	var cssText            = require('text!./Storage.css');
	var getModule		   = require;
	var DOM             = require('Utils/DOM');


	/**
	 * Create Component
	 */
	var Storage = new UIComponent( 'Storage', htmlText, cssText );


	/**
	 * Tab constant
	 */
	Storage.TAB = {
		ITEM:   0,
		KAFRA:  1,
		ARMOR:  2,
		ARMS:   3,
		AMMO:   4,
		CARD:   5,
		ETC:    6
	};


	/**
	 * @var {Array} inventory items
	 */
	var _list = [];


	/**
	 * @var {Preference} structure to save
	 */
	var _preferences = Preferences.get('Storage', {
		x:      200,
		y:      500,
		height:   8,
		tab:      Storage.TAB.ITEM
	}, 1.0);


	/**
	 * Initialize UI
	 */
	Storage.init = function Init()
	{
		// Bind buttons
		this.ui.querySelector('.tabs button').addEventListener('mousedown', onSwitchTab);
		this.ui.querySelector('.footer .extend').addEventListener('mousedown', onResize);
		this.ui.querySelector('.footer .close').addEventListener('click', this.onClosePressed.bind(this));

		// Load tabs
		Client.loadFile( DB.INTERFACE_PATH + 'basic_interface/tab_itm_ex_0'+ (_preferences.tab+1) +'.bmp', function(data){
			Storage.ui.querySelector('.tabs').style.backgroundImage = 'url("' + data + '")';
		});

		// Resize, position
		resizeHeight(_preferences.height);
		DOM.setCss(this.ui, {
			top:  Math.min( Math.max( 0, _preferences.y), Renderer.height - this.ui.offsetHeight),
			left: Math.min( Math.max( 0, _preferences.x), Renderer.width  - this.ui.offsetWidth)
		});

		// drag, drop items
		this.ui.addEventListener('drop', onDrop);
		this.ui.addEventListener('dragover', stopPropagation);
		var _storageContent = this.ui.querySelector('.container .content');
		_storageContent.addEventListener('mousewheel', onScroll);
		_storageContent.addEventListener('DOMMouseScroll', onScroll);
		DOM.addDelegatedEvent(_storageContent, 'mouseover', '.item', onItemOver);
		DOM.addDelegatedEvent(_storageContent, 'mouseout', '.item', onItemOut);
		DOM.addDelegatedEvent(_storageContent, 'dragstart', '.item', onItemDragStart);
		DOM.addDelegatedEvent(_storageContent, 'dragend', '.item', onItemDragEnd);
		DOM.addDelegatedEvent(_storageContent, 'contextmenu', '.item', onItemInfo);

		this.draggable(this.ui.querySelector('.titlebar'));
	};


	/**
	 * Remove Storage from window (and so clean up items)
	 */
	Storage.onRemove = function onRemove()
	{
		this.ui.querySelector('.container .content').innerHTML = '';
		_list.length = 0;

		// Save preferences
		_preferences.y      =  parseInt(this.ui.style.top, 10);
		_preferences.x      =  parseInt(this.ui.style.left, 10);
		_preferences.height =  Math.floor( (this.ui.offsetHeight - (31 + 19 - 30)) / 32 );
		_preferences.save();
	};


	/**
	 * Add items to the list
	 *
	 * @param {Array} item list
	 */
	Storage.setItems = function setItems(items)
	{
		var i, count;

		for (i = 0, count = items.length; i < count ; ++i) {
			if (this.addItemSub( items[i])) {
				_list.push(items[i]);
			}
		}
	};


	/**
	 * Insert Item to Storage
	 *
	 * @param {object} Item
	 */
	Storage.addItem = function addItem( item )
	{
		var i = getItemIndexById(item.index);

		// Found, update quantity
		if (i > -1) {
			_list[i].count += item.count;
			this.ui.querySelector('.item[data-index="'+ item.index +'"] .count').textContent = _list[i].count;
			return;
		}

		if (this.addItemSub(item)) {
			_list.push(item);
		}
	};


	/**
	 * Add item to Storage
	 *
	 * @param {object} Item
	 */
	Storage.addItemSub = function addItemSub( item )
	{
		var tab;

		switch (item.type) {
			case ItemType.HEALING:
			case ItemType.USABLE:
			case ItemType.DELAYCONSUME:
				tab = Storage.TAB.ITEM;
				break;

			case ItemType.CASH:
				tab = Storage.TAB.KAFRA;
				break;

			case ItemType.ARMOR:
			case ItemType.SHADOWGEAR:
			case ItemType.PETEGG:
				tab = Storage.TAB.ARMOR;
				break;

			case ItemType.WEAPON:
			case ItemType.PETARMOR:
				tab = Storage.TAB.ARMS;
				break;

			case ItemType.AMMO:
				tab = Storage.TAB.AMMO;
				break;

			case ItemType.CARD:
				tab = Storage.TAB.CARD;
				break;

			default:
			case ItemType.ETC:
				tab = Storage.TAB.ETC;
				break;
		}

		if (tab === _preferences.tab) {
			var it   = DB.getItemInfo( item.ITID );

			this.ui.querySelector('.container .content').insertAdjacentHTML('beforeend',
				'<div class="item" data-index="' + item.index +'" draggable="true">' +
					'<div class="icon"></div>' +
					'<div class="amount">'+ (item.count ? '<span class="count">' + item.count + '</span>' + ' ' : '') + '</div>' +
					'<span class="name">' + DOM.escapeHtml(DB.getItemName(item)) + '</span>' +
				'</div>'
			);

			Client.loadFile( DB.INTERFACE_PATH + 'item/' + ( item.IsIdentified ? it.identifiedResourceName : it.unidentifiedResourceName ) + '.bmp', function(data){
				this.ui.querySelector('.item[data-index="'+ item.index +'"] .icon').style.backgroundImage = 'url('+ data +')';
			}.bind(this));
		}

		return true;
	};


	/**
	 * Remove item from Storage
	 *
	 * @param {number} index in Storage
	 */
	Storage.removeItem = function removeItem( index, count )
	{
		var i = getItemIndexById(index);
		var item;

		// Not found
		if (i < 0) {
			return null;
		}

		if (_list[i].count) {
			_list[i].count -= count;

			if (_list[i].count > 0) {
				this.ui.querySelector('.item[data-index="'+ index +'"] .count').textContent = _list[i].count;
				return _list[i];
			}
		}

		// Remove item
		item = _list[i];
		_list.splice( i, 1 );
		this.ui.querySelector('.item[data-index="'+ index +'"]').remove();

		return item;
	};


	/**
	 * Update or set the current amount of items in storage in ui
	 */
	Storage.setItemInfo = function setItemInfo( current, limit ) {
		this.ui.querySelector('.footer .current').textContent = current;
		this.ui.querySelector('.footer .limit').textContent = limit;
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
	 * Extend Storage window size
	 */
	function onResize()
	{
		var ui         = Storage.ui;
		var top = parseInt(ui.style.top, 10) || 0;
		var lastHeight = 0;
		var _Interval;

		function resizing()
		{
			var extraY = 31 + 19 - 30;
			var h = Math.floor( (Mouse.screen.y - top  - extraY) / 32 );

			// Maximum and minimum window size
			h = Math.min( Math.max(h, 8), 17);

			if (h === lastHeight) {
				return;
			}

			resizeHeight(h);
			lastHeight = h;
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
	}


	/**
	 * Extend Storage window size
	 */
	function resizeHeight(height)
	{
		height = Math.min( Math.max(height, 8), 17);

		Storage.ui.querySelector('.container .content').style.height = height * 32;
		Storage.ui.style.height = 31 + 19 + height * 32;
	}



	/**
	 * Modify tab, filter display entries
	 */
	function onSwitchTab()
	{
		var idx          = DOM.indexAmongSiblings(this);
		_preferences.tab = idx;

		Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/tab_itm_ex_0'+ (idx+1) +'.bmp', function(data){
			Storage.ui.querySelector('.tabs').style.backgroundImage = 'url("' + data + '")';
			requestFilter();
		});
	}


	/**
	 * Drop from inventory to storage
	 */
	function onDrop( event )
	{
		var item, data;

		try {
			data = JSON.parse(
				event.dataTransfer.getData('Text')
			);
		}
		catch(e) {}

		event.stopImmediatePropagation();

		// Just support items for now ?
		if (!data || data.type !== 'item' || (data.from !== 'Inventory' && data.from !== 'CartItems')) {
			return false;
		}

		item = data.data;

		// Have to specify how much
		if (item.count > 1) {
			InputBox.append();
			InputBox.setType('number', false, item.count);
			InputBox.onSubmitRequest = function OnSubmitRequest( count ) {
				InputBox.remove();

				if(data.from === 'CartItems')
				{
					Storage.reqAddItemFromCart(
						item.index,
						parseInt(count, 10 )
					);
				}
				else
				{
					Storage.reqAddItem(
						item.index,
						parseInt(count, 10 )
					);
				}
			};

			return false;
		}

		if(data.from === 'CartItems')
		{
			Storage.reqAddItemFromCart( item.index, 1 );
		}
		else
		{
			Storage.reqAddItem( item.index, 1 );
		}

		return false;
	}


	/**
	 * Change tab,
	 * Update its content
	 */
	function requestFilter()
	{
		Storage.ui.querySelector('.container .content').innerHTML = '';
		var i, count;

		for (i = 0, count = _list.length; i < count; ++i) {
			Storage.addItemSub(_list[i]);
		}
	}


	/**
	 * Get item index in list base on it's ID
	 *
	 * @param {number} item id
	 */
	function getItemIndexById( index )
	{
		var i, count;

		for (i = 0, count = _list.length; i < count; ++i) {
			if (_list[i].index === index) {
				return i;
			}
		}

		return -1;
	}


	/**
	 * Update scroll by block (32px)
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
		return false;
	}


	/**
	 * Mouse over item, display name and informations
	 */
	function onItemOver()
	{
		var idx = parseInt( this.getAttribute('data-index'), 10);
		var i   = getItemIndexById(idx);

		// Not found
		if (i < 0) {
			return;
		}

		// Get back data
		var item    = _list[i];
		var rect = this.getBoundingClientRect();
		var uiRect = Storage.ui.getBoundingClientRect();
		var overlay = Storage.ui.querySelector('.overlay');

		// Display box
		overlay.style.display = '';
		overlay.style.top = (pos.top - 10) + 'px';
		overlay.style.left = (pos.left + 35) + 'px';
		overlay.textContent = DB.getItemName(item) + ' ' + (item.count || 1) + ' ea';

		if (item.IsIdentified) {
			overlay.classList.remove('grey');
		}
		else {
			overlay.classList.add('grey');
		}
	}


	/**
	 * Mouse mouve out of an item, hide title description
	 */
	function onItemOut()
	{
		Storage.ui.querySelector('.overlay').style.display = 'none';
	}


	/**
	 * Start dragging an item
	 */
	function onItemDragStart( event )
	{
		var index   = parseInt(this.getAttribute('data-index'), 10);
		var i       = getItemIndexById(index);

		if (i === -1) {
			return;
		}

		// Set image to the drag drop element
		var img = new Image();
		var url = this.firstChild.style.backgroundImage.match(/\(([^\)]+)/)[1];
		url     = url = url.replace(/^\"/, '').replace(/\"$/, ''); // Firefox bug
		img.src = url;

		event.dataTransfer.setDragImage( img, 12, 12 );
		event.dataTransfer.setData('Text',
			JSON.stringify( window._OBJ_DRAG_ = {
				type: 'item',
				from: 'Storage',
				data: _list[i]
			})
		);

		onItemOut();
	}


	/**
	 * Stop the drag/drop on an item
	 */
	function onItemDragEnd()
	{
		delete window._OBJ_DRAG_;
	}


	/**
	 * Display item description
	 *
	 */
	function onItemInfo( event )
	{
		event.stopImmediatePropagation();

		var index   = parseInt(this.getAttribute('data-index'), 10);
		var i       = getItemIndexById(index);

		if (i === -1) {
			return false;
		}

		// If right click w/ alt (Request Transfer Item)
		if (event.altKey && event.which === 3) {
			event.stopImmediatePropagation();
			transferItemToOtherUI( _list[i] );
			return false;
		}

		// Don't add the same UI twice, remove it
		if (ItemInfo.uid === _list[i].ITID) {
			ItemInfo.remove();
		}

		// Add ui to window
		ItemInfo.append();
		ItemInfo.uid = _list[i].ITID;
		ItemInfo.setItem( _list[i] );

		return false;
	}


	/**
	 * Alt Right Click Request Transfer
	 */
	function transferItemToOtherUI(item)
	{
		var CartItems = getModule('UI/Components/CartItems/CartItems');
		var Inventory = getModule('UI/Components/Inventory/Inventory');
		var isInventoryOpen = Inventory.getUI().ui ? DOM.isVisible(Inventory.getUI().ui) : false;
		var isCartOpen = CartItems.ui ? DOM.isVisible(CartItems.ui) : false;

		if (!item) {
			return false;
		}

		var count = item.count || 1;

		if (isInventoryOpen) {
			Storage.reqRemoveItem(item.index, count);
		} else if (isCartOpen) {
			Storage.reqMoveItemToCart(item.index, count);
		}

		return true;
	};


	/**
	 * Callbacks
	 */
	Storage.onClosePressed  = function onClosedPressed(){};
	Storage.reqAddItem      = function reqAddItem(){};
	Storage.reqAddItemFromCart      = function reqAddItemFromCart(){};
	Storage.reqRemoveItem   = function reqRemoveItem(){};
	Storage.reqMoveItemToCart = function reqMoveItemToCart(){};

	/**
	 * Create component and export it
	 */
	return UIManager.addComponent(Storage);
});
