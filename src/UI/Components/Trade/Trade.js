/**
 * UI/Components/Trade/Trade.js
 *
 * Manage Trade UI
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */
define(function(require)
{
	'use strict';


	/**
	 * Dependencies
	 */
	var DB           = require('DB/DBManager');
	var Client       = require('Core/Client');
	var Session      = require('Engine/SessionStorage');
	var Renderer     = require('Renderer/Renderer');
	var UIManager    = require('UI/UIManager');
	var UIComponent  = require('UI/UIComponent');
	var InputBox     = require('UI/Components/InputBox/InputBox');
	var ItemInfo     = require('UI/Components/ItemInfo/ItemInfo');
	var Inventory    = require('UI/Components/Inventory/Inventory');
	var ChatBox      = require('UI/Components/ChatBox/ChatBox');
	var htmlText     = require('text!./Trade.html');
	var cssText      = require('text!./Trade.css');
	var DOM             = require('Utils/DOM');


	/**
	 * Create Component
	 */
	var Trade = new UIComponent( 'Trade', htmlText, cssText);


	/**
	 * @var {Object} queue, item waiting from server an answer
	 */
	var _tmpCount = {};


	/**
	 * @var {Array} list of items to send
	 */
	var _send = [];


	/**
	 * @var {object} list of items to received
	 */
	var _recv = [];


	/**
	 * @var {string} trade title
	 */
	Trade.title = '';


	/**
	 * Initialize UI
	 */
	Trade.init = function Init()
	{
		// Bind buttons
		this.ui.querySelector('.ok.enabled').addEventListener('click', onConclude);
		this.ui.querySelector('.trade.enabled').addEventListener('click', onTrade.bind(this));
		this.ui.querySelector('.cancel').addEventListener('click', onCancel.bind(this));

		DOM.addDelegatedEvent(this.ui, 'mousedown', '.disabled', stopPropagation);
		this.ui.addEventListener('drop', onDrop);
		this.ui.addEventListener('dragover', stopPropagation);

		this.ui.querySelector('.zeny.send').addEventListener('mousedown', function(){
			this.select();
		});

		var _tradeBox = this.ui.querySelector('.box');
		DOM.addDelegatedEvent(_tradeBox, 'mouseover', '.item', onItemOver);
		DOM.addDelegatedEvent(_tradeBox, 'mouseout', '.item', onItemOut);
		DOM.addDelegatedEvent(_tradeBox, 'contextmenu', '.item', onItemInfo);

		this.draggable(this.ui.querySelector('.titlebar'));
	};


	/**
	 * Initialize UI
	 */
	Trade.onAppend = function onAppend()
	{
		// Clean up (interface)
		this.onRemove();
		this.ui.querySelector('.titlebar .title').textContent = this.title;

		DOM.setCss(this.ui, {
			top:  (Renderer.height - this.ui.offsetHeight) / 2,
			left: (Renderer.width  - this.ui.offsetWidth) / 2
		});
	};


	/**
	 * Clean UP UI
	 */
	Trade.onRemove = function onRemove()
	{
		_tmpCount    = {};
		_recv.length = 0;
		_send.length = 0;

		this.ui.querySelector('.overlay').style.display = 'none';
		this.ui.querySelector('.ok.disabled, .trade.enabled').style.display = 'none';
		this.ui.querySelector('.ok.enabled, .trade.disabled').style.display = '';
		this.ui.querySelector('.box').classList.remove('disabled').innerHTML = '';
		var zenySend = this.ui.querySelector('.zeny.send');
		zenySend.value = 0;
		zenySend.classList.remove('disabled');
		zenySend.removeAttribute('disabled');
		this.ui.querySelector('.zeny.recv').textContent = '0';
	};


	/**
	 * Add Item to the trade window from our inventory
	 *
	 * @param {number} item index in inventory
	 * @param {boolean} success ?
	 */
	Trade.addItemFromInventory = function addItemFromInventory(index, success)
	{
		// Reset value
		if (!success) {
			delete _tmpCount[index];
			return;
		}

		// ZENY
		if (index === 0) {
			this.ui.querySelector('.zeny.send').value = prettifyZeny(_tmpCount[index]);
			return;
		}

		var item    = Object.assign({}, Inventory.getUI().removeItem(index, _tmpCount[index]));
		var it      = DB.getItemInfo( item.ITID );
		var idx     = _send.push(item) - 1;
		var box     = this.ui.querySelector('.box.send');
		item.count  = _tmpCount[index];

		box.insertAdjacentHTML('beforeend',
			'<div class="item" data-index="'+ idx +'">' +
				'<div class="icon"></div>' +
				'<div class="amount"><span class="count">' + (_tmpCount[index] || 1) + '</span></div>' +
				'<span class="name">' + DOM.escapeHtml(DB.getItemName(item)) + '</span>' +
			'</div>'
		);

		Client.loadFile( DB.INTERFACE_PATH + 'item/' + ( item.IsIdentified ? it.identifiedResourceName : it.unidentifiedResourceName ) + '.bmp', function(data){
			box.querySelector('.item[data-index="'+ idx +'"] .icon').style.backgroundImage = 'url(' + data + ')';
		}.bind(this));
	};


	/**
	 * Add item to the trade UI
	 *
	 * @param {object} item
	 */
	Trade.addItem = function addItem(item)
	{
		// ZENY
		if (item.ITID === 0) {
			this.ui.querySelector('.zeny.recv').textContent = prettifyZeny(item.count);
			return;
		}

		var it  = DB.getItemInfo( item.ITID );
		var idx = _recv.push(item) - 1;
		var box = this.ui.querySelector('.box.recv');

		box.insertAdjacentHTML('beforeend',
			'<div class="item" data-index="'+ idx +'">' +
				'<div class="icon"></div>' +
				'<div class="amount">'+ item.count + '</div>' +
				'<span class="name">' + DOM.escapeHtml(DB.getItemName(item)) + '</span>' +
			'</div>'
		);

		Client.loadFile( DB.INTERFACE_PATH + 'item/' + ( item.IsIdentified ? it.identifiedResourceName : it.unidentifiedResourceName ) + '.bmp', function(data){
			box.querySelector('.item[data-index="'+ idx +'"] .icon').style.backgroundImage = 'url(' + data + ')';
		}.bind(this));
	};


	/**
	 * Prettify number (15000 -> 15,000)
	 *
	 * @param {number}
	 * @return {string}
	 */
	function prettifyZeny( value )
	{
		var num = String(value);
		var i = 0, len = num.length;
		var out = '';

		while (i < len) {
			out = num[len-i-1] + out;
			if ((i+1) % 3 === 0 && i+1 !== len) {
				out = ',' + out;
			}
			++i;
		}

		return out;
	}

	/**
	 * Request to add an item to the trade UI
	 *
	 * @param {number} item index in inventory
	 * @param {number} item count
	 */
	function onRequestAddItem( index, count )
	{
		// You cannot overlap items on a window
		if (index in _tmpCount) {
			ChatBox.addText( DB.getMessage(51), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
			return;
		}

		// You cannot trade more than 10 types of items per trade.
		if (_send.length >= 10) {
			ChatBox.addText( DB.getMessage(297), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
			return;
		}

		_tmpCount[index]  = count;
		Trade.reqAddItem( index, count);
	}


	/**
	 * Conclude a part of the trade
	 *
	 * @param {string} selector
	 */
	Trade.conclude = function conclude(element)
	{
		this.ui.querySelector('.box.' + element).classList.add('disabled');

		if (element === 'send') {
			this.ui.querySelector('.ok.disabled').style.display = '';
			this.ui.querySelector('.ok.enabled').style.display = 'none';
			this.ui.querySelector('.zeny.send').classList.add('disabled').setAttribute('disabled', true);
		}

		// Can conclude
		if (DOM.isVisible(this.ui.querySelector('.box.recv.disabled')) && DOM.isVisible(this.ui.querySelector('.box.send.disabled'))) {
			this.ui.querySelector('.trade.enabled').style.display = '';
			this.ui.querySelector('.trade.disabled').style.display = 'none';
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
	 * Cancel the deal
	 */
	function onCancel()
	{
		this.remove();
		Trade.onCancel();
	}


	/**
	 * Conclude our part
	 */
	function onConclude()
	{
		// Send zeny value before concluding
		var zeny = parseInt(Trade.ui.querySelector('.zeny.send').value, 10) || 0;
		zeny     = Math.min( Math.max(0, zeny), Session.zeny);

		onRequestAddItem( 0, zeny);
		Trade.onConclude();
	}


	/**
	 * Let's finish the trade
	 */
	function onTrade()
	{
		Trade.onTradeSubmit();
		this.ui.querySelector('.trade.enabled').style.display = 'none';
		this.ui.querySelector('.trade.disabled').style.display = '';
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
		if (!data || data.type !== 'item' || data.from !== 'Inventory') {
			return false;
		}

		item = data.data;

		// Have to specify how much
		if (item.count > 1) {
			InputBox.append();
			InputBox.setType('number', false, item.count);
			InputBox.onSubmitRequest = function OnSubmitRequest(count) {
				var value = parseInt(count, 10) || 0;
				value     = Math.min(Math.max( value, 0), item.count); // cap

				InputBox.remove();

				if (value) {
					onRequestAddItem(item.index, value);
				}
			};

			return false;
		}

		onRequestAddItem(item.index, 1);
		return false;
	}


	/**
	 * When mouse is over an item, show title
	 */
	function onItemOver()
	{
		var idx  = parseInt( this.getAttribute('data-index'), 10);
		var item = this.parentNode.className.match(/send/i) ? _send[idx] : _recv[idx];

		if (!item) {
			return;
		}

		var pos     = DOM.getPosition(this.parentNode);
		var overlay = Trade.ui.querySelector('.overlay');
		var selfPos = DOM.getPosition(this);

		pos.left += selfPos.left;
		pos.top  += selfPos.top;

		// Display box
		overlay.style.display = '';
		DOM.setCss(overlay, {top: pos.top+5, left:pos.left+30});
		overlay.textContent = DB.getItemName(item);

		if (item.IsIdentified) {
			overlay.classList.remove('grey');
		}
		else {
			overlay.classList.add('grey');
		}
	}


	/**
	 * Hide the item title when mouse is not over anymore
	 */
	function onItemOut()
	{
		Trade.ui.querySelector('.overlay').style.display = 'none';
	}


	/**
	 * Display ItemInfo UI
	 */
	function onItemInfo( event )
	{
		var idx  = parseInt( this.getAttribute('data-index'), 10);
		var item = this.parentNode.className.match(/send/i) ? _send[idx] : _recv[idx];

		if (!item) {
			return stopPropagation(event);
		}

		// Don't add the same UI twice, remove it
		if (ItemInfo.uid === item.ITID) {
			ItemInfo.remove();
		}

		// Add ui to window
		ItemInfo.append();
		ItemInfo.uid = item.ITID;
		ItemInfo.setItem(item);

		return stopPropagation(event);
	}


	/**
	 * Callbacks
	 */
	Trade.onConclude    = function onConclude(){};
	Trade.onTradeSubmit = function onTradeSubmit(){};
	Trade.reqAddItem    = function reqAddItem(){};
	Trade.onCancel      = function onCancel(){};


	/**
	 * Create component and export it
	 */
	return UIManager.addComponent(Trade);
});
