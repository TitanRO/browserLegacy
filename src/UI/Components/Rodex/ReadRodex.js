/**
 * UI/Components/Rodex/ReadRodex.js
 *
 * Chararacter ReadRodex
 *
 * @author Alisonrag
 *
 */
 define(function(require)
 {
	 'use strict';
 
 
	 /**
	  * Dependencies
	  */
	 var DB                 = require('DB/DBManager');
	 var Preferences        = require('Core/Preferences');
	 var Renderer           = require('Renderer/Renderer');
	 var Client             = require('Core/Client');
	 var UIManager          = require('UI/UIManager');
	 var UIComponent        = require('UI/UIComponent');
	 var htmlText           = require('text!./ReadRodex.html');
	 var cssText            = require('text!./ReadRodex.css');
	 var Rodex              = require('UI/Components/Rodex/Rodex');
	 var getModule    		= require;
	 var DOM                = require('Utils/DOM');
  
	 /**
	  * Create Component
	  */
	 var ReadRodex = new UIComponent( 'ReadRodex', htmlText, cssText );

	 ReadRodex.MailID = 0;
	 ReadRodex.openType = 0;
 
	 /**
	  * @var {Preferences} structure
	  */
	 var _preferences = Preferences.get('ReadRodex', {
		 show:     false,
	 }, 1.0);

	/**
	 * Initialize Component
	 */
	ReadRodex.onAppend = function onAppend()
	{
		// Bind buttons
		ReadRodex.ui.querySelector('.right .close').addEventListener('click', onClickClose);

		DOM.setCss(ReadRodex.ui, {
			top:  Math.min( Math.max( 0, parseInt(getModule('UI/Components/Rodex/Rodex').ui.style.top, 10) || 0), Renderer.height - ReadRodex.ui.offsetHeight),
			left: Math.min( Math.max( 0, parseInt(getModule('UI/Components/Rodex/Rodex').ui.style.left, 10) || 0) + 310, Renderer.width  - ReadRodex.ui.offsetWidth)
		});

		ReadRodex.draggable(ReadRodex.ui.querySelector('.titlebar'));
	};

	/**
	  * Remove Mail from window (and so clean up items)
	  */
	ReadRodex.onRemove = function OnRemove()
	{
		 _preferences.show   =  DOM.isVisible(this.ui);
		 _preferences.save();
	}


	ReadRodex.initData = function initData( data, mail )
	{
		ReadRodex.MailID = mail.MailID;
		ReadRodex.openType = mail.openType;
		ReadRodex.SenderName = mail.SenderName;
		ReadRodex.ui.querySelector('.name').innerHTML = mail.SenderName;
		ReadRodex.ui.querySelector('.title-text').innerHTML = mail.title;
		ReadRodex.ui.querySelector('.content-text').innerHTML = data.Textcontent;
		ReadRodex.ui.querySelector('.value').innerHTML = prettifyZeny(data.zeny);
		this.ui.querySelector('.get-content').addEventListener('click', onClickGetItems);
		this.ui.querySelector('.get-zeny').addEventListener('click', onClickGetZeny);
		this.ui.querySelector('.delete').addEventListener('click', onClickDelete);
		this.ui.querySelector('.reply').addEventListener('click', onClickReply);
		let content = ReadRodex.ui.querySelector('.item-list');
		content.innerHTML = '';
		for(let i = 0; i < data.ItemList.length; i++) {
			let item = data.ItemList[i];
			let it      = DB.getItemInfo( item.ITID );
			(function(idx){
				content.insertAdjacentHTML('beforeend',
					'<div class="item" data-index="'+ idx +'">' +
						'<div class="icon"></div>' +
						'<div class="amount"><span class="count">' + (item.count || 1) + '</span></div>' +
					'</div>'
				);
				Client.loadFile( DB.INTERFACE_PATH + 'item/' + it.identifiedResourceName + '.bmp', function(data){
					var iconEl = content.querySelector('.item[data-index="'+ idx +'"] .icon');
					if (iconEl) iconEl.style.backgroundImage = 'url('+ data +')';
				});
			})(i);
		}
		if(data.ItemList.length > 0) {
			this.ui.querySelector('.get-content').style.display = '';
		} else {
			this.ui.querySelector('.get-content').style.display = 'none';
		}
		if(data.zeny > 0) {
			this.ui.querySelector('.get-zeny').style.display = '';
		} else {
			this.ui.querySelector('.get-zeny').style.display = 'none';
		}
		ReadRodex.ui.style.display = '';
		ReadRodex.ui.focus();

	}

	function onClickClose(e) {
		e.stopImmediatePropagation();
		ReadRodex.MailID = 0;
		ReadRodex.openType = 0;
		ReadRodex.SenderName = ""
		ReadRodex.ui.style.display = 'none';
	}

	function onClickGetItems(e) {
		e.stopImmediatePropagation();
		Rodex.requestItemsFromRodex(ReadRodex.openType, ReadRodex.MailID);
	}

	function onClickGetZeny(e) {
		e.stopImmediatePropagation();
		Rodex.requestZenyFromRodex(ReadRodex.openType, ReadRodex.MailID);
	}

	

	function onClickDelete(e) {
		e.stopImmediatePropagation();
		UIManager.showPromptBox(DB.getMessage(356), 'ok', 'cancel', function () {
			Rodex.requestDeleteRodex(ReadRodex.openType, ReadRodex.MailID);
		});
	}

	function onClickReply(e) {
		e.stopImmediatePropagation();
		Rodex.requestOpenWriteRodex(ReadRodex.SenderName);
	}

	ReadRodex.clearItemList = function clearItemList() {
		ReadRodex.ui.querySelector('.item-list').innerHTML = '';

	}

	ReadRodex.clearZeny = function clearZeny() {
		ReadRodex.ui.querySelector('.value').innerHTML = '';
	}

	ReadRodex.close = function close() {
		ReadRodex.MailID = 0;
		ReadRodex.openType = 0;
		ReadRodex.SenderName = ""
		ReadRodex.ui.style.display = 'none';
	}

	 /**
	 * Prettify number (15000 -> 15,000)
	 *
	 * @param {number}
	 * @return {string}
	 */
	function prettifyZeny( value )
	{
		var num = String(value);
		var i = 0, len = num.length;
		var out = '';

		while (i < len) {
			out = num[len-i-1] + out;
			if ((i+1) % 3 === 0 && i+1 !== len) {
				out = ',' + out;
			}
			++i;
		}

		return out;
	}

	 /**
	 * Callbacks
	 */

	 /**
	  * Create component and export it
	  */
	 return UIManager.addComponent(ReadRodex);
});
