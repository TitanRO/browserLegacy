/**
 * UI/Components/Sense/Sense.js
 *
 * Sense window
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 *
 */
define(function(require)
{
	'use strict';


	/**
	 * Dependencies
	 */
	var DOM            = require('Utils/DOM');
	var DB             = require('DB/DBManager');
	var Renderer       = require('Renderer/Renderer');
	var Entity         = require('Renderer/Entity/Entity');
	var SpriteRenderer = require('Renderer/SpriteRenderer');
	var UIManager      = require('UI/UIManager');
	var UIComponent    = require('UI/UIComponent');
	var htmlText       = require('text!./Sense.html');
	var cssText        = require('text!./Sense.css');


	/**
	 * Create Component
	 */
	var Sense = new UIComponent( 'Sense', htmlText, cssText );


	function qs(selector)
	{
		return DOM.qs(Sense.ui, selector);
	}


	function setText(el, value)
	{
		if (el) {
			DOM.setFormattedText(el, value, DB.getItemInfo.bind(DB));
		}
	}


	function setElementClasses(el, good, bad)
	{
		if (!el) {
			return;
		}

		el.classList.remove('element_good');
		el.classList.remove('element_bad');

		if (good) {
			el.classList.add('element_good');
		}
		if (bad) {
			el.classList.add('element_bad');
		}
	}
	
	var Elements = [];
	var Sizes = [];
	var Races = [];
	
	/**
	 * @var {object} model 
	 */
	var _model = {
		entity: new Entity(),
		ctx:    null,
		render: false,
		tick:   0
	};

	/**
	 * Initialize popup
	 */
	Sense.init = function init()
	{
		DOM.setCss(this.ui, {
			top:  (Renderer.height-120) / 1.5 - 120 + 'px',
			left: (Renderer.width -280) / 2.0 + 'px',
			zIndex: '100'
		});
		
		var closeBtn = qs('.close');
		closeBtn.addEventListener('mousedown', function(event){
			event.stopImmediatePropagation();
			return false;
		});
		closeBtn.addEventListener('click', this.remove.bind(this));
		
		this.draggable(qs('.header'));
		
		_model.ctx = qs('#canvas_model').getContext('2d');
		
		Elements = [
			DB.getMessage(414), // 0 = Neutral
			DB.getMessage(415), // 1 = Water
			DB.getMessage(416), // 2 = Earth
			DB.getMessage(417), // 3 = Fire
			DB.getMessage(418), // 4 = Wind
			DB.getMessage(419), // 5 = Poison
			DB.getMessage(420), // 6 = Holy
			DB.getMessage(421), // 7 = Shadow
			DB.getMessage(422), // 8 = Ghost
			DB.getMessage(423)  // 9 = Undead
		];
		
		Sizes = [
			DB.getMessage(443), // 0 = Small
			DB.getMessage(444), // 1 = Medium
			DB.getMessage(445), // 2 = Large
		];
		
		Races = [
			DB.getMessage(2285), // 0 = Formless
			DB.getMessage(2276), // 1 = Undead
			DB.getMessage(2277), // 2 = Brute
			DB.getMessage(2278), // 3 = Plant
			DB.getMessage(2279), // 4 = Insect
			DB.getMessage(2280), // 5 = Fish
			DB.getMessage(2281), // 6 = Demon
			DB.getMessage(2282), // 7 = Demi-human
			DB.getMessage(2283), // 8 = Angel
			DB.getMessage(2284)  // 9 = Dragon
		];
	};
	
	/**
	 * Set stats
	 *
	 * @param {string} title
	 */
	Sense.setWindow = function setWindow( pkt )
	{
		//TITLE
		setText(qs('.header .title'), DB.getMessage(406));
		
		//SPRITE
		_model.entity.set({
			job:    pkt.job,
			action: 0,
			direction: 0
		});
		_model.render = true;
		
		//STATS
		setText(qs('#label_name'), DB.getMessage(407));
		
		//Yolo :D (remove to return to boring-ro)
		var valueName = qs('#value_name');
		if (valueName) {
			valueName.innerHTML = '<a href="https://ratemyserver.net/mob_db.php?small=1&mob_id=' + pkt.job + '" target="_blank">' + DOM.sanitizeHtml(DB.getMonsterName(pkt.job)) + ' </a>';
		}
		
		setText(qs('#label_size'), DB.getMessage(410));
		setText(qs('#value_size'), Sizes[pkt.size]);
		
		setText(qs('#label_level'), DB.getMessage(408));
		setText(qs('#value_level'), pkt.level);
		
		setText(qs('#label_type'), DB.getMessage(411));
		setText(qs('#value_type'), Races[pkt.raceType]);
		
		setText(qs('#label_hp'), DB.getMessage(409));
		setText(qs('#value_hp'), pkt.hp);
		
		setText(qs('#label_mdef'), DB.getMessage(412));
		setText(qs('#value_mdef'), pkt.mdefPower);
		
		setText(qs('#label_def'), DB.getMessage(270));
		setText(qs('#value_def'), pkt.def);
		
		setText(qs('#label_attr'), DB.getMessage(413));
		setText(qs('#value_attr'), Elements[pkt.property]);
		
		//PROPS
		var water = qs('#element_water');
		setElementClasses(water, pkt.propertyTable.water > 100, pkt.propertyTable.water < 100);
		setText(water, DB.getMessage(415) + ': '+ pkt.propertyTable.water);
		
		var wind = qs('#element_wind');
		setElementClasses(wind, pkt.propertyTable.wind > 100, pkt.propertyTable.wind < 100);
		setText(wind, DB.getMessage(418) + ': '+ pkt.propertyTable.wind);
		
		var dark = qs('#element_shadow');
		setElementClasses(dark, pkt.propertyTable.dark > 100, pkt.propertyTable.dark < 100);
		setText(dark, DB.getMessage(421) + ': '+ pkt.propertyTable.dark);
		
		var earth = qs('#element_earth');
		setElementClasses(earth, pkt.propertyTable.earth > 100, pkt.propertyTable.earth < 100);
		setText(earth, DB.getMessage(416) + ': '+ pkt.propertyTable.earth);
		
		var poison = qs('#element_poison');
		setElementClasses(poison, pkt.propertyTable.poison > 100, pkt.propertyTable.poison < 100);
		setText(poison, DB.getMessage(419) + ': '+ pkt.propertyTable.poison);
		
		var mental = qs('#element_ghost');
		setElementClasses(mental, pkt.propertyTable.mental > 100, pkt.propertyTable.mental < 100);
		setText(mental, DB.getMessage(422) + ': '+ pkt.propertyTable.mental);
		
		var fire = qs('#element_fire');
		setElementClasses(fire, pkt.propertyTable.fire > 100, pkt.propertyTable.fire < 100);
		setText(fire, DB.getMessage(417) + ': '+ pkt.propertyTable.fire);
		
		var saint = qs('#element_holy');
		setElementClasses(saint, pkt.propertyTable.saint > 100, pkt.propertyTable.saint < 100);
		setText(saint, DB.getMessage(420) + ': '+ pkt.propertyTable.saint);
		
		var undead = qs('#element_undead');
		setElementClasses(undead, pkt.propertyTable.undead > 100, pkt.propertyTable.undead < 100);
		setText(undead, DB.getMessage(423) + ': '+ pkt.propertyTable.undead);
		
		DOM.show(this.ui);
		
		Renderer.render(render);
	};
	
	/**
	 * Remove component from HTML
	 * Stop rendering
	 */
	Sense.onRemove = function onRemove()
	{
		Renderer.stop(render);
	};
	
	/**
	 * Rendering the Character
	 */
	function render( tick )
	{
		// Render the model
		SpriteRenderer.bind2DContext(_model.ctx, Math.floor(_model.ctx.canvas.width/2), _model.ctx.canvas.height);
		_model.ctx.clearRect(0, 0, _model.ctx.canvas.width, _model.ctx.canvas.height );
		_model.entity.renderEntity();
	}

	/**
	 * Create component based on view file and export it
	 */
	return UIManager.addComponent(Sense);
});
