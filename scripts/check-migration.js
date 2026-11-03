#!/usr/bin/env node
/**
 * Static checks for incomplete jQuery → native DOM migration.
 *
 * Run: node scripts/check-migration.js
 * Exit 0 = clean, exit 1 = issues found.
 */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var SRC = path.join(ROOT, 'src');
var SKIP_DIRS = new Set(['Vendors']);

var RULES = [
	{
		id: 'query-selector-index-get-context',
		pattern: /\.querySelector\s*\([^)]+\)\s*\[\s*[0-9]+\s*\]\.getContext/,
		message: 'querySelector returns one element — use querySelectorAll()[N].getContext() for multiple canvases'
	},
	{
		id: 'query-selector-get-zero',
		pattern: /\.querySelector\s*\([^)]+\)\.get\s*\(\s*0\s*\)/,
		message: 'querySelector already returns an Element — remove .get(0) (jQuery migration leftover)'
	},
	{
		id: 'jquery-visible-pseudo',
		pattern: /querySelector\s*\(\s*['"][^'"]*:visible[^'"]*['"]\s*\)/,
		message: ':visible is a jQuery pseudo-selector — use DOM.isVisible() or style checks instead'
	},
	{
		id: 'jquery-require',
		pattern: /require\s*\(\s*['"]Utils\/(jquery|jquery-lite)['"]\s*\)/,
		message: 'jQuery module import still present'
	},
	{
		id: 'jquery-lite-path',
		pattern: /['"]Utils\/jquery-lite['"]/,
		message: 'jquery-lite path reference still present'
	},
	{
		id: 'ui-find',
		pattern: /\.ui\.find\s*\(/,
		message: 'Use querySelector/querySelectorAll instead of .ui.find()'
	},
	{
		id: 'jquery-add-class',
		pattern: /\.addClass\s*\(/,
		message: 'Use classList.add() instead of .addClass()'
	},
	{
		id: 'jquery-remove-class',
		pattern: /\.removeClass\s*\(/,
		message: 'Use classList.remove() instead of .removeClass()'
	},
	{
		id: 'jquery-has-class',
		pattern: /\.hasClass\s*\(/,
		message: 'Use classList.contains() instead of .hasClass()'
	},
	{
		id: 'jquery-val',
		pattern: /\.val\s*\(/,
		message: 'Use .value instead of .val()'
	},
	{
		id: 'jquery-html-setter',
		pattern: /\.html\s*\(\s*[^)]/,
		message: 'Use innerHTML/textContent instead of .html()'
	},
	{
		id: 'jquery-text-setter',
		pattern: /\.text\s*\(\s*[^)]/,
		message: 'Use textContent or DOM.setFormattedText instead of .text()'
	},
	{
		id: 'jquery-css',
		pattern: /\.css\s*\(\s*[\{'"]/,
		message: 'Use DOM.setCss or element.style instead of .css()'
	},
	{
		id: 'parsehtml-bind-component',
		pattern: /parseHTML\.bind\s*\(\s*this\s*\)/,
		message: 'parseHTML uses the DOM node as `this` — use parseElementTree(root) or parseHTML.call(element), not parseHTML.bind(this)'
	},
	{
		id: 'innerhtml-empty-chain',
		pattern: /\.innerHTML\s*=\s*['"]["']\.innerHTML\s*=/,
		message: 'Broken jQuery .html(x) migration — assign element.innerHTML = value directly'
	},
	{
		id: 'add-event-listener-assignment',
		pattern: /^\s*(?:var\s+)?[\w$]+\s*=\s*[^=;\n]+\.addEventListener\s*\(/,
		message: 'addEventListener returns undefined — store the element first, then call addEventListener'
	},
	{
		id: 'innerhtml-assignment-chain',
		pattern: /^\s*(?:var\s+)?[\w$]+\s*=\s*[^=;\n]+\.innerHTML\s*=\s*['"]/,
		message: 'innerHTML assignment returns a string — store the element first, then set innerHTML (jQuery .html() migration footgun)'
	},
	{
		id: 'focus-chain',
		pattern: /\.focus\s*\(\s*\)\s*\.\w+/,
		message: 'DOM methods do not chain like jQuery (e.g. use focus(); select();)'
	},
	{
		id: 'query-selector-index',
		pattern: /\.querySelector\s*\([^)]+\)\s*\[\s*0\s*\]/,
		message: 'querySelector already returns a single element; [0] is unnecessary'
	},
	{
		id: 'query-selector-all-index-zero',
		pattern: /\.querySelectorAll\s*\([^)]+\)\s*\[\s*0\s*\]/,
		message: 'Prefer querySelector() when only the first match is needed'
	},
	{
		id: 'add-event-listener-chain',
		pattern: /\.addEventListener\s*\([^)]*\)\s*\.addEventListener/,
		message: 'addEventListener returns undefined — use separate calls on the same element'
	},
	{
		id: 'handler-add-event-listener-chain',
		pattern: /\}\)\s*\.addEventListener/,
		message: 'Do not chain .addEventListener after a handler (jQuery-style); call addEventListener again on the element'
	},
	{
		id: 'delegated-add-event-listener',
		pattern: /addEventListener\s*\(\s*['"][^'"]+['"]\s*,\s*['"][.#\[]/,
		message: 'Use DOM.addDelegatedEvent(container, event, selector, handler) for delegated events'
	},
	{
		id: 'document-get-element-by-id-lvlup-base',
		pattern: /document\.getElementById\s*\(\s*['"]lvlup_base['"]\s*\)/,
		message: 'Use this.ui.querySelector(\'#lvlup_base\') for Equipment level-up buttons (document.getElementById fails before append)'
	},
	{
		id: 'comma-selector-add-event-listener',
		pattern: /\.querySelector\s*\(\s*['"][^'"]*,[^'"]*['"]\s*\)\.addEventListener/,
		message: 'querySelector with a comma selector only matches the first element — use querySelectorAll().forEach() or DOM.addDelegatedEvent()'
	},
	{
		id: 'html-string-before',
		pattern: /\.before\s*\(\s*[`'"]\s*</,
		message: 'Use insertAdjacentHTML(\'beforebegin\', html) instead of .before() with HTML strings (jQuery parsed HTML; native before() does not)'
	},
	{
		id: 'jquery-element-append',
		pattern: /\.append\s*\(\s*[`'"]\s*</,
		message: 'Use insertAdjacentHTML(\'beforeend\', html) instead of .append() with HTML strings (native Element.append accepts only Nodes)'
	},
	{
		id: 'jquery-element-append-concat',
		pattern: /\.append\s*\(\s*['"][^'"]*['"]\s*\+/,
		message: 'Use insertAdjacentHTML(\'beforeend\', html) instead of .append() with HTML string concatenation'
	},
	{
		id: 'jquery-element-append-html-var',
		pattern: /\.append\s*\(\s*\w*(?:text|html|HTML|Text|Html)\w*\s*\)/,
		message: 'Use createElement+innerHTML+appendChild or insertAdjacentHTML instead of .append() with HTML string variables'
	},
	{
		id: 'query-selector-classlist-runtime',
		pattern: /\.querySelector\s*\(\s*['"][^'"]*\.(?:selected|changed|selection|active|online|disabled|upgradable|needleSkill|counterSkill|extraRow)\b[^'"]*['"]\s*\)\.classList/,
		message: 'Runtime state selector may be absent — use querySelectorAll().forEach() or guard before .classList'
	},
	{
		id: 'classlist-remove-dot-prefix',
		pattern: /\.classList\.remove\s*\(\s*['"]\./,
		message: 'classList.remove() takes a class name without a leading dot (jQuery removeClass migration footgun)'
	},
	{
		id: 'query-selector-remove-runtime',
		pattern: /\.querySelector\s*\(\s*['"][^'"]*\.(?:upgradable|needleSkill|counterSkill|extraRow)\b[^'"]*['"]\s*\)\.remove\s*\(/,
		message: 'Runtime state selector may be absent — use querySelectorAll().forEach(el => el.remove())'
	},
	{
		id: 'get-element-by-id-comma',
		pattern: /document\.getElementById\s*\(\s*['"][^'"]*,[^'"]*['"]\s*\)/,
		message: 'document.getElementById() accepts a single id — use separate lookups or querySelector for comma selectors'
	},
	{
		id: 'jquery-dom-toggle-queryselector',
		pattern: /\.querySelector\s*\([^)]+\)\.toggle\s*\(/,
		message: 'Use DOM.toggleDisplay(element) instead of querySelector(...).toggle() (jQuery migration leftover)'
	},
	{
		id: 'document-query-selector-remove',
		pattern: /document\.querySelector\s*\([^)]+\)\.remove\s*\(/,
		message: 'querySelector may return null — use Component.remove() or guard before .remove() (jQuery .remove() was a no-op on empty sets)'
	},
	{
		id: 'query-selector-remove-unguarded',
		pattern: /(?<![?.\w])\w+\.querySelector\s*\([^)]+\)\.remove\s*\(/,
		message: 'querySelector may return null — guard with if (el) el.remove() or use querySelectorAll().forEach(el => el.remove())'
	},
	{
		id: 'uicomponent-style-display',
		pattern: /\b(?:Navigation|CashShop|NpcBox|NpcMenu|InputBox|SkillList|Guild|Rodex|ChatBox|MobileUI|ChatRoomCreate)\.style\.display\s*=/,
		message: 'UIComponent modules are not DOM elements — use component.ui with DOM.show/hide/toggleDisplay'
	},
	{
		id: 'query-selector-new-item-style',
		pattern: /\.querySelector\s*\(\s*['"]\.new_item['"]\s*\)\.style/,
		message: '.new_item exists only on item rows — use querySelectorAll(\'.new_item\').forEach() or clearNewItems() (jQuery was no-op on empty sets)'
	},
];

/** Full-file patterns (may span lines). */
var FILE_RULES = [
	{
		id: 'add-event-listener-continuation-chain',
		pattern: /\.addEventListener\s*\([^)]*\)\s*\n\s*\.addEventListener/,
		message: 'addEventListener returns undefined — split chained listeners onto the element variable'
	},
	{
		id: 'dynamic-header-input-init',
		pattern: /\.querySelector\s*\(\s*['"]\.header input['"]\s*\)\.addEventListener/,
		message: 'ChatBox tab inputs are created in addNewTab() — use DOM.addDelegatedEvent(this.ui, event, \'.header input\', handler)'
	},
	{
		id: 'query-selector-classlist-multiline',
		pattern: /\.querySelector\s*\([^)]+\)\s*\n\s*\.classList/,
		message: 'querySelector may return null — use querySelectorAll().forEach() or guard before .classList (common jQuery removeClass migration footgun)'
	},
	{
		id: 'jquery-element-append-multiline',
		pattern: /\.append\s*\(\s*\n\s*[`'"]/,
		message: 'Use insertAdjacentHTML(\'beforeend\', html) instead of .append() with HTML strings (native Element.append accepts only Nodes in some environments)'
	},
	{
		id: 'npcbox-stylesheet-hidden-buttons',
		files: ['NpcBox.js'],
		pattern: /querySelector\s*\(\s*['"]\.(?:next|close)['"]\s*\)\.style\.display\s*=\s*['"]["']/,
		message: 'NpcBox .btn buttons are hidden in CSS — use DOM.show() for Next/Close, not style.display = ""'
	},
	{
		id: 'npcbox-active-guard',
		files: ['EntityControl.js'],
		pattern: /if\s*\(\s*!NpcBox\.ui\s*\|\|\s*!DOM\.isVisible\s*\(\s*NpcBox\.ui\s*\)\s*\)/,
		message: 'NpcBox.ui persists after remove() — guard NPC hover/click with NpcBox.__active (UIComponent.__active flag)'
	},
	{
		id: 'ui-overflow-fix-getoffset',
		files: ['UIComponent.js', 'UIManager.js'],
		pattern: /getOffset\s*\(\s*(?:this\.)?ui\s*\)/,
		message: 'Viewport overflow fix should use DOM.clampWindowPosition (style top/left), not getOffset document coords'
	}
];

/** Selectors created at runtime — skip HTML presence audit. */
var DYNAMIC_SELECTOR_PREFIXES = [
	'.level .current',
	'.icon',
	'.tabs button',
	'.monster-select',
	'table.header tr td.tab',
	'.body .content',
	'.content[data-content',
	'.node',
	'.content .name',
	'.content .selection',
	'.name',
	'#main-menu .menu',
	'.skill'
];

function findComponentHtml(jsPath) {
	var dir = path.dirname(jsPath);
	var base = path.basename(jsPath, '.js');
	var candidates = [
		path.join(dir, base + '.html'),
		path.join(dir, base.replace(/V\d+$/, '') + '.html')
	];

	for (var i = 0; i < candidates.length; i++) {
		if (fs.existsSync(candidates[i])) {
			return candidates[i];
		}
	}

	return null;
}

function isDynamicSelector(selector) {
	if (selector.indexOf(',') !== -1) {
		return true;
	}

	// State / selection classes are usually applied at runtime, not in static HTML.
	if (/\.(selected|changed|selection|active|online|disabled|upgradable|needleSkill)\b/.test(selector)) {
		return true;
	}

	for (var i = 0; i < DYNAMIC_SELECTOR_PREFIXES.length; i++) {
		if (selector.indexOf(DYNAMIC_SELECTOR_PREFIXES[i]) === 0) {
			return true;
		}
	}

	return false;
}

function checkDomImportAudit() {
	var issues = [];

	walk(SRC).forEach(function(filePath) {
		if (path.basename(filePath) === 'DOM.js') {
			return;
		}

		var content = fs.readFileSync(filePath, 'utf8');
		if (!/\bDOM\./.test(content)) {
			return;
		}

		var headerMatch = content.match(/^\/\*\*[\s\S]*?\*\//);
		var withoutHeader = headerMatch ? content.slice(headerMatch[0].length) : content;
		var hasImport = /(?:var|const|let)\s+DOM\s*=\s*require\s*\(\s*['"]Utils\/DOM['"]\s*\)/.test(withoutHeader) ||
			/define\s*\(\s*\[[^\]]*['"]Utils\/DOM['"]/.test(content);

		if (headerMatch && /var\s+DOM\s*=\s*require\s*\(\s*['"]Utils\/DOM['"]\s*\)/.test(headerMatch[0]) && !hasImport) {
			issues.push({
				file: path.relative(ROOT, filePath),
				line: 1,
				rule: 'dom-import-in-header-comment',
				message: 'Utils/DOM import is inside the file header comment — move it into define() dependencies',
				text: 'var DOM = require(\'Utils/DOM\')'
			});
			return;
		}

		if (!hasImport) {
			var domUse = withoutHeader.match(/\bDOM\./);
			var useLine = domUse ? content.substring(0, content.indexOf(domUse[0])).split('\n').length : 1;
			issues.push({
				file: path.relative(ROOT, filePath),
				line: useLine,
				rule: 'missing-dom-import',
				message: 'File uses DOM.* but does not import Utils/DOM (var DOM = require(...) or define([..., \'Utils/DOM\', ...]))',
				text: domUse ? domUse[0] : 'DOM.'
			});
		}
	});

	return issues;
}

function checkSelectorAudit() {
	var JSDOM;
	try {
		JSDOM = require('jsdom').JSDOM;
	} catch (e) {
		return [];
	}

	var issues = [];
	var listenerRe = /\.querySelector\s*\(\s*['"]([^'"]+)['"]\s*\)\.addEventListener/g;
	var classListRe = /\.querySelector\s*\(\s*['"]([^'"]+)['"]\s*\)\.classList/g;

	walk(SRC).forEach(function(jsPath) {
		if (jsPath.indexOf(path.join('UI', 'Components')) === -1) {
			return;
		}

		var htmlPath = findComponentHtml(jsPath);
		if (!htmlPath) {
			return;
		}

		var source = fs.readFileSync(jsPath, 'utf8');
		var html = fs.readFileSync(htmlPath, 'utf8');
		var dom = new JSDOM('<!DOCTYPE html><body></body>');
		var template = dom.window.document.createElement('template');
		template.innerHTML = html.trim();
		var ui = template.content.firstChild;
		if (!ui) {
			return;
		}

		[listenerRe, classListRe].forEach(function(re) {
			var match;
			while ((match = re.exec(source))) {
				var selector = match[1];
				if (isDynamicSelector(selector)) {
					continue;
				}
				if (!ui.querySelector(selector)) {
					var lineNum = source.substring(0, match.index).split('\n').length;
					var rule = re === listenerRe ? 'init-selector-missing-in-html' : 'init-classlist-selector-missing-in-html';
					var action = re === listenerRe ? 'addEventListener' : 'classList';
					issues.push({
						file: path.relative(ROOT, jsPath),
						line: lineNum,
						rule: rule,
						message: 'querySelector("' + selector + '") returns null in ' + path.basename(htmlPath) + ' — ' + action + ' will throw',
						text: match[0]
					});
				}
			}
		});
	});

	return issues;
}

var SKILL_LEVEL_FILES = [
	path.join(SRC, 'UI/Components/SkillList/SkillList/SkillList.js'),
	path.join(SRC, 'UI/Components/SkillList/SkillListV0/SkillListV0.js'),
	path.join(SRC, 'UI/Components/SkillListMH/SkillListMH.js'),
	path.join(SRC, 'UI/Components/Guild/Guild.js')
];

var SKILL_LEVEL_ACCESS_RE = /element\.querySelector\s*\(\s*['"]\.level \.current(?:Up|Down)['"]\s*\)\.(?:style|addEventListener)/g;

function isInsideBSeperateLvBlock(content, index) {
	var before = content.substring(0, index);
	var lastIf = before.lastIndexOf('if (sk.bSeperateLv)');
	if (lastIf === -1) {
		return false;
	}

	var slice = content.substring(lastIf, index);
	var depth = 0;
	for (var i = 0; i < slice.length; i++) {
		if (slice.charAt(i) === '{') {
			depth++;
		}
		if (slice.charAt(i) === '}') {
			depth--;
		}
	}

	return depth > 0;
}

function checkSkillSeparateLevelAudit() {
	var issues = [];

	SKILL_LEVEL_FILES.forEach(function(filePath) {
		if (!fs.existsSync(filePath)) {
			return;
		}

		var content = fs.readFileSync(filePath, 'utf8');
		var match;

		while ((match = SKILL_LEVEL_ACCESS_RE.exec(content))) {
			if (isInsideBSeperateLvBlock(content, match.index)) {
				continue;
			}

			var lineNum = content.substring(0, match.index).split('\n').length;
			issues.push({
				file: path.relative(ROOT, filePath),
				line: lineNum,
				rule: 'skill-level-button-unconditional',
				message: 'currentUp/currentDown exist only when sk.bSeperateLv — guard with if (sk.bSeperateLv) before .style or addEventListener',
				text: match[0]
			});
		}
	});

	return issues;
}

function walk(dir, files) {
	files = files || [];
	fs.readdirSync(dir).forEach(function(name) {
		var full = path.join(dir, name);
		var stat = fs.statSync(full);
		if (stat.isDirectory()) {
			if (!SKIP_DIRS.has(name)) {
				walk(full, files);
			}
			return;
		}
		if (name.endsWith('.js')) {
			files.push(full);
		}
	});
	return files;
}

function checkFile(filePath) {
	var rel = path.relative(ROOT, filePath);
	var lines = fs.readFileSync(filePath, 'utf8').split('\n');
	var issues = [];

	lines.forEach(function(line, index) {
		var trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) {
			return;
		}

		RULES.forEach(function(rule) {
			if (rule.pattern.test(line)) {
				issues.push({
					file: rel,
					line: index + 1,
					rule: rule.id,
					message: rule.message,
					text: trimmed
				});
			}
		});
	});

	var content = lines.join('\n');
	FILE_RULES.forEach(function(rule) {
		if (rule.files && rule.files.indexOf(path.basename(filePath)) === -1) {
			return;
		}

		var match = rule.pattern.exec(content);
		if (match) {
			var lineNum = content.substring(0, match.index).split('\n').length;
			issues.push({
				file: rel,
				line: lineNum,
				rule: rule.id,
				message: rule.message,
				text: '(multiline pattern)'
			});
		}
	});

	return issues;
}

function main() {
	var files = walk(SRC);
	var issues = [];

	files.forEach(function(filePath) {
		issues = issues.concat(checkFile(filePath));
	});

	issues = issues.concat(checkDomImportAudit());
	issues = issues.concat(checkSelectorAudit());
	issues = issues.concat(checkSkillSeparateLevelAudit());

	if (issues.length === 0) {
		console.log('check-migration: OK (' + files.length + ' files scanned)');
		process.exit(0);
	}

	console.error('check-migration: found ' + issues.length + ' issue(s)\n');
	issues.forEach(function(issue) {
		console.error(issue.file + ':' + issue.line + ' [' + issue.rule + ']');
		console.error('  ' + issue.message);
		console.error('  ' + issue.text);
		console.error('');
	});
	process.exit(1);
}

main();
