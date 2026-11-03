#!/usr/bin/env node
/**
 * Comprehensive jQuery → Native DOM migration script
 * Handles common patterns found across UI component files
 *
 * Run: node scripts/jquery-to-dom.js src/UI/Components/Foo/Foo.js [...]
 */
'use strict';

var fs = require('fs');

var filesToMigrate = process.argv.slice(2);
if (!filesToMigrate.length) {
	console.error('Usage: node jquery-to-dom.js <file> [...]');
	process.exit(1);
}

/**
 * Main migration function
 * Applies safe, pattern-based replacements
 */
function migrateFile(code) {
	var original = code;

	// =========================================================
	// 1. REMOVE jQuery REQUIRE LINE
	// =========================================================
	// Handles: var jQuery = require('Utils/jquery');
	//          var $ = require("Utils/jquery");
	//          var jQuery    =   require('Utils/jquery');
	code = code.replace(/^[ \t]*var\s+(\$|jQuery)\s*=\s*require\(['"]Utils\/jquery['"]\);?\s*\n/gm, '');

	// =========================================================
	// 2. Replace this.ui.draggable() → this.draggable()
	// (UIComponent.prototype.draggable exists; this.ui.draggable() is jQuery UI)
	// =========================================================
	code = code.replace(/this\.ui\.draggable\(\)/g, 'this.draggable()');

	// =========================================================
	// 3. Replace jQuery(this) → this (inside event handlers)
	// Replace $(this). → this.
	// =========================================================
	code = code.replace(/jQuery\(this\)\./g, 'this.');
	code = code.replace(/\$\(this\)\./g, 'this.');

	// =========================================================
	// 4. Replace jQuery.extend({}, x) → Object.assign({}, x)
	// =========================================================
	code = code.replace(/jQuery\.extend\(\{\}\s*,\s*/g, 'Object.assign({}, ');
	code = code.replace(/\$\.extend\(\{\}\s*,\s*/g, 'Object.assign({}, ');

	// =========================================================
	// 5. Replace jQuery.trim(x) → (x).trim()
	// =========================================================
	code = code.replace(/jQuery\.trim\(([^)]+)\)/g, '($1).trim()');

	// =========================================================
	// 6. Replace jQuery('<tag>') → document.createElement('tag')
	// Handles: jQuery('<div>'), jQuery('<div/>'), jQuery('<span>')
	// =========================================================
	// jQuery('<tag>') or jQuery('<tag/>') → document.createElement('tag')
	code = code.replace(/(?:jQuery|\$)\('<([a-zA-Z][a-zA-Z0-9]*)(?:\/?)>'\)/g, function(match, tag) {
		return 'document.createElement(\'' + tag + '\')';
	});
	code = code.replace(/(?:jQuery|\$)\("<([a-zA-Z][a-zA-Z0-9]*)(?:\/?)>"\)/g, function(match, tag) {
		return 'document.createElement(\'' + tag + '\')';
	});

	// =========================================================
	// 7. Replace jQuery(nativeVariable) → nativeVariable
	// When wrapping a variable that's already an Element
	// jQuery(this.canvas) → this.canvas
	// jQuery(this.element) → this.element
	// =========================================================
	code = code.replace(/(?:jQuery|\$)\((this\.\w+)\)/g, '$1');

	// =========================================================
	// 8. Replace .find('sel') → .querySelector('sel')
	// This is the most common and safe transformation
	// =========================================================
	// Simple string selector
	code = code.replace(/\.find\((['"][^'"]+['"])\)/g, '.querySelector($1)');
	// Variable selector: .find(varName) → .querySelector(varName)
	code = code.replace(/\.find\((\w+)\)/g, '.querySelector($1)');

	// =========================================================
	// 9. Replace .each(fn)
	// CANNOT safely replace all - leave them for manual fix
	// But handle common: querySelectorAll().forEach() instead
	// =========================================================
	// If we had .querySelectorAll(sel).each(fn) → already converted by find→querySelector
	// For now, leave .each() calls - they need manual review

	// =========================================================
	// 10. Replace .addClass('cls') → .classList.add('cls')
	// =========================================================
	code = code.replace(/\.addClass\((['"][^'"]*['"])\)/g, '.classList.add($1)');
	// With variable
	code = code.replace(/\.addClass\((\w+)\)/g, '.classList.add($1)');

	// =========================================================
	// 11. Replace .removeClass('cls') → .classList.remove('cls')
	// =========================================================
	code = code.replace(/\.removeClass\((['"][^'"]*['"])\)/g, '.classList.remove($1)');
	code = code.replace(/\.removeClass\((\w+)\)/g, '.classList.remove($1)');

	// =========================================================
	// 12. Replace .hasClass('cls') → .classList.contains('cls')
	// =========================================================
	code = code.replace(/\.hasClass\((['"][^'"]*['"])\)/g, '.classList.contains($1)');
	code = code.replace(/\.hasClass\((\w+)\)/g, '.classList.contains($1)');

	// =========================================================
	// 13. Replace .toggleClass('cls') → .classList.toggle('cls')
	// =========================================================
	code = code.replace(/\.toggleClass\((['"][^'"]*['"])\)/g, '.classList.toggle($1)');
	code = code.replace(/\.toggleClass\((['"][^'"]*['"]),\s*([^)]+)\)/g, '.classList.toggle($1, !!($2))');
	code = code.replace(/\.toggleClass\((\w+)\)/g, '.classList.toggle($1)');

	// =========================================================
	// 14. Replace .on('event', fn) → .addEventListener('event', fn)
	// Simple non-delegated events only
	// Note: .on('event', 'selector', fn) is delegated - leave for manual
	// =========================================================
	// Detect and skip delegated events (3 args): .on('event', 'selector', fn)
	// Simple 2-arg form: .on('event', fn)
	// We'll use a careful regex that ensures the second arg is a function (not a string selector)
	// Pattern: .on('event', function or namedFn)
	// To avoid delegated events, check that the second arg doesn't start with ' or "
	code = code.replace(/\.on\((['"][^'"]+['"]),\s*(?!['"])/g, function(match, eventType) {
		return '.addEventListener(' + eventType + ', ';
	});

	// =========================================================
	// 15. Replace .off('event') → .removeEventListener('event', ...)
	// Simple form without handler ref is hard to automate
	// .off('event.namespace') patterns need manual handler refs
	// =========================================================
	// Leave these for manual migration

	// =========================================================
	// 16. Replace .click(fn) → .addEventListener('click', fn)
	//     .mousedown(fn) → .addEventListener('mousedown', fn)
	//     etc. shorthand event methods
	// =========================================================
	var eventShorthands = ['click', 'mousedown', 'mouseup', 'mouseover', 'mouseout',
		'mouseenter', 'mouseleave', 'change', 'keydown', 'keyup', 'keypress',
		'focus', 'blur', 'submit', 'input', 'dblclick', 'contextmenu'];

	eventShorthands.forEach(function(evt) {
		// .click(fn) with function arg → addEventListener
		var re = new RegExp('\\.' + evt + '\\((?!\\))', 'g');
		code = code.replace(re, '.addEventListener(\'' + evt + '\', ');
	});
	// Fix: .addEventListener('focus', ) and .addEventListener('blur', ) that have no args → triggers
	// .focus() and .blur() with NO args should remain as native .focus() / .blur()
	// Re-convert no-arg focus/blur back
	code = code.replace(/\.addEventListener\('focus',\s*\)/g, '.focus()');
	code = code.replace(/\.addEventListener\('blur',\s*\)/g, '.blur()');

	// =========================================================
	// 17. Replace .one('event', fn) → addEventListener once
	// =========================================================
	code = code.replace(/\.one\((['"][^'"]+['"]),\s*/g, function(match, evt) {
		return '.addEventListener(' + evt + ', ';
		// Note: this loses the "once" behavior - manual fix needed to add {once: true}
	});

	// =========================================================
	// 18. Replace .show() → .style.display = ''
	//     .hide() → .style.display = 'none'
	// These end statements, so they need to be followed by ; or \n
	// =========================================================
	code = code.replace(/\.show\(\)([;\n,])/g, ".style.display = ''$1");
	code = code.replace(/\.hide\(\)([;\n,])/g, ".style.display = 'none'$1");
	// Handle end of line before comment
	code = code.replace(/\.show\(\)(\s*\/\/)/g, ".style.display = ''$1");
	code = code.replace(/\.hide\(\)(\s*\/\/)/g, ".style.display = 'none'$1");

	// =========================================================
	// 19. Replace .empty() → .innerHTML = ''
	// =========================================================
	code = code.replace(/\.empty\(\)([;\n,])/g, ".innerHTML = ''$1");
	code = code.replace(/\.empty\(\)(\s*\/\/)/g, ".innerHTML = ''$1");

	// =========================================================
	// 20. Replace .html() getter → .innerHTML
	//     .html(val) setter → .innerHTML = val
	// =========================================================
	// Getter: .html() with no args
	code = code.replace(/\.html\(\)/g, '.innerHTML');
	// Setter: .html(val) - handle simple string args
	// Pattern: .html('string') or .html(variable) ending with ; or )
	code = code.replace(/\.html\(('(?:[^'\\]|\\.)*')\)/g, '.innerHTML = $1');
	code = code.replace(/\.html\(("(?:[^"\\]|\\.)*")\)/g, '.innerHTML = $1');
	// .html(variable or expression) - simple identifier
	code = code.replace(/\.html\(([a-zA-Z_$][a-zA-Z0-9_$.]*)\)/g, '.innerHTML = $1');
	// Template literals
	code = code.replace(/\.html\((`[^`]*`)\)/g, '.innerHTML = $1');
	// String concatenation (simple cases)
	code = code.replace(/\.html\(([^()\n]+)\);/g, '.innerHTML = $1;');

	// =========================================================
	// 21. Replace .text() getter → .textContent
	//     .text(val) setter → .textContent = val
	// =========================================================
	code = code.replace(/\.text\(\)/g, '.textContent');
	code = code.replace(/\.text\(('(?:[^'\\]|\\.)*')\)/g, '.textContent = $1');
	code = code.replace(/\.text\(("(?:[^"\\]|\\.)*")\)/g, '.textContent = $1');
	code = code.replace(/\.text\(([a-zA-Z_$][a-zA-Z0-9_$.]*)\)/g, '.textContent = $1');
	code = code.replace(/\.text\((`[^`]*`)\)/g, '.textContent = $1');
	code = code.replace(/\.text\(([^()\n]+)\);/g, '.textContent = $1;');

	// =========================================================
	// 22. Replace .val() getter → .value
	//     .val(x) setter → .value = x
	// =========================================================
	code = code.replace(/\.val\(\)/g, '.value');
	code = code.replace(/\.val\(('(?:[^'\\]|\\.)*')\)/g, '.value = $1');
	code = code.replace(/\.val\(("(?:[^"\\]|\\.)*")\)/g, '.value = $1');
	code = code.replace(/\.val\(([a-zA-Z_$][a-zA-Z0-9_$.]*)\)/g, '.value = $1');
	code = code.replace(/\.val\(([^()\n]+)\);/g, '.value = $1;');

	// =========================================================
	// 23. Replace .attr('name') getter → .getAttribute('name')
	//     .attr('name', val) setter → .setAttribute('name', val)
	// =========================================================
	// Setter: .attr('name', value)
	code = code.replace(/\.attr\((['"][^'"]+['"]),\s*([^)]+)\)/g, '.setAttribute($1, $2)');
	// Getter: .attr('name') - only if not followed by , (that would be setter)
	code = code.replace(/\.attr\((['"][^'"]+['"])\)(?!\s*\))/g, '.getAttribute($1)');

	// =========================================================
	// 24. Replace .prop('name') getter and .prop('name', val) setter
	// =========================================================
	// Setter: .prop('type', 'text') → .type = 'text'
	code = code.replace(/\.prop\((['"])type\1,\s*(['"](?:text|password|none|number|email|checkbox|radio|hidden|button)['"]\s*)\)/g, '.type = $2');
	// Setter: .prop('checked', true/false)
	code = code.replace(/\.prop\((['"])checked\1,\s*([^)]+)\)/g, '.checked = $2');
	// Setter: .prop('disabled', true/false)
	code = code.replace(/\.prop\((['"])disabled\1,\s*([^)]+)\)/g, '.disabled = $2');
	// Getter: .prop('type') → .type
	code = code.replace(/\.prop\((['"])type\1\)/g, '.type');
	code = code.replace(/\.prop\((['"])checked\1\)/g, '.checked');
	code = code.replace(/\.prop\((['"])disabled\1\)/g, '.disabled');
	code = code.replace(/\.prop\((['"])value\1\)/g, '.value');

	// =========================================================
	// 25. Replace .height() → .offsetHeight
	//     .width() → .offsetWidth
	// =========================================================
	code = code.replace(/\.height\(\)/g, '.offsetHeight');
	code = code.replace(/\.width\(\)/g, '.offsetWidth');

	// =========================================================
	// 26. Replace .remove() when called on element result
	// el.remove() → native Element.remove() exists in modern browsers!
	// So this is actually safe - native Element has .remove()
	// =========================================================
	// Keep .remove() as-is - native Element.remove() works

	// =========================================================
	// 27. Replace .append('<htmlString>') with insertAdjacentHTML
	// .append(element) with appendChild
	// =========================================================
	// String append: .append('<tag...>')
	// This is complex - leave for manual

	// =========================================================
	// 28. Replace .css('prop') getter → style or computedStyle
	//     .css('prop', val) setter → el.style.prop = val
	//     .css({...}) object setter → multiple style assignments
	// =========================================================
	// Simple getter with single prop name (camelCase)
	// .css('top') → parseInt(el.style.top, 10) - but can't do inline
	// Leave complex .css() for manual, but do simple setter:
	// .css('property', value) → .style.property = value
	// Only for simple quoted property names
	var cssProps = {
		'top': 'top', 'left': 'left', 'right': 'right', 'bottom': 'bottom',
		'width': 'width', 'height': 'height', 'display': 'display',
		'opacity': 'opacity', 'zIndex': 'zIndex', 'z-index': 'zIndex',
		'position': 'position', 'visibility': 'visibility',
		'backgroundColor': 'backgroundColor', 'background': 'background',
		'color': 'color', 'fontSize': 'fontSize', 'font-size': 'fontSize',
		'overflow': 'overflow', 'cursor': 'cursor',
		'backgroundImage': 'backgroundImage', 'background-image': 'backgroundImage'
	};
	Object.keys(cssProps).forEach(function(prop) {
		var camel = cssProps[prop];
		// Setter: .css('prop', val) → .style.camel = val
		var re = new RegExp('\\.css\\([\'"]' + prop + '[\'"],\\s*([^)]+)\\)', 'g');
		code = code.replace(re, '.style.' + camel + ' = $1');
	});

	// =========================================================
	// 29. Replace .scrollTop(val) → .scrollTop = val
	//     .scrollTop() → .scrollTop
	// =========================================================
	code = code.replace(/\.scrollTop\(([^)]+)\)/g, '.scrollTop = $1');
	code = code.replace(/\.scrollTop\(\)/g, '.scrollTop');
	code = code.replace(/\.scrollLeft\(([^)]+)\)/g, '.scrollLeft = $1');
	code = code.replace(/\.scrollLeft\(\)/g, '.scrollLeft');

	// =========================================================
	// 30. Replace .focus() (no-arg trigger) → .focus()
	//     (already native - keep as-is)
	// =========================================================

	// =========================================================
	// 31. Replace jQuery(window).on('ev.ns', fn) patterns
	// These need handler tracking for namespaced removal
	// =========================================================
	// Simple: jQuery(window).on('event', fn) → window.addEventListener('event', fn)
	code = code.replace(/(?:jQuery|\$)\(window\)\.on\((['"][^'"]+['"]),\s*/g, 'window.addEventListener($1, ');
	// jQuery(window).off('ev.ns') → window.removeEventListener (leave for manual - needs handler ref)

	// =========================================================
	// 32. Replace jQuery(document).on → document.addEventListener
	// =========================================================
	code = code.replace(/(?:jQuery|\$)\(document\)\.on\((['"][^'"]+['"]),\s*/g, 'document.addEventListener($1, ');

	// =========================================================
	// 33. Replace .data('key') getter → .dataset.key or getAttribute
	//     .data('key', val) setter → .dataset.key = val
	// =========================================================
	// Getter: .data('key') - convert to getAttribute('data-key')
	code = code.replace(/\.data\((['"])([a-zA-Z][a-zA-Z0-9-]*)\1\)(?!\s*,)/g, function(match, q, key) {
		// Convert camelCase to kebab: myKey → my-key
		var attrKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
		return '.getAttribute(\'data-' + attrKey + '\')';
	});
	// Setter: .data('key', val)
	code = code.replace(/\.data\((['"])([a-zA-Z][a-zA-Z0-9-]*)\1,\s*([^)]+)\)/g, function(match, q, key, val) {
		var attrKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
		return '.setAttribute(\'data-' + attrKey + '\', ' + val + ')';
	});

	// =========================================================
	// 34. Replace .is(':visible') → DOM.isVisible(el) - needs DOM import
	// =========================================================
	// Can't inline easily, leave for manual

	// =========================================================
	// 35. Replace .position() → DOM.getPosition() - needs DOM import
	// =========================================================
	// Leave for manual

	// =========================================================
	// 36. Replace .offset() → DOM.getOffset() - needs DOM import
	// =========================================================
	// Leave for manual

	// =========================================================
	// 37. Replace .index() → DOM.indexAmongSiblings()
	// =========================================================
	code = code.replace(/\.index\(\)/g, '.parentNode ? Array.from($1.parentNode.children).indexOf($1) : -1');
	// Better: use a simpler replacement with 'this' context in event handlers
	// Revert above - too complex, leave for manual
	code = code.replace(/\.parentNode \? Array\.from\(\$1\.parentNode\.children\)\.indexOf\(\$1\) : -1/g, '.index()');

	// =========================================================
	// 38. jQuery(this).index() pattern (common in event handlers)
	// =========================================================
	// Leave for manual migration

	// =========================================================
	// 39. Fix broken .style.display = ''; chains
	// =========================================================
	// After .show()/.hide() replacement, lines ending with .style.display = '';
	// followed by another method call are broken chains
	// Pattern: CANNOT chain after style assignment
	// These need manual review

	// =========================================================
	// 40. Replace 'originalEvent' references
	// In native event handlers, the event IS the original
	// =========================================================
	code = code.replace(/event\.originalEvent\./g, 'event.');

	return code;
}

filesToMigrate.forEach(function(filePath) {
	var code;
	try {
		code = fs.readFileSync(filePath, 'utf8');
	} catch (e) {
		console.error('Cannot read ' + filePath + ': ' + e.message);
		return;
	}

	var migrated = migrateFile(code);

	if (migrated !== code) {
		fs.writeFileSync(filePath, migrated, 'utf8');
		console.log('MIGRATED: ' + filePath);
	} else {
		console.log('no-change: ' + filePath);
	}
});
