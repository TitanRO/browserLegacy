/**
 * UI/Components/Equipment/Equipment.js
 *
 * Chararacter Equipment window
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
	var DOM         = require('Utils/DOM');
	var Network     = require('Network/NetworkManager');
	var PACKET      = require('Network/PacketStructure');
	var Client      = require('Core/Client');
	var Preferences = require('Core/Preferences');
	var Session     = require('Engine/SessionStorage');
	var Renderer    = require('Renderer/Renderer');
	var Entity      = require('Renderer/Entity/Entity');
	var SpriteRenderer  = require('Renderer/SpriteRenderer');
	var UIManager   = require('UI/UIManager');
	var UIComponent = require('UI/UIComponent');
	var ChatBox     = require('UI/Components/ChatBox/ChatBox');
	var ChatRoom    = require('UI/Components/ChatRoom/ChatRoom');
	var htmlText    = require('text!./ChangeCart.html');
	var cssText     = require('text!./ChangeCart.css');


	/**
	 * Create Component
	 */
	var ChangeCart = new UIComponent( 'ChangeCart', htmlText, cssText );


	function qs(selector)
	{
		return DOM.qs(ChangeCart.ui, selector);
	}


	function qsa(selector)
	{
		return DOM.qsa(ChangeCart.ui, selector);
	}


	/**
	 * @var {Preference} window preferences
	 */
	var _preferences = Preferences.get('ChangeCart', {
		show:     false,
	}, 1.0);
	
	/**
	 * @var {object} model info
	 */
	var _models = {};


	/**
	 * Initialize UI
	 */
	ChangeCart.init = function init()
	{
		var carts = qsa('.cart');
		var canvases = qsa('.canvas');
		
		DOM.setCss(this.ui, {
			top:  (Renderer.height - 100) / 2.0 + 'px',
			left: (Renderer.width  - 400) / 2.0 + 'px'
		});


		qs('.titlebar .close').addEventListener('click', function(){ DOM.hide(ChangeCart.ui); });
		this.draggable(qs('.titlebar'));

		carts.forEach(function(cart) {
			DOM.hide(cart);
			cart.classList.add('event_add_cursor');
			cart.addEventListener('click', function(event) {
				onCart(event.target.getAttribute('data-id'));
			});
			cart.addEventListener('mouseover', function(event) {
				_models[event.target.getAttribute('data-id')].entity.action = 1;
			});
			cart.addEventListener('mouseout', function(event) {
				_models[event.target.getAttribute('data-id')].entity.action = 0;
			});
		});
			
		canvases.forEach(function(canvas) {
			var cartid = canvas.getAttribute("data-id");
			var model = {
				entity: new Entity(),
				ctx:    canvas.getContext('2d'),
				render: false,
				tick:   0
			};
			model.entity.set({
				type: Entity.TYPE_EFFECT,
				action: 0,
				direction: 5
			});
			
			model.entity.hasCart = true;
			model.entity.CartNum = cartid;
			model.entity.hideShadow = true;
			_models[cartid] = model;
		});
	};

	/**
	 * Change cart (Change cart packet IDs are not the same as global cart IDs!!)
	 */
	function onCart(num)
	{
		if(Session.Entity.hasCart == false || num<0 || num>8)
		{
			return;
		}

		var pkt = new PACKET.CZ.REQ_CHANGECART();
		pkt.num = num;
		Network.sendPacket(pkt);
		DOM.hide(ChangeCart.ui);
	}

	/**
	 * Append to body
	 */
	ChangeCart.onAppend = function onAppend()
	{
		DOM.hide(this.ui);
	};

	ChangeCart.onChangeCartSkill = function onChangeCartSkill()
	{
		if(Session.Entity.hasCart == false)
		{
			return;
		}

		DOM.show(this.ui);

		var msg = "Change Cart!!";

		if (ChatRoom.isOpen) {
			ChatRoom.message(msg);
			return;
		}

		ChatBox.addText( msg, ChatBox.TYPE.PUBLIC | ChatBox.TYPE.SELF, ChatBox.FILTER.PUBLIC_LOG );
		if (Session.Entity) {
			Session.Entity.dialog.set( msg );
		}
		
		updateList(Session.Character.level);
		Renderer.render(render);
	};

	ChangeCart.onLevelUp = function onLevelUp(blvl)
	{
		updateList(blvl);
	};
	
	function updateList(blvl){
		if(Session.Entity.hasCart == false)
		{
			return;
		}

		qsa('.cart').forEach(function(cart) {
			DOM.hide(cart);
		});
		stopAllCart();

		if(blvl > 131) { DOM.show(qs(".cart[data-id='9']")); _models['9'].render = true; }
		if(blvl > 121) { DOM.show(qs(".cart[data-id='8']")); _models['8'].render = true; }
		if(blvl > 111) { DOM.show(qs(".cart[data-id='7']")); _models['7'].render = true; }
		if(blvl > 100) { DOM.show(qs(".cart[data-id='6']")); _models['6'].render = true; }
       	if(blvl > 90)  { DOM.show(qs(".cart[data-id='5']")); _models['5'].render = true; }
		if(blvl > 80)  { DOM.show(qs(".cart[data-id='4']")); _models['4'].render = true; }
		if(blvl > 65)  { DOM.show(qs(".cart[data-id='3']")); _models['3'].render = true; }
		if(blvl > 40)  { DOM.show(qs(".cart[data-id='2']")); _models['2'].render = true; }

		DOM.show(qs(".cart[data-id='1']"));
		_models['1'].render = true;
	}
	
	/**
	 * Remove component from HTML
	 * Stop rendering
	 */
	ChangeCart.onRemove = function onRemove()
	{
		stopAllCart();
		Renderer.stop(render);
	};
	
	/**
	 * Rendering the Carts
	 */
	function render( tick )
	{
		Object.entries(_models).forEach((entry) => {
			const [key, model] = entry;
			SpriteRenderer.bind2DContext(model.ctx, Math.floor(model.ctx.canvas.width), model.ctx.canvas.height);
			model.ctx.clearRect(0, 0, model.ctx.canvas.width, model.ctx.canvas.height );
			model.entity.renderEntity();
		});
	}
	
	function stopAllCart(){
		Object.entries(_models).forEach((entry) => {
			const [key, model] = entry;
			model.render = false;
		});
	}


	/**
	 * Create component and export it
	 */
	return UIManager.addComponent(ChangeCart);
});
