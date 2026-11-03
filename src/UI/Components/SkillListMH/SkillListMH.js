/**
 * UI/Components/SkillListMH/SkillListMH.js
 *
 * Character Skill Window for Mercenary and Homunculus
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */
define(function(require)
{
	'use strict';

	/**
	 * Dependencies
	 */
	var DB                   = require('DB/DBManager');
	var SkillInfo            = require('DB/Skills/SkillInfo');
	var Client               = require('Core/Client');
	var Preferences          = require('Core/Preferences');
	var Renderer             = require('Renderer/Renderer');
	var Mouse                = require('Controls/MouseEventHandler');
	var UIManager            = require('UI/UIManager');
	var UIComponent          = require('UI/UIComponent');
	var SkillTargetSelection = require('UI/Components/SkillTargetSelection/SkillTargetSelection');
	var SkillDescription     = require('UI/Components/SkillDescription/SkillDescription');
	var htmlText             = require('text!./SkillListMH.html');
	var cssText              = require('text!./SkillListMH.css');
	var DOM             = require('Utils/DOM');

	/**
	 * Create Component base class
	 */
	function SkillListMH(type) {
		// Create component
		var name = 'SkillList' + (type === 'homunculus' ? 'HOM' : 'MER');
		UIComponent.call(this, name, htmlText, cssText);

		// Initialize variables
		this.type = type;
		this.list = [];
		this._rowCount = Math.min(4, Math.floor(this.list.length / 9));
		this.points = 0;

		// Load preferences
		this._preferences = Preferences.get(name, {
			x:        100,
			y:        200,
			width:    8,
			height:   5,
			show:     false,
		}, 1.0);
	}

	// Inherit UIComponent
	SkillListMH.prototype = Object.create(UIComponent.prototype);
	SkillListMH.prototype.constructor = SkillListMH;

	/**
	 * Initialize UI
	 */
	SkillListMH.prototype.init = function init()
	{
		var self = this;

		this.ui.querySelector('.titlebar .text').textContent = this.type === 'homunculus' ? 'Homunculus Skills' : 'Mercenary Skills';

		this.ui.querySelector('.titlebar .base').addEventListener('mousedown', function(event){
			event.stopImmediatePropagation();
			return false;
		});

		this.ui.querySelector('.footer .extend').addEventListener('mousedown', function(event){
			event.stopImmediatePropagation();
			var ui      = self.ui;
			var top     = DOM.getPosition(ui).top;
			var left    = DOM.getPosition(ui).left;
			var lastWidth  = 0;
			var lastHeight = 0;
			var _Interval;

			function resizing()
			{
				var extraX = -6;
				var extraY = 32;

				var w = Math.floor( (Mouse.screen.x - left - extraX) / 32 );
				var h = Math.floor( (Mouse.screen.y - top  - extraY) / 32 );

				// Maximum and minimum window size
				w = Math.min( Math.max(w, 8), 8);
				h = Math.min( Math.max(h, 4), 10);

				if (w === lastWidth && h === lastHeight) {
					return;
				}

				DOM.setCss(self.ui.querySelector('.content'), {
					width:  w * 32,
					height: h * 32
				});
				lastWidth  = w;
				lastHeight = h;
			}

			_Interval = setInterval(resizing, 30);

			var _resizeHandler = function(event) {
				if (event.which === 1) {
					clearInterval(_Interval);
					window.removeEventListener('mouseup', _resizeHandler);
				}
			};
			window.addEventListener('mouseup', _resizeHandler);
		});

		this.ui.querySelector('.titlebar .close').addEventListener('click', function(){
			self.ui.style.display = 'none';
		});

		// Get level up button
		this.btnIncSkill = this.ui.querySelector('.btn.levelup');
		DOM.detach(this.btnIncSkill);
		this.btnIncSkill.addEventListener('click', function(){
			var index = this.parentNode.parentNode.getAttribute('data-index');
			self.onIncreaseSkill(parseInt(index, 10));
		});

		// Get button to open skill when level up
		this.btnLevelUp = DOM.detach(this.ui.querySelector('#lvlup_job'));
		if (this.btnLevelUp) {
			this.btnLevelUp.addEventListener('click', function(){
				DOM.detach(self.btnLevelUp);
				self.ui.style.display = '';
				if (self.ui.parentNode) self.ui.parentNode.appendChild(self.ui);
			});
			this.btnLevelUp.addEventListener('mousedown', function(event){
				event.stopImmediatePropagation();
				return false;
			});
		}

		// Bind skills
		DOM.addDelegatedEvent(this.ui, 'dblclick', '.skill .icon, .skill .name', function(){
			var main = this.parentNode;
			if (!main.classList.contains('skill')) {
				main = main.parentNode;
			}
			self.useSkillID(parseInt(main.getAttribute('data-index'), 10));
		});
		DOM.addDelegatedEvent(this.ui, 'contextmenu', '.skill .icon, .skill .name', function(){
			var main = this.parentNode;
			var skill;

			if (!main.classList.contains('skill')) {
				main = main.parentNode;
			}

			skill = self.getSkillById(parseInt(main.getAttribute('data-index'), 10));

			// Don't add the same UI twice, remove it
			if (SkillDescription.uid === skill.SKID) {
				SkillDescription.remove();
				return false;
			}

			// Add ui to window
			SkillDescription.append();
			SkillDescription.setSkill(skill.SKID);

			return false;
		});
		DOM.addDelegatedEvent(this.ui, 'mousedown', '.selectable', function(){
			var main = this.parentNode;

			if (!main.classList.contains('skill')) {
				main = main.parentNode;
			}

			Array.from(self.ui.querySelectorAll('.skill.selected')).forEach(function(el) { el.classList.remove('selected'); });
			main.classList.add('selected');
		});
		DOM.addDelegatedEvent(this.ui, 'dragstart', '.skill', function(event){
			var index = parseInt(this.getAttribute('data-index'), 10);
			var skill = self.getSkillById(index);

			// Can't drag a passive skill (or disabled)
			if (!skill || !skill.level || !skill.type) {
				event.stopImmediatePropagation();
				return false;
			}

			var img = new Image();
			img.src = this.firstChild.firstChild.src;

			event.dataTransfer.setDragImage( img, 12, 12 );
			event.dataTransfer.setData('Text',
				JSON.stringify( window._OBJ_DRAG_ = {
					type: 'skill',
					from: 'SkillListMH',
					data:  skill
				})
			);
		});
		DOM.addDelegatedEvent(this.ui, 'dragend', '.skill', function(){
			delete window._OBJ_DRAG_;
			this.classList.remove('hide');
		});

		this.draggable(this.ui.querySelector('.titlebar'));

		Client.loadFile( DB.INTERFACE_PATH + 'basic_interface/arw_right.bmp', function(data){
			this.rArrow = 'url('+data+')';
		}.bind(this));

		Client.loadFile( DB.INTERFACE_PATH + 'basic_interface/arw_left.bmp', function(data){
			this.lArrow = 'url('+data+')';
		}.bind(this));
	};

	/**
	 * Apply preferences once append to body
	 */
	SkillListMH.prototype.onAppend = function onAppend()
	{
		// Apply preferences
		if (!this._preferences.show) {
			this.ui.style.display = 'none';
		}

		this.setSize(this._preferences.width, this._preferences.height);
		DOM.setCss(this.ui, {
			top:  Math.min( Math.max( 0, this._preferences.y), Renderer.height - this.ui.offsetHeight),
			left: Math.min( Math.max( 0, this._preferences.x), Renderer.width  - this.ui.offsetWidth)
		});
	};

	/**
	 * Extend window size
	 */
	SkillListMH.prototype.setSize = function setSize(width, height)
	{
		width  = Math.min( Math.max(width,  8), 8);
		height = Math.min( Math.max(height, 4), 10);

		DOM.setCss(this.ui.querySelector('.content'), {
			width:  width  * 32,
			height: height * 32
		});
	};

	/**
	 * Remove Skill window from DOM
	 */
	SkillListMH.prototype.onRemove = function onRemove()
	{
		DOM.detach(this.btnLevelUp);

		// Save preferences
		this._preferences.show   =  DOM.isVisible(this.ui);
		this._preferences.y      =  parseInt(this.ui.style.top, 10);
		this._preferences.x      =  parseInt(this.ui.style.left, 10);
		this._preferences.width  =  Math.floor( this.ui.querySelector('.content').offsetWidth  / 32 );
		this._preferences.height =  Math.floor( this.ui.querySelector('.content').offsetHeight / 32 );
		this._preferences.save();
	};

	/**
	 * Show/Hide UI
	 */
	SkillListMH.prototype.toggle = function toggle()
	{
		DOM.toggleDisplay(this.ui);

		if (DOM.isVisible(this.ui)) {
			this.focus();
			DOM.detach(this.btnLevelUp);
		}
	};

	/**
	 * Add skills to the list
	 */
	SkillListMH.prototype.setSkills = function setSkills( skills )
	{
		var i, count;

		for (i = 0, count = this.list.length; i < count; ++i) {
			this.onUpdateSkill( this.list[i].SKID, 0);
		}

		this.list.length = 0;
		this.ui.querySelector('.content table').innerHTML = '';

		for (i = 0, count = skills.length; i < count; ++i) {
			this.addSkill( skills[i] );
		}
	};

	/**
	 * Insert skill to list
	 */
	SkillListMH.prototype.addSkill = function addSkill( skill )
	{
		// Custom skill ?
		if (!(skill.SKID in SkillInfo)) {
			return;
		}

		// Already in list, update it instead of duplicating it
		if (this.ui.querySelector('.skill.id' + skill.SKID)) {
			this.updateSkill( skill );
			return;
		}

		var sk        = SkillInfo[ skill.SKID ];
		var levelup   = this.btnIncSkill.cloneNode(true);
		var className = !skill.level ? 'disabled' : skill.type ? 'active' : 'passive';
		var element   = DOM.createElement(
			'<tr class="skill id' + skill.SKID + ' ' + className + '" data-index="'+ skill.SKID +'" draggable="true">' +
				'<td class="icon"><img src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==" width="24" height="24" /></td>' +
				'<td class="levelupcontainer"></td>' +
				'<td class=selectable>' +
					'<div class="name">' +
						DOM.escapeHtml(sk.SkillName)  +'<br/>' +
						'<span class="level">' +
						(
							sk.bSeperateLv ? '<button class="currentDown"></button>Lv : <span class="current">'+ skill.level + '</span> / <span class="max">' + skill.level + '</span><button class="currentUp"></button>'
							               : 'Lv : <span class="current">'+ skill.level +'</span>'
						) +
						'</span>' +
					'</div>' +
				'</td>' +
				'<td class="selectable type">' +
					'<div class="consume">' +
					(
						skill.type ? 'Sp : <span class="spcost">' + skill.spcost + '</span>' : 'Passive'
					) +
					'</div>' +
				'</td>' +
			'</tr>'
		);

		if (!skill.upgradable || !this.points) {
			levelup.style.display = 'none';
		}

		element.querySelector('.levelupcontainer').appendChild( levelup );

		if (sk.bSeperateLv) {
			if (this.rArrow) element.querySelector('.level .currentUp').style.backgroundImage = this.rArrow;
			if (this.lArrow) element.querySelector('.level .currentDown').style.backgroundImage = this.lArrow;

			element.querySelector('.level .currentUp').addEventListener('click',  () => { this.skillLevelSelectUp(skill); });
			element.querySelector('.level .currentDown').addEventListener('click',  () => { this.skillLevelSelectDown(skill); });
		}
		this.ui.querySelector('.content table').appendChild(element);

		Client.loadFile( DB.INTERFACE_PATH + 'item/' + sk.Name + '.bmp', function(data){
			element.querySelector('.icon img').setAttribute('src', data);
		});

		this.list.push(skill);
		this.onUpdateSkill( skill.SKID, skill.level);
	};

	/**
	 * Remove skill from list
	 */
	SkillListMH.prototype.removeSkill = function removeSkill()
	{
		// Not implemented by gravity ? server have to send the whole list again ?
	};

	/**
	 * Update skill
	 */
	SkillListMH.prototype.updateSkill = function updateSkill( skill )
	{
		var target = this.getSkillById(skill.SKID);
		var element;

		if (!target) {
			return;
		}

		// Update Memory
		target.level       = skill.level;
		target.spcost      = skill.spcost;
		target.attackRange = skill.attackRange;
		target.upgradable  = skill.upgradable;
		if (Number.isInteger(skill.type)) {
			target.type    = skill.type;
		}

		// Update UI
		element = this.ui.querySelector('.skill.id' + skill.SKID);
		element.querySelector('.level .current, .level .max').textContent = skill.level;
		if(skill.selectedLevel){
			element.querySelector('.level .current').textContent = skill.selectedLevel;
		}
		element.querySelector('.spcost').textContent = skill.spcost;

		element.classList.remove('active', 'passive', 'disabled');
		element.classList.add(!skill.level ? 'disabled' : skill.type ? 'active' : 'passive');

		if (skill.upgradable && this.points) {
			element.querySelector('.levelup').style.display = '';
		}
		else {
			element.querySelector('.levelup').style.display = 'none';
		}

		this.onUpdateSkill( skill.SKID, skill.level);
	};

	/**
	 * Use a skill by its id
	 */
	SkillListMH.prototype.useSkillID = function useSkillID( id, level )
	{
		var skill = this.getSkillById(id);

		if (!skill || !skill.level || !skill.type) {
			return;
		}

		this.useSkill( skill, level ? level : skill.selectedLevel );
	};

	/**
	 * Use a skill
	 */
	SkillListMH.prototype.useSkill = function useSkill(skill, level )
	{
		// Self
		if (skill.type & SkillTargetSelection.TYPE.SELF) {
			this.onUseSkill( skill.SKID, level ? level : skill.level);
		}

		skill.useLevel = level;

		// no elseif intended (see flying kick).
		if (skill.type & SkillTargetSelection.TYPE.TARGET) {
			SkillTargetSelection.append();
			SkillTargetSelection.set(skill, skill.type);
		}
	};

	/**
	 * Set skill points amount
	 */
	SkillListMH.prototype.setPoints = function setPoints( amount )
	{
		var i, count;
		this.ui.querySelector('.skpoints_count').textContent = amount;

		// Do not need to update the UI
		if ((!this.points) === (!amount)) {
			this.points = amount;
			return;
		}

		this.points = amount;
		count   = this.list.length;

		for (i = 0; i < count; ++i) {
			if (this.list[i].upgradable && amount) {
				this.ui.querySelector('.skill.id' + this.list[i].SKID + ' .levelup').style.display = '';
			}
			else {
				this.ui.querySelector('.skill.id' + this.list[i].SKID + ' .levelup').style.display = 'none';
			}
		}
	};

	/**
	 * Add the button when leveling up
	 */
	SkillListMH.prototype.onLevelUp = function onLevelUp()
	{
		document.body.appendChild(this.btnLevelUp);
	};

	/**
	 * Find a skill by it's id
	 */
	SkillListMH.prototype.getSkillById = function getSkillById( id )
	{
		var i, count = this.list.length;

		for (i = 0; i < count; ++i) {
			if (this.list[i].SKID === id) {
				return this.list[i];
			}
		}

		return null;
	};

	/**
	 * Closing window
	 */
	SkillListMH.prototype.onClose = function onClose()
	{
		this.ui.style.display = 'none';
	};

	/**
	 * Request to upgrade a skill
	 */
	SkillListMH.prototype.onRequestSkillUp = function onRequestSkillUp()
	{
		var index = this.parentNode.parentNode.getAttribute('data-index');
		this.onIncreaseSkill(
			parseInt(index, 10)
		);
	};

	/**
	 * Request to use a skill
	 */
	SkillListMH.prototype.onRequestUseSkill = function onRequestUseSkill()
	{
		var main  = this.parentNode;

		if (!main.classList.contains('skill')) {
			main = main.parentNode;
		}

		this.useSkillID(parseInt(main.getAttribute('data-index'), 10));
	};

	/**
	 * Request to get skill info
	 */
	SkillListMH.prototype.onRequestSkillInfo = function onRequestSkillInfo()
	{
		var main = this.parentNode;
		var skill;

		if (!main.classList.contains('skill')) {
			main = main.parentNode;
		}

		skill = this.getSkillById(parseInt(main.getAttribute('data-index'), 10));

		// Don't add the same UI twice, remove it
		if (SkillDescription.uid === skill.SKID) {
			SkillDescription.remove();
			return;
		}

		// Add ui to window
		SkillDescription.append();
		SkillDescription.setSkill(skill.SKID);
	};

	/**
	 * Focus a skill
	 */
	SkillListMH.prototype.onSkillFocus = function onSkillFocus()
	{
		var main = this.parentNode;

		if (!main.classList.contains('skill')) {
			main = main.parentNode;
		}

		Array.from(this.ui.querySelectorAll('.skill.selected')).forEach(function(el) { el.classList.remove('selected'); });
		main.classList.add('selected');
	};

	/**
	 * Start to drag a skill
	 */
	SkillListMH.prototype.onSkillDragStart = function onSkillDragStart( event )
	{
		var index = parseInt(this.getAttribute('data-index'), 10);
		var skill = this.getSkillById(index);

		// Can't drag a passive skill (or disabled)
		if (!skill || !skill.level || !skill.type) {
			return stopPropagation(event);
		}

		var img   = new Image();
		img.src   = this.firstChild.firstChild.src;

		event.dataTransfer.setDragImage( img, 12, 12 );
		event.dataTransfer.setData('Text',
			JSON.stringify( window._OBJ_DRAG_ = {
				type: 'skill',
				from: 'SkillListMH',
				data:  skill
			})
		);
	};

	/**
	 * Stop the drag drop action
	 */
	SkillListMH.prototype.onSkillDragEnd = function onSkillDragEnd()
	{
		delete window._OBJ_DRAG_;
	};

	SkillListMH.prototype.skillLevelSelectUp = function skillLevelSelectUp( skill )
	{
		var level = skill.selectedLevel ? skill.selectedLevel : skill.level;
		if (level < skill.level){
			skill.selectedLevel = level + 1;
			var element = this.ui.querySelector('.skill.id' + skill.SKID + '');
			element.querySelector('.level .current').textContent = skill.selectedLevel;
		}
	};

	SkillListMH.prototype.skillLevelSelectDown = function skillLevelSelectDown( skill )
	{
		var level = skill.selectedLevel ? skill.selectedLevel : skill.level;
		if (level > 1){
			skill.selectedLevel = level - 1;
			var element = this.ui.querySelector('.skill.id' + skill.SKID + '');
			element.querySelector('.level .current').textContent = skill.selectedLevel;
		}
	};

	/**
	 * Abstract function to define
	 */
	SkillListMH.prototype.onUseSkill      = function onUseItem(){};
	SkillListMH.prototype.onIncreaseSkill = function onIncreaseSkill() {};
	SkillListMH.prototype.onUpdateSkill   = function onUpdateSkill(){};

	/**
	 * Create instances
	 */
	var homSkills = new SkillListMH('homunculus');
	var merSkills = new SkillListMH('mercenary');

	// Register both instances with UIManager and export it
	return {
		homunculus: UIManager.addComponent(homSkills),
		mercenary: UIManager.addComponent(merSkills)
	};
});
