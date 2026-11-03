/**
 * UI/Components/ItemCompare/ItemCompare.js
 *
 * Item Comparison Information
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
	var DB                 = require('DB/DBManager');
	var ItemType           = require('DB/Items/ItemType');
	var Client             = require('Core/Client');
	var KEYS               = require('Controls/KeyEventHandler');
	var CardIllustration   = require('UI/Components/CardIllustration/CardIllustration');
	var UIManager          = require('UI/UIManager');
	var Mouse              = require('Controls/MouseEventHandler');
	var UIComponent        = require('UI/UIComponent');
	var MakeReadBook       = require('UI/Components/MakeReadBook/MakeReadBook');
	var Renderer           = require('Renderer/Renderer');
	var SpriteRenderer     = require('Renderer/SpriteRenderer');
	var Sprite             = require('Loaders/Sprite');
	var Action             = require('Loaders/Action');
	var htmlText           = require('text!./ItemCompare.html');
	var cssText            = require('text!./ItemCompare.css');
	var Network       	   = require('Network/NetworkManager');
	var PACKET        	   = require('Network/PacketStructure');
	var getModule     = require;
	var DOM             = require('Utils/DOM');


	/**
	 * Create Component
	 */
	var ItemCompare = new UIComponent( 'ItemCompare', htmlText, cssText );

	/**
	 * @var {Sprite,Action} objects
	 */
	var _sprite, _action;

	/**
	 * @var {CanvasRenderingContext2D}
	 */
	 var _ctx;

	/**
	 * @var {number} type
	 */
	 var _type = 0;

	 /**
	 * @var {number} start tick
	 */
	var _start = 0;

	/**
	 * @var {number} ItemCompare unique id
	 */
	ItemCompare.uid = -1;

	/**
	 * Once append to the DOM
	 */
	/*
	ItemCompare.onKeyDown = function onKeyDown( event )
	{
		if (event.which === KEYS.ESCAPE) {
			ItemCompare.remove();
			event.stopImmediatePropagation();
			return false;
		}

		return true;
	};
	*/

	/**
	 * Once append
	 */
	ItemCompare.onAppend = function onAppend()
	{
		// Note: jQuery._data keydown reordering removed (not possible with native events)
		resize(ItemCompare.ui.querySelector('.description-inner').offsetHeight + 45);

		var ItemInfo = require('UI/Components/ItemInfo/ItemInfo');
		// Position ItemCompare next to ItemInfo
		var itemInfoPosition = DOM.getOffset(ItemInfo.ui);
		var itemInfoWidth = ItemInfo.ui.offsetWidth;
		DOM.setCss(ItemCompare.ui, {
			position: 'absolute',
			top: itemInfoPosition.top ? itemInfoPosition.top : 200,
			left: itemInfoPosition.left ?  itemInfoPosition.left - itemInfoWidth : 200 // Adjust spacing as needed
		});
	};


	/**
	 * Once removed from html
	 */
	ItemCompare.onRemove = function onRemove()
	{
		this.uid = -1;
	};


	/**
	 * Initialize UI
	 */
	ItemCompare.init = function init()
	{
		DOM.setCss(this.ui, { top: 200, left:200 });
		this.ui.querySelector('.extend').addEventListener('mousedown', onResize);

		// Ask to see card.
		this.ui.querySelector('.view').addEventListener('click', function(){
			CardIllustration.append();
			CardIllustration.setCard(this.item);
		}.bind(this));

		var ItemInfo = require('UI/Components/ItemInfo/ItemInfo');
		this.draggable(ItemInfo.ui.querySelector('.title'));

	};

	/**
	 * Bind component
	 *
	 * @param {object} item
	 */
	ItemCompare.setItem = function setItem( item )
	{
		var it = DB.getItemInfo( item.ITID );
		var ui = this.ui;
		var cardList = ui.querySelector('.cardlist .border');
		var optionContainer = ui.querySelector('.option-container');

		this.item = it;
		Client.loadFile( DB.INTERFACE_PATH + 'collection/' + ( item.IsIdentified ? it.identifiedResourceName : it.unidentifiedResourceName ) + '.bmp', function(data){
			ui.querySelector('.collection').style.backgroundImage = 'url(' + data + ')';
		});


		var customname = '';
		var hideslots = false;
		
		if(item.type == ItemType.ARMOR && item.location == 0){ //Pet Egg
			hideslots = true;
		}
		
		if(item.slot){

			var very = '';
			var name = '';
			var elem = '';

			switch (item.slot['card1']) {
				case 0x00FF: // FORGE
					if (item.slot['card2'] >= 3840) {
						very = DB.getMessage(461); // Very Very Very Strong
					} else if (item.slot['card2'] >= 2560) {
						very = DB.getMessage(460); // Very Very Strong
					} else if (item.slot['card2'] >= 1024) {
						very = DB.getMessage(459); // Very Strong
					}
					switch (Math.abs(item.slot['card2'] % 10)){
						case 1: elem = DB.getMessage(452); break; // 's Ice
						case 2: elem = DB.getMessage(454); break; // 's Earth
						case 3: elem = DB.getMessage(451); break; // 's Fire
						case 4: elem = DB.getMessage(453); break; // 's Wind
						default: elem = DB.getMessage(450); break; // 's
					}
				case 0x00FE: // CREATE
					elem = DB.getMessage(450);
				case 0xFF00: // PET
					hideslots = true;

					name = '<font color="red" class="owner-' + GID + '">Unknown</font>';
					var GID = (item.slot['card4']<<16) + item.slot['card3'];

					if( DB.CNameTable[GID] && DB.CNameTable[GID] !== 'Unknown') {
						name = '<font color="blue" class="owner-' + GID + '">'+DB.CNameTable[GID]+'</font>';
					} else {

						//Add to item owner name update queue
						DB.UpdateOwnerName[GID] = onUpdateOwnerName;
						DB.getNameByGID(GID);
					}

					if(item.IsDamaged){
						customname = very + ' ' + name + elem + ' ';
					} else {
						customname = !DB.CNameTable[GID] ? very + ' ' + ' ' + name + ' ' + elem + ' ' : very + ' ' + ' ' + name + ' ' + elem + ' ';
					}

					break;
			}
			switch (item.slot['card4']) {
				case 0x1: //BELOVED PET
					hideslots = true;
					customname = DB.getMessage(756) + ' ' + customname;
					break;
			}
		}

		if(item.Options && item.IsIdentified){
			//Clear all option list
			optionContainer.innerHTML = '';

			//Loop to Show Options
			for (let i = 1; i <= 5; i++) {
				if(item.Options[i].index > 0) {
					let randomOptionName = DB.getOptionName(item.Options[i].index);
					let optionList = 	'<div class="optionlist">' +
															'<div class="border">' +
															randomOptionName.replace('\%d', item.Options[i].value).replace('\%\%', '%') +
															'</div>' +
													'</div>';
					optionContainer.insertAdjacentHTML('beforeend', optionList);
				}
			}
			optionContainer.style.display = '';
		}else{
			optionContainer.style.display = 'none';
		}

		// Damaged status
		if(item.IsDamaged){
			ui.querySelector('.title').classList.add('damaged');
		}else{
			ui.querySelector('.title').classList.remove('damaged');
		}

		ui.querySelector('.title').textContent = item.IsIdentified ? (customname + it.identifiedDisplayName) : it.unidentifiedDisplayName;
		ui.querySelector('.description-inner').textContent =  item.IsIdentified ? it.identifiedDescriptionName : it.unidentifiedDescriptionName ;

		// Add view button (for cards)
		addEvent(item);

		switch (item.type) {
			// Not an equipement = no card
			default:
				cardList.parentNode.style.display = 'none';
				break;

			case ItemType.WEAPON:
			case ItemType.ARMOR:
			case ItemType.SHADOWGEAR:
				if (hideslots){
					cardList.parentNode.style.display = 'none';
					break;
				}
				var slotCount = it.slotCount || 0;
				var i;

				cardList.parentNode.style.display = '';
				cardList.innerHTML = '';

				for (i = 0; i < 4; ++i) {
					addCard(cardList, (item.slot && item.slot['card' + (i+1)]) || 0, i, slotCount);
				}
				if (!item.IsIdentified ) {
					cardList.parentNode.style.display = 'none';
				}
				break;
			
			case ItemType.PETEGG:
				cardList.parentNode.style.display = 'none';
				break;

		}
		resize(ItemCompare.ui.querySelector('.description-inner').offsetHeight + 45);
	};


	/**
	 * Add a card into a slot
	 *
	 * @param {object} jquery cart list DOM
	 * @param {number} item id
	 * @param {number} index
	 * @param {number} slot count
	 */
	function addCard( cardList, itemId, index, slotCount )
	{
		var file, name = '';
		var card = DB.getItemInfo(itemId);

		if (itemId && card) {
			file = 'item/' + card.identifiedResourceName + '.bmp';
			name = '<div class="name">'+ DOM.escapeHtml(card.identifiedDisplayName) + '</div>';
		}
		// TODO: ADD VARIABLE WITH MAXIMUM OF LETTER
		else if (index < slotCount) {
			file = 'empty_card_slot.bmp';
		}
		else {
			file = 'basic_interface/coparison_disable_card_slot.bmp';
		}

		cardList.insertAdjacentHTML('beforeend',
			'<div class="item" data-index="'+ index +'">' +
				'<div class="icon"></div>' +
				name +
			'</div>'
		);

		Client.loadFile( DB.INTERFACE_PATH + file, function(data) {
			var element = cardList.querySelector('.item[data-index="'+ index +'"] .icon');
			element.style.backgroundImage = 'url(' + data + ')';

			if (itemId && card) {
				element.addEventListener('contextmenu', function(){
					ItemCompare.setItem({
						ITID:         itemId,
						IsIdentified: true,
						type:         6
					});
					return false;
				});
			}
		});
	}
	/**
	* Extend ItemCompare window size
	*/
	function onResize()
	{
		var ui      = ItemCompare.ui;
		var top     = parseInt(ui.style.top, 10) || 0;
		var left    = parseInt(ui.style.left, 10) || 0;
		var lastHeight = 0;
		var _Interval;

		function resizing()
		{
			var h = Math.floor((Mouse.screen.y - top));
			if (h === lastHeight) {
				return;
			}
			resize( h );
			lastHeight = h;
		}

		// Start resizing
		_Interval = setInterval(resizing, 30);

		// Stop resizing on left click
		var _icResizeHandler = function(event){
			if (event.which === 1) {
				clearInterval(_Interval);
				window.removeEventListener('mouseup', _icResizeHandler);
			}
		};
		window.addEventListener('mouseup', _icResizeHandler);
	}


	/**
	* Extend ItemCompare window size
	*
	* @param {number} height
	*/
	function resize( height )
	{
		var container = ItemCompare.ui.querySelector('.container');
		var description = ItemCompare.ui.querySelector('.description');
		var descriptionInner = ItemCompare.ui.querySelector('.description-inner');
		var containerHeight = height;
		var minHeight = 120;
		var maxHeight = descriptionInner.offsetHeight + 45 > 120 ? Math.min(descriptionInner.offsetHeight + 45, 448) : 120;

		if (containerHeight <= minHeight) {
			containerHeight = minHeight;
		}

		if (containerHeight >= maxHeight) {
			containerHeight = maxHeight;
		}

		DOM.setCss(container, {
			height: containerHeight + 'px'
		});
		DOM.setCss(description, {
			height: (containerHeight - 45) + 'px'
		});
	}

	function onUpdateOwnerName (pkt){
		var str = ItemCompare.ui.querySelector('.owner-'+pkt.GID).textContent;
		ItemCompare.ui.querySelector('.owner-'+pkt.GID).textContent = pkt.CName;

		delete DB.UpdateOwnerName[pkt.GID];
	}


	function addEvent(item){
		var event = ItemCompare.ui.querySelector('.event_view');
		validateFieldsExist(event) ? '' : addEvent(item);

		event.querySelector('.view').style.display = 'none';
		var eventCanvas = event.querySelector('canvas');
		if (eventCanvas) {
			eventCanvas.remove();
		}

		Renderer.stop(rendering)

		switch (item.type) {
			case ItemType.CARD:
				event.querySelector('.view').style.display = '';
				break;
			case ItemType.ETC:
				let filenameBook =  `data/book/${item.ITID}.txt`;
				Client.loadFile( filenameBook, function(data) {
					MakeReadBook.startBook(data, item);
					eventsBooks();
				});
				break;
			default:
				event.querySelector('.view').style.display = 'none';
				var defaultCanvas = event.querySelector('canvas');
				if (defaultCanvas) {
					defaultCanvas.remove();
				}
				break;
		}
	}

	function eventsBooks(){
		var event = ItemCompare.ui.querySelector('.event_view');

		Client.getFiles([
			'data/sprite/book/\xc3\xa5\xc0\xd0\xb1\xe2.spr',
			'data/sprite/book/\xc3\xa5\xc0\xd0\xb1\xe2.act'
			], function (spr, act) {

				try {
					_sprite = new Sprite( spr );
					_action = new Action( act );
				}
				catch(e) {
					console.error('Book::init() - ' + e.message );
					return;
				}
				var canvas;
				canvas  = _sprite.getCanvasFromFrame( 0 );
				canvas.className = 'book_open event_add_cursor';
				event.appendChild(canvas);
				var bookOpen = ItemCompare.ui.querySelector('.book_open');
				bookOpen.addEventListener('mouseover', function(e) {
					e.stopImmediatePropagation();
					ItemCompare.ui.querySelector('.overlay_open').style.display = '';
				});
				bookOpen.addEventListener('mouseout', function(e) {
					e.stopImmediatePropagation();
					ItemCompare.ui.querySelector('.overlay_open').style.display = 'none';
				});
				bookOpen.addEventListener('click', function(e){
					e.stopImmediatePropagation();
					MakeReadBook.openBook();
				}.bind(this));
				// icon read book
				event.insertAdjacentHTML('beforeend', '<canvas width="21" height="15" class="book_read event_add_cursor"></canvas>');
				canvas  			 = event.querySelector('.book_read');
				canvas.width         = 21;
				canvas.height        = 15;
				_ctx 				 = canvas.getContext('2d');

				var bookRead = ItemCompare.ui.querySelector('.book_read');
				bookRead.addEventListener('mouseover', function(e) {
					e.stopImmediatePropagation();
					ItemCompare.ui.querySelector('.overlay_read').style.display = '';
				});
				bookRead.addEventListener('mouseout', function(e) {
					e.stopImmediatePropagation();
					ItemCompare.ui.querySelector('.overlay_read').style.display = 'none';
				});
				bookRead.addEventListener('click', function(e){
					e.stopImmediatePropagation();
					MakeReadBook.highlighter();
				}.bind(this));
				Renderer.render(rendering);

			}.bind(this)
		);
	}


	/**
	 * Rendering animation
	 */
	 var rendering = function renderingClosure()
	 {
		 var position  = new Uint16Array([0, 0]);

		 return function rendering()
		 {
			var i, count, max;
			var action, animation, anim;
			var Entity = getModule('Renderer/Entity/Entity');

			var _entity = new Entity();
			action = _action.actions[_type];
					max    = action.animations.length;
					anim   = Renderer.tick - _start;
					anim   = Math.floor(anim / action.delay);

					// if (anim >= max) {
					// 	Renderer.stop(rendering);
					// }

			animation = action.animations[anim % action.animations.length];


			// Initialize context
			SpriteRenderer.bind2DContext(_ctx,  10, 25);
			_ctx.clearRect(0, 0, _ctx.canvas.width, _ctx.canvas.height);
			// _ctx.clearRect(0, 0, 21, 15);

			// Render layers
			for (i = 0, count = animation.layers.length; i < count; ++i) {
				_entity.renderLayer( animation.layers[i], _sprite, _sprite, 1.0, position, false);
			}
			// _entity.renderLayer( animation.layers[0], _sprite, _sprite, 1.0, position, false);

			// Renderer.stop(rendering);

		 };
	 }();

	 function validateFieldsExist(event){

		if(!event){
			let validExitElement =
				'<div class="event_view">' +
            		'<button class="view" data-background="btn_view.bmp" data-down="btn_view_a.bmp" data-hover="btn_view_b.bmp"></button>'+
					'<span class="overlay_open" data-text="1294">'+DB.getMessage(1294)+'</span>'+
					'<span class="overlay_read" data-text="1295">'+DB.getMessage(1295)+'</span>'
        		'</div>';
			var collection = ItemCompare.ui.querySelector('.collection');
			collection.insertAdjacentHTML('afterend', validExitElement);
			return false;
		}

		if(!ItemCompare.ui.querySelector('.overlay_open')
			&& !ItemCompare.ui.querySelector('.overlay_read')){
				event.insertAdjacentHTML('beforeend',
					'<span class="overlay_open" data-text="1294">'+DB.getMessage(1294)+'</span>'+
					'<span class="overlay_read" data-text="1295">'+DB.getMessage(1295)+'</span>'
				);
		}

		if(!ItemCompare.ui.querySelector('button')){
			event.insertAdjacentHTML('beforeend',
				'<button class="view" data-background="btn_view.bmp" data-down="btn_view_a.bmp" data-hover="btn_view_b.bmp"></button>'
			);
		}

		return true;
	 }

	/**
	 * Create component and export it
	 */
	return UIManager.addComponent(ItemCompare);
});
