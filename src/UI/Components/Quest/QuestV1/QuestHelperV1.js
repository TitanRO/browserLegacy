/**
 * UI/Components/Quest/QuestHelper.js
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
	var Client = require('Core/Client');
	var Preferences = require('Core/Preferences');
	var Renderer = require('Renderer/Renderer');
	var UIManager = require('UI/UIManager');
	var UIComponent = require('UI/UIComponent');
	var ItemInfo = require('UI/Components/ItemInfo/ItemInfo');
	var Navigation = require('UI/Components/Navigation/Navigation');
	var htmlText = require('text!./QuestHelperV1.html');
	var cssText = require('text!./QuestHelperV1.css');
	var DOM             = require('Utils/DOM');

	/**
	 * Create Component
	 */
	var QuestHelperV1 = new UIComponent('QuestHelperV1', htmlText, cssText);


	/**
	 * @var {Preferences} structure
	 */
	var _preferences = Preferences.get('QuestHelperV1', {
		x: 200,
		y: 200,
		show: false,
	}, 1.0);


	/**
	 * Process text with color codes (^RRGGBB)
	 * @param {string} text - The text to process
	 * @returns {string} HTML with color spans
	 */
	function processColorCodes(text) {
		if (!text) return '';
		// Convert to string to handle non-string inputs
		text = String(text);
		return text.replace(/\^([0-9A-Fa-f]{6})/g, function(match, color) {
			return '<span style="color:#' + color + '">';
		}).replace(/\^000000/g, '</span>');
	}

	/**
	 * Process item tags in text (<ITEM>Name<INFO>ID</INFO></ITEM>)
	 * @param {string} text - The text to process
	 * @returns {string} HTML with processed item tags
	 */
	function processItemTags(text) {
		if (!text) return '';
		text = String(text);
		return text.replace(/<ITEM>([^<]+)<INFO>(\d+)<\/INFO><\/ITEM>/g, function(match, itemName, itemId) {
			return '<span class="item-link" data-item-id="' + itemId + '">' + itemName + '</span>';
		});
	}

	/**
	 * Process NAVI tags in text (<NAVI>Display Name<INFO>mapname,x,y,0,000,flag</INFO></NAVI>)
	 * @param {string} text - The text to process
	 * @returns {string} HTML with processed NAVI tags
	 */
	function processNAVITags(text) {
		if (!text) return '';
		text = String(text);
		return text.replace(/<NAVI>([^<]+)<INFO>([^<]+)<\/INFO><\/NAVI>/g, function(match, displayName, naviInfo) {
			return '<span class="navi-link" data-navi-info="' + naviInfo + '" data-navi-name="' + displayName + '">' + displayName + '</span>';
		});
	}

	/**
	 * Process all text formatting (color codes and item tags)
	 * @param {string} text - The text to process
	 * @returns {string} Fully processed HTML
	 */
	function processText(text) {
		if (!text) return '';
		text = processItemTags(text);
		text = processNAVITags(text);
		text = processColorCodes(text);
		return text;
	}

	/**
	 * Initialize the component (event listener, etc.)
	 */
	QuestHelperV1.init = function init() {
		// Avoid drag drop problems
		DOM.addDelegatedEvent(this.ui, 'click', '.quest-info-close-btn', onClickClose);
		var stopBlock = this.ui.querySelector('.content');
		if (stopBlock) {
			stopBlock.addEventListener('mousedown', function (event) {
				event.stopImmediatePropagation();
				return false;
			});
		}

		// Add click handler for item links
		DOM.addDelegatedEvent(this.ui, 'click', '.item-link', function(event) {
			var itemId = parseInt(this.getAttribute('data-item-id'), 10);
			if (!itemId) {
				return;
			}

			// Don't add the same UI twice, remove it
			if (ItemInfo.uid === itemId) {
				ItemInfo.remove();
				return;
			}

			// Add ui to window
			ItemInfo.append();
			ItemInfo.uid = itemId;
			ItemInfo.setItem({ ITID: itemId, IsIdentified: true });
		});

		// Add click handler for navi links
		DOM.addDelegatedEvent(this.ui, 'click', '.navi-link', function(event) {
			var naviInfo = this.getAttribute('data-navi-info');
			var displayName = this.getAttribute('data-navi-name');

			if (!naviInfo) {
				return;
			}

			// If the Navigation window is already showing this location, toggle it off
			if (Navigation.uid === naviInfo && DOM.isVisible(Navigation.ui)) {
				Navigation.hide();
				return;
			}

			// Show the Navigation window and set the info
			Navigation.uid = naviInfo;
			Navigation.setNaviInfo(naviInfo, displayName);
			Navigation.show();
		});

		this.draggable(this.ui.querySelector('.titlebar'));
	};


	/**
	 * Once append to the DOM, start to position the UI
	 */
	QuestHelperV1.onAppend = function onAppend() {
		DOM.setCss(this.ui, {
			top: Math.min(Math.max(0, _preferences.y), Renderer.height - this.ui.offsetHeight),
			left: Math.min(Math.max(0, _preferences.x + 382), Renderer.width - this.ui.offsetWidth)
		});
	};

	QuestHelperV1.setQuestInfo = function setQuestInfo(quest) {
		QuestHelperV1.ui.querySelector('.title').innerHTML = processText(quest.title);
		QuestHelperV1.ui.querySelector('.summary').innerHTML = processText(quest.summary);
		QuestHelperV1.ui.querySelector('.objective').innerHTML = processText(quest.description);
		let list = '<select class="monster-select">'
		let first = true;
		for (let huntID in quest.hunt_list) {
			if(first) {
				QuestHelperV1.ui.querySelector('.killed').innerHTML = quest.hunt_list[huntID].huntCount;
				QuestHelperV1.ui.querySelector('.limited').innerHTML = quest.hunt_list[huntID].maxCount;
				first = false;
			}
			list += '<option current="' + quest.hunt_list[huntID].huntCount + '" max="' + quest.hunt_list[huntID].maxCount + '">' + processText(quest.hunt_list[huntID].mobName) + '</option>';
		}
		list += '</select>'
		QuestHelperV1.ui.querySelector('.monster').innerHTML = list;
		var monsterSelect = this.ui.querySelector('.monster-select');
		if (monsterSelect) {
			monsterSelect.addEventListener('change', onSelectMonster);
		}
	};

	QuestHelperV1.clearQuestDesc = function clearQuestDesc() {
		QuestHelperV1.ui.querySelector('.title').innerHTML = "";
		QuestHelperV1.ui.querySelector('.summary').innerHTML = "";
		QuestHelperV1.ui.querySelector('.objective').innerHTML = "";
		QuestHelperV1.ui.querySelector('.monster').innerHTML = "";
		QuestHelperV1.ui.querySelector('.killed').innerHTML = "";
		QuestHelperV1.ui.querySelector('.limited').innerHTML = "";
	}

	/**
	 * Clean up UI
	 */
	QuestHelperV1.clean = function clean() {
		QuestHelperV1.ui.style.display = 'none';
		onClose();
	};


	/**
	 * Removing the UI from window, save preferences
	 *
	 */
	QuestHelperV1.onRemove = function onRemove() {
	};


	/**
	 * Show/Hide UI
	 */
	QuestHelperV1.toggle = function toggle() {
		if (DOM.isVisible(this.ui)) {
			this.ui.style.display = 'none';
		} else {
			this.ui.style.display = '';
		}
	};


	function onClickClose(e) {
		QuestHelperV1.ui.style.display = 'none';
	}

	/**
	 * Close the window
	 */
	function onClose() {
		QuestHelperV1.ui.style.display = 'none';
	}

	function onSelectMonster(e) {
		var selected_monster = e.currentTarget;
		QuestHelperV1.ui.querySelector('.killed').innerHTML = selected_monster.getAttribute('current');
		QuestHelperV1.ui.querySelector('.limited').innerHTML = selected_monster.getAttribute('max');
	}


	/**
	 * Export
	 */
	return UIManager.addComponent(QuestHelperV1);
});
