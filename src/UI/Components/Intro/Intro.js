/**
 * UI/Components/Intro/Intro.js
 *
 * Intro Manager
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */
define(function(require)
{
	'use strict';

	var DOM       = require('Utils/DOM');

	/**
	 * Dependencies
	 */
	var KEYS        = require('Controls/KeyEventHandler');
	var UIManager   = require('UI/UIManager');
	var UIComponent = require('UI/UIComponent');
	var htmlText    = require('text!./Intro.html');
	var cssText     = require('text!./Intro.css');
	var Context     = require('Core/Context');
	var Configs     = require('Core/Configs');
	var Particle    = require('./Particle');
	var Preferences = require('./Preferences');
	var FileSystem  = require('./FileSystem');


	/**
	 * Create Intro component
	 */
	var Intro = new UIComponent( 'Intro', htmlText, cssText );


	/**
	 * @var {FileList}
	 */
	Intro.files = [];


	/**
	 * Manage Escape key to exit
	 */
	Intro.onKeyDown = function OnKeyDown( event )
	{
		// Exit fullScreen mode
		if (event.which === KEYS.ESCAPE) {

			if (Context.isFullScreen()) {
				Context.cancelFullScreen();
			}

			event.stopImmediatePropagation();
			return false;
		}

		return true;
	};


	/**
	 * Initialize Metaling
	 */
	Intro.init = function init()
	{
		if (!Configs.get('servers')) {
			Configs.set('_serverEditMode', true);
		}

		var ui = this.ui;

		preloadImages();

		// About page
		ui.querySelector('.btn_about')
			.addEventListener('mousedown', function(){
				var $about =  ui.querySelector('.overlay.about');
				$about
					.style.display = ''
					.animate({opacity:1}, 200)
					.addEventListener('click', function(){
						$about.animate({opacity:0}, 200, function(){
							$about.style.display = 'none';
						});
					});
			});

		// Settings page
		ui.querySelector('.btn_settings')
			.addEventListener('mousedown', function(){
				Preferences.load( ui );

				ui.querySelector('.overlay.settings')
					.style.display = ''
					.animate({opacity:1}, 200);
			});

		// Box to set files
		var _fileBox = ui.querySelector('.box');
		_fileBox.addEventListener('mouseover', function(){
			this.classList.add('over');
		});
		_fileBox.addEventListener('mouseout', function(){
			this.classList.remove('over');
		});
		_fileBox.addEventListener('click', function(){
			ui.querySelector('input[type="file"]').click();
		});
		_fileBox.addEventListener('drop', process);
		_fileBox.addEventListener('dragover', function(){
			this.classList.add('over');
			return false;
		});
		_fileBox.addEventListener('dragleave', function(){
			this.classList.remove('over');
			return false;
		});

		// Set file by clicking the box
		ui.querySelector('input[type="file"]')
			.addEventListener('change', process );

		// Modify quality
		ui.querySelector('.quality')
			.addEventListener('change', function(){
				ui.querySelector('.quality_result').textContent =  this.value + '%' ;
			});

		// Clean cache
		ui.querySelector('.clean')
			.addEventListener('click', function(){
				var parent = this.style.display = 'none'.parentNode;
				parent.insertAdjacentHTML('beforeend',
					'<span><img src="'+ require.toUrl('./images/loading.gif')  +'"/> <i>Cleaning cache...</i></span>'
				);

				FileSystem.cleanup(function(){
					var loading = parent.querySelector('span');
					if (loading) {
						loading.remove();
					}
					Intro.ui.querySelector('.msg').textContent = '';
				});
			});

		// Stop propagation in overlay to avoid hiding the page
		DOM.addDelegatedEvent(ui.querySelector('.overlay'), 'click', 'input[type="text"], a, button', function( event ){
			if (this.nodeName === 'INPUT') {
				this.select();
			}
			event.stopImmediatePropagation();
		});

		// Not allow to edit server list
		if (!Configs.get('_serverEditMode')) {
			ui.querySelector('.serveredit').style.display = 'none';
		}

		// Modify volume
		ui.querySelector('.bgmvol')
			.addEventListener('change', function(){
				ui.querySelector('.bgmvol_result').textContent =  this.value + '%' ;
			});
		ui.querySelector('.soundvol')
			.addEventListener('change', function(){
				ui.querySelector('.soundvol_result').textContent =  this.value + '%' ;
			});

		// Add Server
		ui.querySelector('.btn_add')
			.addEventListener('click', function(){
				var $serverlist = ui.querySelector('.servers');
				var count = $serverlist.querySelector('tr');
				$serverlist.insertAdjacentHTML('beforeend',
					'<tr>' +
					'	<td><input type="text" class="display" value="Server '+ count +'"/></td>' +
					'	<td><input type="text" class="address" value="127.0.0.1:6900"/></td>' +
					'	<td><input type="text" class="version"value="22"/></td>' +
					'	<td><input type="text" class="langtype" value="12"/></td>' +
					'	<td><input type="text" class="packetver"value="auto"/></td>' +
					'	<td><button class="btn_delete"></button></td>' +
					'</tr>'
				);

				$serverlist.querySelectorAll('tr  input')[count].focus();
			});

		ui.querySelector('.btn_save')
			.addEventListener('click', function(){
				Preferences.save( ui );
				ui.querySelector('.overlay')
					.animate({opacity:0}, 200, function(){
						ui.querySelector('.overlay').style.display = 'none';
					});
			});

		DOM.addDelegatedEvent(ui.querySelector('.serverlist tbody'), 'click', '.btn_delete', function(){
			var row = this.parentNode && this.parentNode.parentNode;
			if (row) row.remove();
		});

		// Start roBrowser
		ui.querySelector('.btn_play')
			.addEventListener('click', function(){
				ui.querySelector('.overlay.loading')
					.style.display = ''
					.animate({opacity:1}, 200);

				Intro.onFilesSubmit( Intro.files );
			});
	};


	/**
	 * Once append to body
	 */
	Intro.onAppend = function onAppend()
	{
		// Can't resize the window if it's not a popup/App
		if (!Context.Is.POPUP) {
			this.ui.querySelector('.resolution').style.display = 'none';
		}

		// Show content saved
		this.ui.querySelector('.clean').style.display = 'none';
		FileSystem.getSize(function(used){
			var msg = '';

			if (used) {
				if (used > 1024 * 1024 * 1024) {
					msg = (used / 1024 / 1024 / 1024).toFixed(2) + ' GiB saved';
				}
				else if (used > 1024 * 1024) {
					msg = (used / 1024 / 1024).toFixed(2) + ' MiB saved';
				}
				else {
					msg = (used / 1024).toFixed(2) + ' KiB saved';
				}

				this.ui.querySelector('.msg').textContent = msg;
				this.ui.querySelector('.clean').style.display = '';
			}
		}.bind(this));

		// Hook resize
		var $intro  = this.ui.querySelector('.intro');
		var _introResizeHandler = function(){
			$intro.style.transform = 'scale('+
				window.innerWidth  / $intro.offsetWidth  +
				',' +
				window.innerHeight / $intro.offsetHeight +
			')';
		};
		window.addEventListener('resize', _introResizeHandler);
		_introResizeHandler(); // trigger initial

		// Initialize window and particle
		Particle.init( 100, this.ui.querySelector('canvas') );
	};


	/**
	 * Once removed
	 */
	Intro.onRemove = function onRemove()
	{
		window.removeEventListener('resize', _introResizeHandler);
		Particle.stop();
		this.ui.querySelector('.overlay').style.display = 'none';
	};


	/**
	 * Start loading images
	 */
	function preloadImages()
	{
		// Background images
		var _styleEl = document.querySelector('style') || document.head.appendChild(document.createElement('style'));
		_styleEl.textContent += [
			'#intro .intro { background-image:url(' + require.toUrl('./images/background.jpg') + '); }',
			'#intro .ribbon { background-image:url(' + require.toUrl('./images/ribbon.png') + '); }',
			'#intro .box { background-image:url(' + require.toUrl('./images/box.jpg') + '); }',
			'#intro .btn_play { background-image:url(' + require.toUrl('./images/play.png') + '); }',
			'#intro .btn_play:hover { background-image:url(' + require.toUrl('./images/play-down.png') + '); }',
			'#intro .btn_add { background-image:url('+ require.toUrl('./images/add-server.jpg') +'); }',
			'#intro .btn_save { background-image:url('+ require.toUrl('./images/save.jpg') + '); }',
			'#intro .btn_delete { background-image:url('+ require.toUrl('./images/delete.png') + '); }'
		].join('\n');

		// Add images to IMG tag
		Intro.ui.querySelector('.icon img').setAttribute('src', require.toUrl('./images/icon.png') );
		Intro.ui.querySelector('.btn_about img').setAttribute('src', require.toUrl('./images/about.png') );
		Intro.ui.querySelector('.btn_settings img').setAttribute('src', require.toUrl('./images/settings.png') );

		// Preload image
		(new Image()).src = require.toUrl('./images/play-down.png');
	}


	/**
	 * User submit files, get back files
	 * @param {object} event
	 * @return {boolean} false
	 */
	function process( event )
	{
		var i, count;

		var _dir_count   = 0;
		var _dir_loaded  = 0;
		var _file_count  = 0;
		var _file_loaded = 0;
		var _files       = [];

		event.stopImmediatePropagation();
		this.classList.remove('over');

		function processing(files) {
			if (files.length) {
				Intro.files.push.apply( Intro.files, files );
				Intro.ui.querySelector('.msg').textContent =  Intro.files.length + ' files selected' ;
			}
		}

		// Extract files from directory
		function recursiveReader(entry, skip){
			if (entry.isFile) {
				++_file_count;
				entry.file(function(file){
					file.fullPath = entry.fullPath.substr(skip); // get rid of the "/"
					_files.push(file);
					if ((++_file_loaded) === _file_count && _dir_loaded === _dir_count) {
						processing(_files);
					}
				});
			}
			else if (entry.isDirectory) {
				++_dir_count;
				entry.createReader().readEntries(function(entries){
					for (var i = 0, count = entries.length; i < count; ++i) {
						recursiveReader(entries[i], skip);
					}
					if ((++_dir_loaded) === _dir_count && _file_loaded === _file_count) {
						processing(_files);
					}
				});
			}
		}

		// input[type="file"]
		if ('files' in this) {

			// In wekit we select the folder, not files.
			// we have to rewrite the relativePath to remove the main folder from it
			if (this.files.length) {
				var token = 'webkitRelativePath' in this.files[0] ? 'webkitRelativePath' :
				                  'relativePath' in this.files[0] ?       'relativePath' :
				                                                           null;
				if (token) {
					count = this.files.length;
					var baseFolder = /^[^(\/|\\)]+(\/|\\)/;

					for (i = 0; i < count; ++i) {
						this.files[i].fullPath = this.files[i][token].replace(baseFolder, '');
					}
				}
			}

			processing(this.files);
			return false;
		}

		// drag drop
		if (event.dataTransfer) {
			var data = event.dataTransfer;

			// Read directory content
			if (data.items && data.items.length && data.items[0].webkitGetAsEntry) {

				// If select a directory, have to remove the root folder for all files
				// inside this directory
				var skip  = 1;
				var entry = data.items[0].webkitGetAsEntry();
				if (data.items.length === 1 && entry.isDirectory) {
					skip = entry.fullPath.split('/')[1].length + 2;
				}

				for (i = 0, count = data.items.length; i < count; ++i) {
					recursiveReader( data.items[i].webkitGetAsEntry(), skip);
				}

				return false;
			}
			// Read files directly
			else if (data.files) {
				processing(data.files);
				return false;
			}
		}

		processing(_files);
		return false;
	}


	/**
	 * Callback to used.
	 */
	Intro.onFilesSubmit = function OnFilesSubmit(){};


	/**
	 * Stored component and return it
	 */
	return UIManager.addComponent(Intro);
});
