/**
 * UI/Components/MakeItemSelection/MakeItemSelection.js
 *
 * MakeItemSelection windows
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */
 define(function(require)
 {
     'use strict';


     /**
      * Dependencies
      */
     var DOM         = require('Utils/DOM');
     var DB          = require('DB/DBManager');
     var SkillInfo   = require('DB/Skills/SkillInfo');
     var Client      = require('Core/Client');
     var Renderer    = require('Renderer/Renderer');
     var UIManager   = require('UI/UIManager');
     var UIComponent = require('UI/UIComponent');
     var Inventory   = require('UI/Components/Inventory/Inventory');
     var htmlText    = require('text!./MakeItemSelection.html');
     var cssText     = require('text!./MakeItemSelection.css');


     /**
      * Create MakeItemSelection namespace
      */
     var MakeItemSelection = new UIComponent( 'MakeItemSelection', htmlText, cssText );

     var validMultipleMaterials = 	[
                                 1000 //star crumb
                             ];
							 
	 var validSingleMaterials = 	[
                                 997 //great nature
                                 ,996 //rough wind
                                 ,995 //mystic frozen
                                 ,994 //flame heart
                             ];

     /**
      * Initialize UI
      */
     MakeItemSelection.init = function init()
     {
         // Show at center.
         DOM.setCss(this.ui, {
             top:  (Renderer.height- 200)/2,
             left: (Renderer.width - 200)/2
         });

         this.list  = this.ui.querySelector('.list');
         this.index = 0;
		 this.mkType = 0;
         this.material = [];

         this.draggable(this.ui.querySelector('.head'));

         // Click Events
         this.ui.querySelector('.cancel').addEventListener('click', function(){
             this.index = -1;
             this.selectIndex();
         }.bind(this) );

         // Bind events
         DOM.addDelegatedEvent(this.ui, 'mousedown', '.item', function(){
             MakeItemSelection.setIndex( Math.floor(this.getAttribute('data-index')) );
         });

         DOM.addDelegatedEvent(this.ui, 'dblclick', '.item', function(event){
             if (MakeItemSelection._itemDblClick) {
                 MakeItemSelection._itemDblClick.call(this, event);
             }
         });

         // on drop item
         var _misMaterials = this.ui.querySelector('.materials');
         _misMaterials.addEventListener('drop', onDrop);
         _misMaterials.addEventListener('dragover', stopPropagation);


		this.ui.querySelector('.item').remove();
        this.ui.querySelector('.materials').style.display = 'none';
     };


     /**
      * Add elements to the list
      *
      * @param {Array} list object to display
      */
     MakeItemSelection.setList = function setList( list )
     {
         var i, count;
         var item, it, file, name, showMaterials;

         MakeItemSelection.list.innerHTML = '';
		 this.ui.querySelector('.list').style.backgroundColor = '#f7f7f7';
         this.ui.querySelector('.materials').style.display = 'none';
		 this.ui.querySelector('.item').remove();

         showMaterials = true;
         this.mkType = 0;
         this.material = [];

         for (i = 0, count = list.length; i < count; ++i) {

             item = list[i];
             it   = DB.getItemInfo( item.ITID );
             file = it.identifiedResourceName;
             name = it.identifiedDisplayName;

             if(it.processitemlist === ''){
				 showMaterials = false;
			 }

             addElement( DB.INTERFACE_PATH + 'item/' + file + '.bmp', list[i].ITID, name);
         }

		 this.setIndex(list[0].ITID);

		 bindSelectEvents(showMaterials);
     };


     /**
      * Add elements to the list
      *
      * @param {Array} list object to display
      */
      MakeItemSelection.setCookingList = function setCookingList( list, mkType )
      {
         var i, count;
         var item, it, file, name;

         MakeItemSelection.list.innerHTML = '';
		 this.ui.querySelector('.list').style.backgroundColor = '#f7f7f7';
         this.ui.querySelector('.materials').style.display = 'none';
		 this.ui.querySelector('.item').remove();

		 this.mkType = mkType; // add mk type

         for (i = 0, count = list.length; i < count; ++i) {

             item = list[i];
             it   = DB.getItemInfo( item );
             file = it.identifiedResourceName;
             name = it.identifiedDisplayName;

             addElement( DB.INTERFACE_PATH + 'item/' + file + '.bmp', list[i], name);
         }

		 this.setIndex(list[0].ITID);

         bindSelectEvents(false);
      };


     /**
      * Add an element to the list
      *
      * @param {string} image url
      * @param {index} index in list
      * @param {string} element name
      */
     function addElement( url, index, name)
     {
         MakeItemSelection.list.insertAdjacentHTML('beforeend',
             '<div class="item" data-index="'+ index +'">' +
                 '<div class="icon"></div>' +
                 '<span class="name">' + DOM.escapeHtml(name) + '</span>' +
             '</div>'
         );

         Client.loadFile( url, function(data){
             MakeItemSelection.list
                 .querySelector('div[data-index="'+ index +'"] .icon')
                 .style.backgroundImage = 'url('+ data +')';
         });
     }


     /**
      * Advances to the next screen of the item creation
      *
      * @param {number} index in list
      */
     MakeItemSelection.advance = function advance(){
         var it, title, metal;
         MakeItemSelection.list.innerHTML = '';
         it   = DB.getItemInfo( this.index );
         title = it.identifiedDisplayName + ' ' + DB.getMessage(426);
         metal = it.processitemlist;
         MakeItemSelection.setTitle(title);

         var okBtn = this.ui.querySelector('.ok');
         okBtn.replaceWith(okBtn.cloneNode(true));
         this.ui.querySelector('.ok').addEventListener('click', this.selectIndex.bind(this));
         this.ui.querySelector('.list').style.backgroundColor = '#ffffff';

         this.ui.querySelector('.list').insertAdjacentHTML('beforeend',
				`<pre>${it.identifiedDisplayName} - ${DB.getMessage(427)}`+
					`\n`+
					`${metal}`+
				`</pre>`
			);
         this.ui.querySelector('.materials').style.display = ''

     };


     /**
      * Change selection
      *
      * @param {number} id in list
      */
     MakeItemSelection.setIndex = function setIndex( id )
     {
		 id = id === 0 ? this.index : id;
         this.list.querySelector('div[data-index='+ this.index +']').classList.remove('select');
         this.list.querySelector('div[data-index='+ id         +']').classList.add('select');
         this.index = id;
     };


     /**
      * Select a server, callback
      */
     MakeItemSelection.selectIndex = function selectIndex()
     {
         this.onIndexSelected( this.index, this.material, this.mkType );
         if(this.index == -1){
             this.material.forEach(item => Inventory.getUI().addItem(item));
         }
         this.remove();
     };



     /**
      * Free variables once removed from HTML
      */
     MakeItemSelection.onRemove = function onRemove()
     {
         this.index = 0;
     };


     /**
      * Set new window name
      *
      * @param {string} title
      */
     MakeItemSelection.setTitle = function setTitle( title )
     {
         this.ui.querySelector('.head .text').textContent =  title ;
     };


     /**
      * Functions to define
      */
     MakeItemSelection.onIndexSelected = function onIndexSelected(){};

     /**
      * Insert material to creation
      *
      * @param {object} Item
      */
     MakeItemSelection.addMaterial = function AddMaterial( item, from )
     {
		 var singleMatUsed = false;
		 this.material.forEach(item => { if(validSingleMaterials.includes(item.ITID)){ singleMatUsed = true; } });
		 
         if( this.material.length < 3 && (validMultipleMaterials.includes(item.ITID) || (validSingleMaterials.includes(item.ITID) && !singleMatUsed) )){
             if (this.addItemSub(item)) {
				 switch(from)
				{
					case 'Inventory':
						Inventory.getUI().removeItem( item.index, 1 );
					break;
				}
                 this.material.push(item);
             }
         }
     };

     /**
      * Add item to inventory
      *
      * @param {object} Item
      */
     MakeItemSelection.addItemSub = function AddItemSub( item )
     {

         var it      = DB.getItemInfo( item.ITID );
         var content = this.ui.querySelector('.materials');

         content.insertAdjacentHTML('beforeend',
             '<div class="item" data-index="'+ item.index +'" draggable="false">' +
                 '<div class="icon"></div>' +
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

         return true;
     };



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
         if (!data || data.type !== 'item' || data.from !== 'Inventory') {
             return false;
         }

         item = data.data;
		 item.count = 1;

         MakeItemSelection.addMaterial( item, data.from );
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


     function bindSelectEvents(showMaterials){
         var okBtn = MakeItemSelection.ui.querySelector('.ok');
         var newOk = okBtn.cloneNode(true);
         okBtn.parentNode.replaceChild(newOk, okBtn);

         if(showMaterials){
             newOk.addEventListener('click', MakeItemSelection.advance.bind(MakeItemSelection));
             MakeItemSelection._itemDblClick = MakeItemSelection.advance.bind(MakeItemSelection);
         }else{
             newOk.addEventListener('click', MakeItemSelection.selectIndex.bind(MakeItemSelection));
             MakeItemSelection._itemDblClick = MakeItemSelection.selectIndex.bind(MakeItemSelection);
         }
     }

     /**
      * Create component based on view file and export it
      */
     return UIManager.addComponent(MakeItemSelection);
 });

