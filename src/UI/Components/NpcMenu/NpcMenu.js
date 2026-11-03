/**
 * UI/Components/NpcMenu/NpcMenu.js
 *
 * Display npc menu
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
	var htmlText           = require('text!./NpcMenu.html');
	var cssText            = require('text!./NpcMenu.css');
	var DOM             = require('Utils/DOM');


	/**
	 * Create NPC Menu component
	 */
	var NpcMenu = new UIComponent( 'NpcMenu', htmlText, cssText );


	/**
	 * @var {number} index selected in menu
	 */
	var _index = 0;


	/**
	 * @var {number} NPC ID
	 */
	var _ownerID = 0;


	/**
	 * Initialize component
	 */
	NpcMenu.init = function init()
	{
		this.ui.querySelector('.ok').addEventListener('click', validate.bind(this));
		this.ui.querySelector('.cancel').addEventListener('click', cancel.bind(this));

		DOM.setCss(this.ui, {
			top: Math.max(376, Renderer.height/2 + 76 ),
			left: Math.max( Renderer.width/3, 20)
		});

		this.draggable();

		var self = this;
		var _content = this.ui.querySelector('.content');

		// Scroll feature should block at each line
		_content.addEventListener('mousewheel', onScroll);
		_content.addEventListener('DOMMouseScroll', onScroll);

		// Manage indexes
		DOM.addDelegatedEvent(_content, 'mousedown', 'div', function(event) {
			selectIndex.call(self, this);
		});

		// Select index
		DOM.addDelegatedEvent(_content, 'dblclick', 'div', validate.bind(this));

		// Stop drag drop
		_content.addEventListener('mousedown', function(event) {
			event.stopImmediatePropagation();
			return false;
		});
	};


	/**
	 * Clean up events
	 */
	NpcMenu.onRemove = function onRemove()
	{
		this.ui.querySelector('.content').innerHTML = '';
	};


	/**
	 * Bind KeyDown event
	 */
	NpcMenu.onKeyDown = function onKeyDown(event)
	{
		var count, top;
		var content;

		switch (event.which) {

			case KEYS.SPACE:	// Same as Enter
			case KEYS.ENTER:
				validate.call(this);
				break;

			case KEYS.ESCAPE:
				cancel.call(this);
				break;

			case KEYS.UP:
				count  = this.ui.querySelectorAll('.content div').length;
				_index = Math.max( _index - 1, 0 );

				this.ui.querySelectorAll('.content div').forEach(function(el) {
					el.classList.remove('selected');
				});
				this.ui.querySelectorAll('.content div')[_index].classList.add('selected');

				content = this.ui.querySelector('.content');
				top     = _index * 20;

				if (top < content.scrollTop) {
					content.scrollTop = top;
				}
				break;

			case KEYS.DOWN:
				count  = this.ui.querySelectorAll('.content div').length;
				_index = Math.min( _index + 1, count -1 );

				this.ui.querySelectorAll('.content div').forEach(function(el) {
					el.classList.remove('selected');
				});
				this.ui.querySelectorAll('.content div')[_index].classList.add('selected');

				content = this.ui.querySelector('.content');
				top     = _index * 20;

				if (top >= content.scrollTop + 80) {
					content.scrollTop = top - 60;
				}
				break;

			default:
				return true;
		}

		event.stopImmediatePropagation();
		return false;
	};


	/**
	 * Initialize menu
	 *
	 * @param {string} menu
	 * @param {number} gid - npc id
	 */
	NpcMenu.setMenu = function SetMenu( menu, gid )
	{
		var content, list;
		var i, j, count;

		content  = this.ui.querySelector('.content');
		list     = menu.split(':');
		_ownerID = gid;
		_index   = 0;

		content.innerHTML = '';

		for (i = 0, j = 0, count = list.length; i < count; ++i) {
			// Don't display empty menu
			if (list[i].length) {
				var div = document.createElement('div');
				div.textContent = list[i];
				div.setAttribute('data-index', j++);
				content.appendChild(div);
			}
		}

		var firstDiv = content.querySelector('div');
		if (firstDiv) {
			firstDiv.classList.add('selected');
		}
	};


	/**
	 * Submit an index
	 */
	function validate()
	{
		this.onSelectMenu( _ownerID, _index + 1 );
	}


	/**
	 * Pressed cancel, client send "255" as value
	 */
	function cancel()
	{
		this.onSelectMenu( _ownerID, 255 );
	}


	/**
	 * Select an index, change background color
	 */
	function selectIndex($this)
	{
		Array.from(this.ui.querySelectorAll('.content div')).forEach(function(el){ el.classList.remove('selected'); });
		$this.classList.add('selected');

		_index = parseInt($this.getAttribute('data-index'), 10);
	}


	/**
	 * Update scroll by block (20px)
	 */
	function onScroll( event )
	{
		var delta;

		if (event.wheelDelta) {
			delta = event.wheelDelta / 120 ;
			if (window.opera) {
				delta = -delta;
			}
		}
		else if (event.detail) {
			delta = -event.detail;
		}

		this.scrollTop = Math.floor(this.scrollTop/20) * 20 - (delta * 20);
		return false;
	}


	/**
	 * Abstract callback to define
	 */
	NpcMenu.onSelectMenu = function OnSelectMenu(/*gid, index*/){};


	/**
	 * Create componentand export it
	 */
	return UIManager.addComponent(NpcMenu);
});
