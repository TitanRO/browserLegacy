/**
 * UI/Components/Rodex/Rodex.js
 *
 * Rodex Box
 *
 * @author Alisonrag
 *
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
	var ChatBox = require('UI/Components/ChatBox/ChatBox');
	var UIManager = require('UI/UIManager');
	var UIComponent = require('UI/UIComponent');

	var htmlText = require('text!./Rodex.html');
	var cssText = require('text!./Rodex.css');
	var DOM             = require('Utils/DOM');


	/**
	 * Create Component
	 */
	var Rodex = new UIComponent('Rodex', htmlText, cssText);

	/**
	 * Store Rodex items
	 */
	Rodex.list = [];
	/**
   * Determine data page size
   */
	Rodex.pageSize = 6;
	/**
	 * know which page is current
	 */
	Rodex.page = 0;

	/**
	 * know which tab is current
	 */
	Rodex.openType = 0;

	/**
	 * know which tab is current
	 */
	Rodex.currentTab = 0;

	/**
	 * know what to search
	 */
	Rodex.searchType = 1;

	Rodex.attachmentType = {
		0: '', // none
		2: 'basic_interface/rodexsystem/renewal/icon_zeny.bmp', // zeny
		4: 'basic_interface/rodexsystem/renewal/icon_item.bmp', // item
		6: 'basic_interface/rodexsystem/renewal/icon_zeny_n_item.bmp', // zeny + item
		12: 'basic_interface/rodexsystem/renewal/icon_zeny_n_item.bmp', // gift??
	}


	/**
	 * @var {Preferences} structure
	 */
	var _preferences = Preferences.get('Rodex', {
		x: 350,
		y: 350,
		show: false,
	}, 2.0);

	/**
	 * Apply preferences once append to body
	 */
	Rodex.onAppend = function OnAppend() {
		// Apply preferences
		DOM.setCss(this.ui, {
			top: Math.min(Math.max(0, _preferences.y), Renderer.height - this.ui.offsetHeight),
			left: Math.min(Math.max(0, _preferences.x), Renderer.width - this.ui.offsetWidth)
		});

		this.draggable(this.ui.querySelector('.titlebar'));

		this.ui.querySelector('.close').addEventListener('click', onClickClose);
		this.ui.querySelector('.refresh').addEventListener('click', onClickRefresh);
		this.ui.querySelector('.write').addEventListener('click', onClickWriteMail);
		this.ui.querySelector('.delete-all').addEventListener('click', onClickDeleteAll);
		this.ui.querySelector('.retrieve-all').addEventListener('click', onClickRetrieveAll);
		this.ui.querySelector('.previous-page').addEventListener('click', onClickPreviousPage);
		this.ui.querySelector('.next-page').addEventListener('click', onClickNexPage);
		this.ui.querySelector('.nav-item').addEventListener('click', onClickTab);
		this.ui.querySelector('.search-title').addEventListener('click', onClickSearchTitle);
		this.ui.querySelector('.search-sender').addEventListener('click', onClickSearchSender);
		this.ui.querySelector('.search').value = '';
		this.ui.querySelector('.search-btn').addEventListener('click', onClickSearchButton);

		Rodex.openType = 0;
		Rodex.ui.querySelectorAll('.nav-item.active').forEach(function(el) { el.classList.remove('active'); });
		Rodex.ui.querySelector('#tab_0').classList.add('active');
		Rodex.searchType = 1;
		Rodex.page = 0;
	};

	/**
	* Remove Rodex from window (and so clean up items)
	*/
	Rodex.onRemove = function OnRemove() {
		this.list.length = 0;
		// Save preferences
		_preferences.show = DOM.isVisible(this.ui);
		_preferences.y = parseInt(this.ui.style.top, 10);
		_preferences.x = parseInt(this.ui.style.left, 10);
		_preferences.save();

		Rodex.openType = 0;
	};


	/**
	* Extend Rodex window size
	*
	* @param {object} read
	*/
	Rodex.initData = function initData(pkt) {
		Rodex.list = pkt.MailList;
		Rodex.isEnd = pkt.isEnd;
		Rodex.openType = (typeof pkt.openType !== 'undefined') ? pkt.openType : 0;
		Rodex.createRodexList();
		Rodex.ui.style.display = '';
		Rodex.ui.focus();
	};

	Rodex.createRodexList = function createRodexList(tabID = 0, search = false, term = "") {
		var content = Rodex.ui.querySelector('.mail-list');
		content.innerHTML = '';
		let mail_list = [];
		if (search) {
			Rodex.page = 0;
			if (Rodex.searchType == 1) {
				mail_list = Rodex.getMailsByTitle(term);
			} else {
				mail_list = Rodex.getMailsBySender(term);

			}
		} else {
			mail_list = Rodex.getMailsByTabID(tabID);
		}
		if (mail_list.length == 0) return;
		let start = Rodex.pageSize * Rodex.page;

		let total = 0;
		for (let i = start; total < Rodex.pageSize && i < mail_list.length; i++) {
			let mail = mail_list[i];
			let mailID = mail.MailID;
			let title = mail.title.length > 18 ? mail.title.substring(0, 18) + "..." : mail.title;
			let sender = mail.SenderName.length > 18 ? mail.SenderName.substring(0, 18) + "..." : mail.SenderName;
			let mail_image = (mail.Isread) ? 'icon_status_mail_read' : 'icon_status_mail_received';
			let mail_content = Rodex.attachmentType[mail.type];
			let remaining_days = parseInt(mail.expireDateTime / 60 / 60 / 24);
			let openType = (typeof mail.openType !== 'undefined') ? mail.openType : 0;
			let mail_html =
				`
			<li class="mail-item">
				<div class="mail-checkbox" data-background="basic_interface/rodexsystem/renewal/checkbox_off.bmp">
				</div>
				<div class="mail-image" data-background="basic_interface/rodexsystem/renewal/` + mail_image + `.bmp">
				</div>
				<div class="mail-text">
					<div class="title" ><div id="mail_` + mailID + `" openType="` + openType + `" class="text event_add_cursor"><span data-text="2702"></span>` + title + `</div></div>
					<div class="sender"><div id="sender_` + mailID + `" sender="` + sender + `"class="text event_add_cursor"><span data-text="2701"></span>` + sender + `</div></div>
				</div>
				<div class="mail-content" data-background="`+ mail_content + `"></div>
				<div class="expire-days">` + remaining_days + ` days</div>
			</li>
			`;
			content.insertAdjacentHTML('beforeend', mail_html);
			var _mailEl = Rodex.ui.querySelector("#mail_" + mailID);
			if (_mailEl) _mailEl.addEventListener('click', onClickReadMail);
			var _senderEl = Rodex.ui.querySelector("#sender_" + mailID);
			if (_senderEl) _senderEl.addEventListener('click', onClickReplyMail);
			total++;
		}
		this.parseElementTree(content);
	}

	Rodex.getMailsByTabID = function getMailsByTabID(tabID) {
		return Rodex.list.filter(mail => mail.openType == tabID);
	}

	Rodex.getMailsBySender = function getMailsBySender(term) {
		return Rodex.list.filter(mail => mail.SenderName.indexOf(term) > -1);
	}

	Rodex.getMailsByTitle = function getMailsByTitle(term) {
		return Rodex.list.filter(mail => mail.title.indexOf(term) > -1);
	}

	Rodex.getMailByID = function getMailByID(mailID) {
		return Rodex.list.querySelector(mail => mail.MailID == mailID);
	}

	Rodex.getAll = function getAll() {
		for (let i = 0; i < Rodex.list.length; i++) {
			let mail = Rodex.list[i];
			if (mail.type > 0 && (mail.type == 4 || mail.type == 6)) {
				Rodex.requestItemsFromRodex(mail.openType, mail.MailID);
			}
			if (mail.type > 0 && (mail.type == 2 || mail.type == 6)) {
				Rodex.requestZenyFromRodex(mail.openType, mail.MailID);
			}
		}
	}

	Rodex.deleteAll = function deleteAll() {
		for (let i = 0; i < Rodex.list.length; i++) {
			let mail = Rodex.list[i];
			if (mail.type == 0) { // delete only empty mails
				Rodex.requestDeleteRodex(mail.openType, mail.MailID);
			} else {
				ChatBox.addText(DB.getMessage(2612), ChatBox.TYPE.INFO_MAIL, ChatBox.FILTER.PUBLIC_LOG);
			}
		}
	}

	Rodex.updateDeletedMailContent = function updateDeletedMailContent(openType, MailID) {
		var _mailDelEl = Rodex.ui.querySelector("#mail_" + MailID);
		if (_mailDelEl) { _mailDelEl.innerHTML = DB.getMessage(2907); _mailDelEl.classList.add('deleted'); }
		var _senderDelEl = Rodex.ui.querySelector("#sender_" + MailID);
		if (_senderDelEl) _senderDelEl.innerHTML = '';
	}

	/**
	 * Show/Hide UI
	 */
	Rodex.toggle = function toggle() {
		if (DOM.isVisible(this.ui)) {
			Rodex.closeRodexBox();
			Rodex.ui.style.display = 'none';
		} else {
			Rodex.openRodexBox();
			Rodex.append();
			Rodex.ui.style.display = '';
			Rodex.ui.focus();
		}
	};

	function onClickClose(e) {
		e.stopImmediatePropagation();
		Rodex.openType = 0;
		Rodex.closeRodexBox();
		// Save preferences
		_preferences.y = parseInt(Rodex.ui.style.top, 10) || 0;
		_preferences.x = parseInt(Rodex.ui.style.left, 10) || 0;
		_preferences.save();
		Rodex.ui.style.display = 'none';
	}

	function onClickRefresh(e) {
		e.stopImmediatePropagation();
		Rodex.requestRefreshRodexPage();
	}

	function onClickWriteMail(e) {
		e.stopImmediatePropagation();
		Rodex.requestOpenWriteRodex();
	}

	function onClickDeleteAll(e) {
		//0x9f5
		e.stopImmediatePropagation();
		UIManager.showPromptBox(DB.getMessage(3590), 'ok', 'cancel', function () {
			Rodex.deleteAll();
		});
	}

	function onClickRetrieveAll(e) {
		//0x9f3 and 09f1
		e.stopImmediatePropagation();
		UIManager.showPromptBox(DB.getMessage(3594), 'ok', 'cancel', function () {
			Rodex.getAll();
		});
	}

	function onClickPreviousPage(e) {
		e.stopImmediatePropagation();
		if (Rodex.page - 1 < 0) return;
		Rodex.page--;
		Rodex.createRodexList(Rodex.openType);
	}

	function onClickNexPage(e) {
		e.stopImmediatePropagation();
		if ((Rodex.page + 1) * Rodex.pageSize < Rodex.getMailsByTabID(Rodex.openType).length) {
			Rodex.page++;
			Rodex.createRodexList(Rodex.openType);
		}
	}

	function onClickTab(e) {
		e.stopImmediatePropagation();
		Rodex.page = 0;
		let element = e.currentTarget;
		let tid = element.getAttribute('id');
		let id = tid.replace("tab_", "");
		Rodex.ui.querySelectorAll('.nav-item.active').forEach(function(el) { el.classList.remove('active'); });
		element.classList.add('active');
		if (id >= 0 && id <= 2) {
			Rodex.openType = id;
			Rodex.createRodexList(Rodex.openType);
		} else {
			Rodex.ui.querySelector('.mail-list').innerHTML = ''; // search tab
		}
	}

	function onClickSearchTitle(e) {
		e.stopImmediatePropagation();
		Rodex.searchType = 1;
		Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/rodexsystem/renewal/checkbox_search_off.bmp', function (data) {
			Rodex.ui.querySelector('.search-sender').style.backgroundImage = 'url(' + data + ')';
		});
		Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/rodexsystem/renewal/checkbox_search_on.bmp', function (data) {
			Rodex.ui.querySelector('.search-title').style.backgroundImage = 'url(' + data + ')';
		});
	}

	function onClickSearchSender(e) {
		e.stopImmediatePropagation();
		Rodex.searchType = 2;

		Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/rodexsystem/renewal/checkbox_search_on.bmp', function (data) {
			Rodex.ui.querySelector('.search-sender').style.backgroundImage = 'url(' + data + ')';
		});
		Client.loadFile(DB.INTERFACE_PATH + 'basic_interface/rodexsystem/renewal/checkbox_search_off.bmp', function (data) {
			Rodex.ui.querySelector('.search-title').style.backgroundImage = 'url(' + data + ')';
		});
	}

	function onClickSearchButton(e) {
		e.stopImmediatePropagation();
		let search = Rodex.ui.querySelector('.search').value;
		Rodex.ui.querySelectorAll('.nav-item.active').forEach(function(el) { el.classList.remove('active'); });
		Rodex.ui.querySelector('#tab_3').classList.add('active');
		if (search.length > 2) {
			Rodex.createRodexList(0, true, search);
		}
	}

	function onClickReadMail(e) {
		e.stopImmediatePropagation();
		let element = e.currentTarget;
		let mid = element.getAttribute('id');
		let openType = element.getAttribute('openType');
		let id = mid.replace("mail_", "");
		Rodex.requestReadRodex(openType, id);
	}

	function onClickReplyMail(e) {
		e.stopImmediatePropagation();
		let element = e.currentTarget;
		let sender = element.getAttribute('sender');
		Rodex.requestOpenWriteRodex(sender);
	}

	/**
	 * Create component and export it
	 */
	return UIManager.addComponent(Rodex);
});

