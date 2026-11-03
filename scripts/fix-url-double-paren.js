#!/usr/bin/env node
/**
 * Fix broken backgroundImage URL patterns where previous fix introduced double-paren.
 *
 * Before: .style.backgroundImage = 'url('+ data +'');   (two quotes, no closing paren)
 * After first fix: .style.backgroundImage = 'url('+ data +'));  (one quote missing, extra paren)
 * Correct: .style.backgroundImage = 'url('+ data +')';   (proper closing)
 *
 * Also handles: 'url('+ data + '));
 */

const fs = require('fs');
const path = require('path');

function findJsFiles(dir) {
    const files = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...findJsFiles(fullPath));
            } else if (entry.name.endsWith('.js')) {
                files.push(fullPath);
            }
        }
    } catch(e) {}
    return files;
}

const srcDir = path.join(__dirname, '..', 'src');
const files = findJsFiles(srcDir);

let totalFixed = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    const original = content;

    // Fix the double-paren issue: +'));  →  +')';
    // Also: + '));  →  + ')';
    // Pattern: ends with +' followed by )); (an extra paren remains from .css() migration)
    const lines = content.split('\n');
    let changed = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('.style.backgroundImage') && line.includes("'url(")) {
            // Check for the double-paren broken pattern: ends with '));
            // i.e., the line has: 'url('+ expr +'));
            // Fix: remove the extra ) before the ;
            const fixed = line.replace(/(\+\s*')\)\s*\);(\s*)$/, "$1);$2");
            if (fixed !== line) {
                lines[i] = fixed;
                changed = true;
            }
        }
    }

    if (changed) {
        content = lines.join('\n');
        fs.writeFileSync(file, content, 'utf8');
        console.log('Fixed: ' + file.replace(srcDir + '/', ''));
        totalFixed++;
    }
}

console.log('\nDone. Fixed ' + totalFixed + ' files.');
