#!/usr/bin/env node
/**
 * Fix remaining jQuery patterns missed by jquery-to-dom.js
 */
'use strict';

var fs = require('fs');
var path = require('path');

var DOM_IMPORT = "\tvar DOM       = require('Utils/DOM');\n";

function needsDomImport(code) {
	return /\bDOM\.(setCss|qsa|qs|indexAmongSiblings|createElement|hide|show|empty|addDelegatedEvent)\b/.test(code)
		&& !/require\(['"]Utils\/DOM['"]\)/.test(code);
}

function addDomImport(code) {
	if (!needsDomImport(code)) {
		return code;
	}

	var match = code.match(/^(\t\/\/ Load dependencies\n)/m);
	if (match) {
		return code.replace(match[0], match[0] + DOM_IMPORT);
	}

	var defineMatch = code.match(/(define\(function\(\s*require\s*\)\s*\{\s*\n\t'use strict';\n\n)/);
	if (defineMatch) {
		return code.replace(defineMatch[0], defineMatch[0] + DOM_IMPORT);
	}

	return code;
}

function replaceDomFind(code) {
	// .ui.find( → .ui.querySelector(
	code = code.replace(/\.ui\.find\(/g, '.ui.querySelector(');

	// Common element variable names used as jQuery containers
	var domVars = [
		'content', 'ui', 'overlay', 'cardList', 'materialDiv', 'bsbDiv',
		'container', 'list', 'element', 'menu', 'panel', 'box', 'wrapper',
		'body', 'header', 'footer', 'table', 'tbody', 'row', 'cell',
		'description', 'title', 'target', 'source', 'parent', 'child',
		'$serverlist', 'toContent', 'fromContent', 'countmsg', 'event',
		'optionContainer', 'optionList', 'levelup', 'view', 'div',
		'positions', 'this\\.list', 'this\\.ui_list'
	];

	domVars.forEach(function(v) {
		var re = new RegExp('(' + v + ')\\.find\\(', 'g');
		code = code.replace(re, '$1.querySelector(');
	});

	return code;
}

function replaceJquerySelectors(code) {
	// $("#id") → document.querySelector("#id")
	code = code.replace(/\$\((['"]#[^'"]+['"])\)/g, 'document.querySelector($1)');
	code = code.replace(/\$\((['"]\.[^'"]+['"])\)/g, 'document.querySelector($1)');

	// jQuery('#id') → document.getElementById or querySelector
	code = code.replace(/jQuery\((['"]#([^'"]+)['"])\)/g, "document.getElementById('$2')");
	code = code.replace(/jQuery\((['"]\.[^'"]+['"])\)/g, 'document.querySelector($1)');

	// jQuery(html).appendTo('#id') → appendChild pattern (handled separately)
	code = code.replace(/jQuery\(html\)\.appendTo\((['"]#[^'"]+['"])\)/g,
		"(function(){ var el = document.querySelector($1); if(el){ var n = DOM.createElement(html); el.appendChild(n); return n; } return null; })()");

	// jQuery(window.innerHeight...) broken patterns → window.innerHeight
	code = code.replace(/jQuery\(window\.offsetHeight/g, 'window.innerHeight');
	code = code.replace(/jQuery\(window\)/g, 'window');

	return code;
}

function replaceEqPseudo(code) {
	// :eq(n) in selectors → handled via querySelectorAll()[n]
	// Pattern: .querySelector('.container:eq(' + index + ')')
	code = code.replace(
		/\.querySelector\((['"])([^'"]*?):eq\(\s*\+\s*(\w+)\s*\+\s*\)([^'"]*?)\1\)/g,
		function(_, q, before, varName, after) {
			return '.querySelectorAll(' + q + before + after + q + ')[' + varName + ']';
		}
	);

	// div:eq('+ this.index +')
	code = code.replace(
		/\.querySelector\((['"])([^'"]*?):eq\(\s*['"]\s*\+\s*([^+]+?)\s*\+\s*['"]\s*\)([^'"]*?)\1\)/g,
		function(_, q, before, varName, after) {
			return '.querySelectorAll(' + q + before + after + q + ')[' + varName.trim() + ']';
		}
	);

	// tr :eq('+ count +')
	code = code.replace(
		/\.querySelector\((['"])([^'"]*?):eq\(\s*\+\s*(\w+)\s*\+\s*\)([^'"]*?)\1\)/g,
		function(_, q, before, varName, after) {
			return '.querySelectorAll(' + q + before + after + q + ')[' + varName + ']';
		}
	);

	// .eq(n) method calls on collections (if any remain)
	code = code.replace(/\.eq\((\w+)\)/g, '[$1]');

	// :first pseudo
	code = code.replace(/:first(['")\]])/g, '$1');
	code = code.replace(/:first\)/g, ')');

	return code;
}

function replaceTextHtmlVal(code) {
	// .text(expr) setter - more permissive than jquery-to-dom
	code = code.replace(/\.text\(([^);]+)\)([;\n,)])/g, function(match, expr, end) {
		if (expr.trim() === '') {
			return match;
		}
		return '.textContent = ' + expr + end;
	});

	// .html(expr) setter
	code = code.replace(/\.html\(([^);]+)\)([;\n,)])/g, function(match, expr, end) {
		if (expr.trim() === '') {
			return match;
		}
		return '.innerHTML = ' + expr + end;
	});

	return code;
}

function replaceCssObject(code) {
	var PX_PROPS = /^(top|left|right|bottom|width|height|fontSize|lineHeight|margin|padding|marginTop|marginLeft|marginRight|marginBottom|paddingTop|paddingLeft|paddingRight|paddingBottom|maxWidth|maxHeight|minWidth|minHeight|borderWidth)$/;

	function toPxString(key, value) {
		var trimmed = value.trim();
		if (/^-?\d+(\.\d+)?$/.test(trimmed) && PX_PROPS.test(key)) {
			return trimmed + 'px';
		}
		return trimmed;
	}

	var result = '';
	var i = 0;

	while (i < code.length) {
		var idx = code.indexOf('.css({', i);
		if (idx === -1) {
			result += code.slice(i);
			break;
		}

		result += code.slice(i, idx);

		var elMatch = result.match(/([a-zA-Z_$][\w$.]*(?:\([^)]*\))*(?:\.[a-zA-Z_$][\w$.]*)*)\s*$/);
		var elExpr = elMatch ? elMatch[1] : null;

		var start = idx + 5;
		var depth = 0;
		var j = start;
		while (j < code.length) {
			if (code[j] === '{') depth++;
			else if (code[j] === '}') {
				depth--;
				if (depth === 0) break;
			}
			j++;
		}

		if (depth !== 0 || code[j + 1] !== ')') {
			result += code.slice(idx, idx + 6);
			i = idx + 6;
			continue;
		}

		var inner = code.slice(start + 1, j).trim();
		var props = inner.split(',').map(function(p) { return p.trim(); }).filter(Boolean);
		var replacements = [];

		props.forEach(function(prop) {
			var colon = prop.indexOf(':');
			if (colon === -1) return;
			var key = prop.slice(0, colon).trim().replace(/['"]/g, '');
			var val = prop.slice(colon + 1).trim();
			replacements.push((elExpr || 'el') + '.style.' + key + ' = ' + toPxString(key, val));
		});

		if (replacements.length && elExpr) {
			result += replacements.join('; ');
		} else {
			result += code.slice(idx, j + 2);
		}

		i = j + 2;
	}

	return result;
}

function replaceLengthChecks(code) {
	// .querySelector(...).length → truthy check or querySelectorAll().length
	code = code.replace(/\.querySelector\(([^)]+)\)\.length/g, '.querySelector($1)');
	return code;
}

function replaceIndex(code) {
	// .index(this) → DOM.indexAmongSiblings(this)
	code = code.replace(/\.index\((this)\)/g, '/*index*/');
	code = code.replace(/\.querySelector\([^)]+\)\.index\((this)\)/g, function(m) {
		return m.replace('.index(this)', '');
	});
	return code;
}

function migrateFile(filePath) {
	var code = fs.readFileSync(filePath, 'utf8');
	var original = code;

	code = replaceDomFind(code);
	code = replaceJquerySelectors(code);
	code = replaceEqPseudo(code);
	code = replaceTextHtmlVal(code);
	code = replaceCssObject(code);
	code = replaceLengthChecks(code);
	code = addDomImport(code);

	if (code !== original) {
		fs.writeFileSync(filePath, code, 'utf8');
		return true;
	}
	return false;
}

var targets = process.argv.slice(2);
if (!targets.length) {
	function walk(dir, files) {
		fs.readdirSync(dir).forEach(function(item) {
			var full = path.join(dir, item);
			if (fs.statSync(full).isDirectory()) {
				if (!/node_modules|dist|Vendors/.test(full)) {
					walk(full, files);
				}
			} else if (item.endsWith('.js')) {
				files.push(full);
			}
		});
	}
	targets = [];
	walk('src/UI', targets);
	walk('src/Engine', targets);
}

var count = 0;
targets.forEach(function(f) {
	try {
		if (migrateFile(f)) {
			console.log('FIXED: ' + f);
			count++;
		}
	} catch (e) {
		console.error('ERROR ' + f + ': ' + e.message);
	}
});

console.log('Total fixed: ' + count);
