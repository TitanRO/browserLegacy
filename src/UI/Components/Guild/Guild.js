/**
 * UI/Components/Guild/Guild.js
 *
 * Chararacter Guild
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author @vthibault, @Javierlog08, @scriptord3
 */
define(function(require)
{
	'use strict';

	var DOM       = require('Utils/DOM');

	/**
	 * Dependencies
	 */
	var DB             = require('DB/DBManager');
	var SkillInfo      = require('DB/Skills/SkillInfo');
	var Mouse          = require('Controls/MouseEventHandler');
	var MonsterTable   = require('DB/Monsters/MonsterTable');
	var Session        = require('Engine/SessionStorage');
	var Entity         = require('Renderer/Entity/Entity');
	var SpriteRenderer = require('Renderer/SpriteRenderer');
	var Camera         = require('Renderer/Camera');
	var Renderer       = require('Renderer/Renderer');
	var Preferences    = require('Core/Preferences');
	var Client         = require('Core/Client');
	var UIManager      = require('UI/UIManager');
	var UIComponent    = require('UI/UIComponent');
	var ContextMenu    = require('UI/Components/ContextMenu/ContextMenu');
	var ChatBox        = require('UI/Components/ChatBox/ChatBox');
	var InputBox       = require('UI/Components/InputBox/InputBox');
	var SkillTargetSelection = require('UI/Components/SkillTargetSelection/SkillTargetSelection');
	var SkillDescription     = require('UI/Components/SkillDescription/SkillDescription');
	var htmlText       = require('text!./Guild.html');
	var cssText        = require('text!./Guild.css');


	/**
	 * @var {Preferences} structure
	 */
	var _preferences = Preferences.get('Guild', {
		x: 100,
		y: 100
	}, 1.0);


	/**
	 * Flags to check access
	 * (Look up for Type)
	 */
	var AccessTypeBit = {
		0: 0x00, // General
		1: 0x01, // Members
		2: 0x02, // Position
		3: 0x04, // Skills
		4: 0x10, // Expel
		5: 0x40, // Unknown
		6: 0x80  // Notice
	};


	/**
	 * Create Component
	 */
	var Guild = new UIComponent( 'Guild', htmlText, cssText );


	/**
	 * View template
	 */
	var MemberView, PositionView, ExpelView;


	/**
	 * @var {Array} position list
	 */
	var _positions = [];


	/**
	 * @var {Array} members list
	 */
	var _members = [];

	/**
	 * @var {Array} Skill List
	 * { SKID, type, level, spcost, attackRange, skillName, upgradable }
	 */
	var _skills = [];

	/**
	 * @var {jQuery} level up button reference
	 */
	var _btnIncSkill;


	/**
	 * @var {number} skill points
	 */
	var _skpoints = 0;


	/**
	 * @var {jQuery} button that appeared when level up
	 */
	var _btnLevelUp;

	var lArrow, rArrow;

	/**
	 * @var {number} total guild exp
	 */
	var _totalExp = 0;


	/**
	 * @var {number} access to guild tab
	 */
	var _guildAccess = 0;


	/**
	 * @var {string} checkbox images
	 */
	var _checkbox_off, _checkbox_on;


	/**
	 * Initialize component
	 */
	Guild.init = function init()
	{
		var ui = this.ui;

		MemberView   = DOM.detach(this.ui.querySelector('.MemberView'));
		PositionView = DOM.detach(this.ui.querySelector('.PositionView'));
		ExpelView    = DOM.detach(this.ui.querySelector('.ExpelView'));

		// Close button
		ui.querySelector('.titlebar .close').addEventListener('mousedown', stopPropagation);
		ui.querySelector('.titlebar .close').addEventListener('click', Guild.toggle.bind(this));
		DOM.addDelegatedEvent(ui.querySelector('.tabs'), 'click', 'button', onChangeTab);

		// Preload image
		Client.loadFiles([DB.INTERFACE_PATH + 'checkbox_0.bmp', DB.INTERFACE_PATH + 'checkbox_1.bmp'], function(off,on) {
			_checkbox_off = off;
			_checkbox_on  = on;
		});

		// Positions
		var _positionsBody = ui.querySelector('.content.positions tbody');
		DOM.addDelegatedEvent(_positionsBody, 'mousedown', 'input', function(){
			return Session.isGuildMaster;
		});
		DOM.addDelegatedEvent(_positionsBody, 'focus', 'input', function(){
			ui.querySelector('.footer .btn_ok').style.display = '';
			this.select();
		});
		DOM.addDelegatedEvent(_positionsBody, 'click', 'button', function(){
			if (Session.isGuildMaster) {
				this.className = (this.className === 'on' ? 'off' : 'on');
				this.style.backgroundImage = 'url('+ (this.className === 'on' ? _checkbox_on : _checkbox_off) +')';
				ui.querySelector('.footer .btn_ok').style.display = '';
			}
		});
		DOM.addDelegatedEvent(_positionsBody, 'mousedown', 'tr', function(){
			ui.querySelector('.content.positions tbody tr').classList.remove('active');
			this.classList.add('active');
		});

		// Antagonist/Ally
		var _allyListEl    = ui.querySelector('.content.info .ally_list');
		var _hostileListEl = ui.querySelector('.content.info .hostile_list');
		function onRelationContextMenu(){
			var relation = this.parentNode.classList.contains('ally_list') ? 0 : 1;
			var guild_id = parseInt(this.getAttribute('data-guild-id'), 10);

			var activeDivs = ui.querySelectorAll('.content.info .ally_list div, .content.info .hostile_list div');
			Array.prototype.forEach.call(activeDivs, function(d){ d.classList.remove('active'); });
			this.classList.add('active');

			ContextMenu.remove();
			ContextMenu.append();
			ContextMenu.addElement(DB.getMessage(351), function(){
				Guild.onRequestDeleteRelation(guild_id, relation);
			});
		}
		if (_allyListEl)    DOM.addDelegatedEvent(_allyListEl,    'contextmenu', 'div', onRelationContextMenu);
		if (_hostileListEl) DOM.addDelegatedEvent(_hostileListEl, 'contextmenu', 'div', onRelationContextMenu);

		// Members
		var _membersBody = ui.querySelector('.content.members tbody');
		DOM.addDelegatedEvent(_membersBody, 'mousedown', 'tr', function(){
			ui.querySelector('.content.members tbody tr').classList.remove('active');
			this.classList.add('active');
		});
		DOM.addDelegatedEvent(_membersBody, 'contextmenu', 'td.name', function(){
			var index  = this.parentNode.getAttribute('data-index');
			var member = _members[index];
			var isSelf = ((member.AID === Session.AID) && (member.GID === Session.GID));

			ContextMenu.remove();
			ContextMenu.append();

			// View Information
			ContextMenu.addElement( DB.getMessage(129), function(){
				Guild.onRequestMemberInfo(member.AID);
			});

			// Leave Guild
			if (isSelf && !Session.isGuildMaster) {
				ContextMenu.addElement( DB.getMessage(508), function(){
					InputBox.append();
					InputBox.setType('text');
					InputBox.ui.querySelector('.text').textContent = DB.getMessage(523);
					InputBox.onSubmitRequest = function(reason) {
						InputBox.remove();
						Guild.onRequestLeave(member.AID, member.GID, reason);
					};
				});
			}

			// Expel
			if ((Session.guildRight & 0x10) && !isSelf) {
				ContextMenu.addElement( DB.getMessage(509), function(){
					InputBox.append();
					InputBox.setType('text');
					InputBox.ui.querySelector('.text').textContent = DB.getMessage(524);
					InputBox.onSubmitRequest = function(reason) {
						InputBox.remove();
						Guild.onRequestMemberExpel(member.AID, member.GID, reason);
					};
				});
			}
		});
		// Skills

		// Get level up button
		_btnIncSkill = this.ui.querySelector('.btn.levelup');
		DOM.detach(_btnIncSkill);
		_btnIncSkill.addEventListener('click', onRequestSkillUp);

		// Get button to open skill when level up
		_btnLevelUp = DOM.detach(document.getElementById('lvlup_job'));
		if (_btnLevelUp) {
			_btnLevelUp.addEventListener('click', function(){
				DOM.detach(_btnLevelUp);
				Guild.ui.style.display = '';
				if (Guild.ui.parentNode) Guild.ui.parentNode.appendChild(Guild.ui);
			});
			_btnLevelUp.addEventListener('mousedown', stopPropagation);
		}

		// Bind skills
		DOM.addDelegatedEvent(this.ui, 'dblclick', '.skill .icon, .skill .name', onRequestUseSkill);
		DOM.addDelegatedEvent(this.ui, 'contextmenu', '.skill .icon, .skill .name', onRequestSkillInfo);
		DOM.addDelegatedEvent(this.ui, 'mousedown', '.selectable', onSkillFocus);
		DOM.addDelegatedEvent(this.ui, 'dragstart', '.skill', onSkillDragStart);
		DOM.addDelegatedEvent(this.ui, 'dragend', '.skill', onSkillDragEnd);


		// Notice
		var _noticeContent = ui.querySelector('.content.notice');
		DOM.addDelegatedEvent(_noticeContent, 'focus', 'textarea, input', function(){
			ui.querySelector('.footer .btn_ok').style.display = '';
		});

		// Upload emblem
		ui.querySelector('.content.info .emblem_edit input').addEventListener('change', function(){
			if (this.files.length && this.files[0].type === 'image/bmp' && this.files[0].size < 1783) {
				var reader = new FileReader();
				reader.onload = function(e) {
					Guild.onSendEmblem(new Uint8Array(e.target.result));
				};
				reader.readAsArrayBuffer(this.files[0]);
			} else {
				console.warn('[Warning] Incorrect emblem file type. Only BMP, 24bit or lower is accepted.');
			}
		});

		ui.querySelector('.footer .btn_ok').addEventListener('click', onValidate);

		this.draggable(this.ui.querySelector('.titlebar'));
		this.ui.style.display = 'none';

		Client.loadFile( DB.INTERFACE_PATH + 'basic_interface/arw_right.bmp', function(data){
			rArrow = 'url('+data+')';
		});
		Client.loadFile( DB.INTERFACE_PATH + 'basic_interface/arw_left.bmp', function(data){
			lArrow = 'url('+data+')';
		});

		renderTendency(0, 0);
	};


	/**
	 * Removing guild, stop rendering
	 */
	Guild.onRemove = function onRemove()
	{
		Renderer.stop(renderMemberFaces);
	};


	/**
	 * Process shortcut
	 *
	 * @param {object} key
	 */
	Guild.onShortCut = function onShurtCut( key )
	{
		switch (key.cmd) {
			case 'TOGGLE':
				DOM.toggleDisplay(this.ui);
				break;
		}
	};


	/**
	 * Toggle Guild UI
	 */
	Guild.toggle = function onToggle()
	{
		if (!Session.hasGuild) {
			return;
		}

		if (DOM.isVisible(this.ui)) {
			this.ui.style.display = 'none';
			DOM.detach(_btnLevelUp);
		}
		else {
			this.ui.style.display = '';
		}
	};


	/**
	 * Show guild element
	 */
	Guild.show = function show()
	{
		this.focus();

		if (DOM.isVisible(this.ui)) {
			return;
		}

		this.ui.style.display = '';

		if (!this.ui.querySelector('.tabs .active')) {
			this.ui.querySelector('.tabs .info').click();
			Guild.onRequestAccess();
		}

		if (DOM.isVisible(this.ui.querySelector('.content.members'))) {
			Renderer.render(renderMemberFaces);
		}
	};


	/**
	 * Hide guild element
	 */
	Guild.hide = function hide()
	{
		this.ui.style.display = 'none';
		Renderer.stop(renderMemberFaces);
	};


	/**
	 * Update General guild infos
	 *
	 * @param {object} data
	 */
	Guild.setGuildInformations = function setGuildInformations( info )
	{
		var general = this.ui.querySelector('.content.info');

		general.querySelector('.name .value').textContent = info.guildname;
		general.querySelector('.level .value').textContent = info.level;
		general.querySelector('.master .value').textContent = info.masterName;
		//general.querySelector('.members .numMember').textContent = info.userNum; // Why does the server send online number instead of total members?
		general.querySelector('.members .online').textContent = info.userNum;
		general.querySelector('.members .maxMember').textContent = info.maxUserNum;
		general.querySelector('.avglevel .value').textContent = info.userAverageLevel;
		general.querySelector('.territory .value').textContent = info.manageLand;
		general.querySelector('.exp .value').textContent = info.exp;
		general.querySelector('.tax .value').textContent = info.point;

		Guild.onRequestGuildEmblem(info.GDID, info.emblemVersion, Guild.setEmblem.bind(this));

		if (Session.isGuildMaster) {
			general.querySelector('.emblem_edit').style.display = '';
		}
		else {
			general.querySelector('.emblem_edit').style.display = 'none';
		}

		renderTendency(info.honor, info.virtue);
	};


	/**
	 * Set guild emblem
	 *
	 * @param {Image}
	 */
	Guild.setEmblem = function setEmblem( image )
	{
		this.ui.querySelector('.content.info').querySelector('.emblem_container').style.backgroundImage = 'url('+ image.src +')';
	};


	/**
	 * Add guild relation (ally / enemy)
	 *
	 * @param {Array} guild list
	 */
	Guild.setRelations = function setRelations( guilds )
	{
		var i, count;

		this.ui.querySelector('.ally_list, .hostile_list').innerHTML = '';

		for (i = 0, count = guilds.length; i < count; ++i) {
			this.addRelation(guilds[i]);
		}
	};


	/**
	 * Add a relation
	 *
	 * @param {object} guild
	 */
	Guild.addRelation = function addRelation( guild )
	{
		var list = this.ui.querySelector('.' + (guild.relation === 0 ? 'ally' : 'hostile') + '_list');
		var div  = document.createElement('div');

		div.setAttribute('data-guild-id', guild.GDID);
		div.textContent = guild.guildName;
		list.append(div);
	};


	/**
	 * Remove relation
	 *
	 * @param {number} guild id
	 * @param {number} relation
	 */
	Guild.removeRelation = function removeRelation( guild_id, relation)
	{
		var list = this.ui.querySelector('.content.info .' + (relation === 0 ? 'ally' : 'hostile') + '_list');
		var _relEl = list.querySelector('div[data-guild-id="'+ guild_id +'"]');
		if (_relEl) _relEl.remove();
	};


	/**
	 * Add guild members
	 *
	 * @param {Array} member list
	 */
	Guild.setMembers = function setMembers( members )
	{
		var i, count, online;

		count           = members.length;
		_members.length = 0;
		_totalExp       = 0;
		online          = 0;

		this.ui.querySelector('.content.members tbody').innerHTML = '';

		// Get total exp
		for (i = 0; i < count; ++i) {
			_totalExp += members[i].MemberExp;
			online    += members[i].CurrentState ? 1 : 0;
		}

		this.ui.querySelector('.content.info .members .numMember').textContent = count;
		this.ui.querySelector('.content.info .members .online').textContent = online;

		for (i = 0, count = members.length; i < count; ++i) {
			this.setMember(members[i]);
		}

		renderMemberFaces(Renderer.tick+1000);
	};


	/**
	 * Display member
	 *
	 * @param {object} member
	 */
	Guild.setMember = function setMember( member )
	{
		var i, count, view;

		// Search for duplicate entry
		for (i = 0, count = _members.length; i < count; ++i) {
			if (_members[i].AID === member.AID && _members[i].GID === member.GID) {
				break;
			}
		}

		// Edit member
		if (i < count) {
			view = this.ui.querySelector('.MemberView[data-index="'+ i +'"]');
		}

		// Create new entry
		else {
			view = MemberView.cloneNode(true);
			this.ui.querySelector('.content.members tbody').append(view);
			_members.push(member);
		}

		if (member.CurrentState) {
			view.classList.add('online');
		}

		view.setAttribute('data-index', i);
		var _nameEl = view.querySelector('.name .value');
		if (_nameEl) { _nameEl.textContent = member.CharName; _nameEl.title = member.CharName; }

		if (_positions[member.GPositionID]) {
			if (Session.isGuildMaster && member.GPositionID !== 0) { // Don't let GM change it's own position. Causes bugs.
				var selectElement = '<select class="changePosition member_' +member.AID+ '_' +member.GID+ '">';
				_positions.forEach( (position, key) => {
					selectElement += '<option value="' + position.positionID + '" ' + ( key == member.GPositionID ? 'selected' : '') + '>' + position.posName + '</option>';
				});
				selectElement += '</select>';

				var _posEl = view.querySelector('.position');
				if (_posEl) _posEl.innerHTML = selectElement;

				var _selectEl = view.querySelector('.member_'+member.AID+'_'+member.GID);
				if (_selectEl) _selectEl.addEventListener('change', function(evt){
					Guild.updateMemberPosition(member.AID, member.GID, evt.target.selectedIndex, true);
				});
			}
			else {
				var _posEl2 = view.querySelector('.position');
				if (_posEl2) { _posEl2.textContent = _positions[member.GPositionID].posName; _posEl2.title = _positions[member.GPositionID].posName; }
			}
		}

		var _jobEl = view.querySelector('.job');
		if (_jobEl) { _jobEl.textContent = MonsterTable[member.Job]; _jobEl.title = MonsterTable[member.Job]; }
		view.querySelector('.level').textContent = member.Level;
		view.querySelector('.note').textContent = member.Memo;
		view.querySelector('.devotion').textContent = (member.MemberExp ? Math.round(member.MemberExp / _totalExp * 100) : 0) + ' %';
		var _taxEl = view.querySelector('.tax');
		if (_taxEl) { _taxEl.textContent = member.MemberExp; _taxEl.title = member.MemberExp; }

		if (!member.entity) {
			member.entity = new Entity();
			member.entity.direction = 4;
			member.entity.objecttype = Entity.TYPE_PC;
			member.entity.files.shadow.spr = null;
		}

		member.entity.sex         = member.Sex;
		member.entity.head        = member.HeadType;
		member.entity.headpalette = member.HeadPalette;
		
		this.ui.querySelector('.content.info .members .numMember').textContent = _members.length;
	};



	/**
	 * Display member
	 *
	 * @param {object} member
	 */
	Guild.updateMemberStatus = function updateMemberStatus( member )
	{
		var i, count, view;
		var online = 0;

		// Search for duplicate entry
		for (i = 0, count = _members.length; i < count; ++i) {
			if (_members[i].AID === member.AID && _members[i].GID === member.GID) {
				break;
			}
		}

		// Not found
		if (i >= count) {
			return;
		}

		view = this.ui.querySelector('.MemberView[data-index="'+ i +'"]');

		_members[i].CurrentState = member.status;
		view.classList.toggle('online', !!(_members[i].CurrentState));

		if ('sex' in member) {
			_members[i].entity.sex = member.sex;
		}

		if ('head' in member) {
			_members[i].entity.head = member.head;
		}

		if ('headPalette' in member) {
			_members[i].entity.headpalette = member.headPalette;
		}
		
		// Update online count
		for (i = 0, count = _members.length; i < count; ++i) {
			online    += _members[i].CurrentState ? 1 : 0;
		}
		this.ui.querySelector('.content.info .members .online').textContent = online;

		ChatBox.addText( DB.getMessage(485 + (member.status ? 0 : 1)).replace('%s', view.querySelector('.name .value').textContent), ChatBox.TYPE.BLUE, ChatBox.FILTER.GUILD);
	};


	/**
	 * Update member position
	 *
	 * @param {number} AID
	 * @param {number} GID
	 * @param {number} position id
	 */
	Guild.updateMemberPosition = function updateMemberPosition( AID, GID, positionID, validate)
	{
		var i, count;

		// Search the member.
		for (i = 0, count = _members.length; i < count; ++i) {
			if (_members[i].AID === AID && _members[i].GID === GID) {
				_members[i].GPositionID = positionID;

				// Update it
				Guild.setMember(_members[i]);
				break;
			}
		}
		
		if(validate){
			onValidate();
		}
	};


	/**
	 * Set guild positions
	 *
	 * @param {Array} position list
	 * @param {boolean} erase array ?
	 */
	Guild.setPositions = function setPositions( positions, erase )
	{
		var i, count;
		var rank;

		if (erase) {
			_positions.length = positions.length;
		}

		for (i = 0, count = positions.length; i < count; ++i) {
			rank = positions[i];

			if (!(rank.positionID in _positions)) {
				_positions[ rank.positionID ] = {};
			}

			_positions[ rank.positionID ].positionID = rank.positionID;
			_positions[ rank.positionID ].right      = rank.right;
			_positions[ rank.positionID ].ranking    = rank.ranking;
			_positions[ rank.positionID ].payRate    = rank.payRate;

			if (rank.posName) {
				_positions[ rank.positionID ].posName = rank.posName;
			}
		}

		Guild.updatePositionView();
	};


	/**
	 * Set guild positions name
	 *
	 * @param {Array} position list
	 */
	Guild.setPositionsName = function setPositionsName( positions )
	{
		var i, count;
		var rank;

		for (i = 0, count = positions.length; i < count; ++i) {
			rank = positions[i];

			if (!(rank.positionID in _positions)) {
				_positions[ rank.positionID ] = {};
			}

			_positions[ rank.positionID ].posName = rank.posName;
		}

		Guild.updatePositionView();
	};


	/**
	 * Update guild positions view
	 */
	Guild.updatePositionView = function updatePositionView()
	{
		var i, count;
		var view, rank, container;

		count     = _positions.length;
		container = this.ui.querySelector('.content.positions tbody');
		container.innerHTML = '';

		// Update UI
		for (i = 0; i < count; ++i) {
			view = PositionView.cloneNode(true);
			rank = _positions[i];

			if (i === 0) {
				view.classList.add('active');
			}

			view.querySelector('.id').textContent = rank.positionID;
			view.querySelector('.title input').value = rank.posName;
			view.querySelector('.tax input').value = rank.payRate;

			var inviteBtn = view.querySelector('.invite button');
			inviteBtn.style.backgroundImage = 'url(' + (rank.right & 0x01 ? _checkbox_on : _checkbox_off) + ')';
			inviteBtn.classList.remove('on', 'off');
			inviteBtn.classList.add(rank.right & 0x01 ? 'on' : 'off');

			var punishBtn = view.querySelector('.punish button');
			punishBtn.style.backgroundImage = 'url(' + (rank.right & 0x10 ? _checkbox_on : _checkbox_off) + ')';
			punishBtn.classList.remove('on', 'off');
			punishBtn.classList.add(rank.right & 0x10 ? 'on' : 'off');

			container.append(view);
		}
	};




	/**
	 * Add skills to the list
	 */
	Guild.setSkills = function setSkills( skills )
	{
		var i, count;

		for (i = 0, count = _skills.length; i < count; ++i) {
			this.onUpdateSkill( _skills[i].SKID, 0);
		}

		_skills.length = 0;
		this.ui.querySelector('.content.skills .skill_list table').innerHTML = '';

		for (i = 0, count = skills.length; i < count; ++i) {
			this.addSkill( skills[i] );
		}
	};


	/**
	 * Insert skill to list
	 *
	 * @param {object} skill
	 */
	Guild.addSkill = function addSkill( skill )
	{
		// Custom skill ?
		if (!(skill.SKID in SkillInfo)) {
			return;
		}

		// Already in list, update it instead of duplicating it
		if (this.ui.querySelector('.skill.id' + skill.SKID + '')) {
			this.updateSkill( skill );
			return;
		}

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

		if (!skill.upgradable || !_skpoints) {
			levelup.style.display = 'none';
		}

		element.querySelector('.levelupcontainer').append( levelup );

		if (sk.bSeperateLv) {
			if (rArrow) element.querySelector('.level .currentUp').style.backgroundImage = rArrow;
			if (lArrow) element.querySelector('.level .currentDown').style.backgroundImage = lArrow;

			element.querySelector('.level .currentUp').addEventListener('click',  function(){ skillLevelSelectUp(skill);  } );
			element.querySelector('.level .currentDown').addEventListener('click',  function(){ skillLevelSelectDown(skill); } );
		}
		Guild.ui.querySelector('.content.skills .skill_list table').append(element);
		this.parseHTML.call(levelup);

		Client.loadFile( DB.INTERFACE_PATH + 'item/' + sk.Name + '.bmp', function(data){
			element.querySelector('.icon img').setAttribute('src', data);
		});

		_skills.push(skill);
		this.onUpdateSkill( skill.SKID, skill.level);
	};

	/**
	 * Remove skill from list
	 */
	Guild.removeSkill = function removeSkill()
	{
		// Not implemented by gravity ? server have to send the whole list again ?
	};


	/**
	 * Update skill
	 *
	 * @param {object} skill : { SKID, level, spcost, attackRange, upgradable }
	 */
	Guild.updateSkill = function updateSkill( skill )
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
		element = this.ui.querySelector('.skill.id' + skill.SKID + '');
		element.querySelector('.level .current, .level .max').textContent = skill.level;
		if(skill.selectedLevel){
			element.querySelector('.level .current').textContent = skill.selectedLevel;
		}
		element.querySelector('.spcost').textContent = skill.spcost;

		element.classList.remove('active passive disabled');
		element.classList.add(!skill.level ? 'disabled' : skill.type ? 'active' : 'passive');

		if (skill.upgradable && _skpoints) {
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
	Guild.useSkillID = function useSkillID( id, level )
	{
		var skill = getSkillById(id);
		if (!skill || !skill.level || !skill.type) {
			return;
		}

		Guild.useSkill( skill, level ? level : skill.selectedLevel );
	};


	/**
	 * Use a skill
	 *
	 * @param {object} skill
	 */
	Guild.useSkill = function useSkill( skill, level )
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
	Guild.setPoints = function SetPoints( amount )
	{
		var i, count;
		this.ui.querySelector('.skpoints_count').textContent = amount;

		// Do not need to update the UI
		if ((!_skpoints) === (!amount)) {
			_skpoints = amount;
			return;
		}

		_skpoints = amount;
		count   = _skills.length;

		for (i = 0; i < count; ++i) {
			if (_skills[i].upgradable && amount) {
				this.ui.querySelector('.skill.id' + _skills[i].SKID + ' .levelup').style.display = '';
			}
			else {
				this.ui.querySelector('.skill.id' + _skills[i].SKID + ' .levelup').style.display = 'none';
			}
		}
	};


	/**
	 * Add the button when leveling up
	 */
	Guild.onLevelUp = function onLevelUp()
	{
		_btnLevelUp.appendTo('body');
	};


	/**
	 * Find a skill by it's id
	 *
	 * @param {number} skill id
	 * @returns {Skill}
	 */
	function getSkillById( id )
	{
		var i, count = _skills.length;

		for (i = 0; i < count; ++i) {
			if (_skills[i].SKID === id) {
				return _skills[i];
			}
		}

		return null;
	}


	/**
	 * Request to upgrade a skill
	 */
	function onRequestSkillUp()
	{
		var index = this.parentNode.parentNode.getAttribute('data-index');
		Guild.onIncreaseSkill(
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

		Guild.useSkillID(parseInt(main.getAttribute('data-index'), 10));
	}


	/**
	 * Request to get skill info (right click on a skill)
	 */
	function onRequestSkillInfo()
	{
		var main = this.parentNode;
		var skill;

		if (!main.classList.contains('skill')) {
			main = main.parentNode;
		}

		skill = getSkillById(parseInt(main.getAttribute('data-index'), 10));

		// Don't add the same UI twice, remove it
		if (SkillDescription.uid === skill.SKID) {
			SkillDescription.remove();
			return;
		}

		// Add ui to window
		SkillDescription.append();
		SkillDescription.setSkill(skill.SKID);
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

		Guild.ui.querySelector('.skill').classList.remove('selected');
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
		img.src   = this.firstChild.firstChild.src;

		event.dataTransfer.setDragImage( img, 12, 12 );
		event.dataTransfer.setData('Text',
			JSON.stringify( window._OBJ_DRAG_ = {
				type: 'skill',
				from: 'Guild',
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

	function skillLevelSelectUp( skill ){
		var level = skill.selectedLevel ? skill.selectedLevel : skill.level;
		if (level < skill.level){
			skill.selectedLevel = level + 1;
			var element = Guild.ui.querySelector('.skill.id' + skill.SKID);
			if (element) element.querySelector('.level .current').textContent = skill.selectedLevel;
		}
	}

	function skillLevelSelectDown( skill ){
		var level = skill.selectedLevel ? skill.selectedLevel : skill.level;
		if (level > 1){
			skill.selectedLevel = level - 1;
			var element = Guild.ui.querySelector('.skill.id' + skill.SKID);
			if (element) element.querySelector('.level .current').textContent = skill.selectedLevel;
		}
	}








	/**
	 * Set guild notice
	 *
	 * @param {string} notice subject
	 * @param {string} notice content
	 */
	Guild.setNotice = function setNotice( subject, notice)
	{
		var element = this.ui.querySelector('.content.notice');

		element.querySelector('.subject').value = subject;
		element.querySelector('.notice').value = notice;
	};


	/**
	 * Set expel list
	 *
	 * @param {Array} expel list
	 */
	Guild.setExpelList = function setExpelList( list )
	{
		var i, count;
		var container, element;

		container = this.ui.querySelector('.content.history tbody');
		container.innerHTML = '';

		for (i = 0, count = list.length; i < count; ++i) {
			element = ExpelView.cloneNode(true);

			element.querySelector('.name').textContent = list[i].charname;
			element.querySelector('.reason').textContent = list[i].reason;

			container.append(element);
		}
	};


	/**
	 * Set access to tabs
	 *
	 * @param {number} access
	 */
	Guild.setAccess = function setAccess(access)
	{
		_guildAccess = access;
	};


	/**
	 * Stop propagation of events
	 */
	function stopPropagation(event)
	{
		event.stopImmediatePropagation();
		return false;
	}


	/**
	 * Change tab
	 */
	function onChangeTab( event )
	{
		var tab = parseInt(this.getAttribute('data-flag'), 10);

		if (!event.isTrigger) {
			// Can't open this tab
			if (this.classList.contains('active') || (tab && !(_guildAccess & AccessTypeBit[tab]))) {
				return false;
			}
		}

		Guild.onGuildInfoRequest(tab);

		Guild.ui.querySelector('.tabs button').classList.remove('active');
		Guild.ui.querySelector('.content').style.display = 'none';
		var _contentEl = Guild.ui.querySelector('.content.' + this.className);
		if (_contentEl) _contentEl.style.display = '';
		Guild.ui.querySelector('.footer .btn_ok').style.display = 'none';

		if (this.className === 'members') {
			Renderer.render(renderMemberFaces);
		}
		else {
			Renderer.stop(renderMemberFaces);
		}

		this.classList.add('active');

		return false;
	}


	/**
	 * Render tendency graphic
	 *
	 * @param {number} honor [-100, 100]
	 * @param {number} virtue [-100, 100]
	 */
	function renderTendency(honor,  virtue)
	{
		var canvas = Guild.ui.querySelector('.content.info .tendency canvas');
		var ctx    = canvas.getContext('2d');

		// Border
		ctx.fillStyle = '#cecfce';
		ctx.fillRect( 0, 0, canvas.width, canvas.height);

		// Background
		ctx.fillStyle = '#739eef';
		ctx.fillRect(1, 1, canvas.width-2, canvas.height-2);

		// axis
		ctx.fillStyle = '#4261a5';
		ctx.fillRect( canvas.width / 2 - 1, 1, 2, canvas.height - 2); // Y
		ctx.fillRect( 1, canvas.height / 2 - 1, canvas.width - 2, 2); // X

		// TODO: render graphic (not sure if it's rectangle or triangle)
		// For now, it was never used so keep it as default
		// honor: (left) Vulgar [-100,100] Famed (right)
		// virtue: (down) Wicked [-100,100] Righteous (up)
		ctx.fillStyle = '#ffffff';
		ctx.fillRect( canvas.width / 2 - 1, canvas.height / 2 - 1, 2, 2);
	}


	/**
	 * Display member faces every seconds.
	 * There is no event to detect if a character finish loading.
	 *
	 * @param {number} tick
	 */
	var renderMemberFaces = (function renderMemberFacesClosure()
	{
		var lastTick = 0;

		return function renderMemberFaces(tick)
		{
			if (tick < lastTick + 1000) {
				return;
			}

			var canvas, ctx;
			var i, count;

			lastTick = tick;
			canvas   = Guild.ui.querySelector('.content.members canvas');
			Camera.direction = 4;

			for (i = 0, count = _members.length; i <  count; ++i) {
				ctx = canvas[i].getContext('2d');
				ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

				// Offline character
				if (!_members[i].CurrentState) {
					continue;
				}

				SpriteRenderer.bind2DContext(ctx, 15, 45);
				_members[i].entity.renderEntity();
			}
		};
	})();


	/**
	 * Validate a change (notice, position, etc.)
	 */
	function onValidate()
	{
		var activeContent = Array.prototype.find.call(
			Guild.ui.querySelectorAll('.content'),
			function(el) { return DOM.isVisible(el); }
		);
		var activeTab = activeContent ? activeContent.className : '';
		activeTab = activeTab.replace(/content/g, '').replace(/^\s+|\s+$/gm,'');

		switch (activeTab) {
			case 'members':
				var list = [];
				
				_members.forEach((member) => {
					list.push({
						AID: member.AID,
						GID: member.GID,
						positionID: member.GPositionID
					});
				});
				
				Guild.onChangeMemberPosRequest(list);
				break;

			case 'positions':
				var i, count;
				var position, positions;
				var right, posName, payRate;
				var list = [];

				positions = Guild.ui.querySelector('.PositionView');

				for (i = 0, count = _positions.length; i < count; ++i) {
					position = positions[i];

					posName = position.querySelector('.title input').value;
					payRate = parseInt(position.querySelector('.tax input').value, 10);
					right   = 0;

					if (position.querySelector('.invite button').classList.contains('on')) {
						right |=  0x01;
					}

					if (position.querySelector('.punish button').classList.contains('on')) {
						right |=  0x10;
					}

					if (_positions[i].right   !== right ||
					    _positions[i].posName !== posName ||
					    _positions[i].payRate !== payRate) {

						list.push({
							positionID: _positions[i].positionID,
							ranking:    _positions[i].ranking,
							right:      right,
							posName:    posName,
							payRate:    payRate
						});
					}
				}

				Guild.onPositionUpdateRequest(list);
				break;

			case 'notice':
				var subject = Guild.ui.querySelector('.content.notice input').value;
				var content = Guild.ui.querySelector('.content.notice textarea').value;

				Guild.onNoticeUpdateRequest(subject, content);
				break;
		}

		Guild.ui.querySelector('.footer .btn_ok').style.display = 'none';
	}


	/**
	 * When Requesting Guild Information Screen.
	 * @param {number}	type
	 *  GENERAL:     0, //	Request packets ZC_GUILD_INFO2, MYGUILD_BASIC_INFO
	 *	MEMBERS:     1, //	Request packets ZC_MEMBERMGR_INFO, ZC_POSITION_ID_NAME_INFO
	 *	POSITION:    2, //	Request packets ZC_POSITION_ID_NAME_INFO, ZC_POSITION_INFO
	 *	SKILLS:      3, //	Request packets ZC_GUILD_SKILLINFO
	 *  EXPEL:       4, //
	 *  NOTICE:      7, //
	 */
	Guild.onGuildInfoRequest = function(){};


	/**
	 * Ask server to modify positions
	 * @param {Array} positions
	 */
	Guild.onPositionUpdateRequest = function(){};

	/**
	 * Ask server to modify user's position
	 * @param {Array} memberInfo
	 */
	Guild.onChangeMemberPosRequest = function(){};

	/**
	 * Ask server to modify notice
	 * @param {string} notice subject
	 * @param {string} notice content
	 */
	Guild.onNoticeUpdateRequest = function(){};


	/**
	 * Ask server for member info
	 * @param {number} account id
	 */
	Guild.onRequestMemberInfo = function(){};


	/**
	 * Ask to leave a guild
	 * @param {number} account id
	 * @param {number} character id
	 * @param {string} reason
	 */
	Guild.onRequestLeave = function(){};


	/**
	 * Ask to expel a member from theguild
	 * @param {number} account id
	 * @param {number} character id
	 * @param {string} reason
	 */
	Guild.onRequestMemberExpel = function(){};


	/**
	 * Ask to remove a guild relation
	 * @param {number} guild_id
	 * @param {number} relation
	 */
	Guild.onRequestDeleteRelation = function(){}


	/**
	 * Request access to know what tab we can open
	 */
	Guild.onRequestAccess = function(){};


	/**
	 * Request guild emblem
	 * @param {number} guild id
	 * @param {number} emblem version
	 * @param {function} callback once loaded
	 */
	Guild.onRequestGuildEmblem = function(){};


	/**
	 * Send new guild emblem to the server
	 * @param {UInt8Array} emblem data
	 */
	Guild.onSendEmblem = function(){}


	/**
	 * Abstract function to define
	 */
	Guild.onUseSkill      = function onUseItem(){};
	Guild.onIncreaseSkill = function onIncreaseSkill() {};
	Guild.onUpdateSkill   = function onUpdateSkill(){};
	Guild.getSkillById    = getSkillById;

	/**
	 * Create componentand export it
	 */
	return UIManager.addComponent(Guild);

});
