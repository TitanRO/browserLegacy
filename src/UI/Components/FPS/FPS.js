/**
 * UI/Components/FPS/FPS.js
 *
 * Manage Graphics details
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author IssID
 */
define(function(require)
{
	'use strict';

	/**
	 * Dependencies
	 */
	var Preferences      = require('Core/Preferences');
	var Renderer         = require('Renderer/Renderer');
	var UIManager        = require('UI/UIManager');
	var UIComponent      = require('UI/UIComponent');
	var htmlText         = require('text!./FPS.html');
	var cssText          = require('text!./FPS.css');
	var DOM             = require('Utils/DOM');

	/**
	 * Create Component
	 */
	var FPS = new UIComponent( 'FPS', htmlText, cssText );

	/**
	 * @var {Preferences} Graphics
	 */
	var _preferences = Preferences.get('FPS', {
		show: false,
		x:    300,
		y:    300
	}, 1.1);


	/**
	 * Initialize UI
	 */
	FPS.init = function Init()
	{
		this.draggable(this.ui.querySelector('.titlebar'));
	};

	/**
	 * When append the element to html
	 */
	FPS.onAppend = function OnAppend()
	{
		// Apply preferences
		if (!_preferences.show) {
			DOM.hide(this.ui);
		} else {
			DOM.show(this.ui);
		}

		DOM.setCss(this.ui, {
			top:  _preferences.y,
			left: _preferences.x,
		});

		var fps = this.ui.querySelector('#fpsCounter');
		var startTime = 0;
		var frame = 0;

		function tick( timeDelta ) {
			frame++;
			if (timeDelta - startTime >= 1000) {
				var value = (frame / ((timeDelta - startTime) / 1000)).toFixed(1);
				fps.textContent =  value ;
				
				var frameLimit = Renderer.frameLimit > 0 ? Renderer.frameLimit : value;
				this.ui.style.color = value >= frameLimit - ( ( 10 / frameLimit ) * 100 ) ? 'green' : value >= 15 ? 'orange' : 'red';
				startTime = timeDelta;
				frame = 0;
			}
		}
		Renderer.render( tick.bind(this) );
	};

	/**
	 * Once remove, save preferences
	 */
	FPS.onRemove = function onRemove()
	{
		_preferences.x       = parseInt(this.ui.style.left, 10);
		_preferences.y       = parseInt(this.ui.style.top, 10);
		_preferences.show    = DOM.isVisible(this.ui);
		_preferences.save();
	};


	/**
	 * Show/Hide UI
	 */
	FPS.toggle = function toggle(isVisible)
	{
		_preferences.x       = parseInt(this.ui.style.left, 10);
		_preferences.y       = parseInt(this.ui.style.top, 10);
		_preferences.show    = isVisible;
		_preferences.save();

		DOM.toggleDisplay(this.ui);

		if (DOM.isVisible(this.ui)) {
			this.focus();
		}
	};

	/**
	 * Create component and export it
	 */
	return UIManager.addComponent(FPS);
});
