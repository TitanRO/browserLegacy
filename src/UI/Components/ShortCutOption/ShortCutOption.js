/**
 * UI/Components/ShortCutOption/ShortCutOption.js
 *
 * Short Cut Settings
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 */
define(function (require) {

	'use strict';
	
	var KEYS = require("Controls/KeyEventHandler");
	var Preferences = require("Core/Preferences");
	var Renderer = require("Renderer/Renderer");
	var UIManager = require("UI/UIManager");
	var UIComponent = require("UI/UIComponent");
	var ShortCutControls = require("Preferences/ShortCutControls");
	var BattleMode = require("Controls/BattleMode");
	var htmlText = require("text!./ShortCutOption.html");
	var cssText = require("text!./ShortCutOption.css");
	var DOM             = require('Utils/DOM');
	
	var ShortCutOption = new UIComponent("ShortCutOption", htmlText, cssText);
	
	var ShortCuts = ShortCutControls.ShortCuts;
	var ShortCutsTemp = {};
	
	ShortCutOption.isCapturing = false;
	
	/**
	 * @var {Preferences} structure
	 */
	var _preferences = Preferences.get("ShortCutOption", {
		x: 300,
		y: 300
	}, 1.0);


	/**
	 * Initialize UI
	 */
	ShortCutOption.init = function () {
		this.ui.querySelector(".close").addEventListener("click", function(){ ShortCutOption.remove(); });
		DOM.addDelegatedEvent(this.ui.querySelector(".tabs"), "click", "button", function () {
			var tab = this.getAttribute('data-index');
			ShortCutOption.ui.querySelector(".selectedtab").classList.remove("selectedtab");
			ShortCutOption.ui.querySelector("."+tab).classList.add("selectedtab");
		});
		this.ui.querySelector("td").addEventListener("click", function () {
			if (this.classList.contains("customize")) {
				ShortCutOption.isCapturing = true;
				document.querySelectorAll("#ShortCutOption td.selected").forEach(function(el) { el.classList.remove("selected"); });
				this.classList.add("selected");
			} else {
				ShortCutOption.isCapturing = false;
				document.querySelectorAll("#ShortCutOption td.selected").forEach(function(el) { el.classList.remove("selected"); });
			}
		});
		
		this.ui.querySelector(".button.reset").addEventListener("click", function(){ resetKeysToDefault(); });
		this.ui.querySelector(".button.ok").addEventListener("click", function(){ applySettings(); });
		this.ui.querySelector(".button.cancel").addEventListener("click", function(){ cancelSettings(); });
		
		updateKeyList();
		this.draggable(this.ui.querySelector(".titlebar"));
	};


	/**
	 * Apply preferences once append to body
	 */
	ShortCutOption.onAppend = function () {
		DOM.setCss(this.ui, {
			top: .5 * (Renderer.height - this.ui.offsetHeight),
			left: .5 * (Renderer.width - this.ui.offsetWidth),
			zIndex: 100
		});
	};


	/**
	 * Remove Inventory from window (and so clean up items)
	 */
	ShortCutOption.onRemove = function () {
		_preferences.x = parseInt(this.ui.style.left, 10);
		_preferences.y = parseInt(this.ui.style.top, 10);
		_preferences.save();
	};


	/**
	 * Process key
	 *
	 * @param {object} key
	 */
	ShortCutOption.onKeyDown = function (event) {
		if (ShortCutOption.isCapturing) {
			if (16 != event.which && 17 != event.which && 18 != event.which) {
				var box = ShortCutOption.ui.querySelector("td.selected");
				
				if ( tempMatch(event.which) ) {
					return alert("Key already assigned!"), false;
				} else if( ShortCuts[box.getAttribute('data-button')] ){
					
					if(event.which == 27){ // Escape
						ShortCutsTemp[box.getAttribute('data-button')] = {};
						ShortCutsTemp[box.getAttribute('data-button')].cust = {};
						ShortCutsTemp[box.getAttribute('data-button')].cust.key = "";
						ShortCutsTemp[box.getAttribute('data-button')].cust.alt = false;
						ShortCutsTemp[box.getAttribute('data-button')].cust.ctrl = false;
						ShortCutsTemp[box.getAttribute('data-button')].cust.shift = false;
					} else {
						ShortCutsTemp[box.getAttribute('data-button')] = {};
						ShortCutsTemp[box.getAttribute('data-button')].cust = {};
						ShortCutsTemp[box.getAttribute('data-button')].cust.key = event.which;
						ShortCutsTemp[box.getAttribute('data-button')].cust.alt = KEYS.ALT;
						ShortCutsTemp[box.getAttribute('data-button')].cust.ctrl = KEYS.CTRL;
						ShortCutsTemp[box.getAttribute('data-button')].cust.shift = KEYS.SHIFT;
					}
					
					box.textContent = (getAlt(box.getAttribute('data-button') ? "ALT + " : "") + (getCtrl(box.getAttribute('data-button')) ? "CTRL + " : "") + (getShift(box.getAttribute('data-button')) ? "SHIFT + " : "") + KEYS.toReadableKey(getKey(box.getAttribute('data-button')), 10));
					
					document.querySelectorAll("#ShortCutOption td.selected").forEach(function(el) {
						el.classList.add("changed");
						el.classList.remove("selected");
					});
					ShortCutOption.isCapturing = false;
				} else {
					console.warn( 'Shortcut "'+box.getAttribute('data-button')+'" is not defined in ShortCutControls' );
					document.querySelectorAll("#ShortCutOption td.selected").forEach(function(el) { el.classList.remove("selected"); });
					ShortCutOption.isCapturing = false;
				}
				event.stopImmediatePropagation();
				return false;
			}
		}
	};

	/**
	 * Updates the key list on the UI
	 */
	function updateKeyList() {
		var $shortcut = ShortCutOption.ui.querySelectorAll("td[data-button]");
		for (var i=0; i < $shortcut.length; i++) {
			if (getKey($shortcut[i].getAttribute('data-button'))) {
				$shortcut[i].textContent = 
					(getAlt($shortcut[i].getAttribute('data-button') ? "ALT + " : "") + 
					(getCtrl($shortcut[i].getAttribute('data-button')) ? "CTRL + " : "") + 
					(getShift($shortcut[i].getAttribute('data-button')) ? "SHIFT + " : "") + 
					KEYS.toReadableKey(parseInt(getKey($shortcut[i].getAttribute('data-button')), 10))
				);
			} else {
				$shortcut[i].textContent = "N/A";
			}
		}
	}
	
	/**
	 * Resets key bindings to initial
	 */
	function resetKeysToDefault() {
		
		Object.keys(ShortCuts).forEach(SC => {
			// Set empty customs
			ShortCutsTemp[SC] = {};
			ShortCutsTemp[SC].cust = false;
			if( ShortCuts[SC].cust != ShortCutsTemp[SC].cust){
				document.querySelector("#ShortCutOption td[data-button='"+SC+"']").classList.add("changed");
			} else {
				document.querySelector("#ShortCutOption td[data-button='"+SC+"']").classList.remove("changed");
			}
		});
		updateKeyList();
	}
	
	/**
	 * Applies the key bindings
	 */
	function applySettings() {
		
		Object.keys(ShortCutsTemp).forEach(SC => {
			// Copy settings
			if (ShortCutsTemp[SC].cust){
				ShortCuts[SC].cust = {};
				ShortCuts[SC].cust.key = ShortCutsTemp[SC].cust.key;
				ShortCuts[SC].cust.alt = ShortCutsTemp[SC].cust.alt;
				ShortCuts[SC].cust.ctrl = ShortCutsTemp[SC].cust.ctrl;
				ShortCuts[SC].cust.shift = ShortCutsTemp[SC].cust.shift;
			} else {
				ShortCuts[SC].cust = false;
			}
		});
		
		ShortCutControls.save();
		BattleMode.reload();
		ShortCutsTemp = {};
		updateKeyList();
		document.querySelectorAll("#ShortCutOption td.changed").forEach(function(el) { el.classList.remove("changed"); });
	}
	
	/**
	 * Cancels the key bindings
	 */
	function cancelSettings() {
		ShortCutsTemp = {};
		updateKeyList();
		document.querySelectorAll("#ShortCutOption td.changed").forEach(function(el) { el.classList.remove("changed"); });
	}

	/**
	 * Get shortcut key setting
	 */
	function getKey(sc) {
		if(ShortCutsTemp[sc]){
			return ShortCutsTemp[sc].cust ? ShortCutsTemp[sc].cust.key : ShortCuts[sc].init.key;
		} else if(ShortCuts[sc]){
			return ShortCuts[sc].cust ? ShortCuts[sc].cust.key : ShortCuts[sc].init.key;
		} else {
			return false;
		}
	}

	/**
	 * Get shortcut alt setting
	 */
	function getAlt(sc) {
		if(ShortCutsTemp[sc]){
			return ShortCutsTemp[sc].cust ? ShortCutsTemp[sc].cust.alt : ShortCuts[sc].init.alt;
		} else if(ShortCuts[sc]){
			return ShortCuts[sc].cust ? ShortCuts[sc].cust.alt : ShortCuts[sc].init.alt;
		} else {
			return false;
		}
	}

	/**
	 * Get shortcut ctrl setting
	 */
	function getCtrl(sc) {
		if(ShortCutsTemp[sc]){
			return ShortCutsTemp[sc].cust ? ShortCutsTemp[sc].cust.ctrl : ShortCuts[sc].init.ctrl;
		} else if(ShortCuts[sc]){
			return ShortCuts[sc].cust ? ShortCuts[sc].cust.ctrl : ShortCuts[sc].init.ctrl;
		} else {
			return false;
		}
	}

	/**
	 * Get shortcut shift setting
	 */
	function getShift(sc) {
		if(ShortCutsTemp[sc]){
			return ShortCutsTemp[sc].cust ? ShortCutsTemp[sc].cust.shift : ShortCuts[sc].init.shift;
		} else if(ShortCuts[sc]){
			return ShortCuts[sc].cust ? ShortCuts[sc].cust.shift : ShortCuts[sc].init.shift;
		} else {
			return false;
		}
	}
	
	
	/**
	 * Checks if there is a match in the temporary settings
	 */
	function tempMatch(key) {
		var TempState = {};
		var match = false;
		
		Object.keys(ShortCuts).forEach(SC => {
			// Copy current settings
			if (ShortCuts[SC].cust){
				TempState[SC] = {};
				TempState[SC].key = ShortCuts[SC].cust.key;
				TempState[SC].alt = ShortCuts[SC].cust.alt;
				TempState[SC].ctrl = ShortCuts[SC].cust.ctrl;
				TempState[SC].shift = ShortCuts[SC].cust.shift;
			} else {
				TempState[SC] = {};
				TempState[SC].key = ShortCuts[SC].init.key;
				TempState[SC].alt = ShortCuts[SC].init.alt;
				TempState[SC].ctrl = ShortCuts[SC].init.ctrl;
				TempState[SC].shift = ShortCuts[SC].init.shift;
			}
		});
		
		Object.keys(ShortCutsTemp).forEach(SC => {
			// Merge temp settings
			if (ShortCutsTemp[SC].cust){
				TempState[SC] = {};
				TempState[SC].key = ShortCutsTemp[SC].cust.key;
				TempState[SC].alt = ShortCutsTemp[SC].cust.alt;
				TempState[SC].ctrl = ShortCutsTemp[SC].cust.ctrl;
				TempState[SC].shift = ShortCutsTemp[SC].cust.shift;
			}
		});
		
		Object.keys(TempState).every(SC => {
			// Find match
			if (TempState[SC]){
				if(
					TempState[SC].key == key &&
					TempState[SC].alt == KEYS.ALT &&
					TempState[SC].ctrl == KEYS.CTRL &&
					TempState[SC].shift == KEYS.SHIFT
				){ 
					match = true;
					return false;
				} else {
					return true;
				}
			}
		});
		
		return match;
	}
	
	return UIManager.addComponent(ShortCutOption);
});
