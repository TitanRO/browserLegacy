/**
 * Utils/DOM.js
 *
 * Native DOM helpers (jQuery migration)
 */
define(function()
{
	'use strict';

	var HTML_WHITELIST = ['font', 'i', 'b'];

	/**
	 * Escape text for safe HTML insertion
	 *
	 * @param {string} text
	 * @returns {string}
	 */
	function escapeHtml(text)
	{
		var div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	/**
	 * Strip disallowed HTML tags; keep whitelist tags (font, i, b).
	 * Replaces jQuery.escape().
	 *
	 * @param {string} text
	 * @returns {string}
	 */
	function sanitizeHtml(text)
	{
		var filtered = document.createElement('div');
		filtered.innerHTML = text;

		filtered.querySelectorAll('*').forEach(function(node) {
			if (HTML_WHITELIST.indexOf(node.tagName.toLowerCase()) === -1) {
				var fragment = document.createDocumentFragment();
				while (node.firstChild) {
					fragment.appendChild(node.firstChild);
				}
				node.parentNode.replaceChild(fragment, node);
			}
		});

		return filtered.innerHTML;
	}

	/**
	 * Format RO client text codes to HTML (^RRGGBB colors, ^nItemID^, newlines).
	 *
	 * @param {string} value
	 * @param {function} getItemInfo - DB.getItemInfo or compatible
	 * @returns {string}
	 */
	function formatRoText(value, getItemInfo)
	{
		var reg, result;
		var txt = sanitizeHtml(String(value));

		reg = /\^([a-fA-F0-9]{6})/;
		while ((result = reg.exec(txt))) {
			txt = txt.replace(result[0], '<span style="color:#' + result[1] + '">') + '</span>';
		}

		reg = /\^nItemID\^(\d+)/g;
		while ((result = reg.exec(txt))) {
			txt = txt.replace(result[0], getItemInfo(result[1]).identifiedDisplayName);
		}

		return txt.replace(/\n/g, '<br/>');
	}

	/**
	 * Set element content with RO text formatting (replaces jQuery.fn.text setter).
	 *
	 * @param {Element} element
	 * @param {string} value
	 * @param {function} getItemInfo
	 */
	function setFormattedText(element, value, getItemInfo)
	{
		if (element) {
			element.innerHTML = formatRoText(value, getItemInfo);
		}
	}

	/**
	 * Parse an HTML string into a single element
	 *
	 * @param {string} html
	 * @returns {Element}
	 */
	function createElement(html)
	{
		var template = document.createElement('template');
		template.innerHTML = html.trim();
		return template.content.firstChild;
	}

	/**
	 * Insert a node after a reference node
	 *
	 * @param {Node} newNode
	 * @param {Node} referenceNode
	 */
	function insertAfter(newNode, referenceNode)
	{
		referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
	}

	/**
	 * Find the nearest .skill element from an event target
	 *
	 * @param {Element} target
	 * @returns {Element|null}
	 */
	function getSkillElement(target)
	{
		return target.closest('.skill');
	}

	/**
	 * Animate element opacity (replaces jQuery.animate for opacity).
	 *
	 * @param {Element} element
	 * @param {number} targetOpacity
	 * @param {number} duration ms
	 * @param {function} [callback]
	 */
	function animateOpacity(element, targetOpacity, duration, callback)
	{
		if (!element) {
			if (callback) {
				callback();
			}
			return;
		}

		element.style.transition = 'opacity ' + duration + 'ms';
		element.style.opacity = String(targetOpacity);

		setTimeout(function() {
			element.style.transition = '';
			if (callback) {
				callback();
			}
		}, duration);
	}

	/**
	 * Fade element out then hide (display:none).
	 *
	 * @param {Element} element
	 * @param {number} [duration=400]
	 */
	function fadeOut(element, duration)
	{
		duration = duration || 400;
		animateOpacity(element, 0, duration, function() {
			element.style.display = 'none';
			element.style.opacity = '';
		});
	}

	/**
	 * Whether an element is rendered (inline or stylesheet display:none).
	 *
	 * @param {Element} element
	 * @returns {boolean}
	 */
	function isDisplayed(element)
	{
		if (!element) {
			return false;
		}

		if (element.style.display === 'none') {
			return false;
		}

		if (typeof window !== 'undefined' && window.getComputedStyle) {
			return window.getComputedStyle(element).display !== 'none';
		}

		return element.offsetParent !== null;
	}

	/**
	 * jQuery :visible — display not none and connected to the document.
	 * UIComponent.remove() detaches nodes but leaves display intact; treat those as hidden.
	 *
	 * @param {Element} element
	 * @returns {boolean}
	 */
	function isVisible(element)
	{
		if (!isDisplayed(element)) {
			return false;
		}

		return element.isConnected !== false;
	}

	/**
	 * Toggle element display between none and block.
	 *
	 * @param {Element} element
	 * @returns {boolean} visible after toggle
	 */
	function toggleDisplay(element)
	{
		if (!element) {
			return false;
		}

		if (isVisible(element)) {
			element.style.display = 'none';
			return false;
		}

		show(element);
		return isVisible(element);
	}

	/**
	 * Position relative to offset parent (jQuery .position()).
	 *
	 * @param {Element} element
	 * @returns {{top: number, left: number}}
	 */
	function getPosition(element)
	{
		var rect = element.getBoundingClientRect();
		var parent = element.offsetParent;

		if (!parent) {
			return { top: rect.top, left: rect.left };
		}

		var parentRect = parent.getBoundingClientRect();
		return {
			top: rect.top - parentRect.top,
			left: rect.left - parentRect.left
		};
	}

	/**
	 * Index among element siblings.
	 *
	 * @param {Element} element
	 * @returns {number}
	 */
	function indexAmongSiblings(element)
	{
		if (!element || !element.parentNode) {
			return -1;
		}

		return Array.prototype.indexOf.call(element.parentNode.children, element);
	}

	/**
	 * Position relative to document (jQuery .offset()).
	 *
	 * @param {Element} element
	 * @returns {{top: number, left: number}}
	 */
	function getOffset(element)
	{
		var rect = element.getBoundingClientRect();
		return {
			top: rect.top + window.scrollY,
			left: rect.left + window.scrollX
		};
	}

	/**
	 * Keep a positioned UI window inside the viewport.
	 * Uses style top/left (offset-parent coords), not getOffset document coords.
	 *
	 * @param {Element} element
	 * @param {number} viewportWidth
	 * @param {number} viewportHeight
	 * @param {{TOP?: boolean, BOTTOM?: boolean, LEFT?: boolean, RIGHT?: boolean}} [magnet]
	 */
	function clampWindowPosition(element, viewportWidth, viewportHeight, magnet)
	{
		if (!element) {
			return;
		}

		var width = element.offsetWidth;
		var height = element.offsetHeight;
		var top = parseInt(element.style.top, 10);
		var left = parseInt(element.style.left, 10);

		if (isNaN(top)) {
			top = 0;
		}
		if (isNaN(left)) {
			left = 0;
		}

		if (top + height > viewportHeight) {
			top = viewportHeight - Math.min(height, viewportHeight);
		}

		if (left + width > viewportWidth) {
			left = viewportWidth - Math.min(width, viewportWidth);
		}

		if (top < 0) {
			top = 0;
		}

		if (left < 0) {
			left = 0;
		}

		if (magnet) {
			if (magnet.TOP) {
				top = 0;
			}
			if (magnet.LEFT) {
				left = 0;
			}
			if (magnet.BOTTOM) {
				top = Math.max(0, viewportHeight - height);
			}
			if (magnet.RIGHT) {
				left = Math.max(0, viewportWidth - width);
			}
		}

		top = Math.min(Math.max(0, top), Math.max(0, viewportHeight - height));
		left = Math.min(Math.max(0, left), Math.max(0, viewportWidth - width));

		element.style.top = top + 'px';
		element.style.left = left + 'px';
	}

	/**
	 * querySelector shorthand
	 *
	 * @param {Element|null} root
	 * @param {string} selector
	 * @returns {Element|null}
	 */
	function qs(root, selector)
	{
		return root ? root.querySelector(selector) : null;
	}

	/**
	 * querySelectorAll as array
	 *
	 * @param {Element|null} root
	 * @param {string} selector
	 * @returns {Element[]}
	 */
	function qsa(root, selector)
	{
		if (!root) {
			return [];
		}

		return Array.prototype.slice.call(root.querySelectorAll(selector));
	}

	function hide(el)
	{
		if (el) {
			el.style.display = 'none';
		}
	}

	function show(el)
	{
		if (!el) {
			return;
		}

		el.style.display = '';

		if (!isDisplayed(el)) {
			el.style.display = 'block';
		}
	}

	function empty(el)
	{
		if (el) {
			el.innerHTML = '';
		}
	}

	var PX_PROPS = /^(top|left|right|bottom|width|height|fontSize|lineHeight|margin|padding|marginTop|marginLeft|marginRight|marginBottom|paddingTop|paddingLeft|paddingRight|paddingBottom|maxWidth|maxHeight|minWidth|minHeight|borderWidth|borderRadius|backgroundSize)$/;

	function toPxString(key, value)
	{
		if (typeof value === 'number' && PX_PROPS.test(key)) {
			return value + 'px';
		}
		return value;
	}

	function setCss(el, prop, value)
	{
		if (!el) {
			return;
		}

		if (typeof prop === 'object') {
			var key;
			for (key in prop) {
				if (Object.prototype.hasOwnProperty.call(prop, key)) {
					el.style[key] = toPxString(key, prop[key]);
				}
			}
			return;
		}

		el.style[prop] = toPxString(prop, value);
	}

	function trigger(el, type)
	{
		if (!el) {
			return;
		}

		el.dispatchEvent(new Event(type, { bubbles: true }));
	}

	/**
	 * Detach element from DOM and return it (jQuery .detach() equivalent).
	 *
	 * @param {Element} el
	 * @returns {Element}
	 */
	function detach(el)
	{
		if (el && el.parentNode) {
			el.parentNode.removeChild(el);
		}
		return el;
	}

	/**
	 * Add delegated event listener (jQuery .on(event, selector, handler) equivalent).
	 * Attaches to `el`, fires `handler` only when event target matches `selector`.
	 *
	 * @param {Element} el - container element
	 * @param {string} event - event name (no namespace)
	 * @param {string} selector - CSS selector for delegation
	 * @param {function} handler - called with `this` = matched element
	 */
	function addDelegatedEvent(el, event, selector, handler)
	{
		el.addEventListener(event, function(e) {
			var target = e.target.closest(selector);
			if (target && el.contains(target)) {
				handler.call(target, e);
			}
		});
	}

	return {
		escapeHtml: escapeHtml,
		sanitizeHtml: sanitizeHtml,
		formatRoText: formatRoText,
		setFormattedText: setFormattedText,
		createElement: createElement,
		insertAfter: insertAfter,
		getSkillElement: getSkillElement,
		animateOpacity: animateOpacity,
		fadeOut: fadeOut,
		isVisible: isVisible,
		toggleDisplay: toggleDisplay,
		getPosition: getPosition,
		getOffset: getOffset,
		clampWindowPosition: clampWindowPosition,
		indexAmongSiblings: indexAmongSiblings,
		qs: qs,
		qsa: qsa,
		hide: hide,
		show: show,
		empty: empty,
		setCss: setCss,
		trigger: trigger,
		detach: detach,
		addDelegatedEvent: addDelegatedEvent
	};
});
