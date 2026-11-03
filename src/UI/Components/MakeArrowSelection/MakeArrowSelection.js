/**
 * UI/Components/MakeArrowSelection/MakeArrowSelection.js
 *
 * MakeArrowSelection windows
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
	var htmlText    = require('text!./MakeArrowSelection.html');
	var cssText     = require('text!./MakeArrowSelection.css');


	/**
	 * Create MakeArrowSelection namespace
	 */
	var MakeArrowSelection = new UIComponent( 'MakeArrowSelection', htmlText, cssText );


	function qs(selector)
	{
		return DOM.qs(MakeArrowSelection.ui, selector);
	}


	/**
	 * Initialize UI
	 */
	MakeArrowSelection.init = function init()
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
				MakeArrowSelection.selectIndex();
			}
		});
		this.ui.addEventListener('mousedown', function(event) {
			var item = event.target.closest('.item');
			if (item) {
				MakeArrowSelection.setIndex(Math.floor(item.getAttribute('data-index')));
			}
		});
	};


	/**
	 * Add elements to the list
	 *
	 * @param {Array} list object to display
	 */
	MakeArrowSelection.setList = function setList( list )
	{
		var i, count;
		var item, it, file, name;

		DOM.empty(MakeArrowSelection.list);

		for (i = 0, count = list.length; i < count; ++i) {

			item = list[i];
			it   = DB.getItemInfo( item.index );
			file = it.identifiedResourceName;
			name = it.identifiedDisplayName;


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
		MakeArrowSelection.list.insertAdjacentHTML('beforeend',
			'<div class="item" data-index="'+ index +'">' +
				'<div class="icon"></div>' +
				'<span class="name">' + DOM.sanitizeHtml(name) + '</span>' +
			'</div>'
		);

		Client.loadFile( url, function(data){
			var icon = MakeArrowSelection.list.querySelector('div[data-index="'+ index +'"] .icon');
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
	MakeArrowSelection.setIndex = function setIndex( id )
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
	MakeArrowSelection.selectIndex = function selectIndex()
	{
		this.onIndexSelected( this.index );
		this.remove();
	};



	/**
	 * Free variables once removed from HTML
	 */
	MakeArrowSelection.onRemove = function onRemove()
	{
		this.index = 0;
	};


	/**
	 * Set new window name
	 *
	 * @param {string} title
	 */
	MakeArrowSelection.setTitle = function setTitle( title )
	{
		DOM.setFormattedText(qs('.head .text'), title, DB.getItemInfo.bind(DB));
	};


	/**
	 * Functions to define
	 */
	MakeArrowSelection.onIndexSelected = function onIndexSelected(){};


	/**
	 * Create component based on view file and export it
	 */
	return UIManager.addComponent(MakeArrowSelection);
});
