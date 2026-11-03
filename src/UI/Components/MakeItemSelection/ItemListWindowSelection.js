/**
 * UI/Components/MakeItemSelection/ItemListWindowSelection.js
 *
 * ItemListWindowSelection windows
 *
 * @author Francisco Wallison
 */
 define(function(require)
 {
     'use strict';
 
 
     /**
      * Dependencies
      */
     var DB          = require('DB/DBManager');
     var Preferences = require('Core/Preferences');     
     var ConvertItems= require('UI/Components/MakeItemSelection/ItemConvertSelection/ConvertItems');
     var Mouse       = require('Controls/MouseEventHandler');
     var InputBox    = require('UI/Components/InputBox/InputBox');
     var Client      = require('Core/Client');
     var Renderer    = require('Renderer/Renderer');
     var UIManager   = require('UI/UIManager');
     var UIComponent = require('UI/UIComponent');
     var Inventory   = require('UI/Components/Inventory/Inventory');
     var htmlText    = require('text!./ItemListWindowSelection.html');
     var cssText     = require('text!./ItemListWindowSelection.css');
     var DOM         = require('Utils/DOM');
     var getModule   = require;

    
    /**
	 * @var {Preference} structure to save
	 */
	var _preferences = Preferences.get('ItemListWindowSelection', {
		x:      200,
		y:      500,
		height:   8,
        select_all: false
	}, 1.0);

    /**
     * Create ItemListWindowSelection namespace
     */
    var ItemListWindowSelection = new UIComponent( 'ItemListWindowSelection', htmlText, cssText );

    /**
     * Store Convert Items items
     */
     ItemListWindowSelection.list = [];
 

    /**
     * Initialize UI
     */
    ItemListWindowSelection.init = function init()
    {
        // Show at center.
        DOM.setCss(this.ui, {
            top:  (Renderer.height- 200)/2,
            left: (Renderer.width - 655)/2
        });

        this.list  = [];

        this.draggable(this.ui.querySelector('.head'));
        this.ui.querySelector('.footer .extend').addEventListener('mousedown', onResize);
        this.ui.querySelector('.event_selectall').addEventListener('mousedown', onToggleSelectAmount);


        resizeHeight(_preferences.height);
             
        this.ui.addEventListener('drop', onDrop);
        this.ui.addEventListener('dragover', stopPropagation);
        var _ilwContent = this.ui.querySelector('.container .content');
        _ilwContent.addEventListener('mousewheel', onScroll);
        _ilwContent.addEventListener('DOMMouseScroll', onScroll);
        DOM.addDelegatedEvent(_ilwContent, 'mouseover', '.item', onItemOver);
        DOM.addDelegatedEvent(_ilwContent, 'mouseout', '.item', onItemOut);
        DOM.addDelegatedEvent(_ilwContent, 'dragstart', '.item', onItemDragStart);
        DOM.addDelegatedEvent(_ilwContent, 'dragend', '.item', onItemDragEnd);
        DOM.addDelegatedEvent(_ilwContent, 'contextmenu', '.item', onItemInfo);

        this.draggable(this.ui.querySelector('.titlebar'));
        
        this.setList(Inventory.getUI().list);
     };


	/**
	 * Apply preferences once append to body
	 */
	ItemListWindowSelection.onAppend = function OnAppend()
	{
		this.setList(Inventory.getUI().list);
		ConvertItems.append();
	}
 
 
     /**
      * Add elements to the list
      *
      * @param {Array} list object to display
      */
     ItemListWindowSelection.setList = function setList(listItems)
     {
        this.ui.querySelector('.container .content').innerHTML = '';
        this.list = listItems;
        var i, count;

		for (i = 0, count = listItems.length; i < count; ++i) {
			this.addItem(listItems[i]);
		}
       
     };
 

    ItemListWindowSelection.addItem = function addItem( item ){

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


    /**
     * Add elements to the list
     *
     * @param {Array} list object to display
     */
    ItemListWindowSelection.updateList = function UpdateList(item)
    {
        this.list.push(item);
        var i, count;
		this.ui.querySelector('.item').remove();

        for (i = 0, count = this.list.length; i < count; ++i) {
            this.addItem(this.list[i]);
        }

    };

     /**
	 * Extend ItemListWindowSelection window size
	 */
	function onResize()
	{
		var ui         = ItemListWindowSelection.ui;
		var top        = DOM.getPosition(ui).top;
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
		var _resizeHandler = function(event){
			if (event.which === 1) {
				clearInterval(_Interval);
				window.removeEventListener('mouseup', _resizeHandler);
			}
		};
		window.addEventListener('mouseup', _resizeHandler);
	}


    /**
	 * Extend ItemListWindowSelection window size
	 */
	function resizeHeight(height)
	{
		height = Math.min( Math.max(height, 8), 17);

		ItemListWindowSelection.ui.querySelector('.container .content').style.height = height * 32;
		ItemListWindowSelection.ui.style.height = 31 + 19 + height * 32;
	}
     
    
     /**
      * Set new window name
      *
      * @param {string} title
      */
     ItemListWindowSelection.setTitle = function setTitle( title )
     {
         this.ui.querySelector('.head .text').textContent =  title ;
     };
 
    /**
     * Insert material to creation
     *
     * @param {object} Item
     */
    ItemListWindowSelection.addReturnMaterial = function AddReturnMaterial( item )
    {
        var object = getItemIndexById(item.index);

        if(object < 0){            
            this.updateList(item);            
        }else{            
            this.updateItem(item.index, item.count)
        }
    };
     
    /**
	 * Remove item from Storage
	 *
	 * @param {number} index in Storage
	 */
    ItemListWindowSelection.removeItem = function removeItem( index, count )
	{
		var i = getItemIndexById(index);
		var item;

		// Not found
		if (i < 0) {
			return null;
		}

		if (this.list[i].count) {
			this.list[i].count -= count;

			if (this.list[i].count > 0) {
				this.ui.querySelector('.item[data-index="'+ index +'"] .count').textContent = this.list[i].count;
				return this.list[i];
			}
		}

		// Remove item
		item = this.list[i];
		this.list.splice( i, 1 );
		this.ui.querySelector('.item[data-index="'+ index +'"]').remove();

		return item;
	};


    /**
	 * Remove item from inventory
	 *
	 * @param {number} index in inventory
	 * @param {number} count
	 */
     ItemListWindowSelection.updateItem = function UpdateItem( index, count )
     {
         var item = this.getItemByIndex(index);
 
         if (!item) {
             return;
         }
 
         item.count = item.count+count; // update item list
 
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
	 * Search in a list for an item by its index
	 *
	 * @param {number} index
	 * @returns {Item}
	 */
    ItemListWindowSelection.getItemByIndex = function getItemByIndex( index )
	{
		var i, count;
		var list = this.list;

		for (i = 0, count = list.length; i < count; ++i) {
			if (list[i].index === index) {
				return list[i];
			}
		}

		return null;
	};


    ItemListWindowSelection.getSelectAll = function getSelectAll()
    {
        return _preferences.select_all;
    }

    /**
	 * Mouse mouve out of an item, hide title description
	 */
	function onItemOut()
	{
		ItemListWindowSelection.ui.querySelector('.overlay').style.display = 'none';
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
				from: 'ItemListWindowSelection',
				data: ItemListWindowSelection.list[i]
			})
		);

		onItemOut();
	}


    	/**
	 * Option to automatically buy/sell alls items instead of specify the amount
	 */
	function onToggleSelectAmount()
	{
		_preferences.select_all = !_preferences.select_all;

		Client.loadFile(DB.INTERFACE_PATH + 'checkbox_' + (_preferences.select_all ? 1 : 0) + '.bmp', function(data) {
			this.style.backgroundImage = 'url(' + data + ')';
		}.bind(ItemListWindowSelection.ui.querySelector('.selectall')));
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

		// Don't add the same UI twice, remove it
		if (ItemInfo.uid === ItemListWindowSelection.list[i].ITID) {
			ItemInfo.remove();
		}

		// Add ui to window
		ItemInfo.append();
		ItemInfo.uid = ItemListWindowSelection.list[i].ITID;
		ItemInfo.setItem( ItemListWindowSelection.list[i] );

		return false;
	}


    /**
	 * Stop the drag/drop on an item
	 */
	function onItemDragEnd()
	{
		delete window._OBJ_DRAG_;
	}

    /**
	 * Get item index in list base on it's ID
	 *
	 * @param {number} item id
	 */
	function getItemIndexById( index )
	{
		var i, count;

		for (i = 0, count = ItemListWindowSelection.list.length; i < count; ++i) {
			if (ItemListWindowSelection.list[i].index === index) {
				return i;
			}
		}

		return -1;
	}
 
     /**
      * Drop an item from storage to inventory
      *
      * @param {event}
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
         if (!data || data.type !== 'item' || data.from !== 'ConvertItems') {
             return false;
         }
 
         item = data.data;

        // validar se esta marcado
        var valid_select_all = !ItemListWindowSelection.getSelectAll();

        if (item.count > 1 && valid_select_all) {
			InputBox.append();
			InputBox.setType('number', false, item.count);
			InputBox.onSubmitRequest = function OnSubmitRequest( count ) {
				InputBox.remove();
				                
                ConvertItems
                .removeItem(
                    item.index,
                    parseInt(count, 10 )
                );			
                item.count = parseInt(count, 10 );
                ItemListWindowSelection.addReturnMaterial( item );
			};
			return false;
		}

        ConvertItems
            .removeItem(
                item.index,
                item.count
            );
 
         ItemListWindowSelection.addReturnMaterial( item );
         return false;
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
		var item    = ItemListWindowSelection.list[i];
		var pos     = DOM.getPosition(this);
		var overlay = ItemListWindowSelection.ui.querySelector('.overlay');

		// Display box
		overlay.style.display = '';
		overlay.style.top = pos.top-10; overlay.style.left = pos.left+35;
		overlay.textContent = DB.getItemName(item) + ' ' + ( item.count || 1 ) + ' ea';

		if (item.IsIdentified) {
			overlay.classList.remove('grey');
		}
		else {
			overlay.classList.add('grey');
		}
	}
    

	ItemListWindowSelection.onItemListWindowSelected   = function onItemListWindowSelected(){};
     
     /**
      * Create component based on view file and export it
      */
     return UIManager.addComponent(ItemListWindowSelection);
 });
 
