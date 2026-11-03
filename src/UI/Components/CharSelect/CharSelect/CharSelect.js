/**
 * UI/Components/CharSelect/CharSelect.js
 *
 * Chararacter Selection windows
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
	var DB                 = require('DB/DBManager');
	var DOM                = require('Utils/DOM');
	var MonsterTable       = require('DB/Monsters/MonsterTable');
	var Preferences        = require('Core/Preferences');
	var KEYS               = require('Controls/KeyEventHandler');
	var Renderer           = require('Renderer/Renderer');
	var Entity             = require('Renderer/Entity/Entity');
	var SpriteRenderer     = require('Renderer/SpriteRenderer');
	var Camera             = require('Renderer/Camera');
	var UIManager          = require('UI/UIManager');
	var UIComponent        = require('UI/UIComponent');
	var htmlText           = require('text!./CharSelect.html');
	var cssText            = require('text!./CharSelect.css');


	/**
	 * Create Chararacter Selection namespace
	 */
	var CharSelect = new UIComponent( 'CharSelect', htmlText, cssText );


	function qs(selector)
	{
		return DOM.qs(CharSelect.ui, selector);
	}


	function qsa(selector)
	{
		return DOM.qsa(CharSelect.ui, selector);
	}


	function setText(el, value)
	{
		if (el) {
			el.textContent = value;
		}
	}


	/**
	 * @var {Preferences} save where the cursor position is
	 */
	var _preferences = Preferences.get('CharSelect', {
		index: 0
	}, 1.0 );


	/**
	 * @var {number} max slots
	 */
	var _maxSlots = 3 * 9;


	/**
	 * var {Array} list of characters
	 */
	var _list = [];


	/**
	 * @var {Array} list of characters (index by slot)
	 */
	var _slots = [];


	/**
	 * @var {Array} list of entities (index by slot)
	 */
	var _entitySlots = [];


	/**
	 * @var {number} selector index
	 */
	var _index = 0;


	/**
	 * @var {Array} canvas context
	 */
	var _ctx = [];


	/**
	 * var {number} sex
	 */
	var _sex = 0;

	/**
	 * var {boolean} disable input
	 */
	var _disable_UI = false;

	/**
	 * Initialize UI
	 */
	CharSelect.init = function Init()
	{
		var ui = this.ui;

		DOM.setCss(ui, {
			top:  (Renderer.height - 342) / 2 + 'px',
			left: (Renderer.width - 576) / 2 + 'px'
		});

		var okBtn = qs('.ok');
		var cancelBtn = qs('.cancel');
		var makeBtn = qs('.make');
		var deleteBtn = qs('.delete');
		var arrowLeft = qs('.arrow.left');
		var arrowRight = qs('.arrow.right');

		if (okBtn) {
			okBtn.addEventListener('click', connect);
		}
		if (cancelBtn) {
			cancelBtn.addEventListener('click', cancel);
		}
		if (makeBtn) {
			makeBtn.addEventListener('click', create);
		}
		if (deleteBtn) {
			deleteBtn.addEventListener('click', suppress);
		}
		if (arrowLeft) {
			arrowLeft.addEventListener('mousedown', genericArrowDown(-1));
		}
		if (arrowRight) {
			arrowRight.addEventListener('mousedown', genericArrowDown(+1));
		}

		var slot1 = qs('.slot1');
		var slot2 = qs('.slot2');
		var slot3 = qs('.slot3');

		if (slot1) {
			slot1.addEventListener('mousedown', genericCanvasDown(0));
		}
		if (slot2) {
			slot2.addEventListener('mousedown', genericCanvasDown(1));
		}
		if (slot3) {
			slot3.addEventListener('mousedown', genericCanvasDown(2));
		}

		qsa('canvas').forEach(function(canvas) {
			canvas.addEventListener('dblclick', function() {
				if (_slots[_index]) {
					connect();
				}
				else {
					create();
				}
			});
			_ctx.push(canvas.getContext('2d'));
		});

		this.draggable();
	};


	/**
	 * Once append to body
	 */
	CharSelect.onAppend = function onAppend()
	{
		_index = _preferences.index;

		setText(qs('.slotinfo .number'), _list.length + ' / ' + _maxSlots);
		setText(qs('.pageinfo .count'), _maxSlots / 3);

		moveCursorTo(_index);

		Renderer.render(render);
	};


	/**
	 * Stop rendering
	 */
	CharSelect.onRemove = function onRemove()
	{
		_preferences.index = _index;
		_preferences.save();
		Renderer.stop();
	};


	/**
	 * Bind Key events
	 *
	 * @param {object} event
	 */
	CharSelect.onKeyDown = function onKeyDown( event )
	{
		switch (event.which) {
			case KEYS.ESCAPE:
				cancel();
				break;

			case KEYS.LEFT:
				moveCursorTo(_index-1);
				break;

			case KEYS.RIGHT:
				moveCursorTo(_index+1);
				break;

			case KEYS.SUPR:
				if (_slots[_index]) {
					suppress();
				}
				break;

			case KEYS.ENTER:
				if (_slots[_index]) {
					connect();
				}
				else {
					create();
				}
				break;

			default:
				return true;
		}

		event.stopImmediatePropagation();
		return false;
	};


	/**
	 * Add players to window
	 *
	 * @param {object} pkt - packet structure
	 */
	CharSelect.setInfo = function setInfo( pkt )
	{
		_maxSlots           = Math.floor((pkt.TotalSlotNum + pkt.PremiumStartSlot) || 9);
		_sex                = pkt.sex;
		_slots.length       = 0;
		_entitySlots.length = 0;
		_list.length        = 0;

		if (pkt.charInfo) {
			var i, count = pkt.charInfo.length;
			for (i = 0; i < count; ++i) {
				CharSelect.addCharacter( pkt.charInfo[i] );
				_maxSlots = Math.max( _maxSlots, Math.floor(pkt.charInfo[i].CharNum / 3 + 1) * 3 );
			}
		}

		setText(qs('.slotinfo .number'), _list.length + ' / ' + _maxSlots);
		setText(qs('.pageinfo .count'), _maxSlots / 3);

		moveCursorTo( _index );
	};


	/**
	 * Answer from server to delete a character
	 *
	 * @param {number} error id
	 */
	CharSelect.deleteAnswer = function DeleteAnswer( error )
	{
		this.on('keydown');

		switch (error) {
			case -2:
				return;

			case -1:
				delete _slots[_index];
				delete _entitySlots[_index];

				var i = 0;
				var count = _list.length;

				while (i < count) {
					if (_list[i].CharNum === _index) {
						_list.splice( i, 1 );
						--count;
					}
					else {
						i++;
					}
				}

				moveCursorTo( _index );
				setText(qs('.slotinfo .number'), _list.length + ' / ' + _maxSlots);
				return;

			default:
			case  0:
				UIManager.showMessageBox( DB.getMessage(301), 'ok' );
				break;
		}
	};


	/**
	 * Adding a Character to the list
	 *
	 * @param {object} character data
	 */
	CharSelect.addCharacter = function addCharacter( character )
	{
		if (!('sex' in character) || character.sex === 99) {
			character.sex = _sex;
		}

		_list.push( character );
		_slots[ character.CharNum ] = character;

		_entitySlots[ character.CharNum ] = new Entity();
		_entitySlots[ character.CharNum ].set( character );
	};


	/**
	 * Disable or Enable the UI.
	 *
	 * @param {boolean}
	 */
	CharSelect.setUIEnabled = function setUIEnabled( value )
	{
		_disable_UI = !value;
	};

	/**
	 * Callback to use
	 */
	CharSelect.onExitRequest    = function onExitRequest(){};
	CharSelect.onDeleteRequest  = function onDeleteRequest(){};
	CharSelect.onCreateRequest  = function onCreateRequest(){};
	CharSelect.onConnectRequest = function onConnectRequest(){};


	/**
	 * Generic method to handle mousedown on arrow
	 *
	 * @param {number} value to move
	 */
	function genericArrowDown( value )
	{
		return function( event ) {
			moveCursorTo((_index + _maxSlots + value) % _maxSlots );
			event.stopImmediatePropagation();
			return false;
		};
	}


	/**
	 * Generic method to handle mousedown on arrow
	 *
	 * @param {number} value to move
	 */
	function genericCanvasDown( value )
	{
		return function( event ) {
			moveCursorTo( Math.floor(_index / 3) * 3 + value );
			event.stopImmediatePropagation();
			return false;
		};
	}


	/**
	 * Press "cancel" or ESCAPE key
	 */
	function cancel()
	{
		if (_disable_UI === false) {
			UIManager.showPromptBox( DB.getMessage(17), 'ok', 'cancel', function(){
				CharSelect.onExitRequest();
			}, null);
		}
	}


	/**
	 * Jumping to Character creation window
	 */
	function create()
	{
		if (_disable_UI === false) {
			CharSelect.onCreateRequest( _index );
		}
	}


	/**
	 * Select Player, connect
	 */
	function connect() {
		if (_disable_UI === false) {
			if (_slots[_index]) {
				_preferences.index = _index;
				_preferences.save();
				CharSelect.onConnectRequest( _slots[_index] );
			}
		}
	}


	/**
	 * Delete a character
	 */
	function suppress() {
		if (_disable_UI === false) {
			if (_slots[_index]) {
				CharSelect.off('keydown');
				CharSelect.onDeleteRequest( _slots[_index].GID );
			}
		}
	}


	/**
	 * Move cursor, update window value
	 *
	 * @param {number} index
	 */
	function moveCursorTo( index )
	{
		var charinfo = qs('.charinfo');
		var boxSelect = qs('.box_select');
		var makeBtn = qs('.make');
		var deleteBtn = qs('.delete');
		var okBtn = qs('.ok');

		var entity = _entitySlots[_index];
		if (entity) {
			entity.setAction({
				action: entity.ACTION.IDLE,
				frame:  0,
				play:   true,
				repeat: true
			});
		}

		_index = (index + _maxSlots) % _maxSlots;

		if (boxSelect) {
			boxSelect.classList.remove('slot1', 'slot2', 'slot3');
			boxSelect.classList.add('slot' + (_index % 3 + 1));
		}

		setText(qs('.pageinfo .current'), Math.floor( _index / 3) + 1);

		entity = _entitySlots[_index];
		if (!entity) {
			if (charinfo) {
				DOM.qsa(charinfo, 'div').forEach(function(div) {
					DOM.empty(div);
				});
			}
			DOM.show(makeBtn);
			DOM.hide(deleteBtn);
			DOM.hide(okBtn);
			return;
		}

		entity.setAction({
			action: entity.ACTION.READYFIGHT,
			frame:  0,
			play:   true,
			repeat: true
		});

		DOM.hide(makeBtn);
		DOM.show(deleteBtn);
		DOM.show(okBtn);

		var info = _slots[_index];
		setText(DOM.qs(charinfo, '.name'), info.name);
		setText(DOM.qs(charinfo, '.job'), MonsterTable[info.job] || '');
		setText(DOM.qs(charinfo, '.lvl'), info.level);
		setText(DOM.qs(charinfo, '.exp'), info.exp);
		setText(DOM.qs(charinfo, '.hp'), info.hp);
		setText(DOM.qs(charinfo, '.sp'), info.sp);
		setText(DOM.qs(charinfo, '.map'), DB.getMapName( (info.lastMap || '').replace('.gat','.rsw') ));
		setText(DOM.qs(charinfo, '.str'), info.Str);
		setText(DOM.qs(charinfo, '.agi'), info.Agi);
		setText(DOM.qs(charinfo, '.vit'), info.Vit);
		setText(DOM.qs(charinfo, '.int'), info.Int);
		setText(DOM.qs(charinfo, '.dex'), info.Dex);
		setText(DOM.qs(charinfo, '.luk'), info.Luk);
	}


	/**
	 * Render sprites to canvas
	 */
	function render()
	{
		var i, count, idx;

		Camera.direction = 4;
		idx              = Math.floor(_index / 3) * 3;
		count            = _ctx.length;

		for (i = 0; i < count; ++i) {
			_ctx[i].clearRect(0, 0, _ctx[i].canvas.width, _ctx[i].canvas.height);

			if (_entitySlots[idx+i]) {
				SpriteRenderer.bind2DContext(_ctx[i], 63, 130);
				_entitySlots[idx+i].renderEntity();
			}
		}
	}


	/**
	 * Create componentand export it
	 */
	return UIManager.addComponent(CharSelect);
});
