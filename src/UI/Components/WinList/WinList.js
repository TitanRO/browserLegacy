/**
 * UI/Components/WinList/WinList.js
 *
 * WinList windows
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
	var Renderer    = require('Renderer/Renderer');
	var KEYS        = require('Controls/KeyEventHandler');
	var UIManager   = require('UI/UIManager');
	var UIComponent = require('UI/UIComponent');
	var htmlText    = require('text!./WinList.html');
	var cssText     = require('text!./WinList.css');
	var DOM             = require('Utils/DOM');


	/**
	 * Create WinList namespace
	 */
	var WinList = new UIComponent( 'WinList', htmlText, cssText );


	/**
	 * Initialize UI
	 */
	WinList.init = function init()
	{
		// Show at center.
		DOM.setCss(this.ui, {
			top: (Renderer.height - 280)/1.5,
			left: (Renderer.width - 280)/2
		});
		this.draggable();

		this.ui_list = this.ui.querySelector('.list');
		this.list    = null;
		this.index   = 0;

		// Click Events
		this.ui.querySelector('.ok').addEventListener('click',  this.selectIndex.bind(this) );
		this.ui.querySelector('.cancel').addEventListener('click',  this.exit.bind(this) );
	};


	/**
	 * Add elements to the list
	 *
	 * @param {Array} list object to display
	 */
	WinList.setList = function setList( list )
	{
		var i, count;

		this.list = list;
		this.ui_list.innerHTML = '';

		function onSelectListIndex(event) {
			WinList.setIndex( this.getAttribute('data-id') );
			event.stopImmediatePropagation();
			return false;
		}

		for (i = 0, count = list.length; i < count; ++i) {
			var node = document.createElement('div');
			node.classList.add('menu_node');
			node.textContent = list[i];
			node.dataset.id = String(i);
			node.addEventListener('mousedown', onSelectListIndex);
			node.addEventListener('dblclick', this.selectIndex.bind(this));
			this.ui_list.appendChild(node);
		}

		this.setIndex( 0 );
	};


	/**
	 *  Cancel window
	 */
	WinList.exit = function exit()
	{
		WinList.onExitRequest();
	};


	/**
	 * Callback to use
	 */
	WinList.onExitRequest   = function onExitRequest(){};
	WinList.onIndexSelected = function onIndexSelected(){};


	/**
	 * Change selection
	 *
	 * @param {number} id in list
	 */
	WinList.setIndex = function setIndex( id )
	{
		if (id > -1 && id < this.list.length) {
			this.ui_list.querySelectorAll('div')[this.index].style.backgroundColor = 'transparent';
			this.ui_list.querySelectorAll('div')[id].style.backgroundColor = '#cde0ff';
			this.index = id;
		}
	};


	/**
	 * Select a server, callback
	 */
	WinList.selectIndex = function selectIndex()
	{
		this.onIndexSelected( this.index );
	};


	/**
	 * Key Management
	 *
	 * @param {object} event
	 */
	WinList.onKeyDown = function onKeyDown( event )
	{
		switch (event.which) {
			default:                                           return;
			case KEYS.ENTER:  this.selectIndex();              break;
			case KEYS.ESCAPE: this.exit();                     break;
			case KEYS.UP:     this.setIndex( this.index - 1 ); break;
			case KEYS.DOWN:   this.setIndex( this.index + 1 ); break;
		}
		event.stopImmediatePropagation();
	};


	/**
	 * Free variables once removed from HTML
	 */
	WinList.onRemove = function onRemove()
	{
		this.ui_list.innerHTML = '';
		this.list  = null;
		this.index = 0;
	};


	/**
	 * Create component based on view file and export it
	 */
	return UIManager.addComponent(WinList);

});
