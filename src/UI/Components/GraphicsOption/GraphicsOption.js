/**
 * UI/Components/GraphicsOption/GraphicsOption.js
 *
 * Manage Graphics details
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
	var FPS              = require('UI/Components/FPS/FPS');
	var Configs          = require('Core/Configs');
	var Context          = require('Core/Context');
	var Preferences      = require('Core/Preferences');
	var GraphicsSettings = require('Preferences/Graphics');
	var Renderer         = require('Renderer/Renderer');
	var UIManager        = require('UI/UIManager');
	var UIComponent      = require('UI/UIComponent');
	var htmlText         = require('text!./GraphicsOption.html');
	var cssText          = require('text!./GraphicsOption.css');
	var DOM             = require('Utils/DOM');


	/**
	 * Create Component
	 */
	var GraphicsOption = new UIComponent( 'GraphicsOption', htmlText, cssText );


	/**
	 * @var {Preferences} Graphics
	 */
	var _preferences = Preferences.get('GraphicsOption', {
		x:    300,
		y:    300
	}, 1.1);


	/**
	 * Initialize UI
	 */
	GraphicsOption.init = function Init()
	{
		this.ui.querySelector('.base').addEventListener('mousedown', function(event) {
			event.stopImmediatePropagation();
			return false;
		});

		this.ui.querySelector('.close').addEventListener('click', this.remove.bind(this));
		this.ui.querySelector('.details').addEventListener('change', onUpdateQualityDetails);
		this.ui.querySelector('.cursor-option').addEventListener('change', onToggleGameCursor);
		this.ui.querySelector('.screensize').addEventListener('change', onUpdateScreenSize);
		this.ui.querySelector('.fpslimit').addEventListener('change', onUpdateFPSLimit);
		this.ui.querySelector('.fps').addEventListener('change', onToggleFPSDisplay);

		this.draggable(this.ui.querySelector('.titlebar'));
	};



	/**
	 * When append the element to html
	 */
	GraphicsOption.onAppend = function OnAppend()
	{
		DOM.setCss(this.ui, {
			top:  _preferences.y,
			left: _preferences.x,
		});

		this.ui.querySelector('.details').value = GraphicsSettings.quality;
		this.ui.querySelector('.screensize').value = GraphicsSettings.screensize;
		this.ui.querySelector('.cursor-option').setAttribute('checked', GraphicsSettings.cursor);
		this.ui.querySelector('.fpslimit').value = GraphicsSettings.fpslimit;
		this.ui.querySelector('.fps').setAttribute('checked', DOM.isVisible(FPS.ui));
	};


	/**
	 * Once remove, save preferences
	 */
	GraphicsOption.onRemove = function OnRemove()
	{
		_preferences.x    = parseInt(this.ui.style.left, 10);
		_preferences.y    = parseInt(this.ui.style.top, 10);
		_preferences.save();
	};


	/**
	 * Modify game details to perform faster
	 */
	function onUpdateQualityDetails()
	{
		GraphicsSettings.quality = parseInt(this.value, 10);
		GraphicsSettings.save();

		Configs.set('quality', GraphicsSettings.quality);
		Renderer.resize();
	}


	/**
	 * Toggle game cursor
	 */
	function onToggleGameCursor()
	{
		GraphicsSettings.cursor = !!this.checked;
		GraphicsSettings.save();

		// display cursor depending on user settings
		if (!GraphicsSettings.cursor) {
			document.body.classList.remove('custom-cursor');
		} else {	
			document.body.classList.add('custom-cursor');
		}
	}

	/**
	 * Update the fps limit
	 */
	function onUpdateFPSLimit()
	{
		GraphicsSettings.fpslimit = parseInt( this.value, 10 );
		GraphicsSettings.save();

		if( Renderer.frameLimit > 0 ) {
			clearInterval( Renderer.updateId );
		}

		Renderer.frameLimit = GraphicsSettings.fpslimit;
		Renderer.rendering = false;
		Renderer.render( null );
	}

	/**
	 * Toggle the fps display
	 */
	function onToggleFPSDisplay()
	{
		FPS.toggle(!!this.checked);
	}

	/**
	 * Resizing window size
	 */
	function onUpdateScreenSize()
	{
		var isFullScreen = Context.isFullScreen();

		GraphicsSettings.screensize = this.value;
		GraphicsSettings.save();

		// FullScreen
		if (GraphicsSettings.screensize === 'full') {
			if (!isFullScreen) {
				Context.requestFullScreen();
			}
			return;
		}

		if (isFullScreen) {
			Context.cancelFullScreen();
		}

		// Resizing
		if (Context.Is.POPUP) {
			var size = GraphicsSettings.screensize.split('x');

			// Only resize/move if needed
			if (size[0] != window.innerWidth && size[1] != window.innerHeight) {
				window.resizeTo( size[0], size[1] );
				window.moveTo( (screen.availWidth - size[0]) / 2, (screen.availHeight - size[1]) / 2 );
			}
		}
	}


	/**
	 * Create component and export it
	 */
	return UIManager.addComponent(GraphicsOption);
});
