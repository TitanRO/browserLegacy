/**
 * UI/Components/MakeReadBook/MakeReadBook.js
 *
 * Chararacter MakeReadBook
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 * In some cases the client will send packet twice.eg NORMAL_ITEMLIST4; fixit [skybook888]
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
	 var Mouse              = require('Controls/MouseEventHandler');
	 var UIManager          = require('UI/UIManager');
	 var UIComponent        = require('UI/UIComponent');
	 var htmlText           = require('text!./MakeReadBook.html');
	 var cssText            = require('text!./MakeReadBook.css');
	 var DOM                = require('Utils/DOM');
	 var Sprite             = require('Loaders/Sprite');
	 var Client             = require('Core/Client');
	 var TextEncoding       = require('Vendors/text-encoding');
	 var Announce       	= require('UI/Components/Announce/Announce');
	 var ChatBox      		= require('UI/Components/ChatBox/ChatBox');
	 var getModule    		= require;


	var sleepNow = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

	 /**
	  * Create Component
	  */
	 var MakeReadBook = new UIComponent( 'MakeReadBook', htmlText, cssText );

	/**
	 * @var {Preferences} structure
	 */
	var _BOOK_INFORMATION	= Preferences.get('_BOOK_INFORMATION', {
		itid:  					0,
		title:  				'',
		color: 					'',
		pagesize:   			0,
		contents:   			[],
		bookmark_activated:     false,
		bookmark_activated_page:0,
		book_open:				false,
	}, 1.0);

	 /**
	  * Store MakeReadBook items
	  */
	 MakeReadBook.list = [];


	 /**
	  * @var {number} used to remember the window height
	  */
	 var _realSize = 0;


	 /**
	  * @var {Preferences} structure
	  */
	 var _preferences = Preferences.get('MakeReadBook', {
		 x:        0,
		 y:        172,
		 width:    7,
		 height:   4,
		 show:     false,
		 reduce:   false,
		 magnet_top: false,
		 magnet_bottom: false,
		 magnet_left: true,
		 magnet_right: false
	 }, 1.0);


	 MakeReadBook.startBook = function startBook(inforBook, item){
		var it = DB.getItemInfo( item.ITID );

		_BOOK_INFORMATION['title'] 	= it.identifiedDisplayName;
		let addColor = inforBook.substr(1, 7);
		let validtext = inforBook.substr(7);// remover color background

		let lineValidtext = validtext.split(`\n`);
		let defoutValue = 15;
		let coutIndeNewText = 0;
		let coutNewIndex = 0;
		let contentsArray = []

		for (let index = 0; index < lineValidtext.length; index++) {

			if((defoutValue + coutNewIndex) > index){

				let addText = (typeof contentsArray[coutIndeNewText] === 'undefined') ? '\n' : contentsArray[coutIndeNewText]
				+ '\n' + lineValidtext[index];

				if(addText.length > 460)
				{
					contentsArray[(coutIndeNewText)+1] = (typeof contentsArray[(coutIndeNewText)+1] === 'undefined') ? '\n' + lineValidtext[index]  :  '\n';

					coutNewIndex = defoutValue + coutNewIndex;
					coutIndeNewText++;
					continue;
				}

				contentsArray[coutIndeNewText] = addText;
				continue;
			}

			coutNewIndex = defoutValue + coutNewIndex;
			coutIndeNewText++;
		}

		let validNewBookOpen = _BOOK_INFORMATION['itid'] === item.ITID;
		_BOOK_INFORMATION['color'] 				= addColor;
		_BOOK_INFORMATION['contents'] 			= contentsArray;
		_BOOK_INFORMATION['pagesize'] 			= contentsArray.length; // length
		_BOOK_INFORMATION['page'] 				= validNewBookOpen ? _BOOK_INFORMATION['page'] : 0; // length
		_BOOK_INFORMATION['bookmark_activated'] = validNewBookOpen;
		_BOOK_INFORMATION['itid'] 				= item.ITID;
		_BOOK_INFORMATION['book_open'] 		    = false;
		_BOOK_INFORMATION.save();
	 }

	 MakeReadBook.openBook = function openBook(){
		MakeReadBook.append();

		this.ui.querySelector('.panel').style.backgroundColor = '#'+_BOOK_INFORMATION['color'];
		this.ui.querySelector('.footer').style.backgroundColor = '#'+_BOOK_INFORMATION['color'];

		this.ui.querySelector('#titleBook').textContent = _BOOK_INFORMATION['title'];

		Client.getFiles(
			[
				'data/sprite/book/\xc3\xa5\xb4\xdd\xb1\xe2.spr',
				'data/sprite/book/\xc3\xa5\xb0\xa5\xc7\xc7.spr',
				'data/sprite/book/\xc3\xa5\xbf\xde\xc2\xca.spr', // previous
				'data/sprite/book/\xc3\xa5\xbf\xc0\xb8\xa5\xc2\xca.spr', // next
			],function (spr_close, spr_highlighter, spr_previous, spr_next) {
				// close
				var sprite_close = new Sprite( spr_close );
				var canvas;
				canvas  = sprite_close.getCanvasFromFrame( 0 );
				canvas.className = 'clone_book event_add_cursor';
				MakeReadBook.ui.querySelector('.footer').querySelector('canvas').remove();
				MakeReadBook.ui.querySelector('.footer').append(canvas);
				var cloneBook = MakeReadBook.ui.querySelector('.clone_book');
				cloneBook.addEventListener('click', onClose);

				// highlighter
				var sprite_highlighter = new Sprite( spr_highlighter );
				var canvas;
				canvas  = sprite_highlighter.getCanvasFromFrame( 0 );
				canvas.className = 'highlighter event_add_cursor';
				MakeReadBook.ui.querySelector('#highlighter').querySelector('canvas').remove();
				MakeReadBook.ui.querySelector('#highlighter').append(canvas);
				var highlighter = MakeReadBook.ui.querySelector('.highlighter');
				highlighter.addEventListener('mouseover', function(e) {
					e.stopImmediatePropagation();
					MakeReadBook.ui.querySelector('.bookmark').style.display = '';
				});
				highlighter.addEventListener('mouseout', function(e) {
					e.stopImmediatePropagation();
					MakeReadBook.ui.querySelector('.bookmark').style.display = 'none';
				});
				highlighter.addEventListener('click', function(e) {
					e.stopImmediatePropagation();
					_BOOK_INFORMATION['bookmark_activated'] = true;
					_BOOK_INFORMATION['bookmark_activated_page'] = _BOOK_INFORMATION['page'];
					_BOOK_INFORMATION.save();
				});


				// remove canvas next and previous
				MakeReadBook.ui.querySelector('#next_previous').querySelector('canvas').remove();
				// previous
				var sprite_previous = new Sprite( spr_previous );
				var canvas;
				canvas  = sprite_previous.getCanvasFromFrame( 0 );
				canvas.className = 'previous_btn event_add_cursor';
				MakeReadBook.ui.querySelector('#next_previous').append(canvas);
				var previous_btn = MakeReadBook.ui.querySelector('.previous_btn');
				previous_btn.addEventListener('mouseover', function(e) {
					e.stopImmediatePropagation();
					MakeReadBook.ui.querySelector('.previous').style.display = '';
				});
				previous_btn.addEventListener('mouseout', function(e) {
					e.stopImmediatePropagation();
					MakeReadBook.ui.querySelector('.previous').style.display = 'none';
				});

				// next
				var sprite_next = new Sprite( spr_next );
				var canvas;
				canvas  = sprite_next.getCanvasFromFrame( 0 );
				canvas.className = 'next_btn event_add_cursor';
				MakeReadBook.ui.querySelector('#next_previous').append(canvas);
				var next_btn = MakeReadBook.ui.querySelector('.next_btn');
				next_btn.addEventListener('mouseover', function(e) {
					e.stopImmediatePropagation();
					DOM.show(MakeReadBook.ui.querySelector('.next'));
				});
				next_btn.addEventListener('mouseout', function(e) {
					e.stopImmediatePropagation();
					DOM.hide(MakeReadBook.ui.querySelector('.next'));
				});

				// pagination
				next_btn.addEventListener('click', function(e) {
					e.stopImmediatePropagation();
					if (_BOOK_INFORMATION['page'] < _BOOK_INFORMATION['pagesize'] / 1 - 1) {
						_BOOK_INFORMATION['page']++;
						page();
						adjustButtons();
						_BOOK_INFORMATION.save();
					}
				});
				previous_btn.addEventListener('click', function(e) {
					e.stopImmediatePropagation();
					if (_BOOK_INFORMATION['page'] > 0) {
						_BOOK_INFORMATION['page']--;
						page();
						adjustButtons();
						_BOOK_INFORMATION.save();
					}
				});
				page();
				adjustButtons();

			})
	}


	MakeReadBook.highlighter = async function highlighter()
	{
		if(_preferences.show)onClose();

		let index = _BOOK_INFORMATION['bookmark_activated'] ? _BOOK_INFORMATION['bookmark_activated_page'] : 0;
		let newText = '';
		for (index; index < _BOOK_INFORMATION['contents'].length; index++) {
			newText = newText + `\n` +_BOOK_INFORMATION['contents'][index];
		}
	    await repeatedGreetingsLoop(newText);
	};

	async function repeatedGreetingsLoop(book_information) {
		let text1 = book_information.split(`\n`);
		for (let i = 0; i < text1.length; i++) {

			if(_BOOK_INFORMATION['book_open'])
				break;

			if(text1[i] === "" && i === 0){
				getText("   ");
				continue
			};

			if(i === 1) {
				getText(text1[i]);
				continue;
			}
			await sleepNow(5000)

			if(_BOOK_INFORMATION['book_open'])
				break;

			getText(text1[i]);
		}
	}

	function getText(textbook){
		let text = cleanTextColor(textbook);
		text = TextEncoding.decodeString(text);
		ChatBox.addText( text == "" ? '  ' : text , ChatBox.TYPE.ANNOUNCE, ChatBox.FILTER.PUBLIC_LOG, '#ffffff' );
		Announce.append();
		Announce.set( text == "" ? '  ' : text, '#ffffff');
	}

	function cleanTextColor(text)
	{

		let cout = text.split('^').length;
		let array = text.split('^');
		let newMessage = ''

		for (let index = 0; index < cout; index++) {

			if(index === 0){
				newMessage = array[index];
				continue;
			}

			newMessage = newMessage + array[index].substr(6);
		}

		if(newMessage.length === 1)
			return newMessage[0];

		return newMessage;
	}

	 /**
	  * Apply preferences once append to body
	  */
	 MakeReadBook.onAppend = function OnAppend()
	 {
		this.ui.style.display = '';

		DOM.setCss(this.ui, {
			top:  Math.min( Math.max( 0, _preferences.y), Renderer.height - this.ui.offsetHeight),
			left: Math.min( Math.max( 0, _preferences.x), Renderer.width  - this.ui.offsetWidth)
		});

		_BOOK_INFORMATION['book_open'] = true;
		_BOOK_INFORMATION.save();

		_preferences.show   =  DOM.isVisible(this.ui);
		_preferences.save();

		this.draggable(this.ui.querySelector('.titlebar'));
	 };

	 /**
	  * Remove MakeReadBook from window (and so clean up items)
	  */
	 MakeReadBook.onRemove = function OnRemove()
	 {

		try {
			if (_preferences.show) {
				this.ui.style.display = 'none';
			}
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

		} catch (error) {
			_preferences.show   =  false;
			_preferences.save();
		}
	 };

	 /**
	  * Extend MakeReadBook window size
	  *
	  * @param {number} width
	  * @param {number} height
	  */
	 MakeReadBook.resize = function Resize( width, height )
	 {
		 width  = Math.min( Math.max(width,  6), 9);
		 height = Math.min( Math.max(height, 2), 6);

		 DOM.setCss(this.ui, {
			 width:  23 + 16 + 16 + width  * 32,
			 height: 31 + 19      + height * 32
		 });
	 };


	/**
	 * Exit window
	 */
	function onClose(e)
	{
		try {
			e.stopImmediatePropagation();

		} catch (error) {
		}

		_BOOK_INFORMATION['book_open'] = false;
		_BOOK_INFORMATION.save();
		if (_preferences.show) {
			MakeReadBook.onRemove();
		}
	}

	function page() {
		MakeReadBook.ui.querySelector('#textBook').textContent = '';
		var textBody = MakeReadBook.ui.querySelector('#textBook');

		for (var i = _BOOK_INFORMATION['page'] * 1 ; i < _BOOK_INFORMATION['pagesize'] && i < (_BOOK_INFORMATION['page'] + 1) *  1 ; i++) {
			textBody.textContent = TextEncoding.decodeString(_BOOK_INFORMATION['contents'][i])
		}
		MakeReadBook.ui.querySelector('#pageBook').textContent = '(' + (_BOOK_INFORMATION['page'] + 1) + '/' + Math.ceil(_BOOK_INFORMATION['pagesize'] / 1 ) + ')' ;
	}

	function adjustButtons() {
		MakeReadBook.ui.querySelector('.next_btn').disabled = _BOOK_INFORMATION['pagesize'] <= 1 || _BOOK_INFORMATION['page'] > _BOOK_INFORMATION['pagesize'] / 1 - 1;
		MakeReadBook.ui.querySelector('.previous_btn').disabled = _BOOK_INFORMATION['pagesize'] <= 1 || _BOOK_INFORMATION['page'] == 0;
	}

	 /**
	  * Extend MakeReadBook window size
	  */
	 function onResize()
	 {
		 var ui      = MakeReadBook.ui;
		 var top     = DOM.getPosition(ui).top;
		 var left    = DOM.getPosition(ui).left;
		 var lastWidth  = 0;
		 var lastHeight = 0;
		 var _Interval;

		 function resizing()
		 {
			 var extraX = 23 + 16 + 16 - 30;
			 var extraY = 31 + 19 - 30;

			 var w = Math.floor( (Mouse.screen.x - left - extraX) / 32 );
			 var h = Math.floor( (Mouse.screen.y - top  - extraY) / 32 );

			 // Maximum and minimum window size
			 w = Math.min( Math.max(w, 6), 9);
			 h = Math.min( Math.max(h, 2), 6);

			 if (w === lastWidth && h === lastHeight) {
				 return;
			 }

			 MakeReadBook.resize( w, h );
			 lastWidth  = w;
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
	  * Create component and export it
	  */
	 return UIManager.addComponent(MakeReadBook);
 });

