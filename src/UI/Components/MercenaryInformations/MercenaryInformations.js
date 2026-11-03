/**
 * UI/Components/MercenaryInformations/MercenaryInformations.js
 *
 * Display mercenary information
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 */

define(function(require)
{
	'use strict';

	/**
	 * Dependencies
	 */
	var DB                 = require('DB/DBManager');
	var Client            = require('Core/Client');
	var Preferences      = require('Core/Preferences');
	var Renderer         = require('Renderer/Renderer');
	var EntityManager    = require('Renderer/EntityManager');
	var Session          = require('Engine/SessionStorage');
	var UIManager        = require('UI/UIManager');
	var UIComponent      = require('UI/UIComponent');
    var SkillListMH      = require('UI/Components/SkillListMH/SkillListMH');
	var AIDriver         = require('Core/AIDriver');
	var htmlText         = require('text!./MercenaryInformations.html');
	var cssText          = require('text!./MercenaryInformations.css');
	var DOM             = require('Utils/DOM');

	/**
	 * Create Component
	 */
	var MercenaryInformations = new UIComponent( 'MercenaryInformations', htmlText, cssText );

	/**
	 * @var {Preferences}
	 */
	var _preferences = Preferences.get('MercenaryInformations', {
		x:        100,
		y:        100,
		show:     false,
		reduce:   false
	}, 1.0);


	/**
	 * Initialize UI
	 */
	MercenaryInformations.init = function init()
	{
		this.draggable(this.ui.querySelector('.content'));

		// Avoid drag drop problems
		this.ui.querySelector('.content').addEventListener('mousedown', stopPropagation);
		this.ui.querySelector('.content .base').addEventListener('mousedown', stopPropagation);
		this.ui.querySelector('.close').addEventListener('click', onClose);
		this.ui.querySelector('.dismiss').addEventListener('click', onDelete);

		if (!_preferences.show) {
			DOM.hide(this.ui);
		}

		DOM.setCss(this.ui, {
			top:  Math.min( Math.max( 0, _preferences.y), Renderer.height - this.ui.offsetHeight),
			left: Math.min( Math.max( 0, _preferences.x), Renderer.width  - this.ui.offsetWidth)
		});

        this.ui.querySelector('.skill').addEventListener('mousedown', function () {
            SkillListMH.mercenary.toggle();
        });

		// If no aggressive level defined, default to 1
		// otherwise toggle and untoggle to remain the same
		this.toggleAggressive();
		this.toggleAggressive();
	};

	/**
	 * Once append to body
	 */
	MercenaryInformations.onAppend = function onAppend()
	{
		// Set preferences
		if (!_preferences.show) {
			DOM.hide(this.ui);
		}
	};

	/**
	 * Once remove from body
	 */
	MercenaryInformations.onRemove = function onRemove()
	{
		_preferences.show   = DOM.isVisible(this.ui);
		_preferences.y      = parseInt(this.ui.style.top, 10);
		_preferences.x      = parseInt(this.ui.style.left, 10);
		_preferences.save();
		this.stopAI();
	};

	/**
	 * Process shortcut
	 *
	 * @param {object} key
	 */
	MercenaryInformations.onShortCut = function onShortCut(key)
	{
		// Not in body
		if (!this.ui) {
			return;
		}

		switch (key.cmd) {
			case 'TOGGLE':
				if (Session.mercId) {
					DOM.toggleDisplay(this.ui);
					if (DOM.isVisible(this.ui)) {
						this.focus();
					}
					if (!DOM.isVisible(this.ui)) {
						DOM.hide(SkillListMH.mercenary.ui);
					}
				} else {
					DOM.hide(SkillListMH.mercenary.ui);
					DOM.hide(this.ui);
				}
				break;
			case 'AGGRESSIVE':
				this.toggleAggressive();
				break;
		}
	};

	/**
	 * Stop event propagation
	 */
	function stopPropagation(event)
	{
		event.stopImmediatePropagation();
		return false;
	}

	/**
	 * Closing window
	 */
	function onClose()
	{
		MercenaryInformations.ui.style.display = 'none';
        SkillListMH.mercenary.ui.style.display = 'none';
	}

	/**
	 * Delete mercenary
	 */
	function onDelete()
	{
		MercenaryInformations.reqDeleteMercenary();
	}

	/**
	 * Format expire date into readable string
	 * @param {number} timestamp - Unix timestamp
	 * @returns {string} Formatted time string
	 */
	MercenaryInformations.formatExpireDate = function formatExpireDate(timestamp) {
		if (!timestamp) {
			return '0';
		}

		var now = Date.now() / 1000;
		var remaining = Math.max(0, timestamp - now);

		var hours = Math.floor(remaining / 3600);
		var minutes = Math.floor((remaining % 3600) / 60);

		return hours + 'h ' + minutes + 'm';
	};

	/**
	 * Set time left bar and value
	 * @param {number} timestamp - Unix timestamp for expiration
	 */
	MercenaryInformations.setTimeLeft = function setTimeLeft(timestamp)
	{
		if (!timestamp) {
			this.ui.querySelector('.block2 .timeleft').textContent = '0';
			return;
		}

		var now = Date.now() / 1000;
		var remaining = Math.max(0, timestamp - now);
		var TOTAL_DURATION = 30 * 60; // 30 minutes in seconds
		var time_per = remaining / TOTAL_DURATION;

		// Update text
		this.ui.querySelector('.block2 .timeleft').textContent = this.formatExpireDate(timestamp);

		// Update bar
		var canvas = this.ui.querySelector('canvas.life.title_timeleft');
		var ctx = canvas.getContext('2d');
		var width = 60, height = 5;

		// empty
		ctx.fillStyle = '#424242';
		ctx.fillRect(1, 1, width - 2, height - 2);

		ctx.fillStyle = (time_per < 0.25) ? '#ff1e00' : '#205cc3';
		ctx.fillRect(1, 1, Math.round((width - 2) * time_per), 3);
	};

	/**
	 * Set monster kills bar and value
	 * @param {number} kills - Number of monsters killed
	 */
	MercenaryInformations.setKills = function setKills(kills)
	{
		if (kills === undefined) {
			this.ui.querySelector('.block2 .kills').textContent = '0';
			return;
		}

		// Update text
		this.ui.querySelector('.block2 .kills').textContent = kills;

		// Update bar
		var canvas = this.ui.querySelector('canvas.life.title_kills');
		var ctx = canvas.getContext('2d');
		var width = 60, height = 5;
		var kills_per = kills%50 / 50;

		// empty
		ctx.fillStyle = '#424242';
		ctx.fillRect(1, 1, width - 2, height - 2);

		ctx.fillStyle = '#205cc3';
		ctx.fillRect(1, 1, Math.round((width - 2) * kills_per), 3);
	};

	/**
	 * Initialize UI
	 */
	MercenaryInformations.setInformations = function setInformations(info)
	{
		this.ui.querySelector('.name').textContent = info.name || '';
		this.ui.querySelector('.level').textContent = info.level || '';

		// Stats
		this.ui.querySelector('.stats .atk').textContent = info.atk || 0;
		this.ui.querySelector('.stats .Matk').textContent = info.Matk || 0;
		this.ui.querySelector('.stats .hit').textContent = info.hit || 0;
		this.ui.querySelector('.stats .critical').textContent = info.critical || 0;
		this.ui.querySelector('.stats .def').textContent = info.def || 0;
		this.ui.querySelector('.stats .Mdef').textContent = info.Mdef || 0;
		this.ui.querySelector('.stats .flee').textContent = info.flee || 0;
		this.ui.querySelector('.stats .aspd').textContent = info.aspd || 0;

		// HP/SP
		this.setHpSpBar('hp', info.hp, info.maxHP);
		this.setHpSpBar('sp', info.sp, info.maxSP);

		// Additional Info
		this.setTimeLeft(info.ExpireDate);
		this.setKills(info.approval_monster_kill_counter || 0);
		this.setFaith(info.faith || 0);

        SkillListMH.mercenary.setPoints(info.SKPoint);
	};

	/**
	 * Set hp and sp bar
	 */
	MercenaryInformations.setHpSpBar = function setHpSpBar(type, val, val2)
	{
		var perc = Math.floor(val * 100 / val2);
		var color = perc < 25 ? 'red' : 'blue';

		this.ui.querySelector('.' + type + '_bar_perc .'+type+'_value').textContent = val;
		this.ui.querySelector('.' + type + '_bar_perc .'+type+'_max_value').textContent = val2;
		this.ui.querySelector('.' + type + '2').textContent = val + ' / ' + val2;

		Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/gze' + color + '_left.bmp', function (url) {
			this.ui.querySelector('.' + type + '_bar_left').style.backgroundImage = 'url(' + url + ')';
		}.bind(this));

		Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/gze' + color + '_mid.bmp', function (url) {
			var el = this.ui.querySelector('.' + type + '_bar_middle');
			el.style.backgroundImage = 'url(' + url + ')';
			el.style.width = Math.floor(Math.min(perc, 100) * 0.75) + 'px';
		}.bind(this));

		Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/gze' + color + '_right.bmp', function (url) {
			var el = this.ui.querySelector('.' + type + '_bar_right');
			el.style.backgroundImage = 'url(' + url + ')';
			el.style.left = Math.floor(Math.min(perc, 100) * 1.27) + 'px';
		}.bind(this));
	};

	/**
	 * Toggle Aggressive
	 */
	MercenaryInformations.toggleAggressive = function toggleAggressive()
	{
		let agr = localStorage.getItem('MER_AGGRESSIVE') == 0 ? 1 : 0;
		localStorage.setItem('MER_AGGRESSIVE', agr);
	};

	/**
	 * Start AI
	 */
	MercenaryInformations.startAI = function startAI()
	{
		this.stopAI();
		AIDriver.mercenary.reset();
		this.AILoop = setInterval(function () {
			if (Session.mercId) {
				var entity = EntityManager.get(Session.mercId);
				if (entity) {
					AIDriver.mercenary.exec('AI(' + Session.mercId + ')')
				}
			}
		}, 100);
	};

	/**
	 * Stop AI
	 */
	MercenaryInformations.stopAI = function stopAI()
	{
		if(this.AILoop){
			clearInterval(this.AILoop);
		}
	};

	/**
	 * Reset AI
	 */
	MercenaryInformations.resetAI = function resetAI()
	{
		this.stopAI();
		this.startAI();
	};

	/**
	 * Set target for mercenary to attack
	 */
	MercenaryInformations.setTarget = function setTarget(targetId)
	{
		var entity = EntityManager.get(Session.mercId);
		if (!entity) {
			return;
		}

		entity.targetId = targetId;
	};

	/**
	 * Set faith value
	 */
	MercenaryInformations.setFaith = function setFaith(faith)
	{
		this.ui.querySelector('.block2 .faith').textContent = faith;
	};

	/**
	 * Functions defined in Engine/MapEngine/Mercenary.js
	 */
	MercenaryInformations.reqDeleteMercenary = function reqDeleteMercenary() {};
	MercenaryInformations.reqAttack = function reqAttack() {};
	MercenaryInformations.reqMoveTo = function reqMoveTo() {};
	MercenaryInformations.reqMoveToOwner = function reqMoveToOwner() {};

	/**
	 * Export
	 */
	return UIManager.addComponent(MercenaryInformations);
});
