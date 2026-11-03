/**
 * UI/Components/EntitySignboard/EntitySignboard.js
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
	var htmlText           = require('text!./EntitySignboard.html');
	var cssText            = require('text!./EntitySignboard.css');


	/**
	 * Createcomponent
	 */
	var EntitySignboard = new UIComponent( 'EntitySignboard', htmlText, cssText );


	/**
	 * @var {boolean} do not focus this UI
	 */
	EntitySignboard.needFocus = false;


	/**
	 * Once in HTML, focus the input
	 */
	EntitySignboard.onAppend = function onAppend()
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
	EntitySignboard.onRemove = function onRemove()
	{
		// Clean up event listeners if needed
		//this.ui.querySelector('button').classList.remove('icon-only');
	};


	/**
	 * Define title and icons
	 *
	 * @param {string} title
	 * @param {string} url - icon url
	 */
	EntitySignboard.setTitle = function setTitle( title, url )
	{
		this.ui.querySelector('button').style.backgroundImage = 'url('+ url +')';
		var titleEl = this.ui.querySelector('.title');
		var overlayEl = this.ui.querySelector('.overlay');
		if (titleEl) titleEl.textContent = title;
		if (overlayEl) overlayEl.textContent = title;

		// Check if the title is overflowing
		if (titleEl && !isOverflowing(titleEl)) {
			if (overlayEl) overlayEl.style.display = 'none'; // Hide the overlay if no overflow
		}
	};


	/**
	 * Define title and icons
	 *
	 * @param {string} title
	 * @param {string} url - icon url
	 */
	EntitySignboard.setIconOnly = function setIconOnly(url)
	{
		this.ui.style.backgroundImage = 'none'; // Hide the background image of the entire signboard
		var btn = this.ui.querySelector('button');
		if (btn) {
			btn.classList.add('icon-only');
			btn.style.backgroundImage = 'url('+ url +')';
		}
		var titleEl = this.ui.querySelector('.title');
		var overlayEl = this.ui.querySelector('.overlay');
		if (titleEl) titleEl.style.display = 'none';
		if (overlayEl) overlayEl.style.display = 'none';
	};

	// Function to check if an element's content is overflowing
	function isOverflowing(element) {
	    return element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight;
	}

	/**
	 * function to define
	 */
	EntitySignboard.onEnter = function onEnter(){};


	/**
	 * Stored component and return it
	 */
	return UIManager.addComponent(EntitySignboard);
});
