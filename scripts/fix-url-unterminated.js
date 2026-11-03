#!/usr/bin/env node
/**
 * Fix broken backgroundImage URL patterns where the string is unterminated.
 *
 * Current broken state:
 *   .style.backgroundImage = 'url('+ data +');    <- unterminated: string opened with ', has ) then ;
 *
 * Correct form: .style.backgroundImage = 'url('+ data +')';
 *
 * The broken pattern: +'); has a quote that opens a string, ) inside, then ; terminates statement
 * The correct pattern: +')'; the ') closes the string, then ; ends the statement
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
        if (!line.includes('.style.backgroundImage') && !line.includes("css('backgroundImage'")) {
            continue;
        }
        if (!line.includes("'url(")) {
            continue;
        }

        let fixed = line;

        // Pattern: +'  + SOMETHING + ');   (ends with quote, paren, semicolon without closing quote)
        // i.e., +'   opens string, ) is inside it, but ; comes without closing quote
        // Fix: +');  → +')';
        // But only if the line doesn't already have ')'  which would be correct

        // Check: does the line end with +'); or + ');
        // This matches lines where: expr + '); at end, where ' is opening a string for )
        // But not lines with the correct +')';

        // The broken pattern has: [+]['][)]['][;]  (but the second ' is actually the closing part)
        // Wait: +');  is: + then ' then ) then ' then ;
        // That's 5 chars. The ' at pos 1 opens string, ) at 2 is inside, ' at 3 closes string, ; at 4 ends statement
        // Actually that IS correct! The issue was different...

        // Let me check differently: the WRONG pattern is +');  where the last char before ; is '
        // vs the RIGHT pattern +')'; where there's ' ) ' ;

        // Current pattern in the file (verified by Python inspect):
        // chars at end: + ' ) ;   (no closing quote before semicolon)
        // This means: + opens concat, ' opens string, ) is content, ; TERMINATES without closing string!
        // So the fix is: insert a ' before the ;: +') + ' + ; = +')';

        // Regex: match + [optional space] ' ) ; (end of line or )
        // i.e., (\+\s*')[)];  →  $1)';
        fixed = fixed.replace(/(\+\s*')\);(\s*)$/, "$1)';$2");

        // Also handle the space variant: + ' ) ;
        // (already handled by \s* above)

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
