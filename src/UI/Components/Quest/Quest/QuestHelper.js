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
	var htmlText = require('text!./QuestHelper.html');
	var cssText = require('text!./QuestHelper.css');
	var DOM             = require('Utils/DOM');

	/**
	 * Create Component
	 */
	var QuestHelper = new UIComponent('QuestHelper', htmlText, cssText);


	/**
	 * @var {Preferences} structure
	 */
	var _preferences = Preferences.get('Quest', {
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
	QuestHelper.init = function init() {
		// Avoid drag drop problems
		DOM.addDelegatedEvent(this.ui, 'click', '.quest-info-bottom-btn', onClickClose);
		var stopBlock = this.ui.querySelector('.quest-info-mid-panel');
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
	QuestHelper.onAppend = function onAppend() {
		DOM.setCss(this.ui, {
			top: Math.min(Math.max(0, _preferences.y), Renderer.height - this.ui.offsetHeight),
			left: Math.min(Math.max(0, _preferences.x + 382), Renderer.width - this.ui.offsetWidth)
		});
	};

	QuestHelper.setQuestInfo = function setQuestInfo(quest) {
		QuestHelper.ui.querySelector('.quest-info-title-panel-text').innerHTML = processText(quest.title);
		QuestHelper.ui.querySelector('.quest-info-description-panel-text .quest-ui-text-span').innerHTML = processText(quest.description);
		let list = ""
		for (let huntID in quest.hunt_list) {
			list += '<li>' + processText(quest.hunt_list[huntID].mobName) + ' ( ' + quest.hunt_list[huntID].huntCount + ' / ' + quest.hunt_list[huntID].maxCount + ' )</li>';
		}
		QuestHelper.ui.querySelector('.quest-info-monster-panel-text .quest-ui-text-span').innerHTML = '<ul class="quest-ui-monster-list">' + list + '<ul>';
		if (quest.reward_exp_base > 0)
			QuestHelper.ui.querySelector('.quest-info-reward-li-base').innerHTML = quest.reward_exp_base;
		if (quest.reward_exp_job > 0)
			QuestHelper.ui.querySelector('.quest-info-reward-li-job').innerHTML = quest.reward_exp_job;

		for (let i = 0; i < quest.reward_item_list.length; i++) {
			let it = DB.getItemInfo(quest.reward_item_list[i].ItemID);
			let item_li = '<li class="quest-reward-item-li"><div class="quest-reward-item" data-index="' + quest.reward_item_list[i].ItemID + '">' + '<div class="quest-icon"></div></div><div class="quest-reward-item-info"><span class="quest-reward-item-name">' + processText(it.identifiedDisplayName) + '</span><br><span>' + quest.reward_item_list[i].ItemNum + '</span></div></li>';
			QuestHelper.ui.querySelector('.quest-info-reward-li-item-list').insertAdjacentHTML('beforeend', item_li);
			Client.loadFile(DB.INTERFACE_PATH + 'renew_questui/img_questiocn.bmp', function (data) {
				QuestHelper.ui.querySelector('.quest-reward-item[data-index="' + quest.reward_item_list[i].ItemID + '"]').style.backgroundImage = 'url(' + data + ')';
			});
			Client.loadFile(DB.INTERFACE_PATH + 'item/' + it.identifiedResourceName + '.bmp', function (data) {
				QuestHelper.ui.querySelector('.quest-reward-item[data-index="' + quest.reward_item_list[i].ItemID + '"] .quest-icon').style.backgroundImage = 'url(' + data + ')';
			});
		}

		// TODO: quest.npc_spr

		if (quest.end_time) {
			var d = new Date(0);
			d.setUTCSeconds(quest.end_time);
			QuestHelper.ui.querySelector('.quest-info-bottom-deadline-info-text').innerHTML = 'Deadline [' + d.toLocaleString( + ']');
		}

	};

	QuestHelper.clearQuestDesc = function clearQuestDesc() {
		QuestHelper.ui.querySelector('.quest-info-title-panel-text').innerHTML = "";
		QuestHelper.ui.querySelector('.quest-info-description-panel-text .quest-ui-text-span').innerHTML = "";
		QuestHelper.ui.querySelector('.quest-info-monster-panel-text .quest-ui-text-span').innerHTML = '<ul class="quest-ui-monster-list"><ul>';
		QuestHelper.ui.querySelector('.quest-info-reward-li-base').innerHTML = "";
		QuestHelper.ui.querySelector('.quest-info-reward-li-job').innerHTML = "";
		QuestHelper.ui.querySelector('.quest-info-bottom-deadline-info-text').innerHTML = "";
		QuestHelper.ui.querySelector('.quest-info-reward-li-item-list').innerHTML = "";
	}

	/**
	 * Clean up UI
	 */
	QuestHelper.clean = function clean() {
		QuestHelper.ui.style.display = 'none';
		onClose();
	};


	/**
	 * Removing the UI from window, save preferences
	 *
	 */
	QuestHelper.onRemove = function onRemove() {
	};


	/**
	 * Show/Hide UI
	 */
	QuestHelper.toggle = function toggle() {
		if (DOM.isVisible(this.ui)) {
			this.ui.style.display = 'none';
		} else {
			this.ui.style.display = '';
		}
	};


	function onClickClose(e) {
		QuestHelper.ui.style.display = 'none';
	}

	/**
	 * Close the window
	 */
	function onClose() {
		QuestHelper.ui.style.display = 'none';
	}


	/**
	 * Export
	 */
	return UIManager.addComponent(QuestHelper);
});
