#!/usr/bin/env node
/**
 * Automated jQuery → Native DOM migration script
 * Handles common patterns across all files
 */
'use strict';

var fs = require('fs');
var path = require('path');

// Files to migrate
var filesToMigrate = process.argv.slice(2);

if (filesToMigrate.length === 0) {
	console.error('Usage: node migrate-jquery.js <file1> [file2] ...');
	process.exit(1);
}

function migrate(code) {
	var changed = false;

	// Track if we need DOM import
	var needsDOM = false;

	// 1. Remove jQuery require line (various forms)
	var jqueryRequireRegex = /^[\t ]*var (\$|jQuery)\s*=\s*require\(['"]Utils\/jquery['"]\);?\s*\n/gm;
	if (jqueryRequireRegex.test(code)) {
		code = code.replace(jqueryRequireRegex, '');
		changed = true;
	}

	// Also handle ShortCutOption's dollar sign pattern
	code = code.replace(/^[\t ]*var \$\s*=\s*require\(["']Utils\/jquery["']\);?\s*\n/gm, '');

	// 2. Replace .find(sel) chained with single-element methods
	// Pattern: el.find('sel').method(args)
	// Replace with: el.querySelector('sel').method(args)
	// But .each(), .filter(), .length accesses → querySelectorAll

	// Simple chained find → querySelector for single-element operations
	// .find(SEL).addClass/removeClass/hasClass/toggleClass/on/off/click/html/text/val/attr/removeAttr/css/show/hide/empty/remove/append/prepend/prop/data/focus/blur/one/trigger
	var singleMethods = ['addClass', 'removeClass', 'hasClass', 'toggleClass', 'on', 'off', 'click',
		'html', 'text', 'val', 'attr', 'removeAttr', 'css', 'show', 'hide', 'empty', 'remove',
		'append', 'prepend', 'prop', 'data', 'focus', 'blur', 'one', 'trigger', 'mousedown',
		'mouseup', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave', 'change', 'keydown',
		'keyup', 'keypress', 'submit', 'closest', 'parent', 'children', 'siblings', 'next',
		'prev', 'is', 'not', 'filter', 'scrollTop', 'scrollLeft', 'width', 'height', 'offset',
		'position', 'insertAfter', 'insertBefore', 'appendTo', 'detach', 'clone', 'replaceWith',
		'fadeOut', 'fadeIn', 'animate', 'stop', 'draggable'];

	// Replace .find(SEL) with .querySelector(SEL) when chained
	// This regex matches .find('sel').METHOD or .find("sel").METHOD
	var findChainRegex = /\.find\((['"][^'"]+['"])\)\.(addClass|removeClass|hasClass|toggleClass|on|off|click|html|text|val|attr|removeAttr|css|show|hide|empty|remove|append|prepend|prop|data|focus|blur|one|trigger|mousedown|mouseup|mouseover|mouseout|mouseenter|mouseleave|change|keydown|keyup|keypress|submit|closest|parent|children|siblings|is|not|draggable|width|height|offset|position|insertAfter|insertBefore|appendTo|detach|clone|replaceWith|fadeOut|fadeIn|animate|stop)\(/g;
	code = code.replace(findChainRegex, '.querySelector($1).$2(');

	// Replace .find(SEL).each( → Array.from(.querySelectorAll(SEL)).forEach(
	code = code.replace(/\.find\((['"][^'"]+['"])\)\.each\(/g, '.querySelectorAll($1)).forEach(Array.from(');
	// Fix the Array.from placement
	code = code.replace(/\.querySelectorAll\((['"][^'"]+['"])\)\)\.forEach\(Array\.from\(/g, function(m, sel) {
		return '.querySelectorAll(' + sel + ')).forEach(';
	});
	// Better replacement:
	code = code.replace(/(\w+)\.find\((['"][^'"]+['"])\)\.each\(/g, 'Array.from($1.querySelectorAll($2)).forEach(');
	// Handle this.ui.find(SEL).each(
	code = code.replace(/this\.ui\.find\((['"][^'"]+['"])\)\.each\(/g, 'Array.from(this.ui.querySelectorAll($1)).forEach(');

	// 3. Replace standalone .find() not followed by known methods → querySelector
	// For remaining .find() calls, use querySelector (conservative)
	code = code.replace(/\.find\((['"][^'"]+['"])\)/g, '.querySelector($1)');

	// 4. Replace addClass/removeClass/hasClass/toggleClass
	code = code.replace(/\.addClass\((['"][^'"]+['"])\)/g, '.classList.add($1)');
	code = code.replace(/\.removeClass\((['"][^'"]+['"])\)/g, '.classList.remove($1)');
	code = code.replace(/\.hasClass\((['"][^'"]+['"])\)/g, '.classList.contains($1)');
	code = code.replace(/\.toggleClass\((['"][^'"]+['"])\)/g, '.classList.toggle($1)');
	// toggleClass with state argument
	code = code.replace(/\.toggleClass\((['"][^'"]+['"]),\s*([^)]+)\)/g, '.classList.toggle($1, $2)');

	// 5. Replace show/hide/empty - be careful about .show() on objects other than DOM elements
	// These are usually called on this.ui.xxx() results
	code = code.replace(/\.show\(\)/g, '.style.display = \'\'');
	code = code.replace(/\.hide\(\)/g, '.style.display = \'none\'');
	code = code.replace(/\.empty\(\)/g, '.innerHTML = \'\'');

	// Fix: show()/hide() may be chained - needs to be statement-ending
	// Revert those that broke chaining: .style.display = ''.method() → can't chain native style assignment
	// Actually, if there's a dot after .show() replacement, we have an issue
	// But in practice, .show() and .hide() are rarely chained further in this codebase

	// 6. Replace .html(val) setter → .innerHTML = val
	// Getter: .html() → .innerHTML (no args)
	code = code.replace(/\.html\(\)/g, '.innerHTML');
	// Setter: .html(val) - but val could be complex
	// Only safe if followed by ; or )
	code = code.replace(/\.html\(([^)]+)\)([;\n])/g, '.innerHTML = $1$2');

	// 7. Replace .text(val) setter → .textContent = val
	code = code.replace(/\.text\(\)/g, '.textContent');
	code = code.replace(/\.text\(([^)]+)\)([;\n])/g, '.textContent = $1$2');

	// 8. Replace .val() getter → .value
	code = code.replace(/\.val\(\)/g, '.value');
	// .val(val) setter → .value = val
	code = code.replace(/\.val\(([^)]+)\)([;\n,])/g, '.value = $1$2');

	// 9. Replace .attr() getter/setter
	// Getter: .attr('name') → .getAttribute('name')
	code = code.replace(/\.attr\((['"][^'"]+['"])\)(?!\s*,)/g, '.getAttribute($1)');
	// Setter: .attr('name', val) → .setAttribute('name', val)
	code = code.replace(/\.attr\((['"][^'"]+['"]),\s*([^)]+)\)/g, '.setAttribute($1, $2)');
	// prop getter: .prop('name') → .name (simplified)
	code = code.replace(/\.prop\((['"])type\1\)/g, '.type');
	code = code.replace(/\.prop\((['"])checked\1\)/g, '.checked');
	code = code.replace(/\.prop\((['"])disabled\1\)/g, '.disabled');

	// 10. Replace .on(event, fn) → .addEventListener(event, fn)
	code = code.replace(/\.on\((['"][^'"]+['"]),\s*/g, '.addEventListener($1, ');

	// 11. Replace .off(event) → .removeEventListener(event, handler)
	// This is tricky without knowing the handler - leave as TODO for named handlers
	// code = code.replace(/\.off\((['"][^'"]+['"])\)/g, '.removeEventListener($1, /* TODO: handler ref */)');

	// 12. Replace .css(obj) or .css('prop', val) or .css('prop')
	// .css({top: x, left: y}) setter with object
	// Leave these as they need case-by-case analysis
	// But for simple getter: .css('prop') → el.style.prop (or getComputedStyle)
	// For single prop setter: .css('top', val) → el.style.top = val
	// For object setter: .css({top: x, left: y}) → el.style.top = x; el.style.left = y;
	// These are too complex for blanket regex - skip for now

	// 13. Replace .append(child) with native
	// String appends → insertAdjacentHTML, element appends → appendChild
	// Too complex for automated replacement without type info

	// 14. Replace .remove() on result elements
	code = code.replace(/\.remove\(\)([;\n])/g, function(m, end) {
		// This replaces .remove() with a check-and-remove
		// But this breaks chaining - only safe on standalone statements
		return '.remove()' + end; // Keep for now, UIComponent handles this
	});

	// 15. Replace .height() and .width()
	code = code.replace(/\.height\(\)/g, '.offsetHeight');
	code = code.replace(/\.width\(\)/g, '.offsetWidth');

	// 16. Replace .each(function(index, el) with Array.from iterators
	// When already on querySelectorAll results

	// 17. Replace jQuery(el) wrapping → just el (when wrapping a variable)
	// jQuery(this) → this  (inside event handlers)
	code = code.replace(/jQuery\(this\)\./g, 'this.');
	code = code.replace(/\$\(this\)\./g, 'this.');

	// 18. Replace jQuery.extend() → Object.assign()
	code = code.replace(/jQuery\.extend\({}\s*,\s*/g, 'Object.assign({}, ');
	code = code.replace(/jQuery\.extend\(/g, 'Object.assign(');

	// 19. Replace jQuery('<tag>') → document.createElement('tag')
	// Simple tags: jQuery('<div>') → document.createElement('div')
	code = code.replace(/jQuery\('<(\w+)\/?>'\)/g, 'document.createElement(\'$1\')');
	code = code.replace(/jQuery\("<(\w+)\/?>"\)/g, 'document.createElement(\'$1\')');
	code = code.replace(/\$\('<(\w+)\/?>'\)/g, 'document.createElement(\'$1\')');
	code = code.replace(/\$\("<(\w+)\/?>"\)/g, 'document.createElement(\'$1\')');

	// 20. Replace jQuery(nativeElement) → nativeElement (for canvas, div etc.)
	// jQuery(this.canvas) → this.canvas
	code = code.replace(/jQuery\((this\.\w+)\)/g, '$1');

	// 21. jQuery.trim → String.prototype.trim
	code = code.replace(/jQuery\.trim\(([^)]+)\)/g, '($1).trim()');

	// 22. jQuery(window).on → window.addEventListener
	// jQuery(window).off → window.removeEventListener (complex due to namespacing)

	// 23. Fix broken chains from .show()/.hide() replacement
	// If .style.display = ''.className or similar, that's broken
	// We need to detect and fix: el.show().on(...) patterns

	return code;
}

filesToMigrate.forEach(function(filePath) {
	var code;
	try {
		code = fs.readFileSync(filePath, 'utf8');
	} catch (e) {
		console.error('Could not read ' + filePath + ': ' + e.message);
		return;
	}

	var migrated = migrate(code);

	if (migrated !== code) {
		fs.writeFileSync(filePath, migrated, 'utf8');
		console.log('Migrated: ' + filePath);
	} else {
		console.log('No changes: ' + filePath);
	}
});
