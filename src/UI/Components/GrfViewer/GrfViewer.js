/**
 * UI/Components/GrfViewer/GrfViewer.js
 *
 * Game File Viewer
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
	var DOM = require('Utils/DOM');

	var Configs            = require('Core/Configs');
	var Client             = require('Core/Client');
	var Thread             = require('Core/Thread');
	var Memory             = require('Core/MemoryManager');
	var Events             = require('Core/Events');

	var KEYS               = require('Controls/KeyEventHandler');

	var Sprite             = require('Loaders/Sprite');
	var Targa              = require('Loaders/Targa');

	var UIManager          = require('UI/UIManager');
	var UIComponent        = require('UI/UIComponent');

	var htmlText           = require('text!./GrfViewer.html');
	var cssText            = require('text!./GrfViewer.css');
	var History            = require('./History');


	// Ugly, require api.js to display models and map
	require('../../../../applications/api/api');



	/**
	 * Create GRFViewer component
	 */
	var Viewer = new UIComponent( 'GRFViewer', htmlText, cssText );


	/**
	 * @var {number} The display is done asynchronus, keep reference of the thread
	 */
	var _thread = 0;


	/**
	 * @var {number} action id, to stop doing things when the action change
	 */
	var _actionID =  0;


	/**
	 * Initialize Component
	 */
	Viewer.init = function init()
	{
		var ui = this.ui;

		Thread.hook('THREAD_READY', function(){
			var remoteClient = Configs.get('remoteClient');
			if (remoteClient) {
				Thread.send( 'SET_HOST', remoteClient);
				Client.init([]);
			}
		});
		Thread.init();


		(function(){ var s = document.createElement('style'); s.type = 'text/css'; s.textContent =
			'#previous { background-image:url(' + require.toUrl('./Icons/arw-left.png') + '); }' +
			'#next     { background-image:url(' + require.toUrl('./Icons/arw-right.png') + '); }' +
			'#progress { background-image:url(' + require.toUrl('./Icons/load.gif') + '); }';
			document.head.appendChild(s);
		})();

		// Drag drop the GRF.
		var _grfInfo = ui.querySelector('#info');
		_grfInfo.addEventListener('dragover', function(){ this.style.backgroundColor = '#DFD'; return false; });
		_grfInfo.addEventListener('dragleave', function(){ this.style.backgroundColor = '#EEE'; return false; });
		_grfInfo.addEventListener('drop', function(event){ this.style.backgroundColor = '#EEE'; processGRF(event.originalEvent); return false; });

		// Load GRFs
		ui.querySelector('#file').addEventListener('change', processGRF);
		ui.querySelector('#info button').addEventListener('mousedown', function(){
			ui.querySelector('#file').addEventListener('click', );
		});


		// Bind icons events
		DOM.addDelegatedEvent(ui, 'click', '.directory', onDirectoryClick);
		DOM.addDelegatedEvent(ui, 'click', '.audio', onAudioClick);
		DOM.addDelegatedEvent(ui, 'click', '.img, .thumb', onImageClick);
		DOM.addDelegatedEvent(ui, 'click', '.txt', onTextClick);
		DOM.addDelegatedEvent(ui, 'click', '.map', onWorldClick);
		DOM.addDelegatedEvent(ui, 'click', '.3d', onObjectClick);
		DOM.addDelegatedEvent(ui, 'click', '.gr2', onGrannyClick);
		DOM.addDelegatedEvent(ui, 'click', '.fx', onEffectClick);
		DOM.addDelegatedEvent(ui, 'contextmenu', '.icon', function(event){ showContextMenu(this, event); event.preventDefault(); });

		// Initialize toolbar
		initToolBar();

		// Initialize history
		History.init(
			ui.querySelector('#previous'),
			ui.querySelector('#next')
		);

		// Renderer is not rendering, causing issue in src/UI/UIComponents.js#212
		// Trigger manually the event.
		setTimeout(function(){
			Events.process(100);
		}, 10);
	};


	/**
	 * Once append to body, initialize elements
	 */
	Viewer.onAppend = function onAppend()
	{
		document.body.style.backgroundColor = 'white';
		moveToDirectory('/', true );
	};


	/**
	 * Initialize tool bar
	 */
	function initToolBar()
	{
		var ui = Viewer.ui;

		// Path submit
		ui.querySelector('#path').addEventListener('keydown', function(event){
			if (event.which === KEYS.ENTER) {
				var value = this.value.replace(/^\s+|\s+$/g, '');
				if (value.substr(-1) !== '/') {
					value += '/';
				}
				moveToDirectory( value, true );
			}
		});

		// History before
		ui.querySelector('#previous').addEventListener('click', function(){
			var path = History.previous();
			if (path) {
				moveToDirectory( path, false );
			}
		});

		// History after
		ui.querySelector('#next').addEventListener('click', function(){
			var path = History.next();
			if (path) {
				moveToDirectory( path, false );
			}
		});

		// Search toolbar
		var _grfSearch = ui.querySelector('#search');
		_grfSearch.addEventListener('focus', function(){ this.value = ''; });
		_grfSearch.addEventListener('blur', function(){ this.value = this.value || 'Search...'; });
		_grfSearch.addEventListener('keydown',  function(event) {
				if (event.which === KEYS.ENTER) {
					var value = this.value.replace(/^\s+|\s+$/g, '');
					if (value.length > 2) {
						moveToDirectory( 'search/' + value, true );
					}
				}
			});
	}


	/**
	 * Context Menu feature
	 *
	 * @param {HTMLElement} icon
	 * @param {object} event
	 */
	function showContextMenu( iconElement, event )
	{
		var contextmenu = Viewer.ui.querySelector('#contextmenu');
		var overlay     = Viewer.ui.querySelector('.overlay');
		var header = contextmenu.querySelector('.header');
		var open = contextmenu.querySelector('.open');
		var save = contextmenu.querySelector('.save');
		var info = contextmenu.querySelector('.info');
		var icon = iconElement;
		var path = icon.getAttribute('data-path');

		contextmenu.style.left = event.pageX + 'px';
		contextmenu.style.top = event.pageY + 'px';
		contextmenu.style.display = '';

		overlay.onmousedown = function(){
			contextmenu.style.display = 'none';
			overlay.style.display = 'none';
		};
		overlay.style.display = '';

		open.classList.remove('disable');
		save.classList.remove('disable');
		info.classList.remove('disable');

		header.textContent = 'Path: ' + path;
		header.style.backgroundColor = '';
		header.onclick = function(){
			navigator.clipboard.writeText(path);
			header.textContent = 'Copied: ' + path;
			header.style.backgroundColor = '#AAFFAA';
		};

		if (icon.classList.contains('file')) {
			open.classList.add('disable');
		}
		else {
			open.onmousedown = function(){
				icon.click();
				if (overlay.onmousedown) {
					overlay.onmousedown();
				}
			};
		}

		if (icon.classList.contains('directory')) {
			save.classList.add('disable');
			save.removeAttribute('download');
		}
		else {
			save.onmouseup = function(){
				if (overlay.onmousedown) {
					overlay.onmousedown();
				}
			};

			Client.getFile(path, function(buffer) {
				var url = URL.createObjectURL(new Blob([buffer], {type: 'application/octet-stream'}));
				save.setAttribute('href', url);
				save.setAttribute('download', icon.textContent.trim());
			});
		}

		info.classList.add('disable');
	}


	/**
	 * Move to a path
	 *
	 * @param {string} path to move
	 * @param {boolean} save in history
	 */
	function moveToDirectory( path, save )
	{
		path = decodeURIComponent(path) || '/';
		path = path.replace(/\\/g, '/');

		if (path.substr(0,1) === '/') {
			path = path.substr(1);
		}

		if (path.match(/^search\//)) {
			search( path.substr(7) );
		}
		else {
			showDirectory( path );
		}

		// Update history
		if (save) {
			History.push( path );
		}
	}


	/**
	 * Load GRF files
	 *
	 * @param {object} event
	 * @return {boolean} false
	 */
	function processGRF(event)
	{
		Viewer.ui.querySelector('#progress').style.display = '';

		Client.onFilesLoaded = function(){ moveToDirectory('data/', true); };
		Client.init( (event.dataTransfer || event.target).files );

		event.preventDefault();
		event.stopPropagation();
		return false;
	}


	/**
	 * Move to a specify path
	 *
	 * @param {string} path
	 */
	function showDirectory( path )
	{
		// Stop displaying
		clearTimeout(_thread);

		// Clean up Input
		path = decodeURIComponent(path) || '/';
		path = path.replace(/\\/g, '/');

		if (path.substr(0,1) === '/') {
			path = path.substr(1);
		}

		// Build regex
		var ui        = Viewer.ui;
		var directory = path.replace( /\//g, '\\\\');
		var reg       = directory + '([^(\\0|\\\\)]+)';

		// Clean windows
		ui.querySelector('#path').value = path;
		ui.querySelectorAll('.icon').forEach(function(el){ el.remove(); });
		ui.querySelector('#progress').style.display = '';
		ui.querySelector('#msg').style.display = 'none';

		// Go back to the home
		if (!path.length) {
			ui.querySelector('#info').style.display = '';
			renderFiles(['data']);
			return;
		}

		ui.querySelector('#info').style.display = 'none';

		// Changing action to avoid conflict
		var actionID = ++_actionID;

		// Send request
		Client.search( new RegExp(reg, 'gi'), function(list) {
			// Organize files and directory and render them
			if (actionID === _actionID) {
				list.sort(sortFiles);
				renderFiles(list);
			}
		});
	}


	/**
	 * Search files (apply a regex on fileList) and show the result
	 *
	 * @param {string} keyword
	 */
	function search( keyword )
	{
		// Escape regex, and complete it
		var search   = keyword.replace(/(\.|\\|\+|\*|\?|\[|\^|\]|\$|\(|\)|\{|\}|\=|\!|<|>|\||\:|\-)/g, '\\$1');
		var reg      = 'data\\\\([^(\\0\\)]+)?' + search + '([^(\\0|\\\\)]+)?';
		var ui       = Viewer.ui;
		var actionID = ++_actionID;

		// Clean path
		ui.querySelectorAll('.icon').forEach(function(el){ el.remove(); });
		ui.querySelector('#progress').style.display = '';
		ui.querySelector('#info').style.display = 'none';
		ui.querySelector('#msg').style.display = 'none';

		// Send request
		Client.search( new RegExp(reg, 'gi'), function( list ) {
			if (actionID === _actionID) {
				list.sort(sortFiles);
				renderFiles(list);
			}
		});
	}


	/**
	 * Organize file listing
	 * Directory first, and organized by alpha
	 *
	 * @param {string} a file's name
	 * @param {string} b file's name
	 * @return {number}
	 */
	function sortFiles( a, b )
	{
		var _a, _b;
		a  = a.replace(/.*\\/,'');
		b  = b.replace(/.*\\/,'');
		_a = a.indexOf('.') !== -1;
		_b = b.indexOf('.') !== -1;

		if (_a === _b) return a > b ? 1 : -1;
		if (_a) return  1;
		return -1;
	}


	/**
	 * Showing file list on the screen
	 *
	 * @param {Array} list of files and directories
	 */
	function renderFiles( list )
	{
		Viewer.ui.querySelector('#progress').style.display = 'none';

		// No file in directory ? (or error : the file isn't a directory)
		if (!list.length) {
			Viewer.ui.querySelector('#msg').textContent = 'No file found.'.style.display = '';
			return;
		}

		var i, count;
		var type, reg = /(.*\\)/;

		i     = 0;
		count = list.length;

		// Avoid freeze, stream to display files
		function streamExecute()
		{
			var j;
			var html = '';

			for (j = 0; j < 200 && i + j < count; ++j) {
				type  = getFileIcon(list[j+i]);
				html +=
					'<div class="icon '+ type +'" data-path="'+ list[j+i] +'">' +
					'	<img src="'+ require.toUrl('./Icons/' + type +'.png') + '" width="48" height="48"/><br/>' +
							list[j+i].replace(reg,'') +
					'</div>';
			}

			(function(){ var c = document.getElementById('grfviewer'); if(c){ c.insertAdjacentHTML('beforeend', html); } })();

			i += j;

			if (i < count) {
				_thread = setTimeout( streamExecute, 4 );
			}
		}

		streamExecute();
		displayImagesThumbnail( count );
	}


	/**
	 * Get file thumbnail based on its extention
	 *
	 * @param {string} filename
	 * @return {string} icon name
	 */
	function getFileIcon( filename )
	{
		var ext = filename.split(/\.([^\.]+)$/)[1] || 'dir';
		var img = 'file';

		switch (ext.toLowerCase()) {
			case 'dir':
				img = 'directory';
				break;

			case 'xml':
			case 'txt':
			case 'lua':
				img = 'txt';
				break;

			case 'jpg':
			case 'bmp':
			case 'tga':
			case 'jpeg':
			case 'spr':
			case 'pal':
				img = 'img';
				break;

			case 'wav':
			case 'mp3':
				img = 'audio';
				break;

			case 'gr2':
				img = 'gr2';
				break;

			case 'rsm':
			case 'rsm2':
				img = '3d';
				break;

			case 'rsw':
				img = 'map';
				break;

			case 'str':
				img = 'fx';
				break;
		}

		return img;
	}


	/**
	 * Display real thumbnails for each known file
	 */
	function displayImagesThumbnail()
	{
		// Stored action to know if user act during the process
		var actionID = _actionID + 0;

		function cleanUp()
		{
			URL.revokeObjectURL(this.src);
		}

		function process()
		{
			// Stop here if we change page.
			if (actionID !== _actionID) {
				return;
			}

			var nodes = Array.prototype.slice.call(document.querySelectorAll('.img'), 0, 5);
			var load  = 0;
			var total = nodes.length;

			// All thumbnails are already rendered
			if (!total) {
				return;
			}

			// Work with current loaded files
			nodes.forEach(function(){
				var self = this;

				Client.getFile( self.getAttribute('data-path'), function( data ) {
					Memory.remove(self.getAttribute('data-path'));
					self.classList.remove('img');
					self.classList.add('thumb');

					var url = getImageThumbnail( self.getAttribute('data-path'), data );

					// Display image
					if (url) {
						var img = self.querySelector('img');
						if (url.match(/^blob\:/)){
							img.onload = img.onerror = img.onabort = cleanUp;
						}
						img.src = url;
					}

					// Fetch next range.
					if ((++load) >= total) {
						setTimeout( process, 4 );
					}
				});
			});
		}

		process();
	}


	/**
	 * Generate thumbnail for a file
	 *
	 * @param {string} filename
	 * @param {ArrayBuffer} data
	 * @return {string|null} url generated
	 */
	function getImageThumbnail( filename, data )
	{
		var canvas;
		var ext = filename.substr(-3).toLowerCase();

		switch (ext) {

			// Sprite support
			case 'spr':
				var spr = new Sprite( data );
				canvas  = spr.getCanvasFromFrame(0);
				return canvas.toDataURL();

			// Palette support
			case 'pal':
				canvas  = document.createElement('canvas');
				var ctx = canvas.getContext('2d');
				var imageData, i, count;
				var palette = new Uint8Array(data);

				// 16 * 16 = 256
				canvas.width  = 16;
				canvas.height = 16;
				imageData     = ctx.createImageData( canvas.width, canvas.height );

				for (i = 0, count = imageData.data.length; i < count; i += 4) {
					imageData.data[i+0] = palette[i+0];
					imageData.data[i+1] = palette[i+1];
					imageData.data[i+2] = palette[i+2];
					imageData.data[i+3] = 255;
				}

				ctx.putImageData( imageData, 0, 0 );
				return canvas.toDataURL();

			// Targa support
			case 'tga':
				var tga = new Targa();
				tga.load( new Uint8Array(data) );
				return tga.getDataURL();

			// Image Support
			default:
				return URL.createObjectURL(
					new Blob( [data], { type: 'image/' + ext })
				);
		}
	}


	/**
	 * User click on directory, open it
	 */
	function onDirectoryClick()
	{
		moveToDirectory( this.getAttribute('data-path') + '/', true );
	}


	/**
	 * User click on an audio file, play it
	 */
	function onAudioClick()
	{
		var ui   = Viewer.ui;
		var path = this.getAttribute('data-path');
		var box  = ui.querySelector('#preview .box');

		ui.querySelector('#progress').style.display = '';

		Client.loadFile( path, function(url) {
			// Create audio
			var audio      = document.createElement('audio');
			audio.src      = url;
			audio.controls = true;
			audio.play();

			box.style.top = ((window.innerHeight - 100) / 2) + 'px';
			box.innerHTML = '';
			audio.addEventListener('click', function(event){
				event.stopPropagation();
			});
			box.appendChild(audio);

			ui.querySelector('#progress').style.display = 'none';
			var preview = ui.querySelector('#preview');
			preview.style.display = '';
			preview.onclick = function(){
				preview.style.display = 'none';
				var a = box.querySelector('audio');
				if (a) {
					a.remove();
				}
			};
		});
	}


	/**
	 * User click on an image, render it
	 */
	function onImageClick()
	{
		var ui   = Viewer.ui;
		var path = this.getAttribute('data-path');
		var box  = ui.querySelector('#preview .box');
		ui.querySelector('#progress').style.display = '';

		Client.getFile( path, function(data)
		{
			var i, count, canvas;

			switch (path.substr(-3)) {

				// Sprite support
				case 'spr':
					var spr = new Sprite(data);
					box.style.top = (200) + 'px';

					for (i = 0, count = spr.frames.length; i < count; ++i) {
						canvas = spr.getCanvasFromFrame( i );
						if (canvas) {
							box.appendChild(canvas);
						}
					}
					break;

				// Palette support
				case 'pal':
					var palette = new Uint8Array(data);
					canvas  = document.createElement('canvas');
					var ctx = canvas.getContext('2d');

					canvas.width = 128;
					canvas.height = 128;

					for (i = 0, count = palette.length; i < count; i += 4) {
						ctx.fillStyle = 'rgb(' + palette[i+0] + ',' + palette[i+1] + ',' + palette[i+2] + ')';
						ctx.fillRect( ( (i/4|0) % 16 )  * 8, ( (i/4|0) / 16 | 0 )  * 8, 8, 8 );
					}

					box.style.top = (window.innerHeight / 2 - 64) + 'px';
					box.appendChild(canvas);
					break;

				// Targa support
				case 'tga':
					var tga = new Targa();
					tga.load( new Uint8Array(data) );
					box.style.top = (window.innerHeight / 2 - 64) + 'px';
					box.appendChild(tga.getCanvas());
						break;

				// Image Support
				default:
					var url = URL.createObjectURL(
						new Blob( [data], { type: 'image/' + path.substr(-3) })
					);
					var img = new Image();
					img.src = url;
					img.onload = function() {
						box.style.top = ((window.innerHeight - this.height) / 2) + 'px';
						box.appendChild(this);

						URL.revokeObjectURL(url);
					};
					break;
			}

			// Display progress bar
			ui.querySelector('#preview').style.display = '';
			ui.querySelector('#progress').style.display = 'none';
			ui.querySelector('#preview').addEventListener('click', function(){
				this.style.display = 'none';
				box.querySelectorAll('img, canvas').forEach(function(el){ el.remove(); });
			});
		});
	}


	/**
	 * User click on a model, render it using ModelViewer
	 */
	var onObjectClick = function onObjectClickClosure()
	{
		var ready   = false;
		var element = document.createElement('div');

		var App = new ROBrowser({
			target:        element,
			type:          ROBrowser.TYPE.FRAME,
			application:   ROBrowser.APP.MODELVIEWER,
			development:   Configs.get('development', false),
			api:           true,
			width:         500,
			height:        400,
			version:       Configs.get('version', '')
		});

		// Ressource sharing
		function onMessage(event) {
			if (typeof event.data !== 'object') {
				return;
			}

			switch (event.data.type) {
				case 'SYNC':
					ready = true;
					App.onload();
					break;

				case 'SET_HOST':
				case 'CLEAN_GRF':
					return;

				default:
					Thread.send( event.data.type, event.data.data, function(){
						App._APP.postMessage({
							arguments: Array.prototype.slice.call(arguments, 0),
							uid:       event.data.uid
						}, location.origin);
					});
			}
		}

		// Wait for synchronisation with frame
		function synchronise() {
			if (!ready) {
				App._APP.postMessage({ type: 'init' }, location.origin);
				setTimeout(synchronise, 100);
			}
		}

		return function onObjectClick()
		{
			var ui    = Viewer.ui;
			var path  = this.getAttribute('data-path').replace(/\\/g, '/');

			// Show iframe
			ui.querySelector('#preview .box').style.top = ((window.innerHeight-400) + 'px'* 0.5 );
			element.style.display = 'block';


			ui.querySelector('#preview').style.display = '';

			// Unload app
			ui.querySelector('#preview').addEventListener('click', function(){
				ui.querySelector('#preview').style.display = 'none';
				element.style.display = 'none';
				App._APP.postMessage({ type:'stop' }, location.origin);
				window.removeEventListener('message', onMessage, false);
			});

			window.addEventListener('message', onMessage, false);

			if (!ready) {
				// Once app is ready
				ui.querySelector('#preview .box').appendChild(element);

				App.start();
				App.onReady = function(){
					App._APP.frameElement.style.border          = '1px solid grey';
					App._APP.frameElement.style.backgroundColor = '#45484d';
					synchronise();
				};
				App.onload = function() {
					App._APP.postMessage({ type:'load', data:path }, location.origin);
				};
			}
			else {
				App._APP.postMessage({ type:'load', data:path }, location.origin);
			}
		};
	}();



	/**
	 * User click on an effect, render it using StrViewer
	 */
	var onEffectClick = function onEffectClickClosure()
	{
		var ready   = false;
		var element = document.createElement('div');

		var App = new ROBrowser({
			target:        element,
			type:          ROBrowser.TYPE.FRAME,
			application:   ROBrowser.APP.STRVIEWER,
			development:   Configs.get('development', false),
			api:           true,
			width:         400,
			height:        400,
			version:       Configs.get('version', '')
		});

		// Ressource sharing
		function onMessage(event) {
			if (typeof event.data !== 'object') {
				return;
			}

			switch (event.data.type) {
				case 'SYNC':
					ready = true;
					App.onload();
					break;

				case 'SET_HOST':
				case 'CLEAN_GRF':
					return;

				default:
					Thread.send( event.data.type, event.data.data, function(){
						App._APP.postMessage({
							arguments: Array.prototype.slice.call(arguments, 0),
							uid:       event.data.uid
						}, location.origin);
					});
			}
		}

		// Wait for synchronisation with frame
		function synchronise() {
			if (!ready) {
				App._APP.postMessage({ type: 'init' }, location.origin);
				setTimeout(synchronise, 100);
			}
		}

		return function onEffectClick()
		{
			var ui   = Viewer.ui;
			var path = this.getAttribute('data-path').replace(/\\/g, '/');

			// Show iframe
			ui.querySelector('#preview .box').style.top = ((window.innerHeight-400) + 'px'* 0.5 );
			ui.querySelector('#preview').style.display = '';
			element.style.display = 'block';

			// Unload app
			ui.querySelector('#preview').addEventListener('click', function(){
				ui.querySelector('#preview').style.display = 'none';
				element.style.display = 'none';
				App._APP.postMessage({ type:'stop' }, location.origin);
				window.removeEventListener('message', onMessage, false);
			});

			window.addEventListener('message', onMessage, false);

			if (!ready) {
				// Once app is ready
				ui.querySelector('#preview .box').appendChild(element);

				App.start();
				App.onReady = function(){
					App._APP.frameElement.style.border          = '1px solid grey';
					App._APP.frameElement.style.backgroundColor = 'black';
					synchronise();
				};
				App.onload = function() {
					App._APP.postMessage({ type:'load', data:path }, location.origin);
				};
			}
			else {
				App._APP.postMessage({ type:'load', data:path }, location.origin);
			}
		};
	}();


	/**
	 * User click on a map, render it using MapViewer
	 */
	var onWorldClick = function onWorldClick()
	{
		var ready   = false;
		var element = document.createElement('div');

		var App = new ROBrowser({
			target:        element,
			type:          ROBrowser.TYPE.FRAME,
			application:   ROBrowser.APP.MAPVIEWER,
			development:   Configs.get('development', false),
			api:           true,
			width:         600,
			height:        480,
			version:       Configs.get('version', '')
		});

		// Ressource sharing
		function onMessage(event) {
			if (typeof event.data !== 'object') {
				return;
			}

			switch (event.data.type) {
				case 'SYNC':
					ready = true;
					App.onload();
					break;

				case 'SET_HOST':
				case 'CLEAN_GRF':
					return;

				default:
					Thread.send( event.data.type, event.data.data, function(){
						App._APP.postMessage({
							arguments: Array.prototype.slice.call(arguments, 0),
							uid:       event.data.uid
						}, location.origin);
					});
			}
		}

		// Redirect Thread result to frame
		function threadRedirect( type ) {
			Thread.hook( type, function(data){
				App._APP.postMessage({
					type: type,
					data: data
				}, location.origin );
			});
		}

		// Wait for synchronisation with frame
		function synchronise() {
			if (!ready) {
				App._APP.postMessage({ type: 'init' }, location.origin);
				setTimeout(synchronise, 100);
			}
		}

		return function onWorldClick()
		{
			var ui   = Viewer.ui;
			var path = this.getAttribute('data-path').replace(/\\/g, '/');

			ui.querySelector('#progress').style.display = '';
			element.style.display = 'block';

			// Show iframe
			ui.querySelector('#preview .box').style.top = ((window.innerHeight-480) + 'px'* 0.5 );
			ui.querySelector('#preview').style.display = '';
			ui.querySelector('#progress').style.display = 'none';
			document.body.style.overflow = 'hidden';

			// Unload app
			ui.querySelector('#preview').addEventListener('click', function(){
				ui.querySelector('#preview').style.display = 'none';
				document.body.style.overflow = 'auto';
				element.style.display = 'none';

				App._APP.postMessage({ type:'stop' }, location.origin);
				window.removeEventListener('message', onMessage, false);
			});

			window.addEventListener('message', onMessage, false);

			if (!ready) {
				// Once app is ready
				ui.querySelector('#preview .box').appendChild(element);

				App.start();
				App.onReady = function(){
					App._APP.frameElement.style.border          = '1px solid grey';
					App._APP.frameElement.style.backgroundColor = 'black';

					// Hook Tread Map loading
					threadRedirect('MAP_PROGRESS');
					threadRedirect('MAP_WORLD');
					threadRedirect('MAP_GROUND');
					threadRedirect('MAP_ALTITUDE');
					threadRedirect('MAP_MODELS');

					synchronise();
				};
				App.onload = function() {
					App._APP.postMessage({ type:'load', data:path }, location.origin);
				};
			}
			else {
				App._APP.postMessage({ type:'load', data:path }, location.origin);
			}
		};
	}();


	/**
	 *  User click on text, display it
	 */
	function onTextClick()
	{
		var ui       = Viewer.ui;
		var path     = this.getAttribute('data-path');
		var progress = ui.querySelector('#progress');
		var box      = ui.querySelector('#preview .box');

		progress.style.display = '';

		Client.loadFile( path, function( text ) {
			var pre = document.createElement('pre');
			pre.textContent = text;
			pre.addEventListener('click', function(event){
				event.stopPropagation();
			});
			pre.style.background = 'white';
			pre.style.width = '500px';
			pre.style.display = 'inline-block';
			pre.style.height = '300px';
			pre.style.overflow = 'scroll';
			pre.style.textAlign = 'left';
			pre.style.padding = '10px';

			box.style.top = ((window.innerHeight - 300) / 2) + 'px';
			box.innerHTML = '';
			box.appendChild(pre);

			progress.style.display = 'none';

			var preview = ui.querySelector('#preview');
			preview.style.display = '';
			preview.onclick = function(){
				preview.style.display = 'none';
				var p = box.querySelector('pre');
				if (p) {
					p.remove();
				}
			};
		});
	}



	/**
	 * User click on a Granny model, render it using GrannyModelViewer
	 */
	var onGrannyClick = function onGrannyClickClosure()
	{

		var ready   = false;
		var element = document.createElement('div');

		var App = new ROBrowser({
			target:        element,
			type:          ROBrowser.TYPE.FRAME,
			application:   ROBrowser.APP.GRANNYMODELVIEWER,
			development:   Configs.get('development', false),
			api:           true,
			width:         500,
			height:        400,
			version:       Configs.get('version', '')
		});

		// Ressource sharing
		function onMessage(event) {
			if (typeof event.data !== 'object') {
				return;
			}

			switch (event.data.type) {
				case 'SYNC':
					ready = true;
					App.onload();
					break;

				case 'SET_HOST':
				case 'CLEAN_GRF':
					return;

				default:
					Thread.send( event.data.type, event.data.data, function(){
						App._APP.postMessage({
							arguments: Array.prototype.slice.call(arguments, 0),
							uid:       event.data.uid
						}, location.origin);
					});
			}
		}

		// Wait for synchronisation with frame
		function synchronise() {
			if (!ready) {
				App._APP.postMessage({ type: 'init' }, location.origin);
				setTimeout(synchronise, 100);
			}
		}

		return function onGrannyClick()
		{
			alert('This module is under development.');
			return;
			//UNDER DEVELOPMENT!!!

			var ui    = Viewer.ui;
			var path  = this.getAttribute('data-path').replace(/\\/g, '/');

			// Show iframe
			ui.querySelector('#preview .box').style.top = ((window.innerHeight-400) + 'px'* 0.5 );
			element.style.display = 'block';


			ui.querySelector('#preview').style.display = '';

			// Unload app
			ui.querySelector('#preview').addEventListener('click', function(){
				ui.querySelector('#preview').style.display = 'none';
				element.style.display = 'none';
				App._APP.postMessage({ type:'stop' }, location.origin);
				window.removeEventListener('message', onMessage, false);
			});

			window.addEventListener('message', onMessage, false);

			if (!ready) {
				// Once app is ready
				ui.querySelector('#preview .box').appendChild(element);

				App.start();
				App.onReady = function(){
					App._APP.frameElement.style.border          = '1px solid grey';
					App._APP.frameElement.style.backgroundColor = '#45484d';
					synchronise();
				};
				App.onload = function() {
					App._APP.postMessage({ type:'load', data:path }, location.origin);
				};
			}
			else {
				App._APP.postMessage({ type:'load', data:path }, location.origin);
			}
		};
	}();




	/**
	 * Stored component and return it
	 */
	return UIManager.addComponent(Viewer);
});
