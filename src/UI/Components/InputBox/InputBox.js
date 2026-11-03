/**
 * UI/Components/InputBox/InputBox.js
 *
 * NPC input GUI
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
	var Renderer           = require('Renderer/Renderer');
	var KEYS               = require('Controls/KeyEventHandler');
	var DB                 = require('DB/DBManager');
	var UIManager          = require('UI/UIManager');
	var UIComponent        = require('UI/UIComponent');
	var htmlText           = require('text!./InputBox.html');
	var cssText            = require('text!./InputBox.css');
	var DOM             = require('Utils/DOM');


	/**
	 * Create NpcBox component
	 */
	var InputBox = new UIComponent( 'InputBox', htmlText, cssText );


	/**
	 * Initialize GUI
	 */
	InputBox.init = function Init()
	{
		this.draggable();
		DOM.setCss(this.ui, { top: (Renderer.height-120)/1.5-49, left: (Renderer.width -280)/2+1 });
		this.ui.querySelector('button').addEventListener('click', validate.bind(this));
		this.ui.querySelector('input').addEventListener('mousedown', function(event) {
			event.stopImmediatePropagation();
		});

		this.overlay = document.createElement('div');
		this.overlay.classList.add('win_popup_overlay');
		this.overlay.style.zIndex = 30;
		this.overlay.addEventListener('click', function(){
			InputBox.remove();
		});
	};


	/**
	 * Input Post-Render callback
	 * Should append data, focus, select text, etc...
	 */
	InputBox.onAppend = function OnAppend() {};


	/**
	 * Remove data from UI
	 */
	InputBox.onRemove = function OnRemove()
	{
		this.ui.querySelector('input').value = '';
		this.ui.querySelector('.text').textContent = '';
		this.ui.querySelector('input').addEventListener('keydown', null);
		DOM.detach(this.overlay);
	};


	/**
	 * Key Listener
	 *
	 * @param {object} event
	 * @return {boolean}
	 */
	InputBox.onKeyDown = function OnKeyDown( event )
	{
		if (!this.isPersistent && event.which === KEYS.ENTER) {
			validate.call(this);
			event.stopImmediatePropagation();
			return false;
		}

		return true;
	};


	/**
	 * Validate input
	 *
	 * @param {ClickEvent}
	 */
	function validate()
	{
		var text = this.ui.querySelector('input').value;

		if (!this.isPersistent || text.length) {

			if (this.ui.classList.contains('number')) {
				text = parseInt(text, 10) | 0;
			}

			this.onSubmitRequest( text );
		}
	}


	/**
	 * Set input type
	 *
	 * @param {string} input type (number or text)
	 * @param {boolean} is the popup persistent ? false : clicking in any part of the game will remove the input
	 * @param {string|number} default value to show in the input
	 */
	InputBox.setType = function setType( type, isPersistent, defaultVal, itemId = null)
	{
		this.isPersistent = !!isPersistent;

		if (!this.isPersistent) {
			this.overlay.appendTo('body');
		}

		switch (type) {
			case 'number':
				this.ui.classList.add('number');
				this.ui.querySelector('.text').textContent = DB.getMessage(1259);
				this.ui.querySelector('input').setAttribute('type', 'text');
				defaultVal = defaultVal || 0;
				break;

			case 'price':
				this.ui.classList.add('number');
				this.ui.querySelector('.text').textContent =  'Input Price' ;
				this.ui.querySelector('input').setAttribute('type', 'text');
				defaultVal = defaultVal || 0;
				break;

			case 'text':
				this.ui.classList.remove('number');
				this.ui.querySelector('.text').textContent = '';
				this.ui.querySelector('input').setAttribute('type', 'text');
				break;

			case 'shopname':
				this.ui.classList.remove('number');
				this.ui.querySelector('.text').textContent = 'Input your Shop Name';
				this.ui.querySelector('input').setAttribute('type', 'text');
				break;

			case 'pass':
				this.ui.classList.remove('number');
				this.ui.querySelector('.text').textContent = '';
				this.ui.querySelector('input').setAttribute('type', 'password');
				break;

			case 'mail':
				this.ui.classList.remove('number');
				this.ui.querySelector('.text').textContent = DB.getMessage(300);
				this.ui.querySelector('input').setAttribute('type', 'password');
				break;
			
			case 'birthdate':
				this.ui.classList.remove('number');
				this.ui.querySelector('.text').textContent = DB.getMessage(1815);
				this.ui.querySelector('input').setAttribute('type', 'text');
				break;

			case 'item':
				this.ui.classList.add('number');
				this.ui.querySelector('.text').textContent = DB.getItemInfo(itemId).identifiedDisplayName;
				this.ui.querySelector('input').setAttribute('type', 'text');
				defaultVal = defaultVal || 0;
				break;

		}

		if (typeof defaultVal !== 'undefined') {
			var _inputEl = this.ui.querySelector('input');
			_inputEl.value = defaultVal;
			_inputEl.select();
		}
	};


	/**
	 * Callback to define
	 */
	InputBox.onSubmitRequest = function OnSubmitRequest(){};


	/**
	 * Stored component and return it
	 */
	return UIManager.addComponent(InputBox);
});
