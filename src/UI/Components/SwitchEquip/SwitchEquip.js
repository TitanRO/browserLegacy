/**
 * UI/Components/SwitchEquip/SwitchEquip.js
 *
 * Chararacter Switch Equipment Window
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */
define(function(require)
{
	'use strict';

	var DOM       = require('Utils/DOM');

	/**
	 * Dependencies
	 */
	var DB                 = require('DB/DBManager');
	var EquipLocation      = require('DB/Items/EquipmentLocation');
	var Network            = require('Network/NetworkManager');
	var PACKET             = require('Network/PacketStructure');
	var ItemType           = require('DB/Items/ItemType');
	var Client             = require('Core/Client');
	var Session            = require('Engine/SessionStorage');
	var Renderer           = require('Renderer/Renderer');
	var Camera             = require('Renderer/Camera');
	var SpriteRenderer     = require('Renderer/SpriteRenderer');
	var UIVersionManager   = require('UI/UIVersionManager');
	var UIManager          = require('UI/UIManager');
	var UIComponent        = require('UI/UIComponent');
	var ItemInfo           = require('UI/Components/ItemInfo/ItemInfo');
	var htmlText           = require('text!./SwitchEquip.html');
	var cssText            = require('text!./SwitchEquip.css');
	var getModule          = require;

	/**
	 * Create Component
	 */
	var SwitchEquip = new UIComponent( 'SwitchEquip', htmlText, cssText );

	/**
	 * @var {Array} switchequipment list
	 */
	SwitchEquip._list = {};

	/**
	 * @var {CanvasRenderingContext2D} canvas context
	 */
	var _swapctx = [];

	/**
	 * @var {Variable} holder for tab
	 */
    var currentEquipTabId = 'general';


	/**
	 * Initialize UI
	 */
	SwitchEquip.init = function init()
	{
		var _canvases = this.ui.querySelectorAll('canvas');
		_swapctx.push(_canvases[0].getContext('2d'));
		_swapctx.push(_canvases[1].getContext('2d'));
	
		// drag, drop items
		this.ui.addEventListener('dragover', onDragOver);
		this.ui.addEventListener('dragleave', onDragLeave);
		this.ui.addEventListener('drop', onDrop);

		this.ui.querySelector('.closeswap').addEventListener('click', function(){SwitchEquip.toggle();});
		this.ui.querySelector('.onswap').addEventListener('click', function(){SwitchEquip.RequestSwitch();});

		// Set the active tab based on Equipment UI's current tab
		var Equipment = require('UI/Components/Equipment/Equipment');
		var currentEquipTabId = Equipment.getUI().getCurrentTabId();
		
		// Set the active tab and content div based on EquipmentV2's current tab
		SwitchEquip.showSwapTab(currentEquipTabId);

		// Bind items
		var _swapContent = this.ui.querySelector('.swapcontent');
		DOM.addDelegatedEvent(_swapContent, 'contextmenu', '.item', onSwitchEquipInfo);
		DOM.addDelegatedEvent(_swapContent, 'dblclick', '.item', onSwitchEquipUnEquip);
		DOM.addDelegatedEvent(_swapContent, 'mouseover', 'button', onSwitchEquipOver);
		DOM.addDelegatedEvent(_swapContent, 'mouseout', 'button', onSwitchEquipOut);
	};


	/**
 	* Show the swap tab with the given tabId, hiding other tabs.
 	* 
 	* @param {string} tabId - The ID of the tab to show.
 	*/
	SwitchEquip.showSwapTab = function showSwapTab(tabId) {
		var swapTabId = 'swap' + tabId;
		var swapContentDivs = {
			'swapgeneral': document.getElementById('swapgeneral'),
			'swapcostume': document.getElementById('swapcostume')
		};
	
		for (var id in swapContentDivs) {
			if (id == swapTabId) {
				swapContentDivs[id].classList.remove('hide');
			} else {
				swapContentDivs[id].classList.add('hide');
			}
		}
	};


	/**
	 * Append to body
	 */
	SwitchEquip.onAppend = function onAppend()
	{
		// Set the active tab based on Equipment UI's current tab
		var Equipment = require('UI/Components/Equipment/Equipment');
		var currentEquipTabId = Equipment.getUI().getCurrentTabId();

		// Set the active tab and content div based on EquipmentV2's current tab
		SwitchEquip.showSwapTab(currentEquipTabId);

		if (DOM.isVisible(this.ui.querySelector('canvas'))) {
			Renderer.render(swaprender);
		}
	};


	/**
	 * Remove Inventory from window (and so clean up items)
	 */
	SwitchEquip.onRemove = function onRemove()
	{
		// Stop rendering
		Renderer.stop(swaprender);

		// Clean equipments
		SwitchEquip._list = {};
		this.ui.querySelector('.col1, .col3, .ammo').innerHTML = '';
	};


	/**
	 * Process shortcut
	 *
	 * @param {object} key
	 */
	SwitchEquip.onShortCut = function onShurtCut( key )
	{
		switch (key.cmd) {
			case 'TOGGLE':
				DOM.toggleDisplay(this.ui);
				break;
		}
	};


	/**
 	* Toggle the visibility of the UI, 
 	* rendering or stopping the renderer based on visibility.
 	*/
	SwitchEquip.toggle = function toggle()
	{
		DOM.toggleDisplay(this.ui);

		if (DOM.isVisible(this.ui)) {
			Renderer.render(swaprender);
			this.focus();
		}
		else {
			Renderer.stop(swaprender);
		}
	};


	/**
	 * Add an equipment to the window
	 *
	 * @param {Item} item
	 * @param {item.Location} location
 	 * @param {boolean} inSwitchList
	 */
	SwitchEquip.equip = function equip( item, location, inSwitchList )
	{
		var it            = DB.getItemInfo( item.ITID );
		item.equipped = location;
		SwitchEquip._list[item.index] = item;

		function add3Dots(string, limit) {
			var dots = "...";
			if (string.length > limit) {
				string = string.substring(0,limit) + dots;
			}

			return string;
		}

		this.ui.querySelector(getSelectorFromLocation(location)).innerHTML =
			'<div class="item" data-index="'+ item.index +'">' +
				'<button></button>' +
				'<span class="itemName">' + add3Dots(DOM.escapeHtml(DB.getItemName(item)), 19) + '</span>' +
			'</div>'
		;

		Client.loadFile( DB.INTERFACE_PATH + 'item/' + it.identifiedResourceName + '.bmp', function(data){
			var button = this.ui.querySelector('.item[data-index="'+ item.index +'"] button');
        	button.style.backgroundImage = 'url('+ data +')';
			if (!inSwitchList) {
				button.style.filter = 'grayscale(100%)';
			}
		}.bind(this));
	};


	/**
	 * Remove equipment from window
	 *
	 * @param {number} item index
	 * @param {number} item location
	 */
	SwitchEquip.unEquip = function unEquip( index, location )
	{
		var selector = getSelectorFromLocation( location );
		var item     = SwitchEquip._list[ index ];
		item.equipped = 0;

		this.ui.querySelector( selector ).innerHTML = '';
    	delete SwitchEquip._list[index];
	};


	/**
	 * Rendering character
	 */
	var swaprender = function swaprenderClosure()
	{

		var _cleanColor = new Float32Array([1.0, 1.0, 1.0, 1.0]);
		var _savedColor = new Float32Array(4);
		var _animation  = {
			tick:  0,
			frame: 0,
			repeat:true,
			play:  true,
			next:  false,
			delay: 0,
			save:  false
		};

		return function swaprender()
		{
			var Entity = getModule('Renderer/Entity/Entity');
			var swap_character = new Entity();
			swap_character.set({
				GID: Session.Entity.GID + '_SWAPEQUIP',
				objecttype: swap_character.constructor.TYPE_PC,
				job: Session.Entity.job,
				sex: Session.Entity.sex,
				name: "",
				hideShadow: true,
				head:   Session.Entity.head,
				headpalette: Session.Entity.headpalette,
				bodypalette: Session.Entity.bodypalette,
			});

			var Equipment = require('UI/Components/Equipment/Equipment');
			var currentEquipTabId = Equipment.getUI().getCurrentTabId();

			// General Tab only shows normal headgears
			if (currentEquipTabId === 'general') {
				swap_character.accessory  = SwitchEquip.checkEquipLoc(EquipLocation.HEAD_BOTTOM);
				swap_character.accessory2 = SwitchEquip.checkEquipLoc(EquipLocation.HEAD_TOP);
				swap_character.accessory3 = SwitchEquip.checkEquipLoc(EquipLocation.HEAD_MID);
				swap_character.robe = SwitchEquip.checkEquipLoc(EquipLocation.GARMENT);
			}
			// Costume Tab only shows costume headgears
			else if (currentEquipTabId === 'costume') {
				swap_character.accessory  = SwitchEquip.checkEquipLoc(EquipLocation.COSTUME_HEAD_BOTTOM);
				swap_character.accessory2 = SwitchEquip.checkEquipLoc(EquipLocation.COSTUME_HEAD_TOP);
				swap_character.accessory3 = SwitchEquip.checkEquipLoc(EquipLocation.COSTUME_HEAD_MID);
				swap_character.robe = SwitchEquip.checkEquipLoc(EquipLocation.COSTUME_ROBE);
			}

			_savedColor.set(swap_character.effectColor);
			swap_character.effectColor.set(_cleanColor);

			// Set action
			Camera.direction = 0;
			swap_character.direction = 0;
			swap_character.headDir   = 0;
			swap_character.action    = swap_character.ACTION.IDLE;
			swap_character.animation = _animation;

			// Rendering
			for (var i = 0; i < _swapctx.length; i++) {
				var ctx = _swapctx[i];
				SpriteRenderer.bind2DContext( ctx, 30, 130 );
				ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height );
				swap_character.renderEntity(ctx);
			}
		};
	}();


	/**
	 * Find elements in html base on item location
	 *
	 * @param {number} location
	 * @returns {string} selector
	 */
	function getSelectorFromLocation( location )
	{
		var selector = [];

		if (location & EquipLocation.HEAD_TOP)    selector.push('.swap_head_top');
		if (location & EquipLocation.HEAD_MID)    selector.push('.swap_head_mid');
		if (location & EquipLocation.HEAD_BOTTOM) selector.push('.swap_head_bottom');
		if (location & EquipLocation.ARMOR)       selector.push('.swap_armor');
		if (location & EquipLocation.WEAPON)      selector.push('.swap_weapon');
		if (location & EquipLocation.SHIELD)      selector.push('.swap_shield');
		if (location & EquipLocation.GARMENT)     selector.push('.swap_garment');
		if (location & EquipLocation.SHOES)       selector.push('.swap_shoes');
		if (location & EquipLocation.ACCESSORY1)  selector.push('.swap_accessory1');
		if (location & EquipLocation.ACCESSORY2)  selector.push('.swap_accessory2');
		if (location & EquipLocation.AMMO)        selector.push('.swap_ammo');

		// Costume Tab
		if (location & EquipLocation.COSTUME_HEAD_TOP)    selector.push('.swap_costume_head_top');
		if (location & EquipLocation.COSTUME_HEAD_MID)    selector.push('.swap_costume_head_mid');
		if (location & EquipLocation.COSTUME_HEAD_BOTTOM) selector.push('.swap_costume_head_bottom');
		if (location & EquipLocation.SHADOW_ARMOR)        selector.push('.swap_shadow_armor');
		if (location & EquipLocation.SHADOW_WEAPON)       selector.push('.swap_shadow_weapon');
		if (location & EquipLocation.SHADOW_SHIELD)       selector.push('.swap_shadow_shield');
		if (location & EquipLocation.COSTUME_ROBE)     	  selector.push('.swap_shadow_garment');
		if (location & EquipLocation.SHADOW_SHOES)        selector.push('.swap_shadow_shoes');
		if (location & EquipLocation.SHADOW_R_ACCESSORY_SHADOW)   selector.push('.swap_shadow_accessory1');
		if (location & EquipLocation.SHADOW_L_ACCESSORY_SHADOW)   selector.push('.swap_shadow_accessory2');

		return selector.join(', ');
	};


	/**
	 * Drag an item over the equipment, show where to place the item
	 */
	function onDragOver( event )
	{
		if (window._OBJ_DRAG_) {
			var data = window._OBJ_DRAG_;
			var item, selector, ui;

			// Just support items for now ?
			if (data.type === 'item') {
				item = data.data;

				if ((item.type === ItemType.WEAPON || item.type === ItemType.ARMOR) &&
				    item.IsIdentified && !item.IsDamaged) {
					selector = getSelectorFromLocation( 'location' in item ? item.location : item.WearLocation);
					ui       = SwitchEquip.ui.querySelector(selector);

					Client.loadFile( DB.INTERFACE_PATH + 'basic_interface/item_invert.bmp', function(data){
						ui.style.backgroundImage = 'url('+ data + ')';
					});
				}
			}
		}

		event.stopImmediatePropagation();
		return false;
	};


	/**
	 * Drag out the window
	 */
	function onDragLeave( event )
	{
		SwitchEquip.ui.querySelector('td').style.backgroundImage = 'none';
		event.stopImmediatePropagation();
		return false;
	};


	/**
	 * Drop an item in the equipment, equip it if possible
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

		// Just support items for now ?
		if (data && data.type === 'item') {
			item = data.data;

			if ((item.type === ItemType.WEAPON || item.type === ItemType.ARMOR || item.type === ItemType.AMMO) &&
			    item.IsIdentified && !item.IsDamaged) {
			    SwitchEquip.ui.querySelector('td').style.backgroundImage = 'none';
				SwitchEquip.onAddSwitchEquip( item.index, 'location' in item ? item.location : item.WearState );
			}
		}

		event.stopImmediatePropagation();
		return false;
	};


	/**
	 * Right click on an item
	 */
	function onSwitchEquipInfo( event )
	{
		var index = parseInt(this.getAttribute('data-index'), 10);
		var item  = SwitchEquip._list[index];

		if (item) {

			// Don't add the same UI twice, remove it
			if (ItemInfo.uid === item.ITID) {
				ItemInfo.remove();
			}

			// Add ui to window
			else {
				ItemInfo.append();
				ItemInfo.uid = item.ITID;
				ItemInfo.setItem(item);
			}
		}

		event.stopImmediatePropagation();
		return false;
	};


	/**
	 * Double click on an equipment to remove it
	 */
	function onSwitchEquipUnEquip()
	{
		var index = parseInt(this.getAttribute('data-index'), 10);
		SwitchEquip.onRemoveSwitchEquip( index );
		SwitchEquip.ui.querySelector('.switchoverlay').style.display = 'none';
	};


	/**
	 * When mouse is over an equipment, display the item name
	 */
	function onSwitchEquipOver()
	{
		var idx  = parseInt( this.parentNode.getAttribute('data-index'), 10);
		var item = SwitchEquip._list[idx];

		if (!item) {
			return;
		}

		// Get back data
		var overlay = SwitchEquip.ui.querySelector('.switchoverlay');
		var pos     = DOM.getPosition(this);

		// Possible jquery error
		if (!pos.top && !pos.left) {
			return;
		}

		// Display box
		overlay.style.display = '';
		overlay.style.top = pos.top-22; overlay.style.left = pos.left-22;
		overlay.textContent = DB.getItemName(item);
	};


	/**
	 * Remove the item name
	 */
	function onSwitchEquipOut()
	{
		SwitchEquip.ui.querySelector('.switchoverlay').style.display = 'none';
	};


	/**
 	* Update the owner name for the equipment items
 	*/
	SwitchEquip.onUpdateOwnerName = function(){
		for (var index in SwitchEquip._list) {
			var item = SwitchEquip._list[index];
			if(item.slot && [0x00FF, 0x00FE, 0xFF00].includes(item.slot.card1)){
				SwitchEquip.ui.querySelector('.item[data-index="'+ index +'"] .itemName').textContent =  DOM.escapeHtml(DB.getItemName(item) );
			}
		}
	};


	/**
 	* Get the number of equipment items excluding AMMO location
 	*
 	* @returns {number} The number of equipment items
 	*/
	SwitchEquip.getNumber = function(){
		var num = 0;
		for (var key in SwitchEquip._list) {
			if(SwitchEquip._list[key].location && SwitchEquip._list[key].location != EquipLocation.AMMO){
				num++;
			}
		}
		return num;
	};


	/**
 	* Check if a specific location
 	*
 	* @param {number} location The location to check
 	* @returns {number} The sprite number of the item in the specified location, or 0 if not equipped
 	*/
	SwitchEquip.checkEquipLoc = function checkEquipLoc( location )
	{
		var Inventory = require('UI/Components/Inventory/Inventory');

		var switchList = Inventory.getUI().equipswitchlist;
		for (var i = 0; i < switchList.length; i++) {
	        var item = switchList[i];
	        if (item.location & location) {
				return item.wItemSpriteNumber;
			}
		}

		return 0;
	};


	/**
 	* Send an equipment switch request to the server.
 	*/
	function sendEquipSwitchRequest() {
	    var pkt = new PACKET.CZ.REQ_FULLSWITCH;
	    Network.sendPacket(pkt);
	};


	/**
 	* Request an equipment switch button
 	* Disabling the button temporarily and updating its background image.
 	*/
	SwitchEquip.RequestSwitch = function()
	{
		// Send the equip switch request
		sendEquipSwitchRequest();

		// Disable the button
		var button = document.getElementById('swap-button');
		button.disabled = true;
		button.classList.add('disabled');

		Client.loadFile(DB.INTERFACE_PATH + 'swap_equipment/btn_change2_disable.bmp', function(data){
			button.style.backgroundImage = 'url(' + data + ')';
		});

		// Re-enable the button and revert the background image after 10 seconds
		setTimeout(function() {
			button.disabled = false;
			button.classList.remove('disabled');
			Client.loadFile(DB.INTERFACE_PATH + 'swap_equipment/btn_change2_normal.bmp', function(data){
				button.style.backgroundImage = 'url(' + data + ')';
			});
		}, 10000); // 10000 milliseconds = 10 seconds
	};


	/**
	 * Method to define
	 */
	SwitchEquip.onRemoveSwitchEquip = function onRemoveSwitchEquip(/* index */){};
	SwitchEquip.onAddSwitchEquip    = function onAddSwitchEquip(/* index, location */){};


	/**
	 * Create component and export it
	 */
	return UIManager.addComponent(SwitchEquip);
});
