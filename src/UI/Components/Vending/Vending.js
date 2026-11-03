/**
 * UI/Components/Vending/Vending.js
 *
 * Chararacter Basic information windows
 *
 *
 * @author Vincent Thibault
 */
define(function(require)
{
	'use strict';


	/**
	 * Dependencies
	 */
	var DB           = require('DB/DBManager');
	var Network          = require('Network/NetworkManager');
	var PACKET           = require('Network/PacketStructure');	
	var ItemType     = require('DB/Items/ItemType');
	var Client       = require('Core/Client');
	var Preferences  = require('Core/Preferences');
	var Session      = require('Engine/SessionStorage');
	var Mouse        = require('Controls/MouseEventHandler');
	var KEYS         = require('Controls/KeyEventHandler');
	var UIManager    = require('UI/UIManager');
	var UIComponent  = require('UI/UIComponent');
	var ItemInfo     = require('UI/Components/ItemInfo/ItemInfo');
	var InputBox     = require('UI/Components/InputBox/InputBox');
	var ChatBox      = require('UI/Components/ChatBox/ChatBox');
	var CartItems    = require('UI/Components/CartItems/CartItems');
	var VendingModelMessage = require('UI/Components/Vending/VendingModelMessage/VendingModelMessage');
	var htmlText     = require('text!./Vending.html');
	var cssText      = require('text!./Vending.css');
	var Renderer     = require('Renderer/Renderer');
	var Inventory    = require('UI/Components/Inventory/Inventory');
	var BasicInfo    = require('UI/Components/BasicInfo/BasicInfo');
	var DOM          = require('Utils/DOM');


	/**
	 * Create NPC Menu component
	 */
	var Vending = new UIComponent( 'Vending', htmlText, cssText );



	/**
	 * Freeze the mouse
	 */
	//Vending.mouseMode = UIComponent.MouseMode.FREEZE;


	/**
	 * @var {enum} Store type
	 */
	Vending.Type = {
		VENDING_STORE: 0,
		BUYING_STORE: 1
	};

	/**
	 * @var {Preferences} 
	 */
	var _preferences = Preferences.get('Vending', {
		inputWindow: {
			x:    100,
			y:    100,
			height: 2
		},
		outputWindow: {
			x:    100 + 280 + 10,
			y:    100 + (7*32) - (2*32),
			height: 5
		},
		select_all: false
	}, 1.0);


	/**
	 * @var {Array} item list
	 */
	var _input = [];


	/**
	 * @var {Array} output list
	 */
	var _output = [];
	var _slots = 0;


	/**
	 * @var {number} type (buy/sell)
	 */
	var _type;
	
	var _shopname = '';
	
	function isItemStackable(item){
		if(
			item.type === ItemType.WEAPON ||
			item.type === ItemType.ARMOR  ||
			item.type === ItemType.SHADOWGEAR  ||
			item.type === ItemType.PETEGG ||
			item.type === ItemType.PETARMOR
		){
			return false;
		} else {
			return true;
		}
	};


	/**
	 * Initialize component
	 */
	Vending.init = function init()
	{
		var ui           = this.ui;
		var InputWindow  = ui.querySelector('.InputWindow');
		var OutputWindow = ui.querySelector('.OutputWindow');

		// Client do not send packet
		//ui.querySelector('.btn.cancel').addEventListener('click', this.remove.bind(this));
		ui.querySelector('.btn.sell').addEventListener('click', function(e){
			e.stopImmediatePropagation();
			Vending.onSubmit();
		});
		this.ui.querySelector('.btn.cancel').addEventListener('click', function(e){
			e.stopImmediatePropagation();
			var pkt;
			if(_type === Vending.Type.VENDING_STORE)
				pkt = new PACKET.CZ.REQ_OPENSTORE2();
			else
				pkt = new PACKET.CZ.REQ_OPEN_BUYING_STORE();
	
			submitNetworkPacket(pkt);
			Vending.onRemove();
		});
		
		InputWindow.querySelector('.footer .extend').addEventListener('mousedown', onResizeInput);


		// Items options
		var _vendingContent = ui.querySelector('.content');
		DOM.addDelegatedEvent(_vendingContent, 'contextmenu', '.icon', onItemInfo);
		_vendingContent.addEventListener('mousewheel', onScroll);
		_vendingContent.addEventListener('DOMMouseScroll', onScroll);
		DOM.addDelegatedEvent(_vendingContent, 'mouseover', '.item', onItemOver);
		DOM.addDelegatedEvent(_vendingContent, 'mouseout', '.item', onItemOut);
		DOM.addDelegatedEvent(_vendingContent, 'dblclick', '.item', onItemSelected);
		DOM.addDelegatedEvent(_vendingContent, 'mousedown', '.item', onItemFocus);
		DOM.addDelegatedEvent(_vendingContent, 'dragstart', '.item', onDragStart);
		DOM.addDelegatedEvent(_vendingContent, 'dragend', '.item', function(){
			delete window._OBJ_DRAG_;
		});

		// Drop items
		var _vendingInputOutput = ui.querySelector('.InputWindow');
		var _vendingOutputWindow = ui.querySelector('.OutputWindow');
		function onVendingDropDragover(event) { event.stopImmediatePropagation(); return false; }
		function onVendingFocus() { Vending.focus(); }
		if (_vendingInputOutput) {
			_vendingInputOutput.addEventListener('drop', onDrop);
			_vendingInputOutput.addEventListener('dragover', onVendingDropDragover);
			_vendingInputOutput.addEventListener('mousedown', onVendingFocus);
		}
		if (_vendingOutputWindow) {
			_vendingOutputWindow.addEventListener('drop', onDrop);
			_vendingOutputWindow.addEventListener('dragover', onVendingDropDragover);
			_vendingOutputWindow.addEventListener('mousedown', onVendingFocus);
		}

		
		

		// Hacky drag drop
		this.draggable.call({ui: InputWindow },  InputWindow.querySelector('.titlebar'));
		this.draggable.call({ui: OutputWindow }, OutputWindow.querySelector('.titlebar'));

		Client.loadFile( DB.INTERFACE_PATH + 'basic_interface/itemwin_mid.bmp', function(data){
			Vending.itemBg = data;
		});
	};


	/**
	 * Player should not be able to move when the store is opened
	 */
	Vending.onAppend = function onAppend()
	{
		var InputWindow  = this.ui.querySelector('.InputWindow');
		var OutputWindow = this.ui.querySelector('.OutputWindow');
		
		DOM.setCss(InputWindow, {
			top:  Math.min( Math.max( 0, _preferences.inputWindow.y), Renderer.height - InputWindow.querySelector('.content').offsetHeight) + 'px',
			left: Math.min( Math.max( 0, _preferences.inputWindow.x), Renderer.width  - InputWindow.querySelector('.content').offsetWidth) + 'px'
		});
		DOM.setCss(OutputWindow, {
			top:  Math.min( Math.max( 0, _preferences.outputWindow.y), Renderer.height - OutputWindow.querySelector('.content').offsetHeight) + 'px',
			left: Math.min( Math.max( 0, _preferences.outputWindow.x), Renderer.width  - OutputWindow.querySelector('.content').offsetWidth) + 'px'
		});

		resize( InputWindow.querySelector('.content'),  _preferences.inputWindow.height );
		resize( OutputWindow.querySelector('.content'), _preferences.outputWindow.height );

		// Seems like "EscapeWindow" is execute first, push it before.
		//var events = jQuery._data( window, 'events').keydown;
		//events.unshift( events.pop() );		
		
		this.ui.style.display = 'none';
	};

	/**
	 * Specify the type of the shop
	 *
	 * @param {number} type (see NpcStore.Type.*)
	 */
	Vending.setType = function setType(type)
	{
		switch (type) {
			case Vending.Type.VENDING_STORE:
				this.ui.querySelector('.WinBuy').style.display = 'none';
				this.ui.querySelector('.WinSell').style.display = '';
				break;

			case Vending.Type.BUYING_STORE:
				this.ui.querySelector('.WinSell').style.display = 'none';
				this.ui.querySelector('.WinBuy').style.display = '';
				//this.ui.querySelector('.content').style.height = '160px';
				this.ui.querySelector('.zenySpan').textContent = prettyZeny(Session.zeny);
				this.ui.querySelector('.weightSpan').textContent = BasicInfo.getUI().weight + '/' + BasicInfo.getUI().weight_max;
				this.ui.querySelector('.limitZeny').value = '0';
				break;
		}

		_type = type;
	};

	/**
	 * Resize the content
	 *
	 * @param {jQueryElement} content
	 * @param {number} height
	 */
	function resize( content, height )
	{
		height = Math.min( Math.max(height, 2), 9);
		content.style.height = height * 32;
	}	


	/**
	 * Released movement and save preferences
	 */
	Vending.onRemove = function onRemove()
	{
		VendingModelMessage.onRemove();//remove message if show

		var InputWindow  = this.ui.querySelector('.InputWindow');
		var OutputWindow = this.ui.querySelector('.OutputWindow');

		_input.length    = 0;
		_output.length   = 0;

		_preferences.inputWindow.x       = parseInt( InputWindow.style.left, 10) || 0;
		_preferences.inputWindow.y       = parseInt( InputWindow.style.top, 10) || 0;
		_preferences.inputWindow.height  = InputWindow.querySelector('.content').offsetHeight / 32 | 0;

		_preferences.outputWindow.x      = parseInt( OutputWindow.style.left, 10) || 0;
		_preferences.outputWindow.y      = parseInt( OutputWindow.style.top, 10) || 0;
		_preferences.outputWindow.height = OutputWindow.querySelector('.content').offsetHeight / 32 | 0;

		_preferences.save();

		this.ui.querySelector('.content').innerHTML = '';
		
		this.ui.style.display = 'none';		
	};


	/**
	 * Key Listener
	 *
	 * Remove the UI when Escape key is pressed
	 */
	Vending.onKeyDown = function onKeyDown( event )
	{
		if (event.which === KEYS.ESCAPE) {
			this.remove();
			event.stopImmediatePropagation();
			return false;
		}

		return true;
	};
	
	

	/**
	 * Add items to list
	 *
	 * @param {Array} item list
	 */
	Vending.setList = function setList( items )
	{
		var i, count;
		var it, item, out, content;

		this.ui.querySelector('.content').innerHTML = '';

		_input.length  = 0;
		_output.length = 0;
		
		
		content        = this.ui.querySelector('.InputWindow .content');

		{		
				for (i = 0, count = items.length; i < count; ++i) {
					

					if (!('index' in items[i])) {
						items[i].index = i;
					}
					
					if(isItemStackable(items[i])){
						items[i].IsStackable = true;
					} else {
						items[i].IsStackable = false;
					}
					
					if(!(items[i].hasOwnProperty('count'))){
						items[i].count = 1;
					}

					items[i].total = items[i].count; // keep track on buying store

					out                   = Object.assign({}, items[i]);
					out.count             = 0;

					addItem( content, items[i], true);

					_input[items[i].index]  = items[i];
					_output[items[i].index] = out;
				}
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
	 * Add item to the list
	 *
	 * @param {jQuery} content element
	 * @param {Item} item info
	 */
	function addItem( content, item , isinput)
	{
		var it      = DB.getItemInfo(item.ITID);
		var element = content.querySelector('.item[data-index="'+ item.index +'"]');
		var price;
		var textPrice = DB.getMessage(1721);

		// 0 as amount ? remove it
		if (item.count === 0) {
			if (element) {
				var parent = element.closest('.item-container');
				element.parentNode && element.parentNode.removeChild(element);
				if (parent) { parent.parentNode && parent.parentNode.removeChild(parent); }
			}
			return;
		}

		// Already here, update it
		// Note: just the amount can be updated ?
		if (element) {
			element.querySelector('.amount').textContent = item.IsStackable ? item.count : '';
			return;
		}

		if(isinput==false){
			price = prettyZeny(item.price, true);
		}

		var itemObj;
		var _tmp = document.createElement('div');

		// Create it
		if(isinput == true)
		{
			_tmp.innerHTML = '<div class="item input" draggable="true" data-index="'+ item.index +'">' +
					'<div class="icon"></div>' +
					'<div class="amount">' + (item.IsStackable ? item.count : '') + '</div>' +
				'</div>';
			itemObj = _tmp.firstChild;
		}
		else
		{
			_tmp.innerHTML = '<div class="item-container">' +
					'<div class="item output" draggable="true" data-index="'+ item.index +'">' +
					'<div class="icon"></div>' +
					'<div class="amount">' + (_type === Vending.Type.BUYING_STORE ? item.total : item.IsStackable ? item.count : '') + '</div>' +
					(_type === Vending.Type.BUYING_STORE ? '<div class="amount_">' + item.count + ' ea</div>' : '') +
					'<div class="name">'+ DOM.escapeHtml(DB.getItemName(item)) +'</div>' +
					'<div class="price">'+textPrice+' '+ price +'</div>' +
				'</div></div>';
			itemObj = _tmp.firstChild;
			if(_type === Vending.Type.BUYING_STORE) {
				let limit = parseInt(Vending.ui.querySelector('.limitZeny').value,10);
				limit += item.count * item.price;
				Vending.ui.querySelector('.limitZeny').value = limit;
			}
		}

		if(item.IsDamaged){
			itemObj.style.backgroundImage = 'url("' + Vending.itemBg + '")';
			itemObj.classList.add('damaged');
		}

		content.appendChild(itemObj);

		// Add the icon once loaded
		Client.loadFile( DB.INTERFACE_PATH + 'item/' + (item.IsIdentified ? it.identifiedResourceName : it.unidentifiedResourceName) + '.bmp', function(data){
			content.querySelector('.item[data-index="'+ item.index +'"] .icon').style.backgroundImage = 'url('+ data +')';
		});
	}


	/**
	 * Transfer item from input to output (or the inverse)
	 *
	 * @param {jQueryElement} from content (input / output)
	 * @param {jQueryElement} to content (input / output)
	 * @param {boolean} is adding the content to the output element
	 * @param {number} item index
	 * @param {number} amount
	 */
	var transferItem = function transferItemQuantityClosure()
	{
		var tmpItem = {};

		return function transferItem(fromContent, toContent, isAdding, index, count)
		{
			// Add item to the list
			if (isAdding) {
				
				if(!_input[index].IsIdentified){
					VendingModelMessage.setInit(603);
					return;
				}

				_output[index].count = (_type === Vending.Type.BUYING_STORE) ? count : Math.min( _output[index].count + count, _input[index].count);
				tmpItem = Object.assign({}, _input[index]);

				// Update input ui item amount
				tmpItem.count = (_type === Vending.Type.BUYING_STORE) ? 0 : _input[index].count - _output[index].count;

				addItem( fromContent, tmpItem, true);
				addItem( toContent, _output[index], false);
			}

			// Remove item
			else {
				count = Math.min(count, _output[index].count);
				if (!count) {
					return;
				}

				_output[index].count = (_type === Vending.Type.BUYING_STORE) ? 0 : _output[index].count - count;

				// Update input ui item amount
				tmpItem = Object.assign({}, _input[index]);
				tmpItem.count = (_type === Vending.Type.BUYING_STORE) ? _input[index].total : _input[index].count + _output[index].count;

				addItem( fromContent, _output[index], false);
				addItem( toContent,   tmpItem, true);
			}

			//Vending.calculateCost();
		};
	}();


	/**
	 * Request move item from box to another
	 *
	 * @param {number} item index
	 * @param {jQueryElement} from the content
	 * @param {jQueryElement} to the content
	 * @param {boolean} add the content to the output box ?
	 */
	function requestMoveItem( index, fromContent, toContent, isAdding)
	{
		var item, count, item_price;

		item        = isAdding ? _input[index] : _output[index];

		if (isAdding) {
			// Don't add more than max Vending capacity
			if(!(countSlotsUsed() < _slots)){
				return false;
			}
			
			count = _input[index].count;
		}
		else {
			count = _output[index].count;
		}

		/*// Can't buy more than one same stackable item
		if ((_type === Vending.Type.BUY || _type === Vending.Type.VENDING_STORE) && !item.IsStackable && isAdding) {
			if (toContent.querySelector('.item[data-index="'+ item.index +'"]')) {
				return false;
			}
		}*/

		// Just one item amount
		if ((item.count === 1 || !item.IsStackable) && _type === Vending.Type.VENDING_STORE /* || (_type === Vending.Type.SELL && _preferences.select_all)*/) {
			
			if(isAdding)
			{
				// Have to specify an price
				InputBox.append();
				InputBox.setType('price', false, item_price);
				InputBox.onSubmitRequest = function(item_price) {
					InputBox.remove();
					_output[index].price = item_price;
					if(item_price > 0)
					{
						transferItem(fromContent, toContent, isAdding, index, item.count );
					}
				};
			}
			else
			{			
				transferItem(fromContent, toContent, isAdding, index, item.count);
			}
			return false;
		}

		// Have to specify an amount
		InputBox.append();
		InputBox.setType('number', false, count);
		InputBox.onSubmitRequest = function(count) {
			InputBox.remove();
			if (count > 0) {
				if(count >= 9999 && _type === Vending.Type.BUYING_STORE ) {
					VendingModelMessage.setInit(1742);
					return;
				}

				if(item.count + count > 9999 && _type === Vending.Type.BUYING_STORE ) {
					VendingModelMessage.setInit(1728);
					return;
				}

				if(isAdding)
				{
					// Have to specify an price
					InputBox.append();
					InputBox.setType('price', false, item_price);
					InputBox.onSubmitRequest = function(item_price) {
						InputBox.remove();
						_output[index].price = item_price;
						if(item_price > 0)
						{
							transferItem(fromContent, toContent, isAdding, index, count);
						}
					};
				}
				else
				{			
					transferItem(fromContent, toContent, isAdding, index, count);
				}
			}
		};
	}


	/**
	 * Drop an input in the InputWindow or OutputWindow
	 *
	 * @param {jQueryEvent} event
	 */
	function onDrop( event )
	{
		var data;

		event.stopImmediatePropagation();

		try {
			data  = JSON.parse(event.dataTransfer.getData('Text'));
		}
		catch(e) {
			return false;
		}

		// Just allow item from store
		if (data.type !== 'item' || data.from !== 'Vending' || data.container === this.className) {
			return false;
		}

		requestMoveItem(
			data.index,
			Vending.ui.querySelector('.' + data.container + ' .content'),
			this.querySelector('.content'),
			this.className === 'OutputWindow'
		);

		return false;
	}


	/**
	 * Get informations about an item
	 */
	function onItemInfo(event)
	{
		event.stopImmediatePropagation();
		
		var index = parseInt( this.parentNode.getAttribute('data-index'), 10);
		var item  = _input[index];


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
	 * Select an item, put it on the other box
	 */
	function onItemSelected()
	{
		var input, from, to;

		if (_type === Vending.Type.BUY || _type === Vending.Type.VENDING_STORE) {
			return;
		}

		input = Vending.ui.querySelector('.InputWindow');

		if (input.contains(this)) {
			from = input;
			to   = Vending.ui.querySelector('.OutputWindow');
		}
		else {
			from = Vending.ui.querySelector('.OutputWindow');
			to   = input;
		}

		requestMoveItem(
			parseInt( this.getAttribute('data-index'), 10),
			from.querySelector('.content'),
			to.querySelector('.content'),
			from === input
		);
	}


	/**
	 * Focus an item
	 */
	function onItemFocus()
	{
		Vending.ui.querySelectorAll('.item.selected').forEach(function(el) { el.classList.remove('selected'); });
		this.classList.add('selected');
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
	 * Start dragging an item
	 */
	function onDragStart( event )
	{
		var container, img, url;
		var InputWindow, OutputWindow;

		InputWindow  = Vending.ui.querySelector('.InputWindow');
		OutputWindow = Vending.ui.querySelector('.OutputWindow');

		container = (InputWindow.contains(this) ? InputWindow : OutputWindow).className;
		img       = new Image();
		url       = this.firstChild.style.backgroundImage.match(/\(([^\)]+)/)[1].replace(/"/g, '');
		img.src   = url;

		event.dataTransfer.setDragImage( img, 12, 12 );
		event.dataTransfer.setData('Text',
			JSON.stringify( window._OBJ_DRAG_ = {
				type:      'item',
				from:      'Vending',
				container: container,
				index:     this.getAttribute('data-index')
			})
		);
	}
	
	/**
	 * Extend InputWindow size
	 */
	function onResizeInput()
	{
		var InputWindow  = Vending.ui.querySelector('.InputWindow');
		var content = InputWindow.querySelector('.container .content');
		var top     = parseInt(InputWindow.style.top, 10) || 0;
		var left    = parseInt(InputWindow.style.left, 10) || 0;
		var lastHeight = 0;
		var _Interval;

		function resizing()
		{
			var extraY = 31 + 19 - 30;

			var h = Math.floor( (Mouse.screen.y - top  - extraY) / 32 );

			// Maximum and minimum window size
			h = Math.min( Math.max(h, 2), 6);

			if (h === lastHeight) {
				return;
			}

			resize( content, h );
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

	Vending.onVendingSkill = function onVendingSkill(pkt)
	{
		_slots = pkt.itemcount;
		this.setList(CartItems.list);
		this.ui.querySelector('.add_shop').style.height = (32 * _slots) + 'px';
		this.ui.querySelector('.shopname').value = '';
		this.ui.style.display = '';
	};

	
	Vending.onBuyingSkill = function onBuyingSkill(pkt)
	{
		_slots = pkt.itemcount; 
		// get from inventory and compare with buyingstoreitemlist.txt
		//Inventory.list
		let buyable = new Array();
		for(let key in Inventory.getUI().list) {
			let item = Inventory.getUI().list[key];
			if(isItemStackable(item) && DB.isBuyable(item.ITID))
				buyable.push(item);
		}
		this.setList(buyable);
		this.ui.querySelector('.add_shop').style.height = (32 * _slots) + 'px';
		this.ui.querySelector('.shopname').value = '';
		this.ui.style.display = '';
	};

	Vending.onSubmit = function onSubmit()
	{
		
		var output;
		var i, count,shopname,limitZeny,ctr = 0;

		output = [];
		count  = _output.length;
		
		shopname = this.ui.querySelector('.shopname').value;
		

		for (i = 0; i < count; ++i) {
			if (_output[i] && _output[i].count) {
				output.push(_output[i]);
				ctr++;
			}
		}

		if(ctr < 1)
		{
			VendingModelMessage.setInit(2494);
			return;
		}
	
        var pkt;
		if(_type === Vending.Type.VENDING_STORE) {
			pkt = new PACKET.CZ.REQ_OPENSTORE2();
		}
		else {
			pkt = new PACKET.CZ.REQ_OPEN_BUYING_STORE();
			limitZeny = parseInt(this.ui.querySelector('.limitZeny').value, 10);
			if(limitZeny > Session.zeny) {
				VendingModelMessage.setInit(3683);
				return;
			}
			if(limitZeny <= 0) {
				VendingModelMessage.setInit(1730);
				return;
			}
			pkt.LimitZeny = limitZeny;
		}

		pkt.storeName = shopname;
		pkt.result = 1;
		pkt.storeList = output;
		
		if(!shopname)
		{
			VendingModelMessage.setInit(225);
			return;
		}
		else
		{
			this._shopname = shopname;
			submitNetworkPacket(pkt);
		}	
		
		this.onRemove();
		 
	};
	
	function countSlotsUsed(){
		var count = 0;
		_output.forEach((item) => {
			if(item.count > 0) { count++; }
		});
		return count;
	}


	function submitNetworkPacket(pkt)
	{
		Network.sendPacket(pkt);
	}

	/**
	 * Show item name when mouse is over
	 */
	function onItemOver()
	{
		if(!(this.classList.contains('input'))) return;

		var idx  = parseInt( this.getAttribute('data-index'), 10);
		var item = _type == Vending.Type.VENDING_STORE ? CartItems.getItemByIndex(idx) : Inventory.getUI().getItemByIndex(idx);

		if (!item) {
			return;
		}

		// Get back data
		var rect    = this.getBoundingClientRect();
		var uiRect  = Vending.ui.getBoundingClientRect();
		var overlay = Vending.ui.querySelector('.overlay');

		// Display box
		overlay.style.display = '';
		DOM.setCss(overlay, {top: (rect.top - uiRect.top - 20) + 'px', left: (rect.left - uiRect.left - 10) + 'px'});
		overlay.textContent = DB.getItemName(item) + ' ' + (item.count || 1) + ' ea';
	}


	/**
	 * Hide the item name
	 */
	function onItemOut()
	{
		Vending.ui.querySelector('.overlay').style.display = 'none';
	}


	/**
	 * Create componentand export it
	 */
	return UIManager.addComponent(Vending);
});
