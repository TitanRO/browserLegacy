/**
 * UI/Components/RefineWeaponSelection/RefineWeaponSelection.js
 *
 * RefineWeaponSelection windows
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
	var htmlText    = require('text!./RefineWeaponSelection.html');
	var cssText     = require('text!./RefineWeaponSelection.css');


	/**
	 * Create RefineWeaponSelection namespace
	 */
	var RefineWeaponSelection = new UIComponent( 'RefineWeaponSelection', htmlText, cssText );


	function qs(selector)
	{
		return DOM.qs(RefineWeaponSelection.ui, selector);
	}


	/**
	 * Initialize UI
	 */
	RefineWeaponSelection.init = function init()
	{
		// Show at center.
		DOM.setCss(this.ui, {
			top:  (Renderer.height- 200)/2 + 'px',
			left: (Renderer.width - 200)/2 + 'px'
		});

		this.list  = qs('.list');
		this.index = 0;

		this.draggable(qs('.head'));

		// Click Events
		qs('.ok').addEventListener('click', this.selectIndex.bind(this));
		qs('.cancel').addEventListener('click', function(){
			this.index = -1;
			this.selectIndex();
		}.bind(this));

		// Bind events
		this.ui.addEventListener('dblclick', function(event) {
			if (event.target.closest('.item')) {
				RefineWeaponSelection.selectIndex();
			}
		});
		this.ui.addEventListener('mousedown', function(event) {
			var item = event.target.closest('.item');
			if (item) {
				RefineWeaponSelection.setIndex(Math.floor(item.getAttribute('data-index')));
			}
		});
	};


	/**
	 * Add elements to the list
	 *
	 * @param {Array} list object to display
	 */
	RefineWeaponSelection.setList = function setList( list )
	{
		var i, count;
		var item, it, file, name, refine;

		DOM.empty(RefineWeaponSelection.list);
		RefineWeaponSelection.ItemList = [];

		for (i = 0, count = list.length; i < count; ++i) {
			
			// Save list
			RefineWeaponSelection.ItemList[i] = list[i];

			it   = DB.getItemInfo( list[i].ITID );
			file = it.identifiedResourceName;
			refine = list[i].RefiningLevel;
			name = (refine>0) ? '+' + refine + ' ' + it.identifiedDisplayName : it.identifiedDisplayName;

			addElement( DB.INTERFACE_PATH + 'item/' + file + '.bmp', list[i].index, name);
		}

		this.setIndex(list[0].index);
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
		RefineWeaponSelection.list.insertAdjacentHTML('beforeend',
			'<div class="item" data-index="'+ index +'">' +
				'<div class="icon"></div>' +
				'<span class="name">' + DOM.sanitizeHtml(name) + '</span>' +
			'</div>'
		);

		Client.loadFile( url, function(data){
			var icon = RefineWeaponSelection.list.querySelector('div[data-index="'+ index +'"] .icon');
			if (icon) {
				icon.style.backgroundImage = 'url('+ data +')';
			}
		});
	}


	/**
	 * Change selection
	 *
	 * @param {number} id in list
	 */
	RefineWeaponSelection.setIndex = function setIndex( id )
	{
		var prev = this.list.querySelector('div[data-index="'+ this.index +'"]');
		var next = this.list.querySelector('div[data-index="'+ id +'"]');
		if (prev) {
			prev.style.backgroundColor = 'transparent';
		}
		if (next) {
			next.style.backgroundColor = '#cde0ff';
		}
		this.index = id;
	};


	/**
	 * Select a server, callback
	 */
	RefineWeaponSelection.selectIndex = function selectIndex()
	{
		this.onIndexSelected( this.index );
		this.remove();
	};
	
	/**
	 * Select a server, callback
	 */
	RefineWeaponSelection.getItemByIndex = function getItemByIndex(index){
		var list = RefineWeaponSelection.ItemList;
		
		for (var i = 0; i < list.length; i++){
			if( RefineWeaponSelection.ItemList[i].index == index ){
				return RefineWeaponSelection.ItemList[i];
			}
		}
	}

	/**
	 * Free variables once removed from HTML
	 */
	RefineWeaponSelection.onRemove = function onRemove()
	{
		this.index = 0;
	};


	/**
	 * Set new window name
	 *
	 * @param {string} title
	 */
	RefineWeaponSelection.setTitle = function setTitle( title )
	{
		DOM.setFormattedText(qs('.head .text'), title, DB.getItemInfo.bind(DB));
	};


	/**
	 * Functions to define
	 */
	RefineWeaponSelection.onIndexSelected = function onIndexSelected(){};


	/**
	 * Create component based on view file and export it
	 */
	return UIManager.addComponent(RefineWeaponSelection);
});
