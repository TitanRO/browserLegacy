/**
 * UI/Components/ContextMenu/ContextMenu.js
 *
 * Manage ContextMenu (right click on a target)
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */
define(function(require)
{
	'use strict';


	/**
	 * Dependencies
	 */
	var Renderer     = require('Renderer/Renderer');
	var Mouse        = require('Controls/MouseEventHandler');
	var UIManager    = require('UI/UIManager');
	var UIComponent  = require('UI/UIComponent');
	var cssText      = require('text!./ContextMenu.css');


	/**
	 * Create Component
	 */
	var ContextMenu = new UIComponent( 'ContextMenu', '<div id="ContextMenu"><div class="menu"/></div>', cssText);


	/**
	 * Initialize event handler
	 */
	ContextMenu.init = function init()
	{
		this.ui.addEventListener('mousedown', function(){
			ContextMenu.remove();
		});

		this.ui.querySelector('.menu').addEventListener('mousedown', function(event){
			if (event.target.matches('div')) {
				event.stopImmediatePropagation();
				return false;
			}
		});
	};


	/**
	 * Initialize UI
	 */
	ContextMenu.onAppend = function onAppend()
	{
		var menu   = this.ui.querySelector('.menu');
		var width  = menu.offsetWidth;
		var height = menu.offsetHeight;
		var x      = Mouse.screen.x;
		var y      = Mouse.screen.y;

		if (Mouse.screen.x + width > Renderer.width) {
			x = Mouse.screen.x - width;
		}

		if (Mouse.screen.y + height > Renderer.height) {
			y = Mouse.screen.y - height;
		}

		menu.style.top  = y + 'px';
		menu.style.left = x + 'px';
	};


	/**
	 * Clean UP UI
	 */
	ContextMenu.onRemove = function onRemove()
	{
		this.ui.querySelector('.menu').innerHTML = '';
	};


	/**
	 * Add a clickable node to the context menu
	 *
	 * @param {string} text
	 * @param {function} callback once clicked
	 */
	ContextMenu.addElement = function addElement(text, callback)
	{
		var div = document.createElement('div');
		div.textContent = text;
		div.addEventListener('click', function(){
			ContextMenu.remove();
			callback();
		});
		this.ui.querySelector('.menu').appendChild(div);
	};


	/**
	 * Add a delimiter to the links
	 */
	ContextMenu.nextGroup = function nextGroup()
	{
		this.ui.querySelector('.menu').insertAdjacentHTML('beforeend', '<hr/>');
	};


	// Prepare the context menu to avoid problem
	ContextMenu.prepare();


	/**
	 * Create component and export it
	 */
	return UIManager.addComponent(ContextMenu);
});
