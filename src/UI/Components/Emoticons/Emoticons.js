/**
 * UI/Components/Emoticons/Emoticons.js
 *
 * Emoticons Interface
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
	var EmoticonsDB    = require('DB/Emotions');
	var Client         = require('Core/Client');
	var Preferences    = require('Core/Preferences');
	var Renderer       = require('Renderer/Renderer');
	var SpriteRenderer = require('Renderer/SpriteRenderer');
	var Entity         = require('Renderer/Entity/Entity');
	var UIManager      = require('UI/UIManager');
	var UIComponent    = require('UI/UIComponent');
	var ChatBox        = require('UI/Components/ChatBox/ChatBox');
	var htmlText       = require('text!./Emoticons.html');
	var cssText        = require('text!./Emoticons.css');
	var DOM             = require('Utils/DOM');



	/**
	 * Create Component
	 */
	var Emoticons = new UIComponent( 'Emoticons', htmlText, cssText );


	/**
	 * @var {number} page index
	 */
	var _page = 0;


	/**
	 * @var {number} emoticons per page
	 */
	var EMOTICONS_PER_PAGE = 30;


	/**
	 * @var {number} total pages
	 */
	var TOTAL_PAGES = 0;


	/**
	 * @var {number} emoticons count
	 */
	var EMOTICONS_COUNT = Object.keys(EmoticonsDB.order).length;


	/**
	 * @var {object} emoticons action file
	 */
	var _action;


	/**
	 * @var {object} emoticons sprite
	 */
	var _sprite;


	/**
	 * @var {Entity} Helper to render sprites
	 */
	var _entity = new Entity();


	/**
	 * @var {Preference} structure to save
	 */
	var _preferences = Preferences.get('Emoticons', {
		x:        600,
		y:        200,
		show:   false
	}, 1.0);


	/**
	 * Initialize UI
	 */
	Emoticons.init = function init()
	{
		Client.loadFiles([
			'data/sprite/\xc0\xcc\xc6\xd1\xc6\xae/emotion.act',
			'data/sprite/\xc0\xcc\xc6\xd1\xc6\xae/emotion.spr'
			], function (act, spr) {
				_action     = act;
				_sprite     = spr;
				TOTAL_PAGES = Math.floor(EMOTICONS_COUNT / EMOTICONS_PER_PAGE);

				var totalEl = this.ui && this.ui.querySelector('.navigation .total');
				if (totalEl) {
					totalEl.textContent = TOTAL_PAGES + 1;
				}
				this.movePage(0);
			}.bind(this)
		);

		var _emoticonContent = this.ui.querySelector('.content');
		DOM.addDelegatedEvent(_emoticonContent, 'dblclick', 'canvas', onPlayEmoticon);
		DOM.addDelegatedEvent(_emoticonContent, 'mousedown', 'canvas', onSelectEmoticon);

		this.ui.querySelector('.base').addEventListener('mousedown', function(event){
			event.stopImmediatePropagation();
			return false;
		});

		this.ui.querySelector('.prev').classList.add('disabled');
		this.ui.querySelector('.close').addEventListener('click', onClose);
		this.ui.querySelector('.prev').addEventListener('click', movePage(-1));
		this.ui.querySelector('.next').addEventListener('click', movePage(+1));

		this.draggable(this.ui.querySelector('.titlebar'));
	};


	/**
	 * Appending to html
	 */
	Emoticons.onAppend = function onAppend()
	{
		if (!_preferences.show) {
			DOM.hide(this.ui);
		}

		DOM.setCss(this.ui, {
			top:  Math.min( Math.max( 0, _preferences.y), Renderer.height - this.ui.offsetHeight),
			left: Math.min( Math.max( 0, _preferences.x), Renderer.width  - this.ui.offsetWidth)
		});
	};


	/**
	 * Once removed from DOM, save preferences
	 */
	Emoticons.onRemove = function OnRemove()
	{
		_preferences.show   =  DOM.isVisible(this.ui);
		_preferences.y      =  parseInt(this.ui.style.top, 10);
		_preferences.x      =  parseInt(this.ui.style.left, 10);
		_preferences.save();
	};


	/**
	 * Update page
	 *
	 * @param {number} direction
	 */
	Emoticons.movePage = function movePage( direction )
	{
		this.ui.querySelectorAll('.prev, .next').forEach(function(button) {
			button.classList.remove('disabled');
		});

		_page += direction;

		if (_page <= 0) {
			this.ui.querySelector('.prev').classList.add('disabled');
			_page = 0;
		}

		if (_page >= TOTAL_PAGES) {
			this.ui.querySelector('.next').classList.add('disabled');
			_page = TOTAL_PAGES;
		}

		var currentEl = this.ui.querySelector('.navigation .current');
		if (currentEl) {
			currentEl.textContent = _page + 1;
		}

		refreshList(this.ui.querySelector('.content'));
	};


	/**
	 * Process shortcut
	 *
	 * @param {object} key
	 */
	Emoticons.onShortCut = function onShurtCut( key )
	{
		switch (key.cmd) {
			case 'TOGGLE':
				DOM.toggleDisplay(this.ui);
				if (DOM.isVisible(this.ui)) {
					this.focus();
				}
				break;
		}
	};


	/**
	 * Generic move page function
	 *
	 * @param {number} index
	 * @return {function}
	 */
	function movePage(index)
	{
		return function movePageClosure() {
			if (!this.className.match(/disabled/)) {
				Emoticons.movePage(index);
			}
		};
	}


	/**
	 * Exit window
	 */
	function onClose()
	{
		Emoticons.ui.style.display = 'none';
	}


	/**
	 * Select an emoticon
	 * Display the command shortcut in the ShortCuts
	 */
	function onSelectEmoticon()
	{
		var idx = this.getAttribute('data-index');
		var cmd = EmoticonsDB.names[idx];
		var ShortCuts 	= require('UI/Components/ShortCuts/ShortCuts');

		if(cmd && DOM.isVisible(ShortCuts.ui)){
			if(ShortCuts.ui.querySelector('.input_alt_focus'))
				ShortCuts.ui.querySelector('.input_alt_focus').value = '/' + cmd.select()
		}
	}


	/**
	 * Do an emoticon
	 */
	function onPlayEmoticon()
	{
		var idx = this.getAttribute('data-index');
		var cmd = EmoticonsDB.names[idx];

		ChatBox.ui.querySelector('.input .message').value = '/' + cmd;
		ChatBox.submit();
	}


	/**
	 * Refresh emoticons list
	 *
	 * @param {jQuery object} content
	 */
	function refreshList( content )
	{
		var canvas, ctx;
		var animation, animations, layers;
		var i, count;

		var index = EMOTICONS_PER_PAGE * _page;
		var end   = Math.min(EMOTICONS_COUNT, index + EMOTICONS_PER_PAGE);
		var pos   = [0, 0];
		var emo;

		content.innerHTML = '';

		while (index < end) {
			canvas        = document.createElement('canvas');
			ctx           = canvas.getContext('2d');
			canvas.width  = 40;
			canvas.height = 40;
			emo           = EmoticonsDB.order[index];

			canvas.setAttribute('data-index', emo);
			animations    = _action.actions[emo].animations;

			// Do not ask why, but we don't know how Gravity find
			// the animation to render:
			animation     = animations[ Math.floor(animations.length / 5) ];
			layers        = animation.layers;
			count         = layers.length;

			SpriteRenderer.bind2DContext( ctx, 20-layers[0].pos[0], 40-layers[0].pos[1]);

			for (i = 0; i < count; ++i) {
				_entity.renderLayer( layers[i], _sprite, _sprite, 1.0, pos, false);
			}

			content.append(canvas);
			index++;
		}
	}


	/**
	 * Export
	 */
	return UIManager.addComponent(Emoticons);
});
