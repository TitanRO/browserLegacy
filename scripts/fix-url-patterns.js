#!/usr/bin/env node
/**
 * Fix broken backgroundImage URL patterns introduced by migration script.
 *
 * Patterns to fix:
 *   .style.backgroundImage = 'url('+ data +''        → 'url('+ data +')'
 *   .style.backgroundImage = 'url('+ data + ''       → 'url('+ data +')'
 *   .style.backgroundImage = 'url(' + data + ''      → 'url(' + data + ')'
 *   .style.backgroundImage = 'url('+data+''          → 'url('+data+')'
 */

const fs = require('fs');
const path = require('path');
const glob = require('./glob-helper');

// Find all JS files in src/
function findJsFiles(dir) {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...findJsFiles(fullPath));
        } else if (entry.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }
    return files;
}

const srcDir = path.join(__dirname, '..', 'src');
const files = findJsFiles(srcDir);

let totalFixed = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    const original = content;

    // Fix: backgroundImage = 'url('+EXPR+'' or 'url(' + EXPR + ''  (missing closing paren)
    // Pattern: .style.backgroundImage = 'url(' [+-spaces] EXPR [+-spaces] ''
    // The broken pattern ends with two consecutive single quotes '' instead of ')'

    // Fix pattern: 'url('+ expr +'' → 'url('+ expr +')'
    // This regex handles various spacing around + operators
    content = content.replace(
        /\.style\.backgroundImage\s*=\s*'url\('([\s\S]*?)''(?=\s*[;,\n\r])/g,
        (match, inner) => {
            // inner is the content between the outer quotes: + expr +
            return `.style.backgroundImage = 'url('${inner}')'`;
        }
    );

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        const count = (original.match(/\.style\.backgroundImage\s*=\s*'url\('[\s\S]*?''/g) || []).length;
        console.log(`Fixed ${file.replace(srcDir + '/', '')}`);
        totalFixed++;
    }
}

console.log(`\nDone. Fixed ${totalFixed} files.`);
