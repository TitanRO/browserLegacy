/**
 * UI/Components/Mail/ReadMail.js
 *
 * Chararacter ReadMail
 *
 * @author Francisco Wallison
 *
 */
 define(function(require)
 {
	 'use strict';
 
 
	 /**
	  * Dependencies
	  */
	 var DOM                = require('Utils/DOM');
	 var DB                 = require('DB/DBManager');
	 var Preferences        = require('Core/Preferences');
	 var Client             = require('Core/Client');
	 var Session      		= require('Engine/SessionStorage');
	 var Renderer           = require('Renderer/Renderer');
	 var Mouse              = require('Controls/MouseEventHandler');
	 var InputBox           = require('UI/Components/InputBox/InputBox');
	 var ChatBox            = require('UI/Components/ChatBox/ChatBox');
	 var ItemInfo           = require('UI/Components/ItemInfo/ItemInfo');
	 var UIManager          = require('UI/UIManager');
	 var UIComponent        = require('UI/UIComponent');
	 var htmlText           = require('text!./ReadMail.html');
	 var cssText            = require('text!./ReadMail.css');
	 var getModule    		= require;
 
 
	 /**
	  * Create Component
	  */
	 var ReadMail = new UIComponent( 'ReadMail', htmlText, cssText );
 
	 /**
	  * Store ReadMail items
	  */
	 ReadMail.list = [];
 
 
	 /**
	  * @var {number} used to remember the window height
	  */
	 var _realSize = 0;
 
 
	 /**
	  * @var {Preferences} structure
	  */
	 var _preferences = Preferences.get('ReadMail', {
		 x:        0,
		 y:        172,
		 width:    7,
		 height:   4,
		 show:     false,
		 reduce:   false,
		 magnet_top: false,
		 magnet_bottom: false,
		 magnet_left: true,
		 magnet_right: false,
		 item_add_email: {}
	 }, 1.0);

	/**
	 * Initialize Component
	 */
	ReadMail.onAppend = function onAppend()
	{
		// Bind buttons
		ReadMail.ui.querySelector('.right .close').addEventListener('click', function(event){
			event.stopImmediatePropagation();
			ReadMail.remove();
		});
		ReadMail.ui.querySelector('#read_mail_del').addEventListener('click', deleteMail);
		ReadMail.ui.querySelector('#read_mail_remail').addEventListener('click', replyMail);
		ReadMail.ui.querySelector('#read_mail_return').addEventListener('click', returnMail);
		
		var mailUi = getModule('UI/Components/Mail/Mail').ui;
		DOM.setCss(ReadMail.ui, {
			top: Math.min(Math.max(0, parseInt(mailUi.style.top, 10)), Renderer.height - ReadMail.ui.offsetHeight),
			left: Math.min(Math.max(0, parseInt(mailUi.style.left, 10) + 300), Renderer.width - ReadMail.ui.offsetWidth)
		});

		ReadMail.draggable(ReadMail.ui.querySelector('.titlebar'));
	};

	/**
	  * Remove Mail from window (and so clean up items)
	  */
	ReadMail.onRemove = function OnRemove()
	{
		 this.list.length = 0;
		 // Save preferences
		 _preferences.show   =  DOM.isVisible(this.ui);
		 _preferences.reduce = !!_realSize;
		 _preferences.y      =  parseInt(this.ui.style.top, 10);
		 _preferences.x      =  parseInt(this.ui.style.left, 10);
		 _preferences.width  =  Math.floor( (this.ui.offsetWidth  - (23 + 16 + 16 - 30)) / 32 );
		 _preferences.height =  Math.floor( (this.ui.offsetHeight - (31 + 19 - 30     )) / 32 );
		 _preferences.magnet_top = this.magnet.TOP;
		 _preferences.magnet_bottom = this.magnet.BOTTOM;
		 _preferences.magnet_left = this.magnet.LEFT;
		 _preferences.magnet_right = this.magnet.RIGHT;
		 _preferences.save();
	}; 

	ReadMail.openEmail = function openEmail(inforMail)
	{
		ReadMail.remove();
		ReadMail.append();
		let textSender = inforMail.FromName;
		let textTitle =  inforMail.Header;
		let textMessage = inforMail.msg === "(no message)" ? "" : inforMail.msg;
		
		this.ui.querySelector('.text_sender').textContent = textSender;
		this.ui.querySelector('.text_title').textContent = textTitle;
		this.ui.querySelector('.textarea_mail').value = textMessage;
		this.ui.querySelector('.btn_return_reply_remove').dataset.mailId = inforMail.MailID;

		if(inforMail.ITID != 0 || inforMail.Money != 0) {
			addItemSub(inforMail);
		}else{
			this.resetItemZeny();
		}
	}

	ReadMail.resetItemZeny = function resetItemZeny()
	{
		_preferences.item_add_email = {};			
		_preferences.save();			
		removeValueItemZeny();
		ReadMail.ui.querySelector(".zeny_item_infor_box" ).remove();
	}

	function addItemSub(itemMail)
	{
		removeValueItemZeny();
		var zenyItemContainer = ReadMail.ui.querySelector('.zeny_item_container');
		if(itemMail.ITID != 0 && itemMail.count > 0){
			let item = itemMail;
			var it      = DB.getItemInfo( item.ITID );
			var content = ReadMail.ui.querySelector('.container_item');			
			content.insertAdjacentHTML('beforeend',
				'<div class="item" data-index="'+ item.index +'" draggable="true">' +
					'<div class="icon"></div>' +				
					'<div class="amount"><span class="count">' + (item.count || 1) + '</span></div>' +
				'</div>'
			);
			ReadMail.ui.querySelector('.hide').style.display = '';
			Client.loadFile( DB.INTERFACE_PATH + 'item/' + ( item.IsIdentified ? it.identifiedResourceName : it.unidentifiedResourceName ) + '.bmp', function(data){
				content.querySelector('.item[data-index="'+ item.index +'"] .icon').style.backgroundImage = 'url('+ data +')';
			});

			var _readMailContainer = ReadMail.ui.querySelector('.container_item');
			// item
			DOM.addDelegatedEvent(_readMailContainer, 'mouseover', '.item', onItemOver);
			DOM.addDelegatedEvent(_readMailContainer, 'mouseout', '.item', onItemOut);
			DOM.addDelegatedEvent(_readMailContainer, 'contextmenu', '.item', onItemInfo);
		}

		if(itemMail.Money > 0){			
			ReadMail.ui.querySelector('.input_zeny_amt').value = prettifyZeny(itemMail.Money);
			ReadMail.ui.querySelector('.input_zeny_amt').disabled = true;
		}
		

		ReadMail.ui.querySelector(".zeny_item_infor_box" ).remove();
		zenyItemContainer.insertAdjacentHTML('beforeend',
			'<div class="zeny_item_infor_box"></div>'
		);
		var _zenyInfo = ReadMail.ui.querySelector('.zeny_item_infor');
		_zenyInfo.addEventListener('mouseover', function(){
			ReadMail.ui.querySelector('.zeny_item_infor_box').style.display = '';
		});
		_zenyInfo.addEventListener('mouseout', function(){
			ReadMail.ui.querySelector('.zeny_item_infor_box').style.display = 'none';
		});

		_preferences.item_add_email = itemMail;
		_preferences.save();


		ReadMail.ui.querySelector(".zeny_item_infor").addEventListener('click', function(event){
			event.stopImmediatePropagation();
			if(!validItemMoneyExists()){
				let mailID = ReadMail.ui.querySelector('.btn_return_reply_remove').getAttribute('data-mail-i-d');
				getModule('UI/Components/Mail/Mail').parseMailgetattach(mailID);
			}			
		});

	}

	/**
	 * Hide the item name
	 */
	function onItemOut(event)
	{
		event.stopImmediatePropagation();
		ReadMail.ui.querySelector('.container_item .overlay').style.display = 'none';
	}

	/**
	 * Show item name when mouse is over
	 */
	function onItemOver(event)
	{
		event.stopImmediatePropagation();
		var item = _preferences.item_add_email;

		if (!item) {
			return;
		}

		// Get back data
		var overlay = ReadMail.ui.querySelector('.container_item .overlay');

		// Display box
		overlay.style.display = '';
		overlay.textContent = DB.getItemName(item) + ' ' + (item.count || 1) + ' ea';

		if (item.IsIdentified) {
			overlay.classList.remove('grey');
		}
		else {
			overlay.classList.add('grey');
		}
	}

	/**
	 * Get item info (open description window)
	 */
	function onItemInfo( event )
	{
		event.stopImmediatePropagation();

		var item = _preferences.item_add_email;
		if (!item) {
			return false;
		}

		// Don't add the same UI twice, remove it
		if (ItemInfo.uid === item.ITID) {
			ItemInfo.remove();
			return false;
		}

		// Add ui to window
		ItemInfo.append();
		ItemInfo.uid = item.ITID;
		ItemInfo.setItem(item);

		return false;
	}

	function replyMail(event)
	{
		event.stopImmediatePropagation();
		let textSender = ReadMail.ui.querySelector('.text_sender').textContent;
		getModule('UI/Components/Mail/Mail').replyNewMail(textSender);
	}

	function deleteMail(event)
	{
		event.stopImmediatePropagation();
		
		if(validItemMoneyExists()){
			let mailID = ReadMail.ui.querySelector('.btn_return_reply_remove').getAttribute('data-mail-i-d');
			getModule('UI/Components/Mail/Mail').deleteMail(mailID);
		}else{
			ChatBox.addText( DB.getMessage(1105), ChatBox.TYPE.ERROR, ChatBox.FILTER.PUBLIC_LOG);
		}
	}

	function validItemMoneyExists(){
		let validItem = _preferences.item_add_email.count === 0 && _preferences.item_add_email.ITID === 0;
		validItem = _preferences.item_add_email.ITID === undefined ? true : validItem;

		let validMoney = _preferences.item_add_email.Money === 0;
		validMoney = _preferences.item_add_email.Money === undefined ? true : validMoney;

		return validItem && validMoney
	}

	function returnMail(event)
	{
		event.stopImmediatePropagation();
		let mailID = ReadMail.ui.querySelector('.btn_return_reply_remove').getAttribute('data-mail-i-d');
		let textSender = ReadMail.ui.querySelector('.text_sender').textContent;
		getModule('UI/Components/Mail/Mail').returnMail(mailID, textSender);
	}

	function remove()
	{
		 ReadMail.list.length = 0;
		 // Save preferences
		 _preferences.show   =  DOM.isVisible(ReadMail.ui);
		 _preferences.reduce = !!_realSize;
		 _preferences.y      =  parseInt(ReadMail.ui.style.top, 10);
		 _preferences.x      =  parseInt(ReadMail.ui.style.left, 10);
		 _preferences.width  =  Math.floor( (ReadMail.ui.offsetWidth  - (23 + 16 + 16 - 30)) / 32 );
		 _preferences.height =  Math.floor( (ReadMail.ui.offsetHeight - (31 + 19 - 30     )) / 32 );
		 _preferences.magnet_top = ReadMail.magnet.TOP;
		 _preferences.magnet_bottom = ReadMail.magnet.BOTTOM;
		 _preferences.magnet_left = ReadMail.magnet.LEFT;
		 _preferences.magnet_right = ReadMail.magnet.RIGHT;
		 _preferences.save();
	}

	 /**
	  * Extend Mail window size
	  */
	 function onResize()
	 {
		var ui         = ReadMail.ui;
		var top        = DOM.getPosition(ui).top;
		var lastHeight = 0;
		var _Interval;

		function resizing()
		{
			var extraY = 31 + 19 - 30;
			var h = Math.floor( (Mouse.screen.y - top  - extraY) / 32 );

			// Maximum and minimum window size
			h = Math.min( Math.max(h, 8), 17);

			if (h === lastHeight) {
				return;
			}

			resizeHeight(h);
			lastHeight = h;
		}

		// Start resizing
		_Interval = setInterval( resizing, 30);

		// Stop resizing on left click
		var _resizeHandler = function(event){
			if (event.which === 1) {
				clearInterval(_Interval);
				window.removeEventListener('mouseup', _resizeHandler);
			}
		};
		window.addEventListener('mouseup', _resizeHandler);
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

	function removeValueItemZeny(){
		ReadMail.ui.querySelector(".item" ).remove();
		ReadMail.ui.querySelector(".input_zeny_amt" ).value = '';
	}
	
	 /**
	 * Callbacks
	 */

	 /**
	  * Create component and export it
	  */
	 return UIManager.addComponent(ReadMail);
});
