#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');

function walk(dir, files) {
	fs.readdirSync(dir).forEach(function(item) {
		var full = path.join(dir, item);
		if (fs.statSync(full).isDirectory()) {
			if (!/node_modules|dist|Vendors/.test(full)) walk(full, files);
		} else if (item.endsWith('.js')) files.push(full);
	});
}

function fix(code) {
	var orig = code;

	// Skip Array.find, Object.keys().find etc - only DOM chain .text( with string/function call before ;
	// Element .text( setter - multiline safe for simple calls
	code = code.replace(/(\)\.text\()([^;\n]+)(\);)/g, function(m, pre, expr, end) {
		if (expr.includes('=>') || expr.includes('function')) return m;
		return pre.replace('.text(', '.textContent = ') + expr + end.replace(');', ';');
	});
	// querySelector(...).text(
	code = code.replace(/(\.querySelector(?:All)?\([^)]+\))\.text\(([^)]+)\)/g, '$1.textContent = $2');

	// .html( setter
	code = code.replace(/(\.querySelector(?:All)?\([^)]+\))\.html\(([^)]+)\)/g, '$1.innerHTML = $2');

	// .val( setter on querySelector
	code = code.replace(/(\.querySelector(?:All)?\([^)]+\))\.val\(([^)]+)\)/g, '$1.value = $2');

	// .css("prop") getter -> style.prop (common)
	code = code.replace(/(\.querySelector(?:All)?\([^)]+\)|this\.ui|[a-zA-Z_$][\w$]*)\.css\((['"])(top|left|color)\2\)/g, function(_, el, q, prop) {
		return el + '.style.' + prop;
	});
	code = code.replace(/this\.ui\.css\((['"])(top|left)\1\)/g, 'this.ui.style.$2');
	code = code.replace(/ReadMail\.ui\.css\((['"])(top|left)\1\)/g, 'ReadMail.ui.style.$2');
	code = code.replace(/ChatBox\.ui\.css\((['"])(top|left)\1\)/g, 'ChatBox.ui.style.$2');
	code = code.replace(/base\.css\((['"])(top|left)\1\)/g, 'base.style.$2');

	// .css('prop', val) setter
	code = code.replace(/(\.querySelector(?:All)?\([^)]+\))\.css\((['"])([^'"]+)\2,\s*([^)]+)\)/g, '$1.style.$3 = $4');

	// overlay.text( -> textContent =
	code = code.replace(/\boverlay\.text\(/g, 'overlay.textContent = ');

	// element.addClass / removeClass
	code = code.replace(/\.addClass\(/g, '.classList.add(');
	code = code.replace(/\.removeClass\(/g, '.classList.remove(');

	// $("#...") remaining
	code = code.replace(/\$\((['"]#[^'"]+['"])\)/g, 'document.querySelector($1)');

	// .hide() on this in Intro - special
	code = code.replace(/this\.hide\(\)/g, "this.style.display = 'none'");

	// .show().addEventListener broken chains
	code = code.replace(/\.style\.display = ''\.addEventListener/g, ".style.display = '';\n\t\t\t.addEventListener");

	// Guild positions.eq(i) -> positions[i]  (if positions is array from querySelectorAll)
	code = code.replace(/positions\.eq\((\w+)\)/g, 'positions[$1]');

	// ShortCutOption querySelectorAll fix
	code = code.replace(
		/var \$shortcut = ShortCutOption\.ui\.querySelector\("td\[data-button\]"\);\s*for \(var i=0; i < \$shortcut\.length;/,
		'var $shortcut = ShortCutOption.ui.querySelectorAll("td[data-button]");\n\t\tfor (var i=0; i < $shortcut.length;'
	);

	return code === orig ? null : code;
}

var files = [];
walk('src/UI', files);
var n = 0;
files.forEach(function(f) {
	var code = fs.readFileSync(f, 'utf8');
	var next = fix(code);
	if (next) {
		fs.writeFileSync(f, next, 'utf8');
		console.log('PASS2: ' + f);
		n++;
	}
});
console.log('Pass2 total: ' + n);
