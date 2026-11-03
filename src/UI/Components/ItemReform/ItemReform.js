/**
 * UI/Components/ItemReform/ItemReform.js
 *
 * Item Reform UI
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
	var EffectConst        = require('DB/Effects/EffectConst');
	var ItemType           = require('DB/Items/ItemType');
	var Session    		   = require('Engine/SessionStorage');
	var Network            = require('Network/NetworkManager');
	var EffectManager      = require('Renderer/EffectManager');
	var UIManager          = require('UI/UIManager');
	var UIComponent        = require('UI/UIComponent');
	var Equipment		   = require('UI/Components/Equipment/Equipment');
	var Inventory		   = require('UI/Components/Inventory/Inventory');
	var ItemCompare        = require('UI/Components/ItemCompare/ItemCompare');
	var ItemInfo           = require('UI/Components/ItemInfo/ItemInfo');
	var NpcBox			   = require('UI/Components/NpcBox/NpcBox');
	var Client             = require('Core/Client');
	var KEYS               = require('Controls/KeyEventHandler');
	var htmlText           = require('text!./ItemReform.html');
	var cssText            = require('text!./ItemReform.css');
	var PACKET        	   = require('Network/PacketStructure');
	var PACKETVER   	   = require('Network/PacketVerManager');
	var getModule     	   = require;
	var DOM             = require('Utils/DOM');


	/**
	 * Create Component
	 */
	var ItemReform = new UIComponent( 'ItemReform', htmlText, cssText );

	var ReformInfo = {};
	var SelectedReformInfo = {};

	const ReformUIState = {
		itemId: 0,
		index: 0,
		resultItem: null,
		timeout: 0
	}

	/**
	 * Once append to the DOM
	 */
	ItemReform.onKeyDown = function onKeyDown( event )
	{
		if (event.which === KEYS.ESCAPE) {
			ItemReform.remove();
			event.stopImmediatePropagation();
			return false;
		}

		return true;
	};


	/**
	 * Once append
	 */
	ItemReform.onAppend = function onAppend()
	{
		// Seems like "EscapeWindow" is execute first, push it before.
		// (jQuery._data removed - UIComponent handles keydown priority)

		ItemReform.ui.querySelector('.information_details').style.display = 'none';
		ItemReform.ui.querySelector('.reform_enabled').style.display = 'none';
		ItemReform.ui.querySelector('.reform_disabled').style.display = '';
	};


	/**
	 * Once removed from html
	 */
	ItemReform.onRemove = function onRemove()
	{
		ReformInfo = {};
		SelectedReformInfo = {};
		ItemReform.ui.querySelector('.available_material_list').innerHTML = '';
		ItemReform.ui.querySelector('.material_list').innerHTML = '';
		ItemReform.ui.querySelector('.result_item_text').innerHTML = '';
		ItemReform.ui.querySelector('.base_item').innerHTML = '';
		ItemReform.ui.querySelector('.result_item').innerHTML = '';
		ItemReform.ui.querySelector('.info_msg').innerHTML = '';
		ItemReform.ui.querySelector('.information_details').style.display = 'none';
		ItemReform.ui.querySelector('.reform_enabled').style.display = 'none';
		ItemReform.ui.querySelector('.reform_disabled').style.display = '';
		ItemReform.ui.querySelector('.some_notifs').style.display = 'none';
		resetReformUIState();

	};


	function resetReformUIState() {
		ReformUIState.itemId = 0;
		ReformUIState.index = 0;
		ReformUIState.resultItem = null;
		ReformUIState.timeout = 0;
	};


	/**
	 * Initialize UI
	 */
	ItemReform.init = function init()
	{
		// UI initializations
		DOM.setCss(this.ui, { top: 200, left:480 });
		this.draggable(this.ui.querySelector('.titlebar'));

		// Functions bind
		var _irCloseBtn = this.ui.querySelector('.close, .cancel');
		if (_irCloseBtn) _irCloseBtn.addEventListener('click', onRequestReformClose);
		var _irAvailList = this.ui.querySelector('.available_material_list');
		DOM.addDelegatedEvent(_irAvailList, 'click', '.item', onMaterialSelect);
		DOM.addDelegatedEvent(_irAvailList, 'mouseover', '.item', onHoverContainer);
		DOM.addDelegatedEvent(_irAvailList, 'mouseout', '.item', onHoverOutContainer);
		var _irInfoDetails = this.ui.querySelector('.information_details');
		_irInfoDetails.addEventListener('mouseover', onHoverDetails);
		_irInfoDetails.addEventListener('mouseout', onHoverOutDetails);
		this.ui.querySelector('.reform_enabled').addEventListener('click', onRequestItemReform);
		DOM.addDelegatedEvent(this.ui.querySelector('.panel'), 'contextmenu', '.item', onItemInfo);
		var _irLeftPanel = this.ui.querySelector('.panel .left_panel');
		DOM.addDelegatedEvent(_irLeftPanel, 'mouseover', '.item', onItemOver);
		DOM.addDelegatedEvent(_irLeftPanel, 'mouseout', '.item', onItemOut);

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
 	* Opens the Laphine UI and initializes its state based on the provided packet data.
 	* @param {object} pkt - The packet containing item information.
 	*/
	function onOpenReformUI(pkt)
	{
		if (pkt) {

			ReformInfo = {};
			SelectedReformInfo = {};

			// Assume lapine_list is already loaded and available
			let reformids = DB.findReformListByItemID(pkt.ITID);

			var item = Inventory.getUI().getItemById(pkt.ITID);

			if (!item) {
				return false;
			}

			ReformUIState.itemId = pkt.ITID;

			if (reformids) {
				ReformInfo = DB.getAllReformInfos(reformids);
				checkReformCriteria(); // Call to check the criteria
				ItemReform.append();
				ItemReform.ui.querySelector('.item_text').textContent = DB.getItemName(item);
			} else {
				console.warn("Item with ID", pkt.itemId, "not found in Reform List.");
			}
		}
	};


	/**
	 * Checks inventory items against reform criteria.
	 */
	function checkReformCriteria() {

		let availableMatList = ItemReform.ui.querySelector('.available_material_list');
		availableMatList.innerHTML = ''; // Clear the list before populating

		let availableMats = 0;
	    // Iterate through each reform entry in ReformInfo
	    for (const reform of ReformInfo) {
	        const baseItemId = reform.BaseItemId;

	        // Get all inventory items with the current BaseItemId
	        const items = GetInventoryItemsById(baseItemId);

	        // Check each item against the reform criteria
	        for (const item of items) {
	            // Check refining level
	            if (item.RefiningLevel < reform.NeedRefineMin || item.RefiningLevel > reform.NeedRefineMax) {
	                continue; // Skip this item if refining level doesn't match
	            }

	            // Check options
	            const optionCount = item.Options.filter(option => option.index !== 0).length;
	            if (optionCount < reform.NeedOptionNumMin) {
	                continue; // Skip this item if option count doesn't match
	            }

	            // Check empty sockets
	            const cardCount = Object.values(item.slot).filter(slot => slot !== 0).length;
	            if (reform.IsEmptySocket && cardCount > 0) {
	                continue; // Skip this item if empty socket requirement is true and there is card in it
	            }

	            // Item passes all checks, process as needed
				availableMats++;
				onAddMaterialItem(item);
	        }
	    }

		if (!availableMats) {
			showMessage(DB.getMessage(3856));
		}

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
 	* Handles the addition of an item in the UI from the available materials list.
 	*/
	function onAddMaterialItem(item)
	{
		let availableMatList = ItemReform.ui.querySelector('.available_material_list');

		let it = DB.getItemInfo(item.ITID);
		// Add item details
		var _tmpNI = document.createElement('div');
		_tmpNI.innerHTML = '<div class="item" data-index="'+item.index+'">' +
			'<div class="item_container" data-index="'+item.index+'">' +
			'<div class="icon"></div>' +
			'<div class="name">'+DB.getItemName(item, { showItemGrade: false, showItemOptions: false })+'</div>' +
			'</div></div>';
		let newItem = _tmpNI.firstChild;

		availableMatList.appendChild(newItem);

		Client.loadFile( DB.INTERFACE_PATH + 'item/' + it.identifiedResourceName + '.bmp', function(data){
			availableMatList.querySelector('.item[data-index="'+ item.index +'"] .icon').style.backgroundImage = 'url('+ data +')';
		});

		Client.loadFile( DB.INTERFACE_PATH + 'itemreform/btn_reform_item.bmp', function(data){
			availableMatList.querySelector('.item[data-index="'+ item.index +'"]').style.backgroundImage = 'url('+ data +')';
		});

	};


	/**
	 * Handles the selection of a material in the UI.
	 */
	function onMaterialSelect()
	{
		var idx  = parseInt( this.getAttribute('data-index'), 10);
		var item = Inventory.getUI().getItemByIndex(idx);

		if (!item) {
			return false;
		}

		ReformUIState.index = item.index;

		// Assuming reformInfos is available in the scope
    	SelectedReformInfo = ReformInfo.find(info => info.BaseItemId === item.ITID);

    	if (!SelectedReformInfo) {
    	    return false;
    	}

		// Update UI
		UpdatePossibleReformUI(item, SelectedReformInfo);

		let availableMatList = ItemReform.ui.querySelector('.available_material_list');

		Array.from(availableMatList.querySelectorAll('.item')).forEach(function(el) {
    	    el.classList.remove('selected');
    	    var resetIdx = parseInt(el.getAttribute('data-index'), 10);
    	    var resetItem = Inventory.getUI().getItemByIndex(resetIdx);
    	    if (resetItem) {
    	        Client.loadFile(DB.INTERFACE_PATH + 'itemreform/btn_reform_item.bmp', function(data) {
    	            availableMatList.querySelector('.item[data-index="'+ resetItem.index +'"]').style.backgroundImage = 'url('+ data +')';
    	        });
    	    }
    	});

    	// Add 'selected' class to the clicked item and change its background
    	this.classList.add('selected');
    	Client.loadFile(DB.INTERFACE_PATH + 'itemreform/btn_reform_item_press.bmp', function(data) {
    	    availableMatList.querySelector('.item[data-index="'+ item.index +'"]').style.backgroundImage = 'url('+ data +')';
    	});

		showMessage(DB.getMessage(3855));
	};


	/**
	 * Handles the hover event on a container element.
	 */
	function onHoverContainer()
	{
		if (this.classList.contains('selected')) {
       		return false;
    	}

		var idx  = parseInt( this.getAttribute('data-index'), 10);
		var item = Inventory.getUI().getItemByIndex(idx);

		if (!item) {
			return false;
		}

		let availableMatList = ItemReform.ui.querySelector('.available_material_list');

		Client.loadFile( DB.INTERFACE_PATH + 'itemreform/btn_reform_item_over.bmp', function(data){
			availableMatList.querySelector('.item[data-index="'+ item.index +'"]').style.backgroundImage = 'url('+ data +')';
		});
	};


	/**
	 * Handles the hover out event on a container element.
	 */
	function onHoverOutContainer()
	{
		if (this.classList.contains('selected')) {
       		return false;
    	}

		var idx  = parseInt( this.getAttribute('data-index'), 10);
		var item = Inventory.getUI().getItemByIndex(idx);

		if (!item) {
			return false;
		}

		let availableMatList = ItemReform.ui.querySelector('.available_material_list');

		Client.loadFile( DB.INTERFACE_PATH + 'itemreform/btn_reform_item.bmp', function(data){
			availableMatList.querySelector('.item[data-index="'+ item.index +'"]').style.backgroundImage = 'url('+ data +')';
		});
	};


	/**
	 * Updates the UI with the possible reform details for a given item and reform info.
	 *
	 * @param {Object} item - The item object.
	 * @param {Object} info - The reform info object.
	 */
	function UpdatePossibleReformUI(item, info)
	{
		// Show Reform Info Details
		ItemReform.ui.querySelector('.information_details').style.display = '';

		// Determine the result item first
		let resultItem = { ...item };  // Shallow copy of the item
		// Changes in the result item
		resultItem.ITID = info.ResultItemId;
		resultItem.RefiningLevel = item.RefiningLevel + info.ChangeRefineValue;
		if (!info.PreserveGrade) {
			resultItem.enchantgrade = 0;
		}
		if (!info.PreserveSocketItem) {
			resultItem.slot = { card1: 0, card2: 0, card3: 0, card4: 0 };
		}

		// Save the resultItem to the state object
		ReformUIState.resultItem = resultItem;

		// Update UI
		// Result Item
		let result_it = DB.getItemInfo(resultItem.ITID);
		let resultItemDiv = ItemReform.ui.querySelector('.result_item');

		var _tmpR = document.createElement('div');
		_tmpR.innerHTML = '<div class="item resultitem" data-index="'+resultItem.ITID+'"><div class="icon"></div></div>';
		let result_item_view = _tmpR.firstChild;
		resultItemDiv.innerHTML = '';
		resultItemDiv.appendChild(result_item_view);

		Client.loadFile( DB.INTERFACE_PATH + 'item/' + result_it.identifiedResourceName + '.bmp', function(data){
			resultItemDiv.querySelector('.item[data-index="'+ resultItem.ITID +'"] .icon').style.backgroundImage = 'url('+ data +')';
		});

		// Base Item
		let it = DB.getItemInfo(item.ITID);
		let baseItemDiv = ItemReform.ui.querySelector('.base_item');

		var _tmpB = document.createElement('div');
		_tmpB.innerHTML = '<div class="item" data-index="'+item.index+'"><div class="icon"></div></div>';
		let base_item_view = _tmpB.firstChild;
		baseItemDiv.innerHTML = '';
		baseItemDiv.appendChild(base_item_view);

		Client.loadFile( DB.INTERFACE_PATH + 'item/' + it.identifiedResourceName + '.bmp', function(data){
			baseItemDiv.querySelector('.item[data-index="'+ item.index +'"] .icon').style.backgroundImage = 'url('+ data +')';
		});

		var _rtext = ItemReform.ui.querySelector('.result_item_text'); _rtext.innerHTML = ''; _rtext.textContent = DB.getItemName(resultItem, {showItemOptions: false});

		// Populate Material List
		let materialDiv = ItemReform.ui.querySelector('.material_list');

		// Clear the existing items if needed
		materialDiv.innerHTML = '';

		// Sort the materials in ascending order based on MaterialItemID
		let sortedMaterials = info.Materials.slice().sort((a, b) => a.MaterialItemID - b.MaterialItemID);

		// Limit to a maximum of 6 items if needed
		let limitedMaterials = sortedMaterials.slice(0, 6);

		let withenoughMat = 0;
		// Iterate through each material in the sorted array
		limitedMaterials.forEach(material => {
			let mat_it = DB.getItemInfo(material.MaterialItemID);
			let mat_item = Inventory.getUI().getItemById(material.MaterialItemID);
			let inventory_mat_count;
			
			if (!mat_item) {
				inventory_mat_count = 0;
			} else {
				inventory_mat_count = (mat_item.type === ItemType.WEAPON || mat_item.type === ItemType.ARMOR) ? 1 : mat_item.count;
			}

			if (inventory_mat_count >= material.Amount) {
				withenoughMat++;
			}

			let itemClass = (inventory_mat_count >= material.Amount) ? '' : 'red';

			// Create a new div for each material
			var _tmpM = document.createElement('div');
			_tmpM.innerHTML = '<div class="item dummy" data-index="'+ material.MaterialItemID + '">' +
				'<div class="icon"></div>' +
				'<div class="count ' + itemClass + '">' + inventory_mat_count + ' / ' + material.Amount + '</div>' +
			'</div>';
			var newMat = _tmpM.firstChild;

			// Append the new material div to the material list
			materialDiv.appendChild(newMat);

			Client.loadFile( DB.INTERFACE_PATH + 'item/' + mat_it.identifiedResourceName + '.bmp', function(data){
				materialDiv.querySelector('.item[data-index="'+ material.MaterialItemID +'"] .icon').style.backgroundImage = 'url('+ data +')';
			});
		});

		if (withenoughMat >= limitedMaterials.length) {
			ItemReform.ui.querySelector('.reform_disabled').style.display = 'none';
			ItemReform.ui.querySelector('.reform_enabled').style.display = '';
		}
	};


	/**
	 * Handles the hover event for displaying item details in the NpcBox.
	 */
	function onHoverDetails(event)
	{
		if (SelectedReformInfo) {

			// InformationString array
			var infoText = SelectedReformInfo.InformationString.join('\n');
			
			// Display the information in NpcBox
			NpcBox.append();
			NpcBox.setText(infoText, 0);

			NpcBox.ui.style.height = '150px';
			NpcBox.ui.querySelector('.border').style.height = '139px'
			var infoDetails = ItemReform.ui.querySelector('.information_details');
			var height = infoDetails.offsetHeight;

			// Initial position update
			function updateNpcBoxPosition(e) {
				DOM.setCss(NpcBox.ui, {
					top: (e.pageY + 10) + 'px',
					left: e.pageX + 'px'
				});
			}
	
			// Add NpcBox to body so it can follow cursor correctly
			document.body.appendChild(NpcBox.ui);
	
			// Update position on mouse move
			document.addEventListener('mousemove', updateNpcBoxPosition);
	
			// Remove the event listener on mouse out
			event.currentTarget.addEventListener('mouseout', function() {
				document.removeEventListener('mousemove', updateNpcBoxPosition);
				onHoverOutDetails();
			});
		}
	};


	/**
	 * Handles the hover out event for the details.
	 */
	function onHoverOutDetails()
	{
		if (SelectedReformInfo) {
			if (DOM.isVisible(NpcBox.ui)) {
				NpcBox.remove();
			}
		}
	};


	/**
 	* Handles the result of Item Reform
 	*/
	function onItemReformResult(pkt)
	{
		if (pkt) {
			switch (pkt.result) {
				case 0:
					let item = Inventory.getUI().getItemByIndex(pkt.index);

					// Show Success effect
					var EF_Init_Par = {
						effectId: EffectConst.EF_NEW_SUCCESS,
						ownerAID: Session.AID
					};

					// Function to handle the delay
					function handleEffectAndPreview() {
					    // Show the success effect
					    EffectManager.spam(EF_Init_Par);

						if (ReformUIState.timeout) {
							clearTimeout(ReformUIState.timeout);
						}

					    // Delay the execution of showItemPreview by 3 seconds
					    ReformUIState.timeout = setTimeout(function() {
					        // Show Item Preview
					        showItemPreview(item);
					    }, 3000); // 3000 milliseconds = 3 seconds
					}

					// Call the function to handle effect and preview
					handleEffectAndPreview();

					// Close UI
					onRequestReformClose();
					break;
				default:
					break;
			}
		}
	};


	/**
 	* Handles the close request of the Laphine UI and sends the appropriate packet.
 	*/
	function onRequestReformClose()
	{
		ItemReform.remove();
		
		var pkt = new PACKET.CZ.CLOSE_REFORM_UI();
		Network.sendPacket(pkt);
	};


	/**
 	* Handles showing of message for notifications.
 	*/
	function showMessage(message)
	{
		ItemReform.ui.querySelector('.info_msg').textContent = message;
		ItemReform.ui.querySelector('.some_notifs').style.display = '';
	};


	/**
 	* Handles the item reform request by preparing and sending the packet.
 	*/
	function onRequestItemReform()
	{
		var pkt;
	    pkt = new PACKET.CZ.ITEM_REFORM();
	    pkt.ITID = ReformUIState.itemId;
		pkt.index = ReformUIState.index;

	    Network.sendPacket(pkt);
	};


	/**
	 * Show item name when mouse is over
	 */
	function onItemOver(event)
	{
		var idx  = parseInt( this.getAttribute('data-index'), 10);
		var item;

    	if (this.classList.contains('dummy')) {
    	    // Get the item using item.ITID as the only member
    	    item = { ITID: idx, IsIdentified: 1 };
    	} else if (this.classList.contains('resultitem')) {
			item = ReformUIState.resultItem;
		} else {
    	    // Normal way to get the item by index
    	    item = Inventory.getUI().getItemByIndex(idx);
    	}

		// Get back data
		var overlay = ItemReform.ui.querySelector('.overlay');

		// Display box
		overlay.style.display = '';
		overlay.textContent = DB.getItemName(item, {showItemOptions: false});

		if (item.IsIdentified) {
			overlay.classList.remove('grey');
		}
		else {
			overlay.classList.add('grey');
		}

		// Get the offset of the UI container
		var uiRect = ItemReform.ui.getBoundingClientRect();

		// Update overlay position based on mouse coordinates and UI offset
		function updateOverlayPosition(e) {
			DOM.setCss(overlay, {
				top: (e.pageY - uiRect.top + 10) + 'px',
				left: (e.pageX - uiRect.left + 10) + 'px'
			});
		}
	
		// Initial position update
		updateOverlayPosition(event);
	
		// Update position on mouse move
		document.addEventListener('mousemove', updateOverlayPosition);
	
		// Remove the event listener on mouse out
		event.currentTarget.addEventListener('mouseout', function() {
			document.removeEventListener('mousemove', updateOverlayPosition);
			onItemOut();
		});
	};


	/**
	 * Hide the item name
	 */
	function onItemOut()
	{
		ItemReform.ui.querySelector('.overlay').style.display = 'none';
	};


	/**
	 * Get item info (open description window)
	 */
	function onItemInfo(event)
	{
		event.stopImmediatePropagation();

		var idx = parseInt(this.getAttribute('data-index'), 10);
		var item;

    	if (this.classList.contains('dummy')) {
    	    // Get the item using item.ITID as the only member
    	    item = { ITID: idx, IsIdentified: 1 };
    	} else if (this.classList.contains('resultitem')) {
			item = ReformUIState.resultItem;
		} else {
    	    // Normal way to get the item by index
    	    item = Inventory.getUI().getItemByIndex(idx);
    	}

		if (!item) {
			return false;
		}

		if (item) {
			showItemPreview(item);
		}

		return false;
	};


	/**
	 * Displays a preview of an item and its comparison item, if available.
	 *
	 * @param {Object} item - The item to display.
	 */
	function showItemPreview(item)
	{
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
	Network.hookPacket( PACKET.ZC.OPEN_REFORM_UI,			onOpenReformUI );
	Network.hookPacket( PACKET.ZC.ITEM_REFORM_ACK,			onItemReformResult );


	/**
	 * Create component and export it
	 */
	return UIManager.addComponent(ItemReform);

});
