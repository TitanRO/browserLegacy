#!/usr/bin/env node
/**
 * Converts this.ui.css({...}) to individual this.ui.style.X = Y; assignments
 * Also handles el.css({...}) for any element variable
 */
'use strict';
var fs = require('fs');

var files = process.argv.slice(2);
if (!files.length) {
	// Process all files that have css({
	var execSync = require('child_process').execSync;
	var out = execSync('grep -rl "this\\.ui\\.css(" src/ --include="*.js"').toString().trim();
	files = out.split('\n').filter(Boolean);
}

// Properties that get 'px' appended for numeric values (same as jQuery)
var PX_PROPS = ['top', 'left', 'right', 'bottom', 'width', 'height', 'fontSize',
	'lineHeight', 'margin', 'padding', 'marginTop', 'marginLeft', 'marginRight',
	'marginBottom', 'paddingTop', 'paddingLeft', 'paddingRight', 'paddingBottom',
	'maxWidth', 'maxHeight', 'minWidth', 'minHeight', 'borderWidth'];

function needsPx(prop) {
	return PX_PROPS.indexOf(prop) !== -1;
}

function toCamelCase(prop) {
	return prop.replace(/-([a-z])/g, function(m, c) { return c.toUpperCase(); });
}

/**
 * Find and replace this.ui.css({...}) blocks
 */
function processCssObjectBlocks(code) {
	// Match: <expr>.css({ ... }) spanning one or more lines
	// We need to find the balanced braces
	var result = '';
	var i = 0;
	var changed = false;

	while (i < code.length) {
		// Look for .css({
		var idx = code.indexOf('.css({', i);
		if (idx === -1) {
			result += code.slice(i);
			break;
		}

		// Find the preceding element expression
		result += code.slice(i, idx);

		// Find the matching closing })
		var start = idx + 5; // points to the {
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

		if (depth !== 0) {
			// Unbalanced - skip
			result += code.slice(idx, idx + 6);
			i = idx + 6;
			continue;
		}

		// Extract the object literal: from { to }
		var objStr = code.slice(start, j + 1); // includes braces
		// Check if ) follows }
		if (code[j + 1] !== ')') {
			// Not a simple call, skip
			result += code.slice(idx, j + 2);
			i = j + 2;
			continue;
		}

		// Parse object literal properties
		var inner = objStr.slice(1, -1).trim(); // remove braces
		var props = parseObjectProps(inner);

		if (!props) {
			// Can't parse - skip
			result += code.slice(idx, j + 2);
			i = j + 2;
			continue;
		}

		// Find what 'el' is (the expression before .css)
		// Look backwards from idx to find the element expression
		var elExpr = findPrecedingExpression(result);

		// Generate replacements
		var replacements = [];
		for (var k = 0; k < props.length; k++) {
			var prop = props[k].key;
			var val = props[k].val;
			var camel = toCamelCase(prop);

			// If val is a number literal and prop needs px, add 'px'
			var numMatch = val.match(/^(-?\d+(?:\.\d+)?)$/);
			if (numMatch && needsPx(camel)) {
				val = "'" + numMatch[1] + "px'";
			}

			replacements.push(elExpr + '.style.' + camel + ' = ' + val);
		}

		result += replacements.join('; ');
		changed = true;

		// Skip past the closing )
		i = j + 2;
	}

	return changed ? result : null;
}

/**
 * Find the expression immediately preceding the current position in result
 * e.g., if result ends with "\t\tthis.ui", returns "this.ui"
 * or if result ends with "\t\t\tvar menu = this.ui.querySelector('.menu')",
 * we can't extract it cleanly, so return null
 */
function findPrecedingExpression(str) {
	// Find last non-whitespace sequence that looks like an identifier chain
	var match = str.match(/([a-zA-Z_$][\w$.]*(?:\.[a-zA-Z_$][\w$.]*)*(?:\([^)]*\))*(?:\.[a-zA-Z_$][\w$.]*)*)\s*$/);
	if (match) {
		return match[1];
	}
	return null;
}

/**
 * Parse simple object literal properties
 * Returns array of {key, val} or null if can't parse
 */
function parseObjectProps(inner) {
	if (!inner.trim()) return [];

	var props = [];
	var remaining = inner.trim();

	while (remaining.length > 0) {
		// Match: key: value[,]
		// Key can be 'quoted' or unquoted
		var keyMatch = remaining.match(/^['"]?([a-zA-Z-]+)['"]?\s*:/);
		if (!keyMatch) return null;

		var key = keyMatch[1];
		remaining = remaining.slice(keyMatch[0].length).trim();

		// Find value - it might have parens, strings, etc.
		var val = extractValue(remaining);
		if (val === null) return null;

		props.push({ key: key, val: val.trim() });
		remaining = remaining.slice(val.length).trim();

		// Skip comma
		if (remaining[0] === ',') {
			remaining = remaining.slice(1).trim();
		}
	}

	return props;
}

/**
 * Extract a value from the start of a string (up to , or end of object)
 */
function extractValue(str) {
	var depth = 0;
	var inStr = null;
	var i = 0;

	while (i < str.length) {
		var c = str[i];
		if (inStr) {
			if (c === inStr && str[i-1] !== '\\') inStr = null;
		} else if (c === '"' || c === "'" || c === '`') {
			inStr = c;
		} else if (c === '(' || c === '[' || c === '{') {
			depth++;
		} else if (c === ')' || c === ']' || c === '}') {
			if (depth === 0) break;
			depth--;
		} else if (c === ',' && depth === 0) {
			break;
		}
		i++;
	}

	return str.slice(0, i);
}

var migrated = 0;
files.forEach(function(filePath) {
	var code;
	try {
		code = fs.readFileSync(filePath, 'utf8');
	} catch (e) {
		console.error('Cannot read ' + filePath);
		return;
	}

	var result = processCssObjectBlocks(code);
	if (result && result !== code) {
		fs.writeFileSync(filePath, result, 'utf8');
		console.log('Fixed: ' + filePath);
		migrated++;
	}
});

console.log('Total files modified: ' + migrated);
