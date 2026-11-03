/**
 * UI/Components/MakeItemSelection/ItemConvertSelection/ConvertItems.js
 *
 * ConvertItems windows
 *
 * @author Francisco Wallison
 */
 define(function(require)
 {
     'use strict';
 
 
     /**
      * Dependencies
      */
     var DB          		= require('DB/DBManager');
     var Preferences 		= require('Core/Preferences');
     var Mouse       		= require('Controls/MouseEventHandler');
     var Client      		= require('Core/Client');
     var Renderer    		= require('Renderer/Renderer');
     var UIManager   		= require('UI/UIManager');
     var UIComponent 		= require('UI/UIComponent');
     var InputBox    		= require('UI/Components/InputBox/InputBox');
	 var MakeModelMessage 	= require('UI/Components/MakeItemSelection/ItemConvertSelection/MakeModelMessage/MakeModelMessage');
     var htmlText    		= require('text!./ConvertItems.html');
     var cssText     		= require('text!./ConvertItems.css');
     var DOM                = require('Utils/DOM');
     var getModule   		= require;
 
    /**
	 * @var {Preference} structure to save
	 */
	var _preferences = Preferences.get('ConvertItems', {
		x:      200,
		y:      500,
		height:   8
	}, 1.0);

     /**
      * Create ConvertItems namespace
      */
     var ConvertItems = new UIComponent( 'ConvertItems', htmlText, cssText );


    /**
	 * Store Convert Items items
	 */
    ConvertItems.material = [];
      
     /**
      * Initialize UI
      */
     ConvertItems.init = function init()
     {
         // Show at center.
         DOM.setCss(this.ui, {
             top:  (Renderer.height- 200)/2,
             left: (Renderer.width - 10)/2
         });
 
         this.material = [];
 
         this.draggable(this.ui.querySelector('.head'));
         this.ui.querySelector('.footer .extend').addEventListener('mousedown', onResize);
		 this.ui.querySelector('.trade').addEventListener('click', onMessageModel); 
		 this.ui.querySelector('.cancel').addEventListener('click', onClose);
		 
         resizeHeight(_preferences.height);
         
        this.ui.addEventListener('drop', onDrop);
        this.ui.addEventListener('dragover', stopPropagation);
        var _ciContent = this.ui.querySelector('.container .content');
        _ciContent.addEventListener('mousewheel', onScroll);
        _ciContent.addEventListener('DOMMouseScroll', onScroll);
        DOM.addDelegatedEvent(_ciContent, 'mouseover', '.item', onItemOver);
        DOM.addDelegatedEvent(_ciContent, 'mouseout', '.item', onItemOut);
        DOM.addDelegatedEvent(_ciContent, 'dragstart', '.item', onItemDragStart);
        DOM.addDelegatedEvent(_ciContent, 'dragend', '.item', onItemDragEnd);
        DOM.addDelegatedEvent(_ciContent, 'contextmenu', '.item', onItemInfo);


        this.draggable(this.ui.querySelector('.titlebar'));
     };


	/**
	 * Apply preferences once append to body
	 */
	ConvertItems.onAppend = function OnAppend()
	{
		this.material = [];
		this.ui.querySelector('.item').remove();
	}
 
     ConvertItems.addItem = function addItem( item ){
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

        return true;
     }


     /**
	 * Remove item from inventory
	 *
	 * @param {number} index in inventory
	 * @param {number} count
	 */
    ConvertItems.updateItem = function UpdateItem( index, count )
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
		this.material.splice( this.material.indexOf(item), 1 );
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
    ConvertItems.getItemByIndex = function getItemByIndex( index )
	{
		var i, count;
		var list = ConvertItems.material;

		for (i = 0, count = list.length; i < count; ++i) {
			if (list[i].index === index) {
				return list[i];
			}
		}

		return null;
	};

	ConvertItems.validItemSend = function validItemSend(valid_material)
	{
		ConvertItems.remove();
		getModule('UI/Components/MakeItemSelection/ItemListWindowSelection')
			.remove();
		MakeModelMessage
			.remove();			

		let inforMaterialList = {
			Type: 0,
			Action: valid_material ? 1 : 0,
			MaterialList: valid_material ? this.material : [],
		}

		
		getModule('UI/Components/MakeItemSelection/ItemListWindowSelection')
			.onItemListWindowSelected(inforMaterialList);
	};

	
	
	function onMessageModel(event){
		event.stopImmediatePropagation();
		MakeModelMessage.append();
	}

	function onClose(event){
		event.stopImmediatePropagation();
		ConvertItems.validItemSend(false);
	}

     /**
	 * Extend ConvertItems window size
	 */
	function onResize()
	{
		var ui         = ConvertItems.ui;
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
	 * Extend ConvertItems window size
	 */
	function resizeHeight(height)
	{
		height = Math.min( Math.max(height, 8), 17);

		ConvertItems.ui.querySelector('.container .content').style.height = height * 32;
		ConvertItems.ui.style.height = 31 + 19 + height * 32;
	}
 
     /**
      * Free variables once removed from HTML
      */
     ConvertItems.onRemove = function onRemove()
     {
         this.index = 0;
     };
 
 
     /**
      * Set new window name
      *
      * @param {string} title
      */
     ConvertItems.setTitle = function setTitle( title )
     {
         this.ui.querySelector('.head .text').textContent =  title ;
     };
 
 
     /**
      * Insert material to creation
      *
      * @param {object} Item
      */
     ConvertItems.addMaterial = function AddMaterial( item )
     {
        var object = getItemIndexById(item.index);

        if(object < 0){
            if (this.addItem(item)) {
                this.material.push(item);
            }
        }else{            
            this.updateItem(item.index, item.count)
        }
     };



     /**
	 * Remove item from Storage
	 *
	 * @param {number} index in Storage
	 */
    ConvertItems.removeItem = function removeItem( index, count )
	{
		var i = getItemIndexById(index);
		var item;

		// Not found
		if (i < 0) {
			return null;
		}

		if (ConvertItems.material[i].count) {
			ConvertItems.material[i].count -= count;

			if (ConvertItems.material[i].count > 0) {
				this.ui.querySelector('.item[data-index="'+ index +'"] .count').textContent = ConvertItems.material[i].count;
				return ConvertItems.material[i];
			}
		}

		// Remove item
		item = ConvertItems.material[i];
		ConvertItems.material.splice( i, 1 );
		this.ui.querySelector('.item[data-index="'+ index +'"]').remove();

		return item;
	};
     
    /**
	 * Mouse mouve out of an item, hide title description
	 */
	function onItemOut()
	{
		ConvertItems.ui.querySelector('.overlay').style.display = 'none';
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
				from: 'ConvertItems',
				data: ConvertItems.material[i]
			})
		);

		onItemOut();
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
		if (ItemInfo.uid === ConvertItems.material[i].ITID) {
			ItemInfo.remove();
		}

		// Add ui to window
		ItemInfo.append();
		ItemInfo.uid = ConvertItems.material[i].ITID;
		ItemInfo.setItem( ConvertItems.material[i] );

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

		for (i = 0, count = ConvertItems.material.length; i < count; ++i) {
			if (ConvertItems.material[i].index === index) {
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
         if (!data || data.type !== 'item' || data.from !== 'ItemListWindowSelection') {
             return false;
         }
 
         item = data.data;
        // validar se esta marcado
        var valid_select_all = !getModule('UI/Components/MakeItemSelection/ItemListWindowSelection')
                                    .getSelectAll();

        if (item.count > 1 && valid_select_all) {
			InputBox.append();
			InputBox.setType('number', false, item.count);
			InputBox.onSubmitRequest = function OnSubmitRequest( count ) {
				InputBox.remove();

                
                getModule('UI/Components/MakeItemSelection/ItemListWindowSelection')
                .removeItem(
                    item.index,
                    parseInt(count, 10 )
                );			

                item.count = parseInt(count, 10 );
                ConvertItems.addMaterial( item );
			};
			return false;
		}


        getModule('UI/Components/MakeItemSelection/ItemListWindowSelection')
            .removeItem(
                item.index,
                item.count
            );
 
        ConvertItems.addMaterial( item );
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
		var item    = ConvertItems.material[i];
		var pos     = DOM.getPosition(this);
		var overlay = ConvertItems.ui.querySelector('.overlay');

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
     
     /**
      * Create component based on view file and export it
      */
     return UIManager.addComponent(ConvertItems);
});
 
