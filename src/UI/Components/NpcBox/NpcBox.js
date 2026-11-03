/**
 * UI/Components/NpcBox/NpcBox.js
 *
 * NPC Box windows
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
	var KEYS        = require('Controls/KeyEventHandler');
	var Renderer    = require('Renderer/Renderer');
	var UIManager   = require('UI/UIManager');
	var UIComponent = require('UI/UIComponent');
	var ItemInfo    = require('UI/Components/ItemInfo/ItemInfo');
	var Navigation  = require('UI/Components/Navigation/Navigation');
	var htmlText    = require('text!./NpcBox.html');
	var cssText     = require('text!./NpcBox.css');
	var DOM             = require('Utils/DOM');


	/**
	 * Create NpcBox component
	 */
	var NpcBox = new UIComponent( 'NpcBox', htmlText, cssText );



	/**
	 * @var {boolean} does the box need to be clean up?
	 */
	var _needCleanUp = false;


	/**
	 * @var {integer} NPC GID
	 */
	var _ownerID = 0;

	Object.defineProperty(NpcBox, 'ownerID', {
		get: function() { return _ownerID; }
	});


	/**
	 * Process NAVI tags in text (<NAVI>Display Name<INFO>mapname,x,y,0,000,flag</INFO></NAVI>)
	 * @param {string} text - The text to process
	 * @returns {string} HTML with processed NAVI tags
	 */
	function processNAVITags(text) {
		if (!text) return '';
		text = String(text);
		return text.replace(/<NAVI>([^<]+)<INFO>([^<]+)<\/INFO><\/NAVI>/g, function(match, displayName, naviInfo) {
			return '<span class="navi-link" data-navi-info="' + naviInfo + '" data-navi-name="' + displayName + '">' + displayName + '</span>';
		});
	}

	/**
	 * Process ITEM tags in text (<ITEM>Name<INFO>ID</INFO></ITEM>)
	 * @param {string} text - The text to process
	 * @returns {string} HTML with processed item tags
	 */
	function processItemTags(text) {
		if (!text) return '';
		text = String(text);
		return text.replace(/<ITEM>([^<]+)<INFO>(\d+)<\/INFO><\/ITEM>/g, function(match, itemName, itemId) {
			return '<span class="item-link" data-item-id="' + itemId + '">' + itemName + '</span>';
		});
	}

	/**
	 * Process color codes in text (^RRGGBB)
	 * @param {string} text - The text to process
	 * @returns {string} HTML with color spans
	 */
	function processColorCodes(text) {
		if (!text) return '';
		text = String(text);
		return text.replace(/\^([0-9A-Fa-f]{6})/g, function(match, color) {
			return '<span style="color:#' + color + '">';
		}).replace(/\^000000/g, '</span>');
	}

	/**
	 * Process all text formatting (color codes, NAVI tags, and item tags)
	 * @param {string} text - The text to process
	 * @returns {string} Fully processed HTML
	 */
	function processText(text) {
		if (!text) return '';
		text = processItemTags(text);
		text = processNAVITags(text);
		text = processColorCodes(text);
		return text;
	}

	/**
	 * Initialize Component
	 */
	NpcBox.init = function init()
	{
		DOM.setCss(this.ui, {
			top: Math.max(100, Renderer.height/2 - 200),
			left: Math.max( Renderer.width/3, 20)
		});

		// Bind mouse
		this.ui.querySelector('.next').addEventListener('click',  NpcBox.next.bind(this) );
		this.ui.querySelector('.close').addEventListener('click',  NpcBox.close.bind(this) );

		// Content do not drag window (official)
		// Will also fix the problem about the scrollbar
		this.ui.querySelector('.content').addEventListener('mousedown', function(event){
			event.stopImmediatePropagation();
		});

		// Add click handler for item links
		DOM.addDelegatedEvent(this.ui, 'click', '.item-link', function(event) {
			var itemId = parseInt(this.getAttribute('data-item-id'), 10);
			if (!itemId) {
				return;
			}

			// Don't add the same UI twice, remove it
			if (ItemInfo.uid === itemId) {
				ItemInfo.remove();
				return;
			}

			// Add ui to window
			ItemInfo.append();
			ItemInfo.uid = itemId;
			ItemInfo.setItem({ ITID: itemId, IsIdentified: true });
		});

		// Add click handler for navi links
		DOM.addDelegatedEvent(this.ui, 'click', '.navi-link', function(event) {
			var naviInfo = this.getAttribute('data-navi-info');
			var displayName = this.getAttribute('data-navi-name');

			if (!naviInfo) {
				return;
			}

			// If the Navigation window is already showing this location, toggle it off
			if (Navigation.uid === naviInfo && DOM.isVisible(Navigation.ui)) {
				Navigation.hide();
				return;
			}

			// Show the Navigation window and set the info
			Navigation.uid = naviInfo;
			Navigation.setNaviInfo(naviInfo, displayName);
			Navigation.show();
		});

		this.draggable();
	};


	/**
	 * Once NPC Box is removed from HTML, clean up data
	 */
	NpcBox.onRemove = function onRemove()
	{
		DOM.hide(this.ui.querySelector('.next'));
		DOM.hide(this.ui.querySelector('.close'));
		this.ui.querySelector('.content').textContent = '';

		_needCleanUp = false;
		_ownerID     = 0;

		// Cutin system
		var cutin = document.getElementById('cutin');
		if (cutin) {
			document.body.removeChild( cutin );
		}
	};


	/**
	 * Add support for Enter key
	 */
	NpcBox.onKeyDown = function onKeyDown( event )
	{
		switch (event.which) {
			case KEYS.SPACE:	// Same as Enter
			case KEYS.ENTER:
				if (DOM.isVisible(this.ui.querySelector('.next'))) {
					this.next();
					break;
				}
				else if (DOM.isVisible(this.ui.querySelector('.close'))) {
					this.close();
					break;
				}
				return true;

			case KEYS.ESCAPE:
				if (DOM.isVisible(this.ui.querySelector('.close'))) {
					this.close();
					break;
				}
				return true;

			default:
				return true;
		}

		event.stopImmediatePropagation();
		return false;
	};


	/**
	 * Add text to box
	 *
	 * @param {string} text to display
	 * @param {number} gid - npc id
	 */
	NpcBox.setText = function SetText( text, gid )
	{
		var content = this.ui.querySelector('.content');
		_ownerID    = gid;

		if (_needCleanUp) {
			_needCleanUp = false;
			content.textContent = '';
		}

		var div = document.createElement('div');
		div.innerHTML = processText(text);
		content.appendChild(div);
	};


	/**
	 * Add next button
	 *
	 * @param {number} gid - npc id
	 */
	NpcBox.addNext = function addNext( gid )
	{
		_ownerID = gid;
		DOM.show(this.ui.querySelector('.next'));
	};


	/**
	 * Add close button
	 *
	 * @param {number} gid - npc id
	 */
	NpcBox.addClose = function addClose( gid )
	{
		_ownerID = gid;
		DOM.show(this.ui.querySelector('.close'));
	};


	/**
	 * Press "next" button
	 */
	NpcBox.next = function Next()
	{
		_needCleanUp = true;
		DOM.hide(this.ui.querySelector('.next'));
		this.onNextPressed( _ownerID );
	};


	/**
	 * Press "close" button
	 */
	NpcBox.close = function Close()
	{
		_needCleanUp = true;
		DOM.hide(this.ui.querySelector('.close'));
		this.onClosePressed( _ownerID );
	};


	/**
	 * Callback
	 */
	NpcBox.onClosePressed = function OnClosePressed(){};
	NpcBox.onNextPressed  = function OnNextPressed(){};


	/**
	 * Create component based on view file and export it
	 */
	return UIManager.addComponent(NpcBox);
});
