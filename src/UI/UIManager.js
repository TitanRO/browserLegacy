/**
 * UI/UIManager.js
 *
 * Manage Interface
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */
define(function( require )
{
	'use strict';

	// Load dependencies
	var DOM             = require('Utils/DOM');
	var UIComponent     = require('./UIComponent');
	var UIVersionManager = require('./UIVersionManager');
	var KEYS            = require('Controls/KeyEventHandler');
	var Renderer        = require('Renderer/Renderer');
	var getModule       = require;


	/**
	 * User Interface Manager
	 */
	var UIManager = {};


	/**
	 * Components cache
	 * @var {array} Components List
	 */
	UIManager.components = {};


	/**
	 * Store a component in the manager
	 *
	 * @param {UIComponent} component object
	 */
	UIManager.addComponent = function addComponent( component )
	{
		if (!(component instanceof UIComponent)) {
			throw new Error('UIManager::addComponent() - Invalid type of component');
		}

		component.manager = this;
		this.components[ component.name ] = component;
		return component;
	};


	/**
	 * Get component stored in manager
	 *
	 * @param {string} component name
	 * @return {UIComponent} object
	 */
	UIManager.getComponent = function getComponent( name )
	{
		var versionAlias = UIVersionManager.getUIAlias( name );
		if (versionAlias) {
			name = versionAlias;
		}
		
		if (!(name in this.components)) {
			throw new Error('UIManager.getComponent() - Component "' + name + '" not found');
		}

		return this.components[name] ;
	};


	/**
	 * Remove all components in screen
	 */
	UIManager.removeComponents = function removeComponents()
	{
		var keys = Object.keys(this.components);
		var i, count = keys.length;

		for (i = 0; i < count; ++i) {
			this.components[ keys[i] ].remove();
		}
	};


	/**
	 * When resizing window, some components can be outside the screen size and
	 * it sucks a lot. Try to correct the problem.
	 *
	 * @param {number} Game screen width
	 * @param {number} Game screen height
	 */
	UIManager.fixResizeOverflow = function fixResizeOverflow( WIDTH, HEIGHT)
	{
		var keys = Object.keys(this.components);
		var i, count = keys.length;
		var ui;

		for (i = 0; i < count; ++i) {
			var component = this.components[ keys[i] ];
			ui = component.ui;

			if (ui) {
				DOM.clampWindowPosition(ui, WIDTH, HEIGHT, component.magnet);

				// Call custom resize function if has one
				if(component.onResize){ component.onResize(); }
			}
			
		}
	};


	function createPopupButton(component, btnName, onClick)
	{
		var button = document.createElement('button');
		button.className = 'btn';
		button.dataset.background = 'btn_' + btnName + '.bmp';
		button.dataset.hover = 'btn_' + btnName + '_a.bmp';
		button.dataset.down = 'btn_' + btnName + '_b.bmp';
		component.parseHTML.call(button);
		button.addEventListener('click', onClick, { once: true });
		return button;
	}


	/**
	 * Display an error box component
	 * Will reload the game once selected
	 *
	 * @param {string} error message
	 */
	UIManager.showErrorBox = function showErrorBox( text )
	{
		var WinError, overlay;

		// Create popup
		WinError = this.getComponent('WinPopup').clone('WinError');
		WinError.init = function Init()
		{
			var textEl = this.ui.querySelector('.text');
			if (textEl) {
				textEl.textContent = text;
			}

			this.ui.style.top = ((Renderer.height-120) / 1.5 - 120) + 'px';
			this.ui.style.left = ((Renderer.width -280) / 2.0) + 'px';
			this.ui.style.zIndex = '100';

			var btns = this.ui.querySelector('.btns');
			if (btns) {
				btns.appendChild(
					createPopupButton(this, 'ok', function(){
						if (overlay.parentNode) {
							overlay.parentNode.removeChild(overlay);
						}
						WinError.remove();
						getModule('Engine/GameEngine').reload();
					})
				);
			}
		};
		WinError.onKeyDown = function OnKeyDown( event )
		{
			event.stopImmediatePropagation();
			switch (event.which) {
				case KEYS.ENTER:
				case KEYS.ESCAPE:
					if (overlay.parentNode) {
						overlay.parentNode.removeChild(overlay);
					}
					this.remove();
					getModule('Engine/GameEngine').reload();
			}
		};

		// Add overlay (to block mouseover, click, etc.)
		overlay = document.createElement('div');
		overlay.className = 'win_popup_overlay';
		document.body.appendChild(overlay);

		WinError.onAppend = function() {
			UIComponent.prioritizeKeyDown(WinError);
		};

		WinError.append();

		return WinError;
	};


	/**
	 * Show a message box to the user
	 *
	 * @param {string} message to show
	 * @param {string} button name
	 * @param {function} callback once the button is pressed
	 */
	UIManager.showMessageBox = function showMessageBox( text, btn_name, callback, keydown )
	{
		var WinMSG;

		// Create popup
		WinMSG = this.getComponent('WinPopup').clone('WinMSG');
		WinMSG.init = function Init()
		{
			this.draggable();
			var textEl = this.ui.querySelector('.text');
			if (textEl) {
				textEl.textContent = text;
			}

			this.ui.style.top = ((Renderer.height-120) / 1.5 - 120) + 'px';
			this.ui.style.left = ((Renderer.width -280) / 2.0) + 'px';
			this.ui.style.zIndex = '100';

			// Just button
			if (btn_name) {
				var btns = this.ui.querySelector('.btns');
				if (btns) {
					btns.appendChild(
						createPopupButton(this, btn_name, function(){
							WinMSG.remove();
							if (callback) {
								callback();
							}
						})
					);
				}
			}
		};


		// Just keydown
		if (keydown) {
			WinMSG.onKeyDown = function(event){
				switch (event.which) {
					case KEYS.ENTER:
					case KEYS.ESCAPE:
						this.remove();
						if (callback) {
							callback();
						}
				}
				event.stopImmediatePropagation();
			};

			WinMSG.onAppend = function() {
				UIComponent.prioritizeKeyDown(WinMSG);
			};
		}

		WinMSG.append();

		return WinMSG;
	};


	/**
	 * Prompt a message to the user
	 *
	 * @param {string} message to show
	 * @param {string} button ok
	 * @param {string} button cancel
	 * @param {function} callback when ok is pressed
	 * @param {function} callback when cancel is pressed
	 */
	UIManager.showPromptBox = function showPromptBox( text, btn_yes, btn_no, onYes, onNo )
	{
		var WinPrompt;

		WinPrompt = this.getComponent('WinPopup').clone('WinPrompt');
		WinPrompt.init = function Init()
		{
			this.draggable();
			var textEl = this.ui.querySelector('.text');
			if (textEl) {
				textEl.textContent = text;
			}

			this.ui.style.top = ((Renderer.height-120) / 1.5 - 120) + 'px';
			this.ui.style.left = ((Renderer.width -280) / 2.0) + 'px';
			this.ui.style.zIndex = '100';

			var btns = this.ui.querySelector('.btns');
			if (btns) {
				btns.appendChild(
					createPopupButton(this, btn_yes, function(){
						WinPrompt.remove();
						if (onYes) {
							onYes();
						}
					})
				);
				btns.appendChild(
					createPopupButton(this, btn_no, function(){
						WinPrompt.remove();
						if (onNo) {
							onNo();
						}
					})
				);
			}

		};

		WinPrompt.append();
		return WinPrompt;
	};


	/**
	 * Export
	 */
	return UIManager;
});
