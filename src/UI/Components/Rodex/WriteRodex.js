/**
 * UI/Components/Rodex/WriteRodex.js
 *
 * Chararacter WriteRodex
 *
 * @author Alisonrag
 *
 */
define(function (require) {
	'use strict';


	/**
	 * Dependencies
	 */
	var DB = require('DB/DBManager');
	var ChatBox = require('UI/Components/ChatBox/ChatBox');
	var Session = require('Engine/SessionStorage');
	var MonsterTable = require('DB/Monsters/MonsterTable');
	var Preferences = require('Core/Preferences');
	var Renderer = require('Renderer/Renderer');
	var ItemInfo = require('UI/Components/ItemInfo/ItemInfo');
	var Client = require('Core/Client');
	var UIManager = require('UI/UIManager');
	var UIComponent = require('UI/UIComponent');
	var htmlText = require('text!./WriteRodex.html');
	var cssText = require('text!./WriteRodex.css');
	var InputBox = require('UI/Components/InputBox/InputBox');
	var getModule = require;
	var DOM = require('Utils/DOM');

	/**
	 * Create Component
	 */
	var WriteRodex = new UIComponent('WriteRodex', htmlText, cssText);
	WriteRodex.list = [];
	WriteRodex.receiver = null;
	WriteRodex.tax = 0;


	/**
	 * @var {Preferences} structure
	 */
	var _preferences = Preferences.get('WriteRodex', {
		show: false,
	}, 1.0);

	/**
	 * Initialize Component
	 */
	WriteRodex.onAppend = function onAppend() {
		// Bind buttons
		WriteRodex.ui.querySelector('.right .close').addEventListener('click', onClickClose);
		WriteRodex.ui.querySelector('.send').addEventListener('click', onClickSend);
		WriteRodex.ui.querySelector('.value').addEventListener('input', WriteRodex.updateTax);

		DOM.setCss(WriteRodex.ui, {
			top: Math.min(Math.max(0, parseInt(getModule('UI/Components/Rodex/Rodex').ui.style.top, 10) || 0) - 20, Renderer.height - WriteRodex.ui.offsetHeight),
			left: Math.min(Math.max(0, parseInt(getModule('UI/Components/Rodex/Rodex').ui.style.left, 10) || 0) + 330, Renderer.width - WriteRodex.ui.offsetWidth)
		});

		WriteRodex.draggable(WriteRodex.ui.querySelector('.titlebar'));

		WriteRodex.ui.querySelector('.items .item-list')

	};


	WriteRodex.initData = function initData(pkt) {
		WriteRodex.receiver = null;
		WriteRodex.CharID = 0;
		WriteRodex.list = [];
		WriteRodex.tax = 0;
		WriteRodex.ui.querySelector('.name').type = "text";
		WriteRodex.ui.querySelector('.name').value = pkt.receiveName;
		WriteRodex.ui.querySelector('.validate-name').style.display = '';
		WriteRodex.ui.querySelector('.baloon').style.display = 'none';
		WriteRodex.ui.querySelector('.title-text').value = DB.getMessage(3575);
		WriteRodex.ui.querySelector('.content-text').value = '';
		WriteRodex.ui.querySelector('.character-zeny').innerHTML = prettifyZeny(Session.zeny) + ' Zeny';
		WriteRodex.ui.querySelector('.validate-name').addEventListener('click', onClickValidateName);
		WriteRodex.ui.querySelector('.weigth-text').innerHTML = '0  2000';
		WriteRodex.ui.querySelector('.tax-text').innerHTML = '0';
		var _valueEl = WriteRodex.ui.querySelector('.value');
		_valueEl.value = '';
		_valueEl.setAttribute('max', Session.zeny);
		WriteRodex.ui.querySelector('.item-list').innerHTML = '';
		var _rodexItems = WriteRodex.ui.querySelector('.items');
		_rodexItems.addEventListener('drop', onDrop);
		_rodexItems.addEventListener('dragover', stopPropagation);
		WriteRodex.ui.style.display = '';
		WriteRodex.ui.focus();

	}

	WriteRodex.characterInfo = function characterInfo(pkt) {
		let text = 'Lv' + pkt.level + '<br>' + MonsterTable[pkt.Job] + '<br>' + pkt.CharID;
		WriteRodex.ui.querySelector('.validate-name').style.display = 'none';
		WriteRodex.ui.querySelector('.baloon').innerHTML = text.style.display = '';
		WriteRodex.ui.querySelector('.name').type = "none";
		WriteRodex.receiver = (pkt.name !== undefined) ? pkt.name : WriteRodex.ui.querySelector('.name').value;
		WriteRodex.CharID = pkt.CharID;
	}

	function onClickClose(e) {
		e.stopImmediatePropagation();
		WriteRodex.receiver = null;
		WriteRodex.ui.querySelector('.name').value = '';
		WriteRodex.ui.querySelector('.title-text').value = '';
		WriteRodex.ui.querySelector('.content-text').value = '';
		WriteRodex.ui.querySelector('.value').value = '';
		WriteRodex.ui.querySelector('.item-list').innerHTML = '';
		WriteRodex.ui.querySelector('.weigth-text').innerHTML = '0  2000';
		WriteRodex.ui.querySelector('.tax-text').innerHTML = '0';
		WriteRodex.ui.querySelector('.number').value = '';
		WriteRodex.requestCancelWriteRodex();
		WriteRodex.list = [];
		WriteRodex.CharID = 0;
		WriteRodex.tax = 0;
		WriteRodex.ui.style.display = 'none';
	}

	function onClickSend(e) {
		e.stopImmediatePropagation();
		if (WriteRodex.receiver == null || (typeof WriteRodex.receiver === "string" && WriteRodex.receiver.trim().length === 0)) {
			ChatBox.addText(DB.getMessage(2611), ChatBox.TYPE.INFO_MAIL, ChatBox.FILTER.PUBLIC_LOG);
			return;
		}
		let receiver = WriteRodex.receiver;
		let sender = Session.Character.name;
		let zeny = parseInt(WriteRodex.ui.querySelector('.value').value, 10);
		zeny = (isNaN(zeny)) ? 0 : zeny;
		zeny = (zeny < 0) ? 0 : zeny;

		if ((WriteRodex.tax + zeny) > Session.zeny) {
			ChatBox.addText(DB.getMessage(2643), ChatBox.TYPE.INFO_MAIL, ChatBox.FILTER.PUBLIC_LOG);
			return;
		}

		let title = WriteRodex.ui.querySelector('.title-text').value.replace(/^(\$|\%)/, '').replace(/\t/g, '').substring(0, 23) + String.fromCharCode(0);
		let body = WriteRodex.ui.querySelector('.content-text').value.replace(/^(\$|\%)/, '').replace(/\t/g, '').substring(0, 499) + String.fromCharCode(0);
		let Titlelength = title.length;
		let Bodylength = body.length;
		let CharID = WriteRodex.CharID;
		WriteRodex.requestSendRodex(receiver, sender, zeny, Titlelength, Bodylength, CharID, title, body);
		WriteRodex.requestCancelWriteRodex();
	}
	/**
	 * Search in a list for an item by its index
	 *
	 * @param {number} index
	 * @returns {Item}
	 */
	WriteRodex.getItemByIndex = function getItemByIndex(index) {
		var i, count;
		var list = WriteRodex.list;

		for (i = 0, count = list.length; i < count; ++i) {
			if (list[i].index === index) {
				return list[i];
			}
		}

		return null;
	};


	WriteRodex.addItem = function addItem(item) {

		var object = WriteRodex.getItemByIndex(item.index);

		if (object) {
			object.count += item.count;
			this.ui.querySelector('.item[data-index="' + item.index + '"] .count').textContent = object.count;
			return;
		}

		object = Object.assign({}, item);
		WriteRodex.list.push(object);

		var it = DB.getItemInfo(item.ITID);
		var content = this.ui.querySelector('.items .item-list');

		content.insertAdjacentHTML('beforeend',
			'<div class="item" data-index="' + item.index + '" draggable="true">' +
			'<div class="icon"></div>' +
			'<div class="amount"><span class="count">' + (item.count || 1) + '</span></div>' +
			'</div>'
		);

		Client.loadFile(DB.INTERFACE_PATH + 'item/' + (item.IsIdentified ? it.identifiedResourceName : it.unidentifiedResourceName) + '.bmp', function (data) {
			content.querySelector('.item[data-index="' + item.index + '"] .icon').style.backgroundImage = 'url(' + data + ')';
		});

		let item_div = content.querySelector('.item[data-index="' + item.index + '"]');
		item_div.addEventListener('mouseover', onItemOver);
		item_div.addEventListener('mouseout', onItemOut);
		item_div.addEventListener('dragstart', onItemDragStart);
		item_div.addEventListener('dragend', onItemDragEnd);
		item_div.addEventListener('contextmenu', onItemInfo);

		WriteRodex.updateWeight(item.weight);
		WriteRodex.updateTax();
	}

	/**
	 * Remove item from WriteRodex
	 *
	 * @param {number} index in WriteRodex
	 * @param {number} count
	 */
	WriteRodex.removeItem = function RemoveItem(index, count, weight) {
		var item = WriteRodex.getItemByIndex(index);

		// Emulator failed to complete the operation
		// do not remove item from inventory
		if (!item || count <= 0) {
			return null;
		}

		if (item.count) {
			item.count -= count;

			if (item.count > 0) {
				WriteRodex.ui.querySelector('.item[data-index="' + item.index + '"] .count').textContent = item.count;
				return;
			}
		}

		WriteRodex.list.splice(WriteRodex.list.indexOf(item), 1);
		var _removeEl = WriteRodex.ui.querySelector('.item[data-index="' + item.index + '"]');
		if (_removeEl && _removeEl.parentNode) _removeEl.parentNode.removeChild(_removeEl);
		WriteRodex.updateWeight(weight);
		WriteRodex.updateTax();
	};

	WriteRodex.updateWeight = function updateWeight(weight) {
		WriteRodex.ui.querySelector('.weigth-text').innerHTML = weight + '  2000';
	}

	WriteRodex.updateTax = function updateTax() {
		let total_items = WriteRodex.list.length;
		let tax = total_items * 2500;
		let zeny = parseInt(WriteRodex.ui.querySelector('.value').value, 10);
		zeny = (isNaN(zeny)) ? 0 : zeny;
		zeny = (zeny < 0) ? 0 : zeny;
		tax += parseInt(zeny * 0.02); // 2% tax
		WriteRodex.ui.querySelector('.tax-text').innerHTML = tax;
		WriteRodex.tax = tax;

		if ((tax + zeny) > Session.zeny) {
			WriteRodex.ui.querySelector('.tax-text').classList.add('red');
			WriteRodex.ui.querySelector('.value').classList.add('red');
		} else {
			WriteRodex.ui.querySelector('.tax-text').classList.remove('red');
			WriteRodex.ui.querySelector('.value').classList.remove('red');
		}
	}

	WriteRodex.close = function close() {
		WriteRodex.ui.style.display = 'none';
	}

	function prettifyZeny(value) {
		var num = String(value);
		var i = 0, len = num.length;
		var out = '';

		while (i < len) {
			out = num[len - i - 1] + out;
			if ((i + 1) % 3 === 0 && i + 1 !== len) {
				out = ',' + out;
			}
			++i;
		}

		return out;
	}

	function onClickValidateName(e) {
		e.stopImmediatePropagation();
		let name = WriteRodex.ui.querySelector('.name').value;
		WriteRodex.validateName(name.replace(/^(\$|\%)/, '').replace(/\t/g, ''));
	}

	/**
	 * Drop an item from inventory to writerodex
	 *
	 * @param {event}
	 */
	function onDrop(event) {
		var item, data;
		event.stopImmediatePropagation();

		try {
			data = JSON.parse(event.dataTransfer.getData('Text'));
			item = data.data;
		}
		catch (e) {
			return false;
		}

		// Just allow item from inventory
		if (data.type !== 'item' || data.from !== 'Inventory') {
			return false;
		}

		// Have to specify how much
		if (item.count > 1) {
			InputBox.append();
			InputBox.setType('item', false, item.count, item.ITID);

			InputBox.onSubmitRequest = function OnSubmitRequest(count) {
				InputBox.remove();
				switch (data.from) {
					case 'Inventory':
						getModule('UI/Components/Inventory/Inventory').reqMoveItemToWriteRodex(item.index, parseInt(count, 10));
						break;
					default:
					//cant do this action
				}
			};
			return false;
		}

		switch (data.from) {
			case 'Inventory':
				getModule('UI/Components/Inventory/Inventory').reqMoveItemToWriteRodex(item.index, 1);
				break;
			default:
			//cant do this action
		}
		return false;
	}

	/**
 * Stop event propagation
 */
	function stopPropagation(event) {
		event.stopImmediatePropagation();
		return false;
	}

	/**
	 * Show item name when mouse is over
	 */
	function onItemOver() {
		var idx = parseInt(this.getAttribute('data-index'), 10);
		var item = WriteRodex.getItemByIndex(idx);

		if (!item) {
			return;
		}

		var rect   = this.getBoundingClientRect();
		var uiRect = WriteRodex.ui.getBoundingClientRect();
		var overlay = WriteRodex.ui.querySelector('.overlay');

		// Display box
		overlay.style.display = '';
		DOM.setCss(overlay, { top: (rect.top - uiRect.top) + 'px', left: (rect.left - uiRect.left + 35) + 'px' });
		overlay.textContent = DB.getItemName(item) + ' ' + (item.count || 1) + ' ea';

		if (item.IsIdentified) {
			overlay.classList.remove('grey');
		}
		else {
			overlay.classList.add('grey');
		}
	}


	/**
	 * Hide the item name
	 */
	function onItemOut() {
		WriteRodex.ui.querySelector('.overlay').style.display = 'none';
	}


	/**
	 * Start dragging an item
	 */
	function onItemDragStart(event) {
		var index = parseInt(this.getAttribute('data-index'), 10);
		var item = WriteRodex.getItemByIndex(index);

		if (!item) {
			return;
		}

		// Set image to the drag drop element
		var img = new Image();
		var url = this.firstChild.style.backgroundImage.match(/\(([^\)]+)/)[1];
		img.src = url.replace(/^\"/, '').replace(/\"$/, '');

		event.dataTransfer.setDragImage(img, 12, 12);
		event.dataTransfer.setData('Text',
			JSON.stringify(window._OBJ_DRAG_ = {
				type: 'item',
				from: 'WriteRodex',
				data: item
			})
		);

		onItemOut();
	}


	/**
	 * Stop dragging an item
	 *
	 */
	function onItemDragEnd() {
		delete window._OBJ_DRAG_;
	}


	/**
	 * Get item info (open description window)
	 */
	function onItemInfo(event) {
		event.stopImmediatePropagation();

		var index = parseInt(this.getAttribute('data-index'), 10);
		var item = WriteRodex.getItemByIndex(index);

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
	* Callbacks
	*/

	/**
	 * Create component and export it
	 */
	return UIManager.addComponent(WriteRodex);
});
