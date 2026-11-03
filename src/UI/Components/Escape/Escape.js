/**
 * UI/Components/Escape/Escape.js
 *
 * Game Escape window, manage options
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
	var KEYS               = require('Controls/KeyEventHandler');
	var Renderer           = require('Renderer/Renderer');
	var UIManager          = require('UI/UIManager');
	var UIComponent        = require('UI/UIComponent');
	var SoundOption        = require('UI/Components/SoundOption/SoundOption');
	var GraphicsOption     = require('UI/Components/GraphicsOption/GraphicsOption');
	var ShortCutOption     = require('UI/Components/ShortCutOption/ShortCutOption');
	var htmlText           = require('text!./Escape.html');
	var cssText            = require('text!./Escape.css');
	var DOM             = require('Utils/DOM');


	/**
	 * Create Escape window component
	 */
	var Escape = new UIComponent( 'Escape', htmlText, cssText );


	/**
	 * Initialize UI
	 */
	Escape.init = function init()
	{
		DOM.setCss(this.ui, {
			top: (Renderer.height-this.ui.offsetHeight) * 0.75,
			left:(Renderer.width -this.ui.offsetWidth)  * 0.5
		});
		this.draggable();

		this.ui.querySelector('.node').addEventListener('mousedown', function(event){
			event.stopImmediatePropagation();
			return false;
		});

		// Only used in specific case
		this.ui.querySelector('button').style.display = '';
		this.ui.querySelector('.resurection, .savepoint').style.display = 'none';

		this.ui.querySelector('.sound').addEventListener('click', onToggleSoundUI);
		this.ui.querySelector('.graphics').addEventListener('click', onToggleGraphicUI);
		this.ui.querySelector('.resurection').addEventListener('click', function(){ Escape.onResurectionRequest(); });
		this.ui.querySelector('.savepoint').addEventListener('click', function(){ Escape.onReturnSavePointRequest(); });
		this.ui.querySelector('.charselect').addEventListener('click', function(){ Escape.onCharSelectionRequest(); });
		this.ui.querySelector('.hotkey').addEventListener('click', onToggleShortcutUI);
		this.ui.querySelector('.exit').addEventListener('click', function(){ Escape.onExitRequest(); });
		this.ui.querySelector('.cancel').addEventListener('click', function(){ Escape.ui.style.display = 'none'; });
	};


	/**
	 * Window must not be visible once append
	 * but need to be here to manage key event
	 */
	Escape.onAppend = function onAppend()
	{
		DOM.hide(this.ui);
	};


	/**
	 * Reset buttons once UI is removed
	 */
	Escape.onRemove = function onRemove()
	{
		DOM.hide(this.ui);
		this.ui.querySelector('.resurection, .savepoint').style.display = 'none';
		this.ui.querySelector('.graphics, .sound, .hotkey').style.display = '';
	};


	/**
	 * Show/Hide UI
	 */
	Escape.toggle = function toggle()
	{
		DOM.toggleDisplay(this.ui);

		if (DOM.isVisible(this.ui)) {
			this.focus();
		}
	};


	/**
	 * Key Listener
	 *
	 * @param {object} event
	 * @return {boolean}
	 */
	Escape.onKeyDown = function onKeyDown( event )
	{
		if (event.which === KEYS.ESCAPE) {
			DOM.toggleDisplay(this.ui);

			if (DOM.isVisible(this.ui)) {
				this.focus();
			}

			event.stopImmediatePropagation();
			return false;
		}

		return true;
	};


	/**
	 * Click on Sound button, toggle the UI
	 */
	function onToggleSoundUI()
	{
		if (!SoundOption.ui || !SoundOption.ui.parentNode) {
			SoundOption.append();
		}
		else {
			SoundOption.remove();
		}
	}


	/**
	 * Click on Graphic button, toggle the UI
	 */
	function onToggleGraphicUI()
	{
		if (!GraphicsOption.ui || !GraphicsOption.ui.parentNode) {
			GraphicsOption.append();
		}
		else {
			GraphicsOption.remove();
		}
	}
	
	/**
	 * Click on Shortcut button, toggle the UI
	 */
	function onToggleShortcutUI()
	{
		if (!ShortCutOption.ui || !ShortCutOption.ui.parentNode) {
			ShortCutOption.append();
		}
		else {
			ShortCutOption.remove();
		}
	}


	/**
	 * @var {function} callback when player want to resuret using Token of Siegfried
	 */
	Escape.onResurectionRequest = function onResurectionRequest(){};


	/**
	 * @var {function} callback to define to disconnect from game
	 */
	Escape.onExitRequest = function onExitRequest(){};


	/**
	 * @var {function} callback when player want to resurect using Token of Siegfried
	 */
	Escape.onReturnSavePointRequest = function onReturnSavePointRequest(){};


	/**
	 * @var {function} callback when player want to return to char selection
	 */
	Escape.onCharSelectionRequest = function onCharSelectionRequest(){};


	/**
	 * Create component and export it
	 */
	return UIManager.addComponent(Escape);
});
