/**
 * UI/Components/LaphineSys/LaphineSys.js
 *
 * Laphine Synthesis System UI
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
	var Network            = require('Network/NetworkManager');
	var UIManager          = require('UI/UIManager');
	var UIComponent        = require('UI/UIComponent');
	var Equipment		   = require('UI/Components/Equipment/Equipment');
	var Inventory		   = require('UI/Components/Inventory/Inventory');
	var ItemCompare        = require('UI/Components/ItemCompare/ItemCompare');
	var ItemInfo           = require('UI/Components/ItemInfo/ItemInfo');
	var Client             = require('Core/Client');
	var KEYS               = require('Controls/KeyEventHandler');
	var htmlText           = require('text!./LaphineSys.html');
	var cssText            = require('text!./LaphineSys.css');
	var PACKET        	   = require('Network/PacketStructure');
	var PACKETVER   	   = require('Network/PacketVerManager');
	var getModule     	   = require;
	var DOM             = require('Utils/DOM');


	/**
	 * Create Component
	 */
	var LaphineSys = new UIComponent( 'LaphineSys', htmlText, cssText );


	/**
	 * @var {number} LaphineSys
	 */
	const LaphineUIState = {
		itemId: null,
		needCount: null,
		needRefineMin: null,
		needRefineMax: null,
		sourceItems: [],
		needSourceString: null
	};


	// Initialize a list to keep track of submitted items
    LaphineSys.submittedItems = [];


	/**
	 * Once append to the DOM
	 */
	LaphineSys.onKeyDown = function onKeyDown( event )
	{
		if (event.which === KEYS.ESCAPE) {
			LaphineSys.remove();
			event.stopImmediatePropagation();
			return false;
		}

		return true;
	};


	/**
	 * Once append
	 */
	LaphineSys.onAppend = function onAppend()
	{
		// Seems like "EscapeWindow" is execute first, push it before.
		// (jQuery._data removed - UIComponent handles keydown priority)

		LaphineSys.ui.querySelector('.some_notifs').style.display = 'none';
		LaphineSys.ui.querySelector('.make_enabled').style.display = 'none';
		LaphineSys.ui.querySelector('.make_disabled').style.display = '';
	};


	/**
	 * Once removed from html
	 */
	LaphineSys.onRemove = function onRemove()
	{
		LaphineSys.submittedItems.length = 0;
		LaphineSys.ui.querySelector('.submit_button_enabled').style.display = '';
        LaphineSys.ui.querySelector('.submit_button_disabled').style.display = 'none';
        LaphineSys.ui.querySelector('.submitted_mat_list').innerHTML = '';
		LaphineSys.ui.querySelector('.mat_count_submitted').textContent = '0';
		LaphineSys.ui.querySelector('.some_notifs').style.display = 'none';
	};


	/**
	 * Initialize UI
	 */
	LaphineSys.init = function init()
	{
		// UI initializations
		this.ui.querySelector('.mat_count_submitted').textContent = '0';
		this.ui.querySelector('.submit_button_disabled').style.display = 'none';
		this.ui.querySelector('.some_notifs').style.display = 'none';
		DOM.setCss(this.ui, { top: 200, left:480 });
		this.draggable(this.ui.querySelector('.titlebar'));

		// Functions bind
		var _lsCloseBtn = this.ui.querySelector('.close, .cancel');
		if (_lsCloseBtn) _lsCloseBtn.addEventListener('click', onRequestLaphineClose);
		var _lsAvailList = this.ui.querySelector('.available_mat_list');
		var _lsLeftPanel = this.ui.querySelector('.left_panel');
		if (_lsAvailList) {
			_lsAvailList.addEventListener('dragover', stopPropagation);
			DOM.addDelegatedEvent(_lsAvailList, 'dragstart', '.item', onItemDragStart);
			DOM.addDelegatedEvent(_lsAvailList, 'dragend', '.item', onItemDragEnd);
		}
		if (_lsLeftPanel) {
			_lsLeftPanel.addEventListener('dragover', stopPropagation);
			DOM.addDelegatedEvent(_lsLeftPanel, 'dragstart', '.item', onItemDragStart);
			DOM.addDelegatedEvent(_lsLeftPanel, 'dragend', '.item', onItemDragEnd);
		}
		this.ui.querySelector('.submit_button_enabled').addEventListener('click', onSubmitItem);
		if (_lsAvailList) {
			DOM.addDelegatedEvent(_lsAvailList, 'click', '.item', onItemSelect);
			_lsAvailList.addEventListener('drop', onRemoveSubmitDrop);
		}
		if (_lsLeftPanel) _lsLeftPanel.addEventListener('drop', onSubmitItemDrop);
		this.ui.querySelector('.make_enabled').addEventListener('click', onRequestSynthesis);
		var _lsSubmittedList = this.ui.querySelector('.submitted_mat_list');
		[_lsAvailList, _lsSubmittedList].forEach(function(el) {
			if (!el) return;
			DOM.addDelegatedEvent(el, 'mouseover', '.item', onItemOver);
			DOM.addDelegatedEvent(el, 'mouseout', '.item', onItemOut);
			DOM.addDelegatedEvent(el, 'contextmenu', '.item', onItemInfo);
		});

		// Setting chatbox scrollbar
		Client.loadFiles([
			DB.INTERFACE_PATH + 'lapine/scrollbar_bg_btm.bmp',
			DB.INTERFACE_PATH + 'lapine/scrollbar_bg_mid.bmp',
			DB.INTERFACE_PATH + 'lapine/scrollbar_bg_top.bmp',
			DB.INTERFACE_PATH + 'lapine/scrollbar_thumb_out_btm.bmp',
			DB.INTERFACE_PATH + 'lapine/scrollbar_thumb_out_mid.bmp',
			DB.INTERFACE_PATH + 'lapine/scrollbar_thumb_out_top.bmp',
			DB.INTERFACE_PATH + 'lapine/scrollbar_thumb_over_btm.bmp',
			DB.INTERFACE_PATH + 'lapine/scrollbar_thumb_over_mid.bmp',
			DB.INTERFACE_PATH + 'lapine/scrollbar_thumb_over_top.bmp',
			DB.INTERFACE_PATH + 'lapine/scrollbar_thumb_press_btm.bmp',
			DB.INTERFACE_PATH + 'lapine/scrollbar_thumb_press_mid.bmp',
			DB.INTERFACE_PATH + 'lapine/scrollbar_thumb_press_top.bmp'
		], function (bgBottom, bgMid, bgTop, thumbOutBottom, thumbOutMid, thumbOutTop, thumbOverBottom, thumbOverMid, thumbOverTop, thumbPressBottom, thumbPressMid, thumbPressTop) {
			(document.querySelector('style') || document.head.appendChild(document.createElement('style'))).textContent += [
				'#LaphineSys .available_mat_list::-webkit-scrollbar { width: 8px; height: 0px; }',
				'#LaphineSys .available_mat_list::-webkit-scrollbar-corner { display: none; }',
				'#LaphineSys .available_mat_list::-webkit-scrollbar-button:vertical:increment { background: url(' + bgBottom + ') center center no-repeat, url(' + bgMid + ') top no-repeat; height: 15px; width: 7px; background-color: transparent; }',
				'#LaphineSys .available_mat_list::-webkit-scrollbar-button:vertical:decrement { background: url(' + bgTop + ') center center no-repeat, url(' + bgMid + ') bottom no-repeat; height: 15px; width: 7px; background-color: transparent; }',
				'#LaphineSys .available_mat_list::-webkit-scrollbar-track-piece:vertical { background: url(' + bgTop + ') top no-repeat, url(' + bgMid + ') center repeat-y, url(' + bgBottom + ') bottom no-repeat; }',
				'#LaphineSys .available_mat_list::-webkit-scrollbar-thumb:vertical { background: url(' + thumbOutTop + ') top no-repeat, url(' + thumbOutMid + ') center repeat-y, url(' + thumbOutBottom + ') bottom no-repeat !important; border-radius: 100px; }',
				'#LaphineSys .available_mat_list::-webkit-scrollbar-thumb:vertical:hover { background: url(' + thumbOverTop + ') top no-repeat, url(' + thumbOverMid + ') center repeat-y, url(' + thumbOverBottom + ') bottom no-repeat !important; border-radius: 100px; }',
				'#LaphineSys .available_mat_list::-webkit-scrollbar-thumb:vertical:active { background: url(' + thumbPressTop + ') top no-repeat, url(' + thumbPressMid + ') center repeat-y, url(' + thumbPressBottom + ') bottom no-repeat !important; border-radius: 100px; }',
				'#LaphineSys .available_mat_list::-webkit-scrollbar-thumb:vertical{ -webkit-border-image: none; }'
			].join('\n');
		});
	};


	/**
 	* Opens the Laphine UI and initializes its state based on the provided packet data.
 	* @param {object} pkt - The packet containing item information.
 	*/
	function onOpenLaphineUI(pkt)
	{
		if (pkt) {
	
			// Assume lapine_list is already loaded and available
			let laphineInfo = DB.getLaphineSysInfoById(pkt.itemId);
	
			if (laphineInfo) {
	
				// Update the state object
				LaphineUIState.itemId = laphineInfo.ItemID;
				LaphineUIState.needCount = laphineInfo.NeedCount;
				LaphineUIState.needRefineMin = laphineInfo.NeedRefineMin;
				LaphineUIState.needRefineMax = laphineInfo.NeedRefineMax;
				LaphineUIState.sourceItems = laphineInfo.SourceItems;
				LaphineUIState.needSourceString = laphineInfo.NeedSource_String;
	
				// Use a function to build/update your UI
				onUpdateLaphineUI();
				populateAvailableMatList();
				LaphineSys.append();
			} else {
				console.warn("Item with ID", pkt.itemId, "not found in lapine_list.");
			}
		}
	};


	/**
 	* Updates the Laphine UI with the current state information.
 	*/
	function onUpdateLaphineUI()
	{
		var item = Inventory.getUI().getItemById(LaphineUIState.itemId);

		if (!item) {
			return false;
		}

		LaphineSys.ui.querySelector('.item_text').textContent = DB.getItemName(item);
		LaphineSys.ui.querySelector('.mat_info_list').textContent = LaphineUIState.needSourceString;
		LaphineSys.ui.querySelector('.mat_count_needed').textContent = LaphineUIState.needCount;
	};


	/**
	 * Get item objects by id
	 *
	 * @param {number} id
	 * @returns {Array<Item>}
	 */
	function GetInventoryItemsById(id) {
	    var items = [];
	    var list = Inventory.getUI().list;

	    for (var i = 0, count = list.length; i < count; ++i) {
	        if (list[i].ITID === id) {
	            items.push(list[i]);
	        }
	    }

	    return items;
	};


	/**
 	* Populates the list of available materials.
 	*/
	function populateAvailableMatList() {
		let availableMatList = LaphineSys.ui.querySelector('.available_mat_list');
		availableMatList.innerHTML = ''; // Clear the list before populating
	
		LaphineUIState.sourceItems.forEach(sourceItem => {
			let matchingItems = GetInventoryItemsById(sourceItem.id);
			matchingItems.forEach(inventoryItem => {
				let count = (inventoryItem.type === ItemType.WEAPON || inventoryItem.type === ItemType.ARMOR) ? 1 : inventoryItem.count;
				onAddMaterialItem( inventoryItem, count, sourceItem.count, sourceItem.name);
			});
		});
	};


	/**
 	* Handles the addition of an item in the UI from the available materials list.
 	*/
	function onAddMaterialItem( item, inventory_count, source_needcount, source_iconname)
	{
		let availableMatList = LaphineSys.ui.querySelector('.available_mat_list');

		// Determine if the item is selectable based on item type and corresponding criteria
		let isSelectable;
		if (item.type === ItemType.WEAPON || item.type === ItemType.ARMOR) {
			isSelectable = item.RefiningLevel >= LaphineUIState.needRefineMin &&
						   item.RefiningLevel <= LaphineUIState.needRefineMax;
		} else {
			isSelectable = inventory_count >= source_needcount;
		}

		let draggableAttr = !isSelectable ? '' : 'draggable="true"';
        let itemClass = isSelectable ? '' : 'unselectable';

		// Add item details
		var _tmp1 = document.createElement('div');
		_tmp1.innerHTML = '<div class="item ' + itemClass + '" data-index="'+item.index+'" '+ draggableAttr + '>' +
			'<div class="icon"></div>' +
			'<div class="amount">'+inventory_count+'</div>' +
			'<div class="name">'+DB.getItemName(item)+'</div>' +
			'</div>';
		var newItem = _tmp1.firstChild;

		newItem.addEventListener('dblclick', onSubmitItem); // Add double-click event listener to submit item
		availableMatList.appendChild(newItem);

		Client.loadFile( DB.INTERFACE_PATH + 'item/' + source_iconname + '.bmp', function(data){
			availableMatList.querySelector('.item[data-index="'+ item.index +'"] .icon').style.backgroundImage = 'url('+ data +')';
		});

		Client.loadFile( DB.INTERFACE_PATH + 'lapine/list_selected_item.bmp', function(data){
			availableMatList.querySelector('.item[data-index="'+ item.index +'"] .name').style.backgroundImage = 'url('+ data +')';
		});
	};


	/**
 	* Handles the result of Laphine Synthesis.
 	*/
	function onLaphineSysResult(pkt)
	{
		if (pkt) {
			switch (pkt.result) {
				case 0:
					onRequestLaphineClose();
					break;
				case 5: // LAPHINE_SYNTHESIS_AMOUNT = 5,
				case 7: // LAPHINE_SYNTHESIS_ITEM = 7
					break;
				default:
					break;
			}
		}
	};


	/**
 	* Handles the close request of the Laphine UI and sends the appropriate packet.
 	*/
	function onRequestLaphineClose()
	{
		LaphineSys.remove();
		
		var pkt = new PACKET.CZ.RANDOM_COMBINE_ITEM_UI_CLOSE();
		Network.sendPacket(pkt);
	};


	/**
 	* Handles the selection of an item from the available materials list.
 	*/
	function onItemSelect()
	{
		// Check if the clicked item has the class 'unselectable'
		if (this.classList.contains('unselectable')) {
			return false; // Exit the function early
		}

		var idx = parseInt(this.getAttribute('data-index'), 10);
		var item = Inventory.getUI().getItemByIndex(idx);
	
	
		if (!item) {
			return false;
		}
	
		LaphineSys.ui.querySelector('.name').classList.remove('selected');
		LaphineSys.ui.querySelector('.item[data-index="' + item.index + '"] .name').classList.add('selected');
	};


	/**
 	* Submits a selected item and updates the UI accordingly.
 	*/
	function onSubmitItem()
	{

		let submittedCount = parseInt(LaphineSys.ui.querySelector('.mat_count_submitted').textContent, 10);
		let neededCount = parseInt(LaphineSys.ui.querySelector('.mat_count_needed').textContent, 10);

		if (submittedCount >= neededCount) {
			return false;
		}

        // Check if there's a currently selected item in the .name class
		let selectedItem = LaphineSys.ui.querySelector('.item .name.selected');
		let idx;

		if (selectedItem) {
			idx = parseInt(selectedItem.closest('.item').getAttribute('data-index'), 10);
		} else {
			idx = parseInt(this.getAttribute('data-index'), 10);
		}

		let item = Inventory.getUI().getItemByIndex(idx);

		// Ensure the item is valid
		if (!item) {
			return false;
		}

		// Check if the item is already submitted
		if (LaphineSys.submittedItems.some(submittedItem => submittedItem.index === item.index)) {
		    return; // Item already submitted
		}

		// Get the source item count from LaphineUIState.sourceItems
		let sourceItem = LaphineUIState.sourceItems.find(si => si.id === item.ITID);
		if (!sourceItem) {
			return; // Source item not found
		}

		// Check if the clicked item has the class 'unselectable'
		if (this.classList.contains('unselectable')) {
			let message;
			if (item.type === ItemType.WEAPON || item.type === ItemType.ARMOR) {
				if (item.RefiningLevel > LaphineUIState.needRefineMax) {
					message = DB.getMessage(3644);
					showMessage(message);
				} else {
					message = DB.getMessage(2899);
					showMessage(message);
				}
			} else {
				message = DB.getMessage(2898).replace('%d', sourceItem.count);
				showMessage(message);
			}
			return false; // Exit the function early
		}

        if (item) {
			onUpdateSubmitList(item);
        }
	};


	function onUpdateSubmitList(item)
	{
		let it   = DB.getItemInfo( item.ITID );
        let submittedMatList = LaphineSys.ui.querySelector('.submitted_mat_list');
		
		let sourceItem = LaphineUIState.sourceItems.find(si => si.id === item.ITID);

		// Determine the count based on item type
		let itemCount = (item.type === ItemType.WEAPON || item.type === ItemType.ARMOR) ? 1 : sourceItem.count;

		var _tmp2 = document.createElement('div');
		_tmp2.innerHTML = '<div class="item" data-index="' + item.index + '" draggable="true">' +
			'<div class="shadow"></div>'+
			'<div class="icon"></div>' +
			'<div class="amount">'+sourceItem.count+'</div>' +
			'</div>';
		let newItem = _tmp2.firstChild;

		newItem.addEventListener('dblclick', onItemRemove); // Add double-click event listener to remove item
		submittedMatList.appendChild(newItem);

		Client.loadFile(DB.INTERFACE_PATH + 'lapine/shadow_item_off.bmp', function (data) {
			submittedMatList.querySelector('.item[data-index="' + item.index + '"] .shadow').style.backgroundImage = 'url(' + data + ')';
		});

		Client.loadFile(DB.INTERFACE_PATH + 'item/' + ( item.IsIdentified ? it.identifiedResourceName : it.unidentifiedResourceName ) + '.bmp', function (data) {
			submittedMatList.querySelector('.item[data-index="' + item.index + '"] .icon').style.backgroundImage = 'url(' + data + ')';
		});

		// Add the item index and count to the submitted items list
		LaphineSys.submittedItems.push({
			index: item.index,
			count: itemCount
		});

		// Update the count of submitted items
		let submittedCount = parseInt(LaphineSys.ui.querySelector('.mat_count_submitted').textContent, 10) + 1;
		LaphineSys.ui.querySelector('.mat_count_submitted').textContent = submittedCount;

		// Check if the needed count is reached
		let neededCount = parseInt(LaphineSys.ui.querySelector('.mat_count_needed').textContent, 10);
		if (submittedCount >= neededCount) {
			LaphineSys.ui.querySelector('.submit_button_enabled').style.display = 'none';
			LaphineSys.ui.querySelector('.submit_button_disabled').style.display = '';
			LaphineSys.ui.querySelector('.make_disabled').style.display = 'none';
			LaphineSys.ui.querySelector('.make_enabled').style.display = '';
		}

		// Adjust the layout of the submitted materials list
		adjustSubmittedMatList();

		// Update the available materials list
		updateAvailableMatList(item.ITID, item.index, sourceItem.count, false); // false for decreasing the count
	};


	/**
 	* Adjusts the layout of the submitted materials list.
 	*/
	function adjustSubmittedMatList() {
		let submittedMatList = LaphineSys.ui.querySelector('.submitted_mat_list');
    	let items = submittedMatList.querySelector('.item');
    	let numItems = items.length;
    	let numRows = Math.ceil(numItems / 5);

    	// Adjust the top position based on the number of rows
    	submittedMatList.style.top = 145 - (numRows - 1 * 28); // Adjust the top position based on the number of rows
	};


	/**
 	* Handles the removal of a submitted item and updates the UI accordingly.
 	*/
	function onItemRemove() {
	    let idx = parseInt(this.getAttribute('data-index'), 10);
	    let item = Inventory.getUI().getItemByIndex(idx);

	    if (item) {
			onRemoveItemSubmitList(item, this); // Pass the DOM element to the next function
		}
	};


	function onRemoveItemSubmitList(item, element = null)
	{
		let itemIndex = LaphineSys.submittedItems.findIndex(submittedItem => submittedItem.index === item.index);
		if (itemIndex !== -1) {
			// Remove the item from the submitted items list
			LaphineSys.submittedItems.splice(itemIndex, 1);

			// If element is not provided, find the corresponding DOM element
			if (!element) {
				element = LaphineSys.ui.querySelector(`.item[data-index="${item.index}"]`);
			}

	    	// Remove the item from the DOM
	    	if (element && element.parentNode) { element.parentNode.removeChild(element); }

	    	// Update the count of submitted items
	    	let submittedCount = parseInt(LaphineSys.ui.querySelector('.mat_count_submitted').textContent, 10) - 1;
	    	LaphineSys.ui.querySelector('.mat_count_submitted').textContent = submittedCount;

	    	// Show the enabled submit button if the needed count is not reached
	    	let neededCount = parseInt(LaphineSys.ui.querySelector('.mat_count_needed').textContent, 10);
	    	if (submittedCount < neededCount) {
	    	    LaphineSys.ui.querySelector('.submit_button_enabled').style.display = '';
	    	    LaphineSys.ui.querySelector('.submit_button_disabled').style.display = 'none';
	    	}

	    	// Adjust the layout of the submitted materials list
	    	adjustSubmittedMatList();

			// Update the available materials list
			updateAvailableMatList(item.ITID, item.index, item.count, true); // true for increasing the count
	    }
	};


	/**
 	* Handles the changes in UI when submitting and removing item from submitted list.
 	*/
	function updateAvailableMatList(itemId, itemIndex, countChange, increase) {
		let availableMatList = LaphineSys.ui.querySelector('.available_mat_list');
		let itemExists = false;
		let selectedItem = null;

		Array.from(availableMatList.querySelectorAll('.item')).forEach(function() {
			let idx = parseInt(this.getAttribute('data-index'), 10);
			let item = Inventory.getUI().getItemByIndex(idx);

			if (item.ITID === itemId && idx === itemIndex) {
				itemExists = true;
				selectedItem = this;
				let tempCount = (item.type === ItemType.WEAPON || item.type === ItemType.ARMOR) ? 1 : item.count;
				if (increase) {
					this.classList.remove('unselectable');
					this.querySelector('.amount').textContent = tempCount;
					this.setAttribute('draggable', 'true'); // Set draggable to true
				} else {
					tempCount -= countChange;
					if (tempCount <= 0) {
						this.remove();
					} else {
						this.classList.add('unselectable');
						this.querySelector('.name').classList.remove('selected');
						this.querySelector('.amount').textContent = tempCount;
						this.setAttribute('draggable', 'false'); // Set draggable to false
					}
				}
			}
		});

		// If item doesn't exist and should be increased, add it back
		if (increase && !itemExists) {
			let item = Inventory.getUI().getItemByIndex(itemIndex);
			if (item) {
				let inventory_count = (item.type === ItemType.WEAPON || item.type === ItemType.ARMOR) ? 1 : item.count;
            	let sourceItem = LaphineUIState.sourceItems.find(sourceItem => sourceItem.id === itemId);
            	let source_needcount = sourceItem.count;
            	let source_iconname = sourceItem.name;

            	onAddMaterialItem(item, inventory_count, source_needcount, source_iconname);
			}
		}
	};


	/**
 	* Handles showing of message for notifications.
 	*/
	function showMessage(message)
	{
		LaphineSys.ui.querySelector('.info_msg').textContent = message;
		LaphineSys.ui.querySelector('.some_notifs').style.display = '';
	};


	/**
 	* Handles the synthesis request by preparing and sending the packet.
 	*/
	function onRequestSynthesis()
	{
		var pkt;
	    pkt = new PACKET.CZ.REQ_RANDOM_COMBINE_ITEM();
	    pkt.itemId = LaphineUIState.itemId;
		pkt.items = [];

	    // Check if the number of submitted items matches the needed count
    	if (LaphineSys.submittedItems.length === LaphineUIState.needCount) {
    	    // Iterate through the submitted items and add them to pkt.items
    	    for (let i = 0; i < LaphineSys.submittedItems.length; i++) {
    	        let submittedItem = LaphineSys.submittedItems[i];
    	        pkt.items.push({
    	            index: submittedItem.index,
    	            count: submittedItem.count
    	        });
    	    }
    	} else {
    	    // Handle the case where the number of submitted items does not match the needed count
    	    console.warn("[Laphine Synthesis] The number of submitted items does not match the needed count.");
    	    return; // Exit the function early if the counts do not match
    	}

	    Network.sendPacket(pkt);
	};


	/**
	 * Show item name when mouse is over
	 */
	function onItemOver()
	{
		var idx  = parseInt( this.getAttribute('data-index'), 10);
		var item = Inventory.getUI().getItemByIndex(idx);

		if (!item) {
			return;
		}

		// Get back data
		var overlay = LaphineSys.ui.querySelector('.overlay');

		// Determine the immediate parent container explicitly based on the context
		var parentContainer = this.closest('.available_mat_list, .submitted_mat_list');
		var itemRect = this.getBoundingClientRect();
		var containerRect = parentContainer ? parentContainer.getBoundingClientRect() : {top: 0, left: 0};

		// Calculate the desired position of the overlay relative to the container
		var top = (itemRect.top - containerRect.top) - overlay.offsetHeight + 25;
		var left = itemRect.left - containerRect.left;

		// Display box
		overlay.style.display = '';
		DOM.setCss(overlay, {
			top: (top + containerRect.top - LaphineSys.ui.getBoundingClientRect().top) + 'px',
			left: (left + containerRect.left - LaphineSys.ui.getBoundingClientRect().left) + 'px'
		});
		overlay.textContent = DB.getItemName(item);

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
		LaphineSys.ui.querySelector('.overlay').style.display = 'none';
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
	 * Start dragging an item
	 */
	function onItemDragStart( event )
	{
		var index = parseInt(this.getAttribute('data-index'), 10);
		var item  = Inventory.getUI().getItemByIndex(index);

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
				from: 'LaphineSys',
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
	 * Drop an item from available_mat_list into submitted_mat_list
	 *
	 * @param {event}
	 */
	function onSubmitItemDrop( event )
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
		if (data.type !== 'item') {
			return false;
		}
		
		let submittedCount = parseInt(LaphineSys.ui.querySelector('.mat_count_submitted').textContent, 10);
		let neededCount = parseInt(LaphineSys.ui.querySelector('.mat_count_needed').textContent, 10);

		if (submittedCount >= neededCount) {
			return false;
		}

		// Check if the item is already submitted
		if (LaphineSys.submittedItems.some(submittedItem => submittedItem.index === item.index)) {
		    return; // Item already submitted
		}

		// Get the source item count from LaphineUIState.sourceItems
		let sourceItem = LaphineUIState.sourceItems.find(si => si.id === item.ITID);
		if (!sourceItem) {
			return; // Source item not found
		}

		// Check if the clicked item has the class 'unselectable'
		if (this.classList.contains('unselectable')) {
			let message;
			if (item.type === ItemType.WEAPON || item.type === ItemType.ARMOR) {
				if (item.RefiningLevel > LaphineUIState.needRefineMax) {
					message = DB.getMessage(3644);
					showMessage(message);
				} else {
					message = DB.getMessage(2899);
					showMessage(message);
				}
			} else {
				message = DB.getMessage(2898).replace('%d', sourceItem.count);
				showMessage(message);
			}
			return false; // Exit the function early
		}

		if (item) {
			onUpdateSubmitList(item);
		}
	};


	/**
	 * Drop an item from submitted_mat_list into available_mat_list
	 *
	 * @param {event}
	 */
	function onRemoveSubmitDrop(event)
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
		if (data.type !== 'item') {
			return false;
		}

		if (!item) {
			return false;
		}

		// Locate the DOM element based on the item's index
		let element = LaphineSys.ui.querySelector(`.item[data-index="${item.index}"]`);

		if (item) {
			onRemoveItemSubmitList(item, element);
		}
	};


	/**
	 * Get item info (open description window)
	 */
	function onItemInfo(event)
	{
		event.stopImmediatePropagation();

		var idx = parseInt(this.getAttribute('data-index'), 10);
		var item  = Inventory.getUI().getItemByIndex(idx);

		if (!item) {
			return false;
		}

		// Remove existing compare UI if it's currently displayed
		if (ItemCompare.ui) {
			ItemCompare.remove();
		}

		// Don't add the same UI twice, remove it
		if (ItemInfo.uid === item.ITID) {
			ItemInfo.remove();
			if (ItemCompare.ui) {
				ItemCompare.remove();
			}
			return false;
		}

		// Add ui to window
		ItemInfo.append();
		ItemInfo.uid = item.ITID;
		ItemInfo.setItem(item);

		// Check if there is an equipped item in the same location
		var compareItem = Equipment.getUI().isInEquipList(item.location);

		// If a comparison item is found, display comparison
		if (compareItem && Inventory.getUI().itemcomp) {
			ItemCompare.prepare();
			ItemCompare.append();
			ItemCompare.uid = compareItem.ITID;
			ItemCompare.setItem(compareItem);
		}

		return false;
	};


	/**
	 * Packet Hooks to functions
	 */
	Network.hookPacket( PACKET.ZC.RANDOM_COMBINE_ITEM_UI_OPEN,		onOpenLaphineUI );
	Network.hookPacket( PACKET.ZC.ACK_RANDOM_COMBINE_ITEM,			onLaphineSysResult );


	/**
	 * Create component and export it
	 */
	return UIManager.addComponent(LaphineSys);

});
