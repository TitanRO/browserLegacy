/**
 * UI/Components/WinPrompt/WinPrompt.js
 *
 * Prompt window
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
	var DB          = require('DB/DBManager');
	var UIManager   = require('UI/UIManager');
	var WinPopup    = require('UI/Components/WinPopup');


	/**
	 * Create Component
	 */
	var WinPrompt = WinPopup.clone('WinPrompt');


	/**
	 * Initialize popup
	 */
	WinPrompt.init = function init()
	{
		this.draggable();
	};


	/**
	 * Ask for something
	 *
	 * @param {string} question to ask
	 * @param {string} first button name
	 * @param {string} second button name
	 * @param {function} callback to execute once the first button is pressed
	 * @param {function} callback to execute once the second button is pressed
	 *
	 */
	WinPrompt.ask = function ask( text, btn_yes, btn_no, onYes, onNo )
	{
		this.ui.querySelector('.text').textContent = text;
		var btns = this.ui.querySelector('.btns');
		btns.innerHTML = '';

		var btnYesEl = document.createElement('button');
		btnYesEl.classList.add('btn');
		btnYesEl.dataset.background = DB.INTERFACE_PATH + 'btn_' + btn_yes + '.bmp';
		btnYesEl.dataset.hover      = DB.INTERFACE_PATH + 'btn_' + btn_yes + '_a.bmp';
		btnYesEl.dataset.down       = DB.INTERFACE_PATH + 'btn_' + btn_yes + '_b.bmp';
		this.parseHTML.call(btnYesEl);
		btnYesEl.addEventListener('click', function(){
			WinPrompt.remove();
			if (onYes) {
				onYes();
			}
		}, { once: true });

		var btnNoEl = document.createElement('button');
		btnNoEl.classList.add('btn');
		btnNoEl.dataset.background = DB.INTERFACE_PATH + 'btn_' + btn_no + '.bmp';
		btnNoEl.dataset.hover      = DB.INTERFACE_PATH + 'btn_' + btn_no + '_a.bmp';
		btnNoEl.dataset.down       = DB.INTERFACE_PATH + 'btn_' + btn_no + '_b.bmp';
		this.parseHTML.call(btnNoEl);
		btnNoEl.addEventListener('click', function(){
			WinPrompt.remove();
			if (onNo) {
				onNo();
			}
		}, { once: true });

		btns.appendChild(btnYesEl);
		btns.appendChild(btnNoEl);

		// Parse
		this.append();
		Array.from(this.ui.querySelectorAll('*')).forEach(this.parseHTML);
	};


	/**
	 * Create component based on view file and export it
	 */
	return UIManager.addComponent(WinPrompt);
});
