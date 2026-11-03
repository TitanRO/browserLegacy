#!/usr/bin/env node
/**
 * Safe line-by-line migration: skips lines with function( handlers.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src');
const ROOT = '(?:this\\.ui|[A-Za-z_$][\\w$]*(?:\\.getUI\\(\\))?\\.ui|ui)';
const SEL = '([\'"][^\'"]*[\'"]|[^)]+)';

function walk(dir, out = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) walk(full, out);
		else if (entry.name.endsWith('.js')) out.push(full);
	}
	return out;
}

function migrateLine(line) {
	if (/function\s*\(/.test(line)) {
		return line;
	}
	if (!/\.ui\.find\(|\bui\.find\(/.test(line)) {
		return line;
	}

	let out = line;
	const rules = [
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.hide\\(\\)`, 'g'), (_m, root, sel) => `DOM.hide(${root}.querySelector(${sel}))`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.show\\(\\)`, 'g'), (_m, root, sel) => `DOM.show(${root}.querySelector(${sel}))`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.empty\\(\\)`, 'g'), (_m, root, sel) => `DOM.empty(${root}.querySelector(${sel}))`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.remove\\(\\)`, 'g'), (_m, root, sel) => `{var _el=${root}.querySelector(${sel});if(_el)_el.remove();}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.focus\\(\\)`, 'g'), (_m, root, sel) => `{var _el=${root}.querySelector(${sel});if(_el)_el.focus();}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.select\\(\\)`, 'g'), (_m, root, sel) => `{var _el=${root}.querySelector(${sel});if(_el&&_el.select)_el.select();}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.val\\(([^)]+)\\)`, 'g'), (_m, root, sel, val) => `{var _el=${root}.querySelector(${sel});if(_el)_el.value=${val};}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.text\\(([^)]+)\\)`, 'g'), (_m, root, sel, txt) => `DOM.setFormattedText(${root}.querySelector(${sel}),${txt},DB.getItemInfo)`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.text\\(\\)`, 'g'), (_m, root, sel) => `(${root}.querySelector(${sel})||{}).textContent`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.html\\(([^)]+)\\)`, 'g'), (_m, root, sel, html) => `{var _el=${root}.querySelector(${sel});if(_el)_el.innerHTML=${html};}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.css\\((['"][^'"]+['"]),\\s*([^)]+)\\)`, 'g'), (_m, root, sel, prop, val) => `DOM.setCss(${root}.querySelector(${sel}),${prop},${val})`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.addClass\\(([^)]+)\\)`, 'g'), (_m, root, sel, cls) => `{var _el=${root}.querySelector(${sel});if(_el)_el.classList.add(${cls});}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.removeClass\\(([^)]+)\\)`, 'g'), (_m, root, sel, cls) => `{var _el=${root}.querySelector(${sel});if(_el)_el.classList.remove(${cls});}`],
		[new RegExp(`var\\s+(\\w+)\\s*=\\s*${ROOT}\\.find\\(${SEL}\\)`, 'g'), (_m, name, root, sel) => `var ${name} = ${root}.querySelector(${sel})`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)`, 'g'), (_m, root, sel) => `${root}.querySelector(${sel})`],
	];
	for (const [re, repl] of rules) {
		out = out.replace(re, repl);
	}
	return out;
}

function ensureDomImport(source) {
	if (source.includes("'Utils/DOM'") || source.includes('"Utils/DOM"')) return source;
	if (/define\s*\(\s*function\s*\(\s*require\s*\)/.test(source)) {
		if (!source.includes("require('Utils/DOM')")) {
			source = source.replace(
				/(\tvar\s+\w+\s+=\s+require\([^;]+;\n)/,
				"$1\tvar DOM       = require('Utils/DOM');\n"
			);
		}
		return source;
	}
	const m = source.match(/define\s*\(\s*\[([\s\S]*?)\]\s*,/);
	if (!m) return source;
	const deps = m[1].trim();
	const newDeps = deps ? `['Utils/DOM', ${deps}]` : "['Utils/DOM']";
	return source
		.replace(/define\s*\(\s*\[[\s\S]*?\]\s*,/, `define( ${newDeps},`)
		.replace(/function\s*\(([^)]*)\)/, (_match, args) => args.trim() ? `function( DOM, ${args.trim()})` : 'function( DOM )');
}

const files = walk(SRC).filter((f) => /\.ui\.find\(|\bui\.find\(/.test(fs.readFileSync(f, 'utf8')));
let changed = 0;

for (const file of files) {
	const original = fs.readFileSync(file, 'utf8');
	const migrated = original.split('\n').map(migrateLine).join('\n');
	let out = migrated;
	if (/DOM\.(hide|show|empty|setCss|setFormattedText|trigger)/.test(out) && !original.includes("'Utils/DOM'")) {
		out = ensureDomImport(out);
	}
	if (out !== original) {
		fs.writeFileSync(file, out);
		changed++;
		console.log('migrated:', path.relative(SRC, file));
	}
}

console.log(`Done. ${changed} files updated.`);
