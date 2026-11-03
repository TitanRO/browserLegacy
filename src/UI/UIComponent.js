/**
 * UI/UIComponent.js
 *
 * Manage Component
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */
define(function( require )
{
	'use strict';


	// Load dependencies
	var DOM       = require('Utils/DOM');
	var Cursor    = require('./CursorManager');
	var DB        = require('DB/DBManager');
	var Client    = require('Core/Client');
	var Events    = require('Core/Events');
	var Mouse     = require('Controls/MouseEventHandler');
	var Session   = require('Engine/SessionStorage');
	var Targa     = require('Loaders/Targa');
	var Renderer  = require('Renderer/Renderer');
	var getModule = require;


	var CommonCSS = require('text!./Common.css');


	/**
	 * @var {Element} global style element
	 */
	var _style = document.querySelector('style');
	if (!_style) {
		_style = DOM.createElement('<style type="text/css"></style>');
		document.head.appendChild(_style);
	}
	_style.textContent += CommonCSS;


	var _keyDownHandlers = [];
	var _keyDownInitialized = false;


	function initKeyDownDispatcher()
	{
		if (_keyDownInitialized) {
			return;
		}

		_keyDownInitialized = true;
		window.addEventListener('keydown', function(event) {
			var stopped = false;
			var origStop = event.stopImmediatePropagation;

			event.stopImmediatePropagation = function() {
				stopped = true;
				origStop.call(event);
			};

			for (var i = 0; i < _keyDownHandlers.length; i++) {
				_keyDownHandlers[i].handler(event);
				if (stopped) {
					break;
				}
			}
		});
	}


	function toElement(el)
	{
		if (!el) {
			return null;
		}

		if (el.nodeType === 1) {
			return el;
		}

		if (el[0] && el[0].nodeType === 1) {
			return el[0];
		}

		if (typeof el === 'string') {
			return document.querySelector(el);
		}

		return el;
	}


	function walkElements(root, callback)
	{
		callback.call(root, root);
		root.querySelectorAll('*').forEach(function(el) {
			callback.call(el, el);
		});
	}


	function setStyle(element, props)
	{
		var key;

		for (key in props) {
			if (Object.prototype.hasOwnProperty.call(props, key)) {
				element.style[key] = props[key];
			}
		}
	}


	/**
	 * Create a component
	 *
	 * @param {string} name
	 * @param {string} htmlText content
	 * @param {string} cssText content
	 */
	function UIComponent( name, htmlText, cssText )
	{
		this.name      = name;
		this._htmlText = htmlText || null;
		this._cssText  = cssText  || null;
		this.magnet = {
			TOP: false,
			BOTTOM: false,
			LEFT: false,
			RIGHT: false
		};
	}


	/**
	 * @var {enum} Mouse mode
	 */
	UIComponent.MouseMode = {
		CROSS:  0, // cross the ui and intersect with scene
		STOP:   1, // don't intersect the scene if mouse over the ui
		FREEZE: 2  // don't intersect the scene if ui is alive in scene
	};


	/**
	 * @var {number} mouse behavior
	 */
	UIComponent.prototype.mouseMode = UIComponent.MouseMode.STOP;


	/**
	 * @var {boolean} is Component ready ?
	 */
	UIComponent.prototype.__loaded = false;


	/**
	 * @var {boolean} is Component active ?
	 */
	UIComponent.prototype.__active = false;


	/**
	 * @var {boolean} focus element zIndex ?
	 */
	UIComponent.prototype.needFocus = true;


	UIComponent._registerKeyDown = function _registerKeyDown(component, handler)
	{
		initKeyDownDispatcher();
		UIComponent._unregisterKeyDown(component);
		_keyDownHandlers.push({ component: component, handler: handler });
	};


	UIComponent._unregisterKeyDown = function _unregisterKeyDown(component)
	{
		_keyDownHandlers = _keyDownHandlers.filter(function(entry) {
			return entry.component !== component;
		});
	};


	/**
	 * Move a component's keydown handler to the front of the dispatch queue.
	 *
	 * @param {UIComponent} component
	 */
	UIComponent.prioritizeKeyDown = function prioritizeKeyDown(component)
	{
		var idx = -1;
		var i;

		for (i = 0; i < _keyDownHandlers.length; i++) {
			if (_keyDownHandlers[i].component === component) {
				idx = i;
				break;
			}
		}

		if (idx > 0) {
			var entry = _keyDownHandlers.splice(idx, 1)[0];
			_keyDownHandlers.unshift(entry);
		}
	};


	/**
	 * Prepare the component to be used
	 */
	UIComponent.prototype.prepare = function prepare()
	{
		if (this.__loaded) {
			return;
		}

		if (this._htmlText) {
			this.ui = DOM.createElement(this._htmlText);
			this.ui.style.zIndex = '50';
		}

		// Add style to view
		if (this._cssText) {
			// Avoid adding css each time the same component is created
			var marker = '\n\n/** ' + this.name + ' **/\n';
			if (_style.textContent.indexOf(marker) === -1) {
				_style.textContent += marker + this._cssText;
			}
			// Some components (e.g. StatusIcons) create this.ui in init() instead of from htmlText
			if (this.ui) {
				document.body.appendChild(this.ui);
			}
		}

		// Prepare html
		if (this._htmlText) {
			walkElements(this.ui, this.parseHTML);
		}

		// Initialize
		if (this.init) {
			this.init();
		}

		// If the ui don't allow to be crossed by mouse to intersect the scene then
		// _enter variable is here to fix a recurrent bug in mouseenter and mouseleave
		// when mouseenter can be triggered multiples time
		if (this.mouseMode === UIComponent.MouseMode.STOP) {
			var _intersect, _enter = 0;
			var element = toElement(this.__mouseStopBlock) || this.ui;

			// stop intersection
			element.addEventListener('mouseenter', function(){
				if (_enter === 0) {
					_intersect = Mouse.intersect;
					_enter++;
					if (_intersect) {
						Mouse.intersect = false;
						Cursor.setType( Cursor.ACTION.DEFAULT );
						getModule('Renderer/EntityManager').setOverEntity(null);
					}
				}
			});

			// restore previous state
			element.addEventListener('mouseleave', function(){
				if (_enter > 0) {
					_enter--;

					if(_enter === 0 && _intersect) {
						if(!Session.FreezeUI){
							Mouse.intersect = true;
						}
						getModule('Renderer/EntityManager').setOverEntity(null);
					}
				}
			});

			// Custom fix for firefox, mouseleave isn't trigger when element is
			// removed from body, test case: http://jsfiddle.net/7h4sj/
			element.addEventListener('x_remove', function(){
				if (_enter > 0) {
					_enter = 0;
					if(_intersect) {
						Mouse.intersect = true;
						getModule('Renderer/EntityManager').setOverEntity(null);
					}
				}
			});

			// Focus the UI on mousedown
			element.addEventListener('mousedown', this.focus.bind(this));
		}

		if (this.mouseMode !== UIComponent.MouseMode.CROSS) {
			var touchElement = toElement(this.__mouseStopBlock) || this.ui;
			// Do not cross
			touchElement.addEventListener('touchstart', function(event){
				event.stopImmediatePropagation();
			});
		}


		if (this._htmlText && this.ui.parentNode) {
			this.ui.parentNode.removeChild(this.ui);
		}

		this.__loaded = true;
	};


	/**
	 * Remove a component from HTML
	 */
	UIComponent.prototype.remove = function remove()
	{
		this.__active = false;

		if (this.__loaded && this.ui && this.ui.parentNode) {
			if (this.onRemove) {
				this.onRemove();
			}

			if (this.onKeyDown) {
				UIComponent._unregisterKeyDown(this);
			}

			this.ui.dispatchEvent(new CustomEvent('x_remove'));
			this.ui.parentNode.removeChild(this.ui);

			if (this.mouseMode === UIComponent.MouseMode.FREEZE) {
				Mouse.intersect = true;
				Session.FreezeUI = false;
			}
		}
	};


	/**
	* Add the component to HTML
	*
	* @param {string|Element} [target] - Target element to append the UI to. If not provided, appends to body.
	*/
	UIComponent.prototype.append = function append(target)
	{
		this.__active = true;

		if (!this.__loaded) {
			this.prepare();

			if (this.__active) {
				this.append(target);
			}

			return;
		}

		var targetEl;

		if (target) {
			targetEl = toElement(target);
			if (!targetEl) {
				console.error("Error: Unable to find target element for appending UI.");
				return;
			}
		} else {
			targetEl = document.body;
		}

		if (!this.ui) {
			console.error('Error: Component UI element not created for ' + this.name + '.');
			return;
		}

		targetEl.appendChild(this.ui);

		if (this.onKeyDown) {
			if (!this._boundKeyDown) {
				this._boundKeyDown = this.onKeyDown.bind(this);
			}
			UIComponent._registerKeyDown(this, this._boundKeyDown);
		}

		if (this.mouseMode === UIComponent.MouseMode.FREEZE) {
			Mouse.intersect = false;
			Session.FreezeUI = true;
			Cursor.setType( Cursor.ACTION.DEFAULT );
		}

		if (this.onAppend) {
			this.onAppend();
		}

		// Fix position after append (screen changed since last save)
		if (this.ui) {
			DOM.clampWindowPosition(this.ui, Renderer.width, Renderer.height, this.magnet);
		}

		this.focus();
	};


	/**
	 * Focus the UI
	 * (stay at the top of others)
	 */
	UIComponent.prototype.focus = function focus()
	{
		if (!this.manager || !this.needFocus) {
			return;
		}

		var components = this.manager.components;
		var name, zIndex, list = [];
		var i, count, j;

		// Store components zIndex in a list
		for (name in components) {
			if (this !== components[name] && components[name].__active && components[name].needFocus && components[name].ui) {
				zIndex = parseInt(components[name].ui.style.zIndex, 10);
				list[zIndex-50] = zIndex;
			}
		}

		// Re-organize it to have a linear zIndex order (remove gap)
		for (i = 0, j = 0, count = list.length; i < count; ++i) {
			if (!list[i]) {
				j++;
				continue;
			}
			list[i] -= j;
		}

		// Apply new zIndex to list
		for (name in components) {
			if (this !== components[name] && components[name].__active && components[name].needFocus && components[name].ui) {
				zIndex = parseInt(components[name].ui.style.zIndex, 10);
				components[name].ui.style.zIndex = String(list[zIndex-50]);
			}
		}

		// Push our zIndex at top
		this.ui.style.zIndex = String(list.length + 50 - j);
	};

	
	/**
	 * add UI at the top of others
	 */
	UIComponent.prototype.placeOnTop = function placeOnTop()
	{
		if (!this.manager) {
			return;
		}

		var components = this.manager.components;
		var name, zIndex, list = [];

		// Store components zIndex in a list
		for (name in components) {
			if (this !== components[name] && components[name].__active && components[name].ui) {
				zIndex = parseInt(components[name].ui.style.zIndex, 10);
				list.push(zIndex);
			}
		}
		var lastZIndex = Math.max.apply(null, list);
		this.ui.style.zIndex = String(lastZIndex + 1);
	};

	/**
	 * Clone a component
	 *
	 * @param {string} name - new component name
	 */
	UIComponent.prototype.clone = function clone( name, full )
	{
		var ui = new UIComponent( name, this._htmlText, this._cssText );

		if (full) {
			var keys = Object.keys(this);
			var i, count = keys.length;

			for (i = 0; i < count; ++i) {
				ui[ keys[i] ] = this[ keys[i] ];
			}
		}

		return ui;
	};


	/**
	 * Enable a type (keydown is the only one supported yet)
	 *
	 * @param {string} type to enable
	 */
	UIComponent.prototype.on = function on( type )
	{
		switch (type.toLowerCase()) {
			case 'keydown':
				if (this.onKeyDown) {
					if (!this._boundKeyDown) {
						this._boundKeyDown = this.onKeyDown.bind(this);
					}
					UIComponent._registerKeyDown(this, this._boundKeyDown);
				}
				break;
		}
	};


	/**
	 * Disable a type (keydown is the only one supported yet)
	 *
	 * @param {string} type to disable
	 */
	UIComponent.prototype.off = function off( type )
	{
		switch (type.toLowerCase()) {
			case 'keydown':
				UIComponent._unregisterKeyDown(this);
				break;
		}
	};


	/**
	 * Drag an element
	 */
	UIComponent.prototype.draggable = function draggable( element )
	{
		var container = this.ui;
		var component = this;
		var dragTimer = null;

		// Global variable
		if (!element) {
			element = this.ui;
		}
		else {
			element = toElement(element);
		}

		function onMouseUp(event) {
			if (event.type === 'touchend' || event.which === 1) {
				DOM.animateOpacity(container, 1.0, 500);
				if (dragTimer !== null) {
					Events.clearTimeout(dragTimer);
					dragTimer = null;
				}
				window.removeEventListener('mouseup', onMouseUp);
				window.removeEventListener('touchend', onMouseUp);
			}
		}

		// Drag drop stuff
		element.addEventListener('mousedown', onDragStart);
		element.addEventListener('touchstart', onDragStart);

		function onDragStart(event) {
			if (event.type === 'touchstart') {
				Mouse.screen.x = event.touches[0].pageX;
				Mouse.screen.y = event.touches[0].pageY;
			}

			// Only on left click
			else if (event.which !== 1) {
				return;
			}

			var x, y, width, height;
			var pos = DOM.getPosition(container);
			x      = pos.left - Mouse.screen.x;
			y      = pos.top  - Mouse.screen.y;
			width  = container.offsetWidth;
			height = container.offsetHeight;

			if (dragTimer !== null) {
				Events.clearTimeout(dragTimer);
			}
			dragTimer = Events.setTimeout(dragging, 15);

			window.addEventListener('mouseup', onMouseUp);
			window.addEventListener('touchend', onMouseUp);

			function dragging() {
				var x_      = Mouse.screen.x + x;
				var y_      = Mouse.screen.y + y;
				var opacity = parseFloat(container.style.opacity || 1) - 0.02;

				if(component.magnet){
					component.magnet.TOP = false;
					component.magnet.BOTTOM = false;
					component.magnet.LEFT = false;
					component.magnet.RIGHT = false;
				}

				// Magnet on border
				if (Math.abs(x_) < 10) {
					x_ = 0;
					if(component.magnet){
						component.magnet.LEFT = true;
					}
				}
				if (Math.abs(y_) < 10) {
					y_ = 0;
					if(component.magnet){
						component.magnet.TOP = true;
					}
				}

				if (Math.abs((x_ + width) - Mouse.screen.width) < 10) {
					x_ = Mouse.screen.width - width;
					if(component.magnet){
						component.magnet.RIGHT = true;
					}
				}

				if (Math.abs((y_ + height) - Mouse.screen.height) < 10) {
					y_ = Mouse.screen.height - height;
					if(component.magnet){
						component.magnet.BOTTOM = true;
					}
				}

				setStyle(container, { top: y_ + 'px', left: x_ + 'px', opacity: String(Math.max(opacity, 0.7)) });
				dragTimer = Events.setTimeout(dragging, 15);
			}
		}

		return this;
	};


	/**
	 * Apply parseHTML to a DOM subtree (root + descendants).
	 * parseHTML uses the element as `this`; do not use parseHTML.bind(component).
	 *
	 * @param {Element} root
	 */
	UIComponent.prototype.parseElementTree = function parseElementTree(root)
	{
		if (!root) {
			return;
		}

		walkElements(root, this.parseHTML);
	};


	/**
	 * Parse a component html view (data-* attributes)
	 */
	UIComponent.prototype.parseHTML = function parseHTML()
	{
		var node       = this;
		var background = node.dataset.background;
		var preload    = node.dataset.preload;
		var hover      = node.dataset.hover;
		var down       = node.dataset.down;
		var msgId      = node.dataset.text;

		var preloads, i, count;

		var bg_uri    = null;
		var hover_uri = null;

		// text
		if (msgId && DB.getMessage(msgId, '')) {
			DOM.setFormattedText(node, DB.getMessage(msgId, ''), DB.getItemInfo.bind(DB));
		}

		// Default background
		if (background) {
			Client.loadFile( DB.INTERFACE_PATH + background, function(dataURI) {
				bg_uri = dataURI;
				if (dataURI instanceof ArrayBuffer) {
					try {
						var tga = new Targa();
						tga.load( new Uint8Array(dataURI) );
						bg_uri = tga.getDataURL();
					}
					catch(e) {
						console.error( e.message );
					}
				}
				node.style.backgroundImage = 'url(' + bg_uri + ')';
			});
		}

		// On mouse over
		if (hover) {
			Client.loadFile( DB.INTERFACE_PATH + hover, function(dataURI){
				hover_uri = dataURI;
				node.addEventListener('mouseover', function(){ this.style.backgroundImage = 'url(' + hover_uri + ')'; });
				node.addEventListener('mouseout', function(){ this.style.backgroundImage = bg_uri ? 'url(' + bg_uri + ')' : ''; });
			});
		}

		// On mouse down
		if (down) {
			Client.loadFile( DB.INTERFACE_PATH + down, function(dataURI){
				node.addEventListener('mousedown', function(event){ this.style.backgroundImage = 'url(' + dataURI + ')'; event.stopImmediatePropagation(); });
				node.addEventListener('mouseup', function(){ this.style.backgroundImage = 'url(' + (hover_uri||bg_uri) + ')'; });
			});

			if (!hover) {
				node.addEventListener('mouseout', function(){ this.style.backgroundImage = bg_uri ? 'url(' + bg_uri + ')' : ''; });
			}
		}

		// Preload images ?
		if (preload) {
			preloads = preload.split(';');
			for (i = 0, count = preloads.length; i < count; ++i) {
				preloads[i] = DB.INTERFACE_PATH + String(preloads[i]).trim();
			}
			Client.loadFiles( preloads );
		}
	};


	/**
	 * Export
	 */
	return UIComponent;
});
