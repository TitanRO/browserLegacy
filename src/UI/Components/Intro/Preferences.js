/**
 * UI/Components/Intro/Preferences.js
 *
 * Manage User Preferences
 * *
 * @author Vincent Thibault
 */

define(['Utils/DOM', 'Core/Configs', 'Core/Context', 'Core/Preferences', 'Preferences/Audio', 'Preferences/Graphics'],
function(      DOM,        Configs,        Context,        Preferences,               Audio,               Graphics )
{
	'use strict';


	/**
	 * Preferences structure
	 */
	var _preferences = Preferences.get('Window', {
		serverfile:  'clientinfo.xml',
		serverlist:  [],
		serverdef:   'serverfile',
		save:        true
	}, 1.1 );


	function qs(ui, selector)
	{
		return DOM.qs(ui, selector);
	}


	function qsa(ui, selector)
	{
		return DOM.qsa(ui, selector);
	}


	function dispatchInput(el)
	{
		if (el) {
			el.dispatchEvent(new Event('change', { bubbles: true }));
		}
	}


	function dispatchClick(el)
	{
		if (el) {
			el.dispatchEvent(new Event('click', { bubbles: true }));
		}
	}


	/**
	 * Load preferences
	 *
	 * @param {Element} ui
	 */
	function load( ui )
	{
		if (Graphics.screensize === 'full' && !Context.isFullScreen()) {
			Graphics.screensize = '800x600';
		}

		var screensize = qs(ui, '.screensize');
		var quality = qs(ui, '.quality');
		var clientinfo = qs(ui, '.clientinfo');
		var bgmvol = qs(ui, '.bgmvol');
		var soundvol = qs(ui, '.soundvol');
		var save = qs(ui, '.save');

		if (screensize) {
			screensize.value = Graphics.screensize;
		}

		if (quality) {
			quality.value = Graphics.quality;
			dispatchInput(quality);
		}

		qsa(ui, '.serverdef').forEach(function(el) {
			el.checked = false;
		});

		qsa(ui, '.cursor-options').forEach(function(el) {
			el.checked = Graphics.cursor;
		});

		var serverdef = qs(ui, '.serverdef[value="'+ _preferences.serverdef +'"]');
		if (serverdef) {
			serverdef.checked = true;
			dispatchClick(serverdef);
		}

		if (clientinfo) {
			clientinfo.value = _preferences.serverfile;
		}

		if (bgmvol) {
			bgmvol.value = Audio.BGM.volume * 100;
			dispatchInput(bgmvol);
		}

		if (soundvol) {
			soundvol.value = Audio.Sound.volume * 100;
			dispatchInput(soundvol);
		}

		if (!window.requestFileSystem && !window.webkitRequestFileSystem) {
			Configs.set('saveFiles', false);
			if (save) {
				save.disabled = true;
			}
		}
		else if (!Configs.get('saveFiles')) {
			if (save) {
				save.disabled = true;
			}
		}
		else if (save) {
			save.checked = !!_preferences.saveFiles;
		}

		var i, count;
		var serverlist = _preferences.serverlist;
		var servers = qs(ui, '.servers');
		var element = DOM.createElement(
			'<tr>' +
			'	<td><input type="text" class="display"/></td>'   +
			'	<td><input type="text" class="address"/></td>'   +
			'	<td><input type="text" class="version"/></td>'   +
			'	<td><input type="text" class="langtype"/></td>'  +
			'	<td><input type="text" class="packetver"/></td>' +
			'	<td><button class="btn_delete"></button></td>'   +
			'</tr>'
		);

		if (servers) {
			DOM.empty(servers);

			for (i = 0, count = serverlist.length; i < count; ++i) {
				var server = element.cloneNode(true);

				var display = qs(server, '.display');
				var address = qs(server, '.address');
				var version = qs(server, '.version');
				var langtype = qs(server, '.langtype');
				var packetver = qs(server, '.packetver');

				if (display) {
					display.value = serverlist[i].display;
				}
				if (address) {
					address.value = serverlist[i].address +':'+ serverlist[i].port;
				}
				if (version) {
					version.value = serverlist[i].version;
				}
				if (langtype) {
					langtype.value = serverlist[i].langtype;
				}
				if (packetver) {
					packetver.value = serverlist[i].packetver;
				}

				servers.appendChild(server);
			}
		}


		apply();
	}


	/**
	 * Save preferences
	 *
	 * @param {Element} ui
	 */
	function save( ui )
	{
		var screensize = qs(ui, '.screensize');
		var quality = qs(ui, '.quality');
		var clientinfo = qs(ui, '.clientinfo');
		var bgmvol = qs(ui, '.bgmvol');
		var soundvol = qs(ui, '.soundvol');
		var servers = qs(ui, '.servers');
		var cursorOptions = qsa(ui, '.cursor-options:checked');
		var saveChecked = qsa(ui, '.save:checked');
		var serverdefChecked = qs(ui, '.serverdef:checked');

		Graphics.screensize    = screensize ? screensize.value : Graphics.screensize;
		Graphics.quality       = quality ? quality.value : Graphics.quality;
		Graphics.cursor        = cursorOptions.length ? true : false;
		_preferences.saveFiles = saveChecked.length ? true : false;

		var i, count = servers ? servers.querySelectorAll('tr').length : 0;
		var serverRow;

		if (Configs.get('_serverEditMode')) {
			_preferences.serverdef  = serverdefChecked ? serverdefChecked.value : _preferences.serverdef;
			_preferences.serverfile = clientinfo ? clientinfo.value : _preferences.serverfile;
			_preferences.serverlist = [];

			for (i = 0; i < count; ++i) {
				serverRow = servers.querySelectorAll('tr')[i];
				_preferences.serverlist.push({
					display:   qs(serverRow, '.display').value,
					address:   qs(serverRow, '.address').value.split(':')[0],
					port:      parseInt( qs(serverRow, '.address').value.split(':')[1], 10),
					version:   qs(serverRow, '.version').value,
					langtype:  qs(serverRow, '.langtype').value,
					packetver: qs(serverRow, '.packetver').value
				});
			}
		}

		Audio.BGM.volume    = bgmvol ? bgmvol.value / 100 : Audio.BGM.volume;
		Audio.BGM.play      = Audio.BGM.volume > 0 ? true : false;
		Audio.Sound.volume  = soundvol ? soundvol.value / 100 : Audio.Sound.volume;
		Audio.Sound.play    = Audio.Sound.volume > 0 ? true : false;

        Audio.save();
        Graphics.save();
		_preferences.save();

		apply();
	}


	/**
	 * Apply preferences
	 */
	function apply()
	{
		var isFullScreen = Context.isFullScreen();

		if (Graphics.screensize === 'full') {
			if (!isFullScreen) {
				Context.requestFullScreen();
			}
		}
		else {

			if (isFullScreen) {
				Context.cancelFullScreen();
			}

			if (Context.Is.POPUP) {
				var size = Graphics.screensize.split('x');

				if (size[0] != window.innerWidth && size[1] != window.innerHeight) {
					window.resizeTo( size[0], size[1] );
					window.moveTo( (screen.availWidth - size[0]) / 2, (screen.availHeight - size[1]) / 2 );
				}
			}
		}

		if (Configs.get('_serverEditMode')) {
			if (_preferences.serverdef === 'serverlist') {
				Configs.set('servers', _preferences.serverlist );
			}
			else {
				Configs.set('servers', 'data/' + _preferences.serverfile );
			}
		}

		Configs.set('saveFiles', _preferences.saveFiles);
		Configs.set('quality',   Graphics.quality);
	}


	/**
	 * Export
	 */
	return {
		save: save,
		load: load
	};
});
