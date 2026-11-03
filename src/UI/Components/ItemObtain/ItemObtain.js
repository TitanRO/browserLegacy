/**
 * UI/Components/ItemObtain/ItemObtain.js
 *
 * Item Obtain window (when you get an item, a window popup near the announce box)
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */
define(function(require)
{
	'use strict';


	/**
	 * Dependencies
	 */
	var DB                 = require('DB/DBManager');
	var DOM                = require('Utils/DOM');
	var Client             = require('Core/Client');
	var Events             = require('Core/Events');
	var Renderer           = require('Renderer/Renderer');
	var UIManager          = require('UI/UIManager');
	var UIComponent        = require('UI/UIComponent');
	var htmlText           = require('text!./ItemObtain.html');
	var cssText            = require('text!./ItemObtain.css');


	/**
	 * Create component
	 */
	var ItemObtain = new UIComponent( 'ItemObtain', htmlText, cssText );


	function qs(selector)
	{
		return DOM.qs(ItemObtain.ui, selector);
	}


	/**
	 * Mouse can cross this UI
	 */
	ItemObtain.mouseMode = UIComponent.MouseMode.CROSS;


	/**
	 * @var {boolean} do not focus this UI
	 */
	ItemObtain.needFocus = false;


	/**
	 * @var {TimeOut} timer
	 */
	var _timer = 0;


	/**
	 * @var {number} time to display
	 */
	var _life = 5 * 1000;


	/**
	 * Initialize component
	 */
	ItemObtain.init = function init()
	{
		// this.ui.style.zIndex = '45'; // Between Interface and Game Announce
	};


	/**
	 * Once append to body
	 */
	ItemObtain.onAppend = function onAppend()
	{
		this.ui.style.left = (( Renderer.width - this.ui.offsetWidth ) >> 1) + 'px';
	};


	/**
	 * Once removed from HTML, clean timer
	 */
	ItemObtain.onRemove = function onRemove()
	{
		if (_timer) {
			Events.clearTimeout(_timer);
			_timer = 0;
		}
	};


	/**
	 * Timer end, cleaning box
	 */
	ItemObtain.timeEnd = function timeEnd()
	{
		this.remove();
	};


	/**
	 * Add item informations
	 *
	 * @param {object} item
	 */
	ItemObtain.set = function set( item )
	{
		var it       = DB.getItemInfo(item.ITID);
		var display  = DB.getItemName(item, {showItemSlots: false , showItemOptions: false});
		var resource = item.IsIdentified ? it.identifiedResourceName : it.unidentifiedResourceName;
		var content  = qs('.content');

		this.placeOnTop();

		if (content) {
			content.innerHTML =
				'<img src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==" class="'+ item.ITID +'" width="24" height="24" /> ' +
				DOM.sanitizeHtml(display + ' ' + DB.getMessage(696).replace('%d', item.count || 1));
		}

		this.ui.style.left = (( Renderer.width - this.ui.offsetWidth ) >> 1) + 'px';

		Client.loadFile( DB.INTERFACE_PATH + 'item/' + resource + '.bmp', (function(url){
			var img = qs('img.' + item.ITID);
			if (img) {
				img.src = url;
			}
		}).bind(this));

		// Start tomer
		if (_timer) {
			Events.clearTimeout(_timer);
		}

		_timer = Events.setTimeout( this.timeEnd.bind(this), _life );
	};


	/**
	 * Create component and return it
	 */
	return UIManager.addComponent(ItemObtain);
});
