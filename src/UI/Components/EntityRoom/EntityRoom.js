/**
 * UI/Components/EntityRoom/EntityRoom.js
 *
 * Entity room (chat room, shop room, ...)
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
	var UIManager          = require('UI/UIManager');
	var UIComponent        = require('UI/UIComponent');
	var htmlText           = require('text!./EntityRoom.html');
	var cssText            = require('text!./EntityRoom.css');


	/**
	 * Createcomponent
	 */
	var EntityRoom = new UIComponent( 'EntityRoom', htmlText, cssText );


	/**
	 * @var {boolean} do not focus this UI
	 */
	EntityRoom.needFocus = false;


	/**
	 * Once in HTML, focus the input
	 */
	EntityRoom.onAppend = function onAppend()
	{
		this.ui.querySelector('button').addEventListener('dblclick', function(){
			if (this.onEnter) {
				this.onEnter();
			}
		}.bind(this));

		// Avoid player to move to the cell
		this.ui.addEventListener('mousedown', function(){
			return false;
		});

		this.ui.style.zIndex = 45;
	};


	/**
	 * Remove data from UI
	 */
	EntityRoom.onRemove = function onRemove()
	{
		var btn = this.ui.querySelector('button');
		if (btn && btn.parentNode) {
			btn.parentNode.replaceChild(btn.cloneNode(true), btn);
		}
	};


	/**
	 * Define title and icons
	 *
	 * @param {string} title
	 * @param {string} url - icon url
	 */
	EntityRoom.setTitle = function setTitle( title, url )
	{
		this.ui.querySelector('button img').setAttribute('src', url);
		this.ui.querySelector('.title, .overlay').textContent = title;
	};


	/**
	 * function to define
	 */
	EntityRoom.onEnter = function onEnter(){};


	/**
	 * Stored component and return it
	 */
	return UIManager.addComponent(EntityRoom);
});
