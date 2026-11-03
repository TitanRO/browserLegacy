#!/usr/bin/env node
/**
 * Migrate jQuery-style .ui.find() / ui.find() chains to native DOM helpers.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');

const ROOT = '(this\\.ui|[A-Za-z_$][\\w$]*(?:\\.getUI\\(\\))?\\.ui|ui)';
const SEL = '([\'"][^\'"]*[\'"]|[^)]+)';

function walk(dir, out = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			walk(full, out);
		} else if (entry.name.endsWith('.js')) {
			out.push(full);
		}
	}
	return out;
}

function ensureDomImport(source) {
	if (source.includes("'Utils/DOM'") || source.includes('"Utils/DOM"')) {
		return source;
	}

	if (/define\s*\(\s*function\s*\(\s*require\s*\)/.test(source)) {
		if (!source.includes("require('Utils/DOM')")) {
			if (/(\tvar\s+\w+\s+=\s+require\([^;]+;\n)/.test(source)) {
				source = source.replace(
					/(\tvar\s+\w+\s+=\s+require\([^;]+;\n)/,
					"$1\tvar DOM       = require('Utils/DOM');\n"
				);
			} else {
				source = source.replace(
					/'use strict';\s*\n/,
					"'use strict';\n\n\tvar DOM = require('Utils/DOM');\n\n"
				);
			}
		}
		return source;
	}

	const arrayMatch = source.match(/define\s*\(\s*\[([\s\S]*?)\]\s*,/);
	if (!arrayMatch) {
		return source;
	}

	const deps = arrayMatch[1].trim();
	const fnMatch = source.match(/function\s*\(([^)]*)\)/);
	if (!fnMatch) {
		return source;
	}

	const fnArgs = fnMatch[1].trim();
	const newDeps = deps ? `['Utils/DOM', ${deps}]` : "['Utils/DOM']";
	const newArgs = fnArgs ? `DOM, ${fnArgs}` : 'DOM';

	return source
		.replace(/define\s*\(\s*\[[\s\S]*?\]\s*,/, `define( ${newDeps},`)
		.replace(/function\s*\([^)]*\)/, `function( ${newArgs})`);
}

function migrateContent(source) {
	let out = source;

	const rules = [
		// Chained terminal methods (longest first)
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.empty\\(\\)\\.append\\(([^)]+)\\)`, 'g'),
			(_m, root, sel, child) => `{var _el=${root}.querySelector(${sel});if(_el){_el.innerHTML='';_el.appendChild(${child});}}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.empty\\(\\)\\.html\\(([^)]+)\\)`, 'g'),
			(_m, root, sel, html) => `{var _el=${root}.querySelector(${sel});if(_el){_el.innerHTML='';_el.innerHTML=${html};}}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.text\\(([^)]+)\\)\\.addClass\\(([^)]+)\\)`, 'g'),
			(_m, root, sel, txt, cls) => `{var _el=${root}.querySelector(${sel});if(_el){DOM.setFormattedText(_el,${txt},DB.getItemInfo);_el.classList.add(${cls});}}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.text\\(([^)]+)\\)\\.show\\(\\)`, 'g'),
			(_m, root, sel, txt) => `{var _el=${root}.querySelector(${sel});if(_el){DOM.setFormattedText(_el,${txt},DB.getItemInfo);_el.style.display='';}}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.removeClass\\(([^)]+)\\)\\.removeAttr\\(([^)]+)\\)`, 'g'),
			(_m, root, sel, cls, attr) => `{var _el=${root}.querySelector(${sel});if(_el){_el.classList.remove(${cls});_el.removeAttribute(${attr});}}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.addClass\\(([^)]+)\\)\\.attr\\(([^,]+),\\s*([^)]+)\\)`, 'g'),
			(_m, root, sel, cls, attr, val) => `{var _el=${root}.querySelector(${sel});if(_el){_el.classList.add(${cls});_el.setAttribute(${attr},${val});}}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.empty\\(\\)\\.hide\\(\\)`, 'g'),
			(_m, root, sel) => `{var _el=${root}.querySelector(${sel});if(_el){_el.innerHTML='';_el.style.display='none';}}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.removeClass\\(([^)]+)\\)`, 'g'),
			(_m, root, sel, cls) => `{var _el=${root}.querySelector(${sel});if(_el)_el.classList.remove(${cls});}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.addClass\\(([^)]+)\\)`, 'g'),
			(_m, root, sel, cls) => `{var _el=${root}.querySelector(${sel});if(_el)_el.classList.add(${cls});}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.removeAttr\\(([^)]+)\\)`, 'g'),
			(_m, root, sel, attr) => `{var _el=${root}.querySelector(${sel});if(_el)_el.removeAttribute(${attr});}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.attr\\(([^,]+),\\s*([^)]+)\\)`, 'g'),
			(_m, root, sel, attr, val) => `{var _el=${root}.querySelector(${sel});if(_el)_el.setAttribute(${attr},${val});}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.css\\((\\{[^}]+\\})\\)`, 'g'),
			(_m, root, sel, props) => `DOM.setCss(${root}.querySelector(${sel}),${props})`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.css\\((['"][^'"]+['"]),\\s*([^)]+)\\)`, 'g'),
			(_m, root, sel, prop, val) => `DOM.setCss(${root}.querySelector(${sel}),${prop},${val})`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.trigger\\((['"][^'"]+['"])\\)`, 'g'),
			(_m, root, sel, type) => `DOM.trigger(${root}.querySelector(${sel}),${type})`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.select\\(\\)`, 'g'),
			(_m, root, sel) => `{var _el=${root}.querySelector(${sel});if(_el&&_el.select)_el.select();}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.focus\\(\\)`, 'g'),
			(_m, root, sel) => `{var _el=${root}.querySelector(${sel});if(_el)_el.focus();}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.empty\\(\\)`, 'g'),
			(_m, root, sel) => `DOM.empty(${root}.querySelector(${sel}))`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.hide\\(\\)`, 'g'),
			(_m, root, sel) => `DOM.hide(${root}.querySelector(${sel}))`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.show\\(\\)`, 'g'),
			(_m, root, sel) => `DOM.show(${root}.querySelector(${sel}))`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.remove\\(\\)`, 'g'),
			(_m, root, sel) => `{var _el=${root}.querySelector(${sel});if(_el)_el.remove();}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.html\\(([^)]+)\\)`, 'g'),
			(_m, root, sel, html) => `{var _el=${root}.querySelector(${sel});if(_el)_el.innerHTML=${html};}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.val\\(([^)]+)\\)`, 'g'),
			(_m, root, sel, val) => `{var _el=${root}.querySelector(${sel});if(_el)_el.value=${val};}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.text\\(([^)]+)\\)`, 'g'),
			(_m, root, sel, txt) => `DOM.setFormattedText(${root}.querySelector(${sel}),${txt},DB.getItemInfo)`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.text\\(\\)`, 'g'),
			(_m, root, sel) => `(${root}.querySelector(${sel})||{}).textContent`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.append\\(([^)]+)\\)`, 'g'),
			(_m, root, sel, child) => `{var _el=${root}.querySelector(${sel});if(_el)_el.appendChild(${child});}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.height\\(\\)`, 'g'),
			(_m, root, sel) => `(${root}.querySelector(${sel})||{offsetHeight:0}).offsetHeight`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.is\\(['"]:visible['"]\\)`, 'g'),
			(_m, root, sel) => `DOM.isVisible(${root}.querySelector(${sel}))`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.click\\(([^)]+)\\)`, 'g'),
			(_m, root, sel, handler) => `{var _el=${root}.querySelector(${sel});if(_el)_el.addEventListener('click',${handler});}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.mousedown\\(([^)]+)\\)`, 'g'),
			(_m, root, sel, handler) => `{var _el=${root}.querySelector(${sel});if(_el)_el.addEventListener('mousedown',${handler});}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.change\\(([^)]+)\\)`, 'g'),
			(_m, root, sel, handler) => `{var _el=${root}.querySelector(${sel});if(_el)_el.addEventListener('change',${handler});}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.on\\((['"][^'"]+['"]),\\s*([^)]+)\\)`, 'g'),
			(_m, root, sel, type, handler) => `{var _el=${root}.querySelector(${sel});if(_el)_el.addEventListener(${type},${handler});}`],
		// Element variable .find() chains
		[new RegExp(`(\\w+)\\.find\\(${SEL}\\)\\.css\\((['"][^'"]+['"]),\\s*([^)]+)\\)`, 'g'),
			(_m, el, sel, prop, val) => `DOM.setCss(${el}.querySelector(${sel}),${prop},${val})`],
		[new RegExp(`(\\w+)\\.find\\(${SEL}\\)\\.text\\(([^)]+)\\)`, 'g'),
			(_m, el, sel, txt) => `DOM.setFormattedText(${el}.querySelector(${sel}),${txt},DB.getItemInfo)`],
		[new RegExp(`(\\w+)\\.find\\(${SEL}\\)\\.click\\(([^)]+)\\)`, 'g'),
			(_m, el, sel, handler) => `{var _el=${el}.querySelector(${sel});if(_el)_el.addEventListener('click',${handler});}`],
		[new RegExp(`(\\w+)\\.find\\(${SEL}\\)\\.remove\\(\\)`, 'g'),
			(_m, el, sel) => `{var _el=${el}.querySelector(${sel});if(_el)_el.remove();}`],
		[new RegExp(`(\\w+)\\.find\\(${SEL}\\)\\.clone\\(\\)`, 'g'),
			(_m, el, sel) => `{var _el=${el}.querySelector(${sel});_el?_el.cloneNode(true):null}`],
		[new RegExp(`(\\w+)\\.find\\(${SEL}\\)`, 'g'),
			(_m, el, sel) => `${el}.querySelector(${sel})`],
		// Assignment
		[new RegExp(`var\\s+(\\w+)\\s*=\\s*${ROOT}\\.find\\(${SEL}\\)`, 'g'),
			(_m, name, root, sel) => `var ${name} = ${root}.querySelector(${sel})`],
		// Bare .find -> querySelector
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)`, 'g'),
			(_m, root, sel) => `${root}.querySelector(${sel})`],
	];

	for (const [re, repl] of rules) {
		out = out.replace(re, repl);
	}

	return out;
}

const files = walk(SRC).filter((file) => {
	const src = fs.readFileSync(file, 'utf8');
	return /\.ui\.find\(|\bui\.find\(/.test(src);
});

let changed = 0;
let errors = [];

for (const file of files) {
	const original = fs.readFileSync(file, 'utf8');
	let migrated = migrateContent(original);
	if (/\.ui\.find\(|\bui\.find\(/.test(migrated) || /\(\w+\)\.find\(/.test(migrated)) {
		migrated = ensureDomImport(migrated);
	}
	if (/\.querySelector\(\d+\)/.test(migrated)) {
		errors.push(path.relative(SRC, file));
		continue;
	}
	if (migrated !== original) {
		fs.writeFileSync(file, migrated);
		changed++;
		console.log('migrated:', path.relative(SRC, file));
	}
}

if (errors.length) {
	console.error('ERRORS - skipped files with bad transforms:', errors);
	process.exit(1);
}

console.log(`Done. ${changed}/${files.length} files updated.`);
