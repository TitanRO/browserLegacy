#!/usr/bin/env node
/**
 * Fix broken backgroundImage URL patterns where closing quote is missing.
 *
 * Current broken state (after failed fixes):
 *   .style.backgroundImage = 'url('+ data +);    (missing closing quote before paren)
 *   .style.backgroundImage = 'url('+ data + );   (same with space)
 *
 * Correct form: .style.backgroundImage = 'url('+ data +')';
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
let linesFixed = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    const original = content;

    const lines = content.split('\n');
    let changed = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.includes('.style.backgroundImage') || !line.includes("'url(")) {
            continue;
        }

        // Check for broken pattern: ends with + expr +);  or + expr + );
        // i.e., the concatenated close paren '+)' is missing the closing quote: should be +')'
        // Pattern: + data + );  →  + data + ')';
        // Pattern: + data +);   →  + data +')';
        let fixed = line;

        // Case 1: ...'url('+ data +);  (missing the ');  at end, just +); left)
        // After second failed fix, pattern is: .style.backgroundImage = 'url('+ data +);
        fixed = fixed.replace(/(\+\s*)(\);)(\s*)$/, "$1')$2$3");

        if (fixed !== line) {
            lines[i] = fixed;
            changed = true;
            linesFixed++;
            console.log(`  Line ${i+1}: ${line.trim().substring(0, 80)}`);
            console.log(`       → ${fixed.trim().substring(0, 80)}`);
        }
    }

    if (changed) {
        content = lines.join('\n');
        fs.writeFileSync(file, content, 'utf8');
        console.log('Fixed: ' + file.replace(srcDir + '/', ''));
        totalFixed++;
    }
}

console.log(`\nDone. Fixed ${linesFixed} lines in ${totalFixed} files.`);
