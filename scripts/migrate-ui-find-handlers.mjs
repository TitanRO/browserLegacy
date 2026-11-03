#!/usr/bin/env node
/**
 * Migrate remaining .ui.find() handler lines (single-line handlers only).
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
	if (!/\.ui\.find\(|\bui\.find\(/.test(line)) {
		return line;
	}

	let out = line;
	const rules = [
		// assignment + mousedown/click one-liners
		[new RegExp(`(\\w+)\\s*=\\s*${ROOT}\\.find\\(${SEL}\\)\\.(mousedown|click|dblclick)\\(\\s*function\\s*\\(([^)]*)\\)\\s*\\{([^}]*)\\}\\s*\\)`, 'g'),
			(_m, name, root, sel, type, params, body) => `{var _el=${root}.querySelector(${sel});${name}=_el;if(_el)_el.addEventListener('${type}',function(${params}){${body}});}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.(mousedown|click|dblclick|change|keydown)\\(\\s*function\\s*\\(([^)]*)\\)\\s*\\{([^}]*)\\}\\s*\\)`, 'g'),
			(_m, root, sel, type, params, body) => `{var _el=${root}.querySelector(${sel});if(_el)_el.addEventListener('${type}',function(${params}){${body}});}`],
		[new RegExp(`${ROOT}\\.find\\(${SEL}\\)\\.(mousedown|click|dblclick)\\(\\s*([\\w.]+)\\s*\\)`, 'g'),
			(_m, root, sel, type, handler) => `{var _el=${root}.querySelector(${sel});if(_el)_el.addEventListener('${type}',${handler});}`],
		[new RegExp(`\\bui\\.find\\(${SEL}\\)\\.(mousedown|click|dblclick|keydown)\\(\\s*function\\s*\\(([^)]*)\\)\\s*\\{([^}]*)\\}\\s*\\)`, 'g'),
			(_m, sel, type, params, body) => `{var _el=ui.querySelector(${sel});if(_el)_el.addEventListener('${type}',function(${params}){${body}});}`],
		[new RegExp(`\\bui\\.find\\(${SEL}\\)\\.(mousedown|click|dblclick)\\(\\s*([\\w.]+)\\s*\\)`, 'g'),
			(_m, sel, type, handler) => `{var _el=ui.querySelector(${sel});if(_el)_el.addEventListener('${type}',${handler});}`],
	];
	for (const [re, repl] of rules) {
		out = out.replace(re, repl);
	}
	return out;
}

const files = walk(SRC).filter((f) => /\.ui\.find\(|\bui\.find\(/.test(fs.readFileSync(f, 'utf8')));
let changed = 0;

for (const file of files) {
	const original = fs.readFileSync(file, 'utf8');
	const out = original.split('\n').map(migrateLine).join('\n');
	if (out !== original) {
		fs.writeFileSync(file, out);
		changed++;
		console.log('migrated:', path.relative(SRC, file));
	}
}

console.log(`Done. ${changed} files updated.`);
