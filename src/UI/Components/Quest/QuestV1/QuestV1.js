/**
 * UI/Components/Quest/Quest.js
 *
 * Manage interface for Quest List
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */
define(function (require) {
	'use strict';


	/**
	 * Dependencies
	 */
	var DB = require('DB/DBManager');
	var Preferences = require('Core/Preferences');
	var Client = require('Core/Client');
	var Renderer = require('Renderer/Renderer');
	var UIManager = require('UI/UIManager');
	var UIComponent = require('UI/UIComponent');
	var Network = require('Network/NetworkManager');
	var PACKET = require('Network/PacketStructure');
	var QuestHelper = require('./QuestHelperV1');
	var htmlText = require('text!./QuestV1.html');
	var cssText = require('text!./QuestV1.css');
	var ChatBox = require('UI/Components/ChatBox/ChatBox');
	var Session = require('Engine/SessionStorage');
	var DOM             = require('Utils/DOM');

	/**
	 * Create Component
	 */
	var QuestV1 = new UIComponent('QuestV1', htmlText, cssText);


	/**
	 * @var {number} index of selection
	 */
	var _index = -1;

	/**
	 * @var {Array} quest list
	 */
	var _questList = [];

	/**
	 * @var {Array} quest list
	 */
	var _questNotShowList = [];

	/**
	 * @var {string} _active_menu active click menu
	 */
	var _active_menu = 'active';

	/**
	 * @var {Preferences} structure
	 */
	var _preferences = Preferences.get('QuestV1', {
		x: 200,
		y: 200,
		show: false,
		showwindow: true
	}, 1.0);


	/**
	 * Initialize the component (event listener, etc.)
	 */
	QuestV1.init = function init() {
		QuestHelper.prepare();

		// Avoid drag drop problems
		var stopBlock = this.ui.querySelector('.btn-left');
		if (stopBlock) {
			stopBlock.addEventListener('mousedown', function (event) {
				event.stopImmediatePropagation();
				return false;
			});
		}

		var viewBtn = this.ui.querySelector('.footer .btn.view');
		if (viewBtn) {
			viewBtn.addEventListener('click', onClickView);
		}

		DOM.addDelegatedEvent(this.ui, 'click', '.btn-right, .footer .close', onClose);
		DOM.addDelegatedEvent(this.ui, 'click', '.quest-menu-item', onClickMenu);
		this.ui.querySelector('#active-quest-list').style.display = '';
		this.draggable(this.ui.querySelector('.titlebar'));
	};


	/**
	 * Once append to the DOM, start to position the UI
	 */
	QuestV1.onAppend = function onAppend() {
		_index = -1;

		DOM.setCss(this.ui, {
			top: Math.min(Math.max(0, _preferences.y), Renderer.height - this.ui.offsetHeight),
			left: Math.min(Math.max(0, _preferences.x), Renderer.width - this.ui.offsetWidth)
		});

		Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/tab_que_01.bmp', function (data) {
			QuestV1.ui.querySelector('.quest-menu').style.backgroundImage = 'url(' + data + ')';
		}.bind(this));

		QuestV1.ui.querySelector('#active-quest-list').style.display = '';
		QuestV1.ui.querySelector('#inactive-quest-list').style.display = 'none';
		QuestV1.ui.querySelector('#all-quest-list').style.display = 'none';

		if (!_preferences.show) {
			this.ui.style.display = 'none';
		}
	};


	/**
	 * Clean up UI
	 */
	QuestV1.clean = function clean() {
		_active_menu = '';
		_questList = {};
		QuestV1.ui.querySelector('#active-quest-list').style.display = 'none';
		QuestV1.ui.querySelector('#inactive-quest-list').style.display = 'none';
		QuestV1.ui.querySelector('#all-quest-list').style.display = 'none';
		QuestV1.ClearQuestList();
		QuestHelper.clearQuestDesc();
		onClose();
	};


	/**
	 * Removing the UI from window, save preferences
	 *
	 */
	QuestV1.onRemove = function onRemove() {
		// Save preferences
		_preferences.show = DOM.isVisible(this.ui);
		_preferences.y = parseInt(this.ui.style.top, 10);
		_preferences.x = parseInt(this.ui.style.left, 10);
		_preferences.save();
	};


	/**
	 * Window Shortcuts
	 */
	QuestV1.onShortCut = function onShurtCut(key) {
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
	 * Show/Hide UI
	 */
	QuestV1.toggle = function toggle() {
		if (DOM.isVisible(this.ui)) {
			this.ui.style.display = 'none';
		} else {
			this.ui.style.display = '';
		}
	};


	/**
	 * Set Quest list
	 *
	 * @param {Array} quests
	 */
	QuestV1.setQuestList = function setQuestList(quests) {
		_questList = quests;
		QuestV1.ClearQuestList();
		for (let questID in quests) {
			QuestV1.addQuestToUI(quests[questID]);
		}
	};


	/**
	 * Add new Quest
	 *
	 * @param {object} quest
	 * @param {number} questID
	 */
	QuestV1.addQuest = function addQuest(quest, questID) {
		_questList[questID] = quest;
		QuestV1.addQuestToUI(quest);
	};


	/**
	 * Update Quest from list
	 *
	 * @param {object} hunt_info
	 * @param {number} questID
	 * @param {number} huntID
	*/
	QuestV1.updateMissionHunt = function updateMissionHunt(hunt_info, questID, huntID) {
		if (hunt_info.huntIDCount) _questList[questID].hunt_list[huntID].huntIDCount = hunt_info.huntIDCount;
		if (hunt_info.maxCount) _questList[questID].hunt_list[huntID].maxCount = hunt_info.maxCount;
		if (hunt_info.huntCount) _questList[questID].hunt_list[huntID].huntCount = hunt_info.huntCount;
		if (hunt_info.mobGID) _questList[questID].hunt_list[huntID].mobGID = hunt_info.mobGID;

		let mob_name = _questList[questID].hunt_list[huntID].mobName;
		let quest_info = DB.getQuestInfo(questID);
		let chat_quest_text = `Mission [${quest_info.Title}], you killed [${mob_name}]. (${_questList[questID].hunt_list[huntID].huntCount}/${_questList[questID].hunt_list[huntID].maxCount})`;
		let self_msg;
		if (_questList[questID].hunt_list[huntID].maxCount == _questList[questID].hunt_list[huntID].huntCount) {
			self_msg = `${mob_name} [Completed]`;
		} else {
			self_msg = `${mob_name} [${_questList[questID].hunt_list[huntID].huntCount}/${_questList[questID].hunt_list[huntID].maxCount}]`;
		}

		ChatBox.addText(chat_quest_text, ChatBox.TYPE.ADMIN | ChatBox.TYPE.SELF, ChatBox.FILTER.QUEST);
		if (Session.Entity) {
			Session.Entity.dialog.set(self_msg, "yellow");
		}
	};


	/**
	 * Remove Quest from list
	 *
	 * @param {number} questID
	*/
	QuestV1.removeQuest = function removeQuest(questID) {
		delete _questList[questID];
		refreshQuestUI();
	};


	/**
	 * Toggle Quest Active/Inactive
	 *
	 * @param {number} questID
	 * @param {boolean} active
	 */
	QuestV1.toggleQuestActive = function toggleQuestActive(questID, active) {
		_questList[questID].active = active;
		refreshQuestUI();
	};


	/**
	 * return questID based on huntID/mobGID
	 *
	 * @param {number} ID
	*/
	QuestV1.getQuestIDByServerID = function getQuestIDByServerID(ID) {
		for (var key in _questList) {
			if (typeof _questList[key].hunt_list[ID] !== "undefined") {
				return key;
			}
		}
		return -1;
	};


	/**
	 * Check if quest exists
	 *
	 * @param {number} questID
	*/
	QuestV1.questExists = function questExists(questID) {
		return (typeof _questList[questID] !== "undefined") ? true : false;
	};


	QuestV1.addQuestToUI = function addQuest(quest) {
		let toggle_id = "qid" + quest.questID;
		let title = (quest.title.length > 30) ? quest.title.substr(0, 30) + '...' : quest.title;
		let pattern = /^ico\_/; // new system ico_xx.bmp - not supported on this version
		let quest_icon = (pattern.test(quest.icon)) ? 'SG_FEEL.bmp' : quest.icon;
		let li_text = '<li id="' + toggle_id + '" class="quest-item ' + toggle_id + '"><div class="quest-item-icon"> <div class="quest-item-icon-image" data-background="item/' + quest_icon + '"></div> </div> <div class="quest-item-title"> <span class="quest-item-title-text">' + title + '</span> </div></li>';

		let ul_id = (quest.active == 1) ? "#active-quest-list" : "#inactive-quest-list";

		var _tmp = document.createElement('div');
		_tmp.innerHTML = li_text;
		var liEl = _tmp.firstChild;
		if (!liEl) {
			return;
		}

		var listEl = this.ui.querySelector(ul_id);
		if (listEl) {
			listEl.appendChild(liEl);
		}
		liEl.addEventListener('contextmenu', onClickQuestToggle);
		liEl.addEventListener('click', onClickQuest);

		var allListEl = this.ui.querySelector('#all-quest-list');
		if (allListEl) {
			var liClone = liEl.cloneNode(true);
			liClone.addEventListener('click', onClickQuest);
			allListEl.appendChild(liClone);
			this.parseElementTree(liClone);
		}

		this.parseElementTree(liEl);
	};


	function onClickMenu(e) {
		var quest_element = e.currentTarget;

		if (_active_menu == quest_element.getAttribute('id')) return;
		_active_menu = quest_element.getAttribute('id');

		var background_image = "";
		QuestV1.ui.querySelector('#active-quest-list').style.display = 'none';
		QuestV1.ui.querySelector('#inactive-quest-list').style.display = 'none';
		QuestV1.ui.querySelector('#all-quest-list').style.display = 'none';
		switch (_active_menu) {
			case 'inactive':
				background_image = "tab_que_02";
				QuestV1.ui.querySelector('#inactive-quest-list').style.display = '';
				break;
			case 'all':
				background_image = "tab_que_03";
				QuestV1.ui.querySelector('#all-quest-list').style.display = '';
				break;
			default:
				background_image = "tab_que_01";
				QuestV1.ui.querySelector('#active-quest-list').style.display = '';
		}

		Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/' + background_image + '.bmp', function (data) {
			QuestV1.ui.querySelector('.quest-menu').style.backgroundImage = 'url(' + data + ')';
		}.bind(this));

		QuestHelper.clearQuestDesc();
	}

	function onClickQuest(e) {
		var toggle_element = e.currentTarget;
		let tid = toggle_element.getAttribute('id');
		let id = tid.replace("qid", "");
		if (_index > -1) {
			var _oldEl = QuestV1.ui.querySelector('.qid' + _index);
			if (_oldEl) { _oldEl.style.backgroundColor = 'white'; }
			var _oldEl2 = QuestV1.ui.querySelector('#qid' + _index);
			if (_oldEl2) { _oldEl2.style.backgroundColor = 'white'; }
		}
		_index = id;
		toggle_element.style.backgroundColor = 'lightgray';
	}

	function onClickQuestToggle(e) {
		var toggle_element = e.currentTarget;
		let tid = toggle_element.getAttribute('id');
		let id = tid.replace("qid", "");
		var _pkt = new PACKET.CZ.ACTIVE_QUEST();
		_pkt.questID = _questList[id].questID;
		_pkt.active = (_questList[id].active == 1) ? 0 : 1;
		Network.sendPacket(_pkt);
	}

	function onClickView(e) {
		if (_index > -1) {
			QuestHelper.clearQuestDesc();
			QuestHelper.setQuestInfo(_questList[_index]);
			QuestHelper.prepare();
			QuestHelper.append();
			QuestHelper.ui.style.display = '';
			QuestHelper.ui.focus();
		}
	}

	function refreshQuestUI() {
		QuestV1.ClearQuestList();
		QuestV1.setQuestList(_questList);
	}

	QuestV1.ClearQuestList = function ClearQuestList() {
		QuestV1.ui.querySelectorAll('.quest-list').forEach(function (el) {
			el.innerHTML = '';
		});
	}


	/**
	 * Close the window
	 */
	function onClose() {
		QuestV1.ui.style.display = 'none';
	}

	/**
	 * Export
	 */
	return UIManager.addComponent(QuestV1);
});