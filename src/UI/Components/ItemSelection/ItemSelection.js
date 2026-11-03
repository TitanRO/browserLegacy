/**
 * UI/Components/ItemSelection/ItemSelection.js
 *
 * ItemSelection windows
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
	var DB          = require('DB/DBManager');
	var SkillInfo   = require('DB/Skills/SkillInfo');
	var Client      = require('Core/Client');
	var Renderer    = require('Renderer/Renderer');
	var UIManager   = require('UI/UIManager');
	var UIComponent = require('UI/UIComponent');
	var Inventory   = require('UI/Components/Inventory/Inventory');
	var htmlText    = require('text!./ItemSelection.html');
	var cssText     = require('text!./ItemSelection.css');
	var DOM             = require('Utils/DOM');


	/**
	 * Create ItemSelection namespace
	 */
	var ItemSelection = new UIComponent( 'ItemSelection', htmlText, cssText );


	/**
	 * Initialize UI
	 */
	ItemSelection.init = function init()
	{
		// Show at center.
		DOM.setCss(this.ui, {
			top:  (Renderer.height- 200)/2,
			left: (Renderer.width - 200)/2
		});

		this.list  = this.ui.querySelector('.list');
		this.index = 0;

		this.draggable(this.ui.querySelector('.head'));

		// Click Events
		this.ui.querySelector('.ok').addEventListener('click',  this.selectIndex.bind(this) );
		this.ui.querySelector('.cancel').addEventListener('click', function(){
			this.index = -1;
			this.selectIndex();
		}.bind(this) );

		// Bind events
		DOM.addDelegatedEvent(this.ui, 'dblclick', '.item', this.selectIndex.bind(this));
		DOM.addDelegatedEvent(this.ui, 'mousedown', '.item', function(){
			ItemSelection.setIndex( Math.floor(this.getAttribute('data-index')) );
		});
	};


	/**
	 * Add elements to the list
	 *
	 * @param {Array} list object to display
	 */
	ItemSelection.setList = function setList( list, isSkill )
	{
		var i, count;
		var item, it, file, name;

		ItemSelection.list.innerHTML = '';

		for (i = 0, count = list.length; i < count; ++i) {
			if (isSkill) {
				if(list[i] > 0 && list[i] in SkillInfo){
					item = SkillInfo[list[i]];
					file = item.Name;
					name = item.SkillName;
					addElement( DB.INTERFACE_PATH + 'item/' + file + '.bmp', list[i], name);
				}
				// else: skip empty
			} else {
				item = Inventory.getUI().getItemByIndex(list[i]);
				if (item){
					it   = DB.getItemInfo( item.ITID );
					if(it){
						file = item.IsIdentified ? it.identifiedResourceName : it.unidentifiedResourceName;
						name = DB.getItemName(item, {showItemGrade: false, showItemSlots: false, showItemOptions: false});
						addElement( DB.INTERFACE_PATH + 'item/' + file + '.bmp', list[i], name);
					}
				}
			}

		}

		this.setIndex(list[0]);
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
		ItemSelection.list.insertAdjacentHTML('beforeend',
			'<div class="item" data-index="'+ index +'">' +
				'<div class="icon"></div>' +
				'<span class="name">' + DOM.escapeHtml(name) + '</span>' +
			'</div>'
		);

		Client.loadFile( url, function(data){
			ItemSelection.list
				.querySelector('div[data-index="'+ index +'"] .icon')
				.style.backgroundImage = 'url('+ data +')';
		});
	}


	/**
	 * Change selection
	 *
	 * @param {number} id in list
	 */
	ItemSelection.setIndex = function setIndex( id )
	{
		this.list.querySelector('div[data-index="'+ this.index +'"]').style.backgroundColor = 'transparent';
		this.list.querySelector('div[data-index="'+ id +'"]').style.backgroundColor = '#cde0ff';
		this.index = id;
	};


	/**
	 * Select a server, callback
	 */
	ItemSelection.selectIndex = function selectIndex()
	{
		this.onIndexSelected( this.index );
		this.remove();
	};



	/**
	 * Free variables once removed from HTML
	 */
	ItemSelection.onRemove = function onRemove()
	{
		this.index = 0;
	};


	/**
	 * Set new window name
	 *
	 * @param {string} title
	 */
	ItemSelection.setTitle = function setTitle( title )
	{
		this.ui.querySelector('.head .text').textContent =  title ;
	};


	/**
	 * Functions to define
	 */
	ItemSelection.onIndexSelected = function onIndexSelected(){};


	/**
	 * Create component based on view file and export it
	 */
	return UIManager.addComponent(ItemSelection);
});
