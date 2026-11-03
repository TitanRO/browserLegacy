/**
 * UI/Components/SkillListV0/SkillListV0.js
 *
 * Chararacter Skill Window
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
+ */
define(function(require)
{
	'use strict';


	/**
	 * Dependencies
	 */
	var DB                   = require('DB/DBManager');
	var SkillInfo            = require('DB/Skills/SkillInfo');
	var SkillTreeView        = require('DB/Skills/SkillTreeView');
	var Session              = require('Engine/SessionStorage');
	var Client               = require('Core/Client');
	var Preferences          = require('Core/Preferences');
	var Renderer             = require('Renderer/Renderer');
	var Mouse                = require('Controls/MouseEventHandler');
	var UIManager            = require('UI/UIManager');
	var UIComponent          = require('UI/UIComponent');
	var SkillTargetSelection = require('UI/Components/SkillTargetSelection/SkillTargetSelection');
	var SkillDescription     = require('UI/Components/SkillDescription/SkillDescription');
	var htmlText             = require('text!./SkillListV0.html');
	var cssText              = require('text!./SkillListV0.css');
	var DOM             = require('Utils/DOM');



	/**
	 * Create Component
	 */
	var SkillListV0 = new UIComponent( 'SkillListV0', htmlText, cssText );


	/**
	 * @var {Preferences} window preferences
	 */
	var _preferences = Preferences.get('SkillListV0', {
		x:        100,
		y:        200,
		width:    8,
		height:   8,
		show:     false,
		mini:     true,
		skillInfo: false,
	}, 1.0);


	/**
	 * @var {Array} Skill List
	 * { SKID, type, level, spcost, attackRange, skillName, upgradable }
	 */
	var _list = [];


	/**
	 * @var {jQuery} level up button reference
	 */
	var _btnIncSkill;


	/**
	 * @var {number} skill points
	 */
	var _points = 0;

	var totalCounter = 0;

	/**
	 * @var {jQuery} button that appeared when level up
	 */
	var _btnLevelUp;

	var lArrow, rArrow;

	var skillPosition = [];

	var skillDependencyTree = [];

	var rememberChoice = [];

	var hasSkills = [];

	/**
	 * Initialize UI
	 */
	SkillListV0.init = function init()
	{
		this.ui.querySelector('.titlebar .base').addEventListener('mousedown', stopPropagation);
		this.ui.querySelector('.footer .extend').addEventListener('mousedown', onResize);
		this.ui.querySelector('.titlebar .close').addEventListener('click', onClose);
		this.ui.querySelector('.titlebar .mini').addEventListener('click', onMini);
		this.ui.querySelector('.view_skill_info').addEventListener('change', onToggleSkillInfo);
		this.ui.querySelector('.reset').addEventListener('click', onResetChoice);
		this.ui.querySelector('.apply').addEventListener('click', onApplyChoice);

		// Get level up button
		_btnIncSkill = this.ui.querySelector('.btn.levelup');
		DOM.detach(_btnIncSkill);
		_btnIncSkill.addEventListener('click', onRequestSkillUp);

		// Get button to open skill when level up
		_btnLevelUp = DOM.detach(this.ui.querySelector('#lvlup_job'));
		if (_btnLevelUp) {
			_btnLevelUp.addEventListener('click', function(){
				DOM.detach(_btnLevelUp);
				SkillListV0.ui.style.display = '';
				if (SkillListV0.ui.parentNode) SkillListV0.ui.parentNode.appendChild(SkillListV0.ui);
			});
			_btnLevelUp.addEventListener('mousedown', stopPropagation);
		}

		// Bind skills
		DOM.addDelegatedEvent(this.ui, 'dblclick', '.skill .icon, .skill .name', onRequestUseSkill);
		DOM.addDelegatedEvent(this.ui, 'contextmenu', '.skill .icon, .skill .name', onRequestSkillInfo);
		DOM.addDelegatedEvent(this.ui, 'mousedown', '.selectable', onSkillFocus);
		DOM.addDelegatedEvent(this.ui, 'mouseover', '.skillCol .skill .icon, .skill .name', onRequestSkillInfo);
		DOM.addDelegatedEvent(this.ui, 'mouseout', '.skillCol .skill .icon, .skill .name', onSkillDescriptionRemove);
		DOM.addDelegatedEvent(this.ui, 'mouseover', '.skillCol .skill .icon, .skill .name', onNecessarySkills);
		DOM.addDelegatedEvent(this.ui, 'mouseout', '.skillCol .skill .icon, .skill .name', onNecessarySkillsRemove);
		DOM.addDelegatedEvent(this.ui, 'click', '.skillCol .skill .icon, .skill .name', onRememberChoice);
		DOM.addDelegatedEvent(this.ui, 'dragstart', '.skill', onSkillDragStart);
		DOM.addDelegatedEvent(this.ui, 'dragend', '.skill', onSkillDragEnd);

		this.draggable(this.ui.querySelector('.titlebar'));

		Client.loadFile( DB.INTERFACE_PATH + 'basic_interface/arw_right.bmp', function(data){
			rArrow = 'url('+data+')';
		});
		Client.loadFile( DB.INTERFACE_PATH + 'basic_interface/arw_left.bmp', function(data){
			lArrow = 'url('+data+')';
		});
	};


	/**
	 * Apply preferences once append to body
	 */
	SkillListV0.onAppend = function onAppend()
	{
		// Apply preferences
		if (!_preferences.show) {
			this.ui.style.display = 'none';
		}

		resize(_preferences.width, _preferences.height);
		DOM.setCss(this.ui, {
			top:  Math.min( Math.max( 0, _preferences.y), Renderer.height - this.ui.offsetHeight),
			left: Math.min( Math.max( 0, _preferences.x), Renderer.width  - this.ui.offsetWidth)
		});

		this.ui.querySelector('.view_skill_info').setAttribute('checked', _preferences.skillInfo);
	};


	/**
	 * Remove Skill window from DROM
	 */
	SkillListV0.onRemove = function onRemove()
	{
		DOM.detach(_btnLevelUp);

		// Save preferences
		_preferences.show   =  DOM.isVisible(this.ui);
		_preferences.y      =  parseInt(this.ui.style.top, 10);
		_preferences.x      =  parseInt(this.ui.style.left, 10);
		_preferences.width  =  Math.floor( this.ui.querySelector('.content').offsetWidth  / 32 );
		_preferences.height =  Math.floor( this.ui.querySelector('.content').offsetHeight / 32 );
		_preferences.save();
	};


	/**
	 * Show/Hide UI
	 */
	SkillListV0.toggle = function toggle()
	{
		DOM.toggleDisplay(this.ui);

		if (DOM.isVisible(this.ui)) {
			this.focus();
			DOM.detach(_btnLevelUp);
		}
	};


	/**
	 * Process shortcut
	 *
	 * @param {object} key
	 */
	SkillListV0.onShortCut = function onShortCut( key )
	{
		switch (key.cmd) {
			case 'TOGGLE':
				DOM.toggleDisplay(this.ui);
				break;
		}
		onResetChoice();
	};


	/**
	 * Add skills to the list
	 */
	SkillListV0.setSkills = function setSkills( skills )
	{
		SkillListV0.ui.querySelectorAll('.upgradable').forEach(function(el) { el.classList.remove('upgradable'); });

		skillPosition = getSkillPosition(Session.Character.job);
		createSkillDependencyTree();

		var i, count;

		for (i = 0, count = _list.length; i < count; ++i) {
			this.onUpdateSkill( _list[i].SKID, 0);
		}

		_list.length = 0;
		this.ui.querySelector('.content table').innerHTML = '';
		this.ui.querySelector('.skillCol').innerHTML = '';

		for (i = 0, count = skills.length; i < count; ++i) {
			this.addSkill( skills[i] );
			hasSkills[skills[i].SKID] = skills[i];
		}

		skillPosition.forEach(function (items, list) {
			SkillListV0.prepareSkillTree(items, list)
		});

		onResetChoice();
	};


	function createSkillDependencyTree() {
		skillPosition.forEach(function (items, list) {
			// listItems array
			Object.entries(items).forEach(entry => {
				const [skid, pos] = entry;

				// skip list and beforeJob
				if (isNaN(+skid)) {
					return;
				}

				var sk = SkillInfo[skid];

				skillDependencyTree[skid] = {
					'dependency': [],
					'position': pos,
					'list': list,
					'MaxLv': sk.MaxLv
				};

				if (sk?.['_NeedSkillListV0'] !== undefined) {
					sk['_NeedSkillListV0'].forEach(function (item) {
						skillDependencyTree[skid]['dependency'][item[0]] = item[1];
					})
				}
			});
		});
	}


	function specifyRequirements(skillId, count = null)
	{
		var showAll = true; // todo debug show all dependency

		var skdt = skillDependencyTree[skillId];

		if (skdt?.dependency || count != null) {
			var element = '<div class="counterSkill">' + count + '</div>';
			skillPosition.forEach(function (items, list) {
				if (items[skillId] !== undefined) {
					var skillbox = SkillListV0.ui.querySelector('#positionSkills' + list + ' .s' + items[skillId]);
					if (skillbox && ((skillbox.children[0] && skillbox.children[0].classList.contains('disabled')) || showAll)) {
						skillbox.classList.add('needleSkill');
						if (count !== null) skillbox.insertAdjacentHTML('beforeend', element);
					}
				}
			});
		}

		if (skdt?.dependency) {
			skdt.dependency.forEach(function (item, key) {
				specifyRequirements(key, item);
			});
		}
	}


	/**
	 * get and show remember choice skills
	 */
	function onRememberChoice()
	{
		var main = this.parentNode;

		if (!main.classList.contains('skill')) {
			main = main.parentNode;
		}
		var skillId = parseInt(main.getAttribute('data-index'), 10);

		rememberChoice = setRememberChoice(skillId);

		// show choice
		rememberChoice.forEach(function (item, skId) {
			if (!rememberChoice[skId]['isQuest'] && totalCounter < _points) {
				var sk = skillDependencyTree[skId];
				var skillbox = SkillListV0.ui.querySelector('#positionSkills' + sk.list + ' .s' + sk.position);
				if (skillbox && skillbox.querySelector('.current').textContent != sk.MaxLv ) {
					totalCounter += rememberChoice[skId]['count'];
					Array.from(skillbox.children).forEach(function(ch) { ch.classList.remove('disabled'); });
					skillbox.querySelector('.level').style.display = '';
					var cur = skillbox.querySelector('.current');
					if (cur) cur.textContent = rememberChoice[skId]['count'];
					var mx = skillbox.querySelector('.max');
					if (mx) mx.textContent = rememberChoice[skId]['count'];
				}
			}
		});

		SkillListV0.ui.querySelector('.skpoints_count').textContent = _points - totalCounter +'/'+_points;
	}


	/**
	 * Remember Choice skills
	 * @param skillId
	 * @param count
	 * @param isQuest
	 * @returns {*[]}
	 */
	function setRememberChoice(skillId, count = null, isQuest = false)
	{
		var sk = SkillInfo[skillId];

		if (!isQuest && sk['Type'] === 'Quest') {
			var skill = getSkillById(skillId);
			isQuest = (!skill?.level || skill?.level <= 0);
		}

		rememberChoice[skillId] = rememberChoice[skillId] ?? {
			'count': hasSkills?.[skillId]?.level ?? 0,
			'list': null,
			'isQuest': isQuest,
		}

		if (!isQuest) {
			if (count) {
				if (count > rememberChoice[skillId]['count']) {
					rememberChoice[skillId]['count'] = count;
				}
			} else {
				if (sk['MaxLv'] > rememberChoice[skillId]['count']) {
					rememberChoice[skillId]['count']++;
				}
			}
		}

		if (sk['_NeedSkillListV0'] !== undefined) {
			sk['_NeedSkillListV0'].forEach(function (item) {
				rememberChoice[skillId][item[0]] = setRememberChoice(item[0], item[1], isQuest)[item[0]]
			});

			Object.entries(rememberChoice[skillId]).forEach(entry => {
				const [key, value] = entry;
				if (!isNaN(+key) && value.isQuest) {
					rememberChoice[skillId]['isQuest'] = value.isQuest;
				}
			});
		}

		return rememberChoice;
	}


	/**
	 * @param JobId
	 * @returns {*[]}
	 */
	function getSkillPosition(JobId) {
		var positions = [];
		positions[SkillTreeView[JobId]['list']] = SkillTreeView[JobId];

		if (SkillTreeView[JobId]['beforeJob'] !== null) {
			var beforeJob = SkillTreeView[JobId]['beforeJob'];
			getSkillPosition(beforeJob).forEach(function (items, list) {
				positions[list] = positions[list] ? Object.assign(positions[list], items) : items;
			})
		}

		return positions;
	}

	/**
	 * Insert skill to list
	 *
	 * @param {object} skill
	 */
	SkillListV0.addSkill = function addSkill( skill )
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

		this.addSkillBig(skill);
		this.addSkillMini(skill);
	}


	/**
	 * Create disabled skills preview
	 * @param items
	 * @param list
	 */
	SkillListV0.prepareSkillTree = function prepareSkillTree(items, list)
	{
		Object.entries(items).forEach(entry => {
			const [key, value] = entry;
			var sk        = SkillInfo[ key ];
			var className = 'disabled';
			if (sk !== undefined) {
				var element = DOM.createElement(
					'<div class="skill id' + key + ' ' + className + '" data-index="'+ key +'" draggable="true">' +
					'<div class="name">' +
					DOM.escapeHtml(sk.SkillName).substr(0, 7)  +'...<br/>' +
					'</div>' +
					'<div class="icon"><img src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==" width="24" height="24" /></div>' +
					'<div class=selectable>' +
					'<span class="level" style="display: none">' +
					(
						sk.bSeperateLv ? '<button class="currentDown"></button><span class="current">'+ 0 + '</span> / <span class="max">' + 0 + '</span><button class="currentUp"></button>'
							: '<span class="current">'+ 0 +'</span>'
					) +
					'</span>' +
					'</div>' +
					'</div>'
				);

				if (sk.bSeperateLv) {
					if (rArrow) element.querySelector('.level .currentUp').style.backgroundImage = rArrow;
					if (lArrow) element.querySelector('.level .currentDown').style.backgroundImage = lArrow;

					element.querySelector('.level .currentUp').addEventListener('click',  function(){ skillLevelSelectUp(0); } );
					element.querySelector('.level .currentDown').addEventListener('click',  function(){ skillLevelSelectDown(0); } );
				}

				if (value !== undefined) {
					var box = SkillListV0.ui.querySelector('#positionSkills' + list + ' .s'+value);
					if (box) {
						// show added cells
						if (key < 41 && box.parentNode) box.parentNode.style.display = '';
						// show preview skill
						if (!box.hasChildNodes()) {
							box.appendChild(element);
						}
					}
				}

				Client.loadFile( DB.INTERFACE_PATH + 'item/' + sk.Name + '.bmp', function(data){
					element.querySelector('.icon img').setAttribute('src', data);
				});
			}
		});
	}


	SkillListV0.addSkillBig = function addSkillBig( skill )
	{
		var sk        = SkillInfo[ skill.SKID ];
		var levelup   = _btnIncSkill.cloneNode(true);
		var className = !skill.level ? 'disabled' : skill.type ? 'active' : 'passive';
		var element   = DOM.createElement(
			'<div class="skill id' + skill.SKID + ' ' + className + '" data-index="'+ skill.SKID +'" draggable="true">' +
			'<div class="name">' +
			DOM.escapeHtml(sk.SkillName).substr(0, 7)  +'...<br/>' +
			'</div>' +
			'<div class="icon"><img src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==" width="24" height="24" /></div>' +
			'<div class="levelupcontainer"></div>' +
			'<div class=selectable>' +
			'<span class="level">' +
			(
				sk.bSeperateLv ? '<button class="currentDown"></button><span class="current">'+ skill.level + '</span> / <span class="max">' + skill.level + '</span><button class="currentUp"></button>'
					: '<span class="current">'+ skill.level +'</span>'
			) +
			'</span>' +
			'</div>' +
			'</div>'
		);

		if (sk.bSeperateLv) {
			if (rArrow) element.querySelector('.level .currentUp').style.backgroundImage = rArrow;
			if (lArrow) element.querySelector('.level .currentDown').style.backgroundImage = lArrow;

			element.querySelector('.level .currentUp').addEventListener('click',  function(){ skillLevelSelectUp(skill); } );
			element.querySelector('.level .currentDown').addEventListener('click',  function(){ skillLevelSelectDown(skill); } );
		}

		skillPosition.forEach(function (items, list) {
			if (items[skill.SKID] !== undefined) {
				var box = SkillListV0.ui.querySelector('#positionSkills' + list + ' .s'+items[skill.SKID]);
				if (box) {
					if (box.hasChildNodes()) {
						box.innerHTML = '';
					}
					box.appendChild(element);

					if (skill.upgradable) {
						box.classList.add('upgradable');
					}
				}
			}
		});

		Client.loadFile( DB.INTERFACE_PATH + 'item/' + sk.Name + '.bmp', function(data){
			element.querySelector('.icon img').setAttribute('src', data);
		});
	}


	SkillListV0.addSkillMini = function addSkillMini( skill )
	{
		var sk        = SkillInfo[ skill.SKID ];
		var levelup   = _btnIncSkill.cloneNode(true);
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

		if (!skill.upgradable || !_points) {
			levelup.style.display = 'none';
		}

		element.querySelector('.levelupcontainer').appendChild( levelup );

		if (sk.bSeperateLv) {
			if (rArrow) element.querySelector('.level .currentUp').style.backgroundImage = rArrow;
			if (lArrow) element.querySelector('.level .currentDown').style.backgroundImage = lArrow;

			element.querySelector('.level .currentUp').addEventListener('click',  function(){ skillLevelSelectUp(skill);  } );
			element.querySelector('.level .currentDown').addEventListener('click',  function(){ skillLevelSelectDown(skill); } );
		}

		SkillListV0.ui.querySelector('.content table').appendChild(element);
		this.parseHTML.call(levelup);

		Client.loadFile( DB.INTERFACE_PATH + 'item/' + sk.Name + '.bmp', function(data){
			element.querySelector('.icon img').setAttribute('src', data);
		});

		_list.push(skill);
		this.onUpdateSkill( skill.SKID, skill.level);
	};


	/**
	 * Remove skill from list
	 */
	SkillListV0.removeSkill = function removeSkill()
	{
		// Not implemented by gravity ? server have to send the whole list again ?
	};


	/**
	 * Update skill
	 *
	 * @param {object} skill : { SKID, level, spcost, attackRange, upgradable }
	 */
	SkillListV0.updateSkill = function updateSkill( skill )
	{
		var target = getSkillById(skill.SKID);
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

		if (skill.upgradable && _points) {
			element.querySelector('.levelup').style.display = '';
		}
		else {
			element.querySelector('.levelup').style.display = 'none';
		}

		this.onUpdateSkill( skill.SKID, skill.level);
	};


	/**
	 * Use a skill index
	 *
	 * @param {number} skill id
	 */
	SkillListV0.useSkillID = function useSkillID( id, level )
	{
		var skill = getSkillById(id);

		if (!skill || !skill.level || !skill.type) {
			return;
		}

		SkillListV0.useSkill( skill, level ? level : skill.selectedLevel );
	};


	/**
	 * Use a skill
	 *
	 * @param {object} skill
	 */
	SkillListV0.useSkill = function useSkill( skill, level )
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
	 *
	 * @param {number} skill points count
	 */
	SkillListV0.setPoints = function SetPoints( amount )
	{
		var i, count;
		this.ui.querySelector('.skpoints_count').textContent = amount;

		// Do not need to update the UI
		if ((!_points) === (!amount)) {
			_points = amount;
			return;
		}

		_points = amount;
		count   = _list.length;

		for (i = 0; i < count; ++i) {
			if (_list[i].upgradable && amount) {
				this.ui.querySelector('.skill.id' + _list[i].SKID + ' .levelup').style.display = '';
			}
			else {
				this.ui.querySelector('.skill.id' + _list[i].SKID + ' .levelup').style.display = 'none';
			}
		}
	};


	/**
	 * Add the button when leveling up
	 */
	SkillListV0.onLevelUp = function onLevelUp()
	{
		document.body.appendChild(_btnLevelUp);
	};


	/**
	 * Stop event propagation
	 */
	function stopPropagation( event )
	{
		event.stopImmediatePropagation();
		return false;
	}


	/**
	 * Find a skill by it's id
	 *
	 * @param {number} skill id
	 * @returns {Skill}
	 */
	function getSkillById( id )
	{
		var i, count = _list.length;

		for (i = 0; i < count; ++i) {
			if (_list[i].SKID === id) {
				return _list[i];
			}
		}

		return null;
	}


	/**
	 * Extend SkillListV0 window size
	 */
	function onResize()
	{
		var ui      = SkillListV0.ui;
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

			resize( w, h );
			lastWidth  = w;
			lastHeight = h;
		}

		// Start resizing
		_Interval = setInterval(resizing, 30);

		// Stop resizing on left click
		var _resizeHandler = function(event) {
			if (event.which === 1) {
				clearInterval(_Interval);
				window.removeEventListener('mouseup', _resizeHandler);
			}
		};
		window.addEventListener('mouseup', _resizeHandler);
	}


	/**
	 * Extend SkillListV0 window size
	 *
	 * @param {number} width
	 * @param {number} height
	 */
	function resize( width, height )
	{
		if (_preferences.mini) {
			width  = Math.min( Math.max(width,  8), 8);
			height = Math.min( Math.max(height, 4), 10);
			SkillListV0.ui.querySelector('.extend').style.display = '';
			SkillListV0.ui.querySelector('.content').style.display = '';
			SkillListV0.ui.querySelector('.contentbig').style.display = 'none';
			SkillListV0.ui.querySelector('.footer .btn').style.display = 'none';
			DOM.setCss(SkillListV0.ui.querySelector('.content'), {
				width:  width  * 32,
				height: height * 32
			});
		} else {
			width  = 17;
			height = 12;
			SkillListV0.ui.querySelector('.extend').style.display = 'none';
			SkillListV0.ui.querySelector('.content').style.display = 'none';
			SkillListV0.ui.querySelector('.contentbig').style.display = '';
			SkillListV0.ui.querySelector('.footer .btn').style.display = '';
			DOM.setCss(SkillListV0.ui.querySelector('.contentbig'), {
				width:  width  * 32,
				height: height * 32
			});
		}
	}


	/**
	 * Closing window
	 */
	function onClose()
	{
		SkillListV0.ui.style.display = 'none';
	}


	/**
	 * Resize and save
	 */
	function onMini()
	{
		_preferences.mini = !_preferences.mini;
		_preferences.save();
		resize(_preferences.width, _preferences.height);
	}


	/**
	 * Request to upgrade a skill
	 */
	function onRequestSkillUp()
	{
		var index = this.parentNode.parentNode.getAttribute('data-index');
		SkillListV0.onIncreaseSkill(
			parseInt(index, 10)
		);
	}


	/**
	 * Request to use a skill
	 */
	function onRequestUseSkill()
	{
		var main  = this.parentNode;

		if (!main.classList.contains('skill')) {
			main = main.parentNode;
		}

		SkillListV0.useSkillID(parseInt(main.getAttribute('data-index'), 10));
	}


	function onApplyChoice()
	{
		var applyArr = [];
		rememberChoice.forEach(function (item, skillId) {
			applyArr[skillId] = 0;
			var level = hasSkills?.[skillId]?.level ?? 0;

			if(item.count > level) {
				applyArr[skillId] = item.count - level
			}
		});

		applyArr.forEach(function (c, k) {
			for (var i = 0; i < c; i++) {
				SkillListV0.onIncreaseSkill(
					parseInt(k, 10)
				);
			}
		})

		totalCounter = 0;
		SkillListV0.ui.querySelector('.skpoints_count').textContent = _points - totalCounter;
		rememberChoice = [];
	}


	/**
	 * Reset choice
	 */
	function onResetChoice()
	{
		rememberChoice.forEach(function (count, skillId) {
			var skillbox = SkillListV0.ui.querySelector('.skillCol.s' + skillDependencyTree[skillId].position);
			if (skillbox) {
				if (!hasSkills?.[skillId]?.level) {
					Array.from(skillbox.children).forEach(function(ch) { ch.classList.add('disabled'); });
				}
				var sel = skillbox.querySelector('.selectable');
				if (sel) sel.style.display = '';
				var cur = skillbox.querySelector('.current');
				if (cur) cur.textContent = hasSkills?.[skillId]?.level ?? 0;
				var mx = skillbox.querySelector('.max');
				if (mx) mx.textContent = hasSkills?.[skillId]?.level ?? 0;
			}

		});
		totalCounter = 0;
		SkillListV0.ui.querySelector('.skpoints_count').textContent = _points;
		rememberChoice = [];
	}


	/**
	 * Show backlight
	 */
	function onNecessarySkills()
	{
		var main = this.parentNode;

		if (!main.classList.contains('skill')) {
			main = main.parentNode;
		}
		var skillId = parseInt(main.getAttribute('data-index'), 10);
		specifyRequirements(skillId);
	}


	/**
	 * Hide backlight
	 */
	function onNecessarySkillsRemove()
	{
		SkillListV0.ui.querySelectorAll('.needleSkill').forEach(function(el) { el.classList.remove('needleSkill'); });
		SkillListV0.ui.querySelectorAll('.counterSkill').forEach(function(el) { el.remove(); });
	}


	/**
	 * Request to get skill info (right click on a skill)
	 */
	function onRequestSkillInfo()
	{
		var main = this.parentNode;

		if (!main.classList.contains('skill')) {
			main = main.parentNode;
		}

		var id = parseInt(main.getAttribute('data-index'), 10);
		var skill = getSkillById(id);

		var skillID = skill?.SKID ?? id;

		// Don't add the same UI twice, remove it
		if (SkillDescription.uid === skillID) {
			SkillDescription.remove();
			return;
		}

		// Add ui to window
		if (_preferences.mini || _preferences.skillInfo) {
			SkillDescription.append();
			SkillDescription.setSkill(skillID);
		}
	}


	/**
	 * Hide description
	 */
	function onSkillDescriptionRemove()
	{
		SkillDescription.remove();
	}


	/**
	 * Checkbox show/hide description
	 */
	function onToggleSkillInfo()
	{
		_preferences.skillInfo = !!this.checked;
		_preferences.save();
	}


	/**
	 * Focus a skill in the list (background color changed)
	 */
	function onSkillFocus()
	{
		var main = this.parentNode;

		if (!main.classList.contains('skill')) {
			main = main.parentNode;
		}

		Array.from(SkillListV0.ui.querySelectorAll('.skill.selected')).forEach(function(el) { el.classList.remove('selected'); });
		main.classList.add('selected');
	}


	/**
	 * Start to drag a skill (to put it on the hotkey UI ?)
	 */
	function onSkillDragStart( event )
	{
		var index = parseInt(this.getAttribute('data-index'), 10);
		var skill = getSkillById(index);

		// Can't drag a passive skill (or disabled)
		if (!skill || !skill.level || !skill.type) {
			return stopPropagation(event);
		}

		var img   = new Image();
		img.src   = this.querySelector('.icon img').getAttribute('src');
		event.dataTransfer.setDragImage( img, 12, 12 );
		event.dataTransfer.setData('Text',
			JSON.stringify( window._OBJ_DRAG_ = {
				type: 'skill',
				from: 'SkillListV0',
				data:  skill
			})
		);
	}


	/**
	 * Stop the drag drop action, clean up
	 */
	function onSkillDragEnd()
	{
		delete window._OBJ_DRAG_;
	}


	function skillLevelSelectUp( skill )
	{
		var level = skill.selectedLevel ? skill.selectedLevel : skill.level;
		if (level < skill.level){
			skill.selectedLevel = level + 1;
			var element = SkillListV0.ui.querySelector('.skill.id' + skill.SKID);
			if (element) element.querySelector('.level .current').textContent = skill.selectedLevel;
		}
	}


	function skillLevelSelectDown( skill )
	{
		var level = skill.selectedLevel ? skill.selectedLevel : skill.level;
		if (level > 1){
			skill.selectedLevel = level - 1;
			var element = SkillListV0.ui.querySelector('.skill.id' + skill.SKID);
			if (element) element.querySelector('.level .current').textContent = skill.selectedLevel;
		}
	}


	/**
	 * Abstract function to define
	 */
	SkillListV0.onUseSkill      = function onUseItem(){};
	SkillListV0.onIncreaseSkill = function onIncreaseSkill() {};
	SkillListV0.onUpdateSkill   = function onUpdateSkill(){};
	SkillListV0.getSkillById    = getSkillById;


	/**
	 * Create component and export it
	 */
	return UIManager.addComponent(SkillListV0);
});
