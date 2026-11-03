/**
 * UI/Components/Error/Error.js
 *
 * Error screen
 * Don't use components class, if there is an error on this module will never be used...
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */
define(function( require )
{
	'use strict';


	/**
	 * Dependencies
	 */
	var _htmlText    = require('text!./Error.html');
	var _cssText     = require('text!./Error.css');


	/**
	 * Error Namespace
	 */
	var Error = {};


	/**
	 * Initialize Metaling
	 */
	Error.init = function init()
	{
		var div = document.createElement('div');
		div.innerHTML = _htmlText;
		this.ui = div.firstElementChild || div;

		// Add view to html
		var style = document.querySelector('style');
		if (!style) {
			style = document.createElement('style');
			style.type = 'text/css';
			document.head.appendChild(style);
		}
		style.appendChild(document.createTextNode('\n' + _cssText));
		document.body.innerHTML = '';
		document.body.appendChild(this.ui);

		this.ui.style.backgroundImage = 'url('+ require.toUrl('./angeling.png') +')';
	};


	/**
	 * Add trace info to UI
	 *
	 * @param {Error} error
	 */
	Error.addTrace = function addTrace( error )
	{
		console.error(error);
		var url = requirejs.toUrl(''); // global
		error   = error.stack || error;

		url   = url.replace(/\/([^\/]+)$/g,'/');
		error = error.replace( /\n/g, '<br/>');
		error = error.replace( new RegExp(url,'g'), '');
		error = error.replace( /\?[^\:]+/g,'');

		if (!this.ui) {
			this.init();
		}

		var traceEl = this.ui.querySelector('.trace');
		if (traceEl) {
			traceEl.innerHTML += error + '<br />';
		}
	};


	/**
	 * Stored component and return it
	 */
	return Error;
});
