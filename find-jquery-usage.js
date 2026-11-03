#!/usr/bin/env node

/**
 * jQuery Usage Detection Script
 * 
 * This script identifies jQuery usage in .js files to help with modernization.
 * It detects various jQuery patterns including selectors, DOM manipulation,
 * event handlers, utility functions, and more.
 * 
 * Usage: node find-jquery-usage.js [directory]
 */

const fs = require('fs');
const path = require('path');

// jQuery patterns to detect (comprehensive list)
const JQUERY_PATTERNS = [
    // jQuery selector and main function calls
    { pattern: /jQuery\s*\(/g, name: 'jQuery selector/function' },
    { pattern: /\$\s*\(/g, name: 'jQuery $ selector' },
    
    // jQuery DOM manipulation methods
    { pattern: /\.(append|prepend|after|before|insertAfter|insertBefore|wrap|unwrap|replaceWith|remove|empty|clone)\s*\(/g, name: 'jQuery DOM manipulation' },
    { pattern: /\.(html|text|val)\s*\(/g, name: 'jQuery content manipulation' },
    { pattern: /\.(attr|prop|data|removeAttr|removeProp|removeData)\s*\(/g, name: 'jQuery attributes/properties' },
    { pattern: /\.(addClass|removeClass|toggleClass|hasClass)\s*\(/g, name: 'jQuery CSS classes' },
    { pattern: /\.(css|width|height|offset|position|scrollTop|scrollLeft)\s*\(/g, name: 'jQuery CSS/dimensions' },
    { pattern: /\.(show|hide|toggle|fadeIn|fadeOut|fadeToggle|slideDown|slideUp|slideToggle)\s*\(/g, name: 'jQuery effects' },
    
    // jQuery traversal methods
    { pattern: /\.(find|children|parent|parents|siblings|next|prev|nextAll|prevAll|closest|filter|not|is|has)\s*\(/g, name: 'jQuery traversal' },
    
    // jQuery event handlers
    { pattern: /\.(on|off|one|trigger|triggerHandler)\s*\(/g, name: 'jQuery events' },
    { pattern: /\.(click|dblclick|mousedown|mouseup|mousemove|mouseover|mouseout|mouseenter|mouseleave|keydown|keyup|keypress|submit|change|focus|blur|load|unload|resize|scroll)\s*\(/g, name: 'jQuery event shortcuts' },
    
    // jQuery AJAX methods
    { pattern: /jQuery\.(ajax|get|post|getJSON|getScript|load)\s*\(/g, name: 'jQuery AJAX' },
    { pattern: /\$\.(ajax|get|post|getJSON|getScript|load)\s*\(/g, name: 'jQuery $ AJAX' },
    
    // jQuery utility functions
    { pattern: /jQuery\.(extend|each|map|grep|inArray|merge|unique|parseJSON|parseXML|noop|now|trim|isArray|isFunction|isNumeric|isEmptyObject|isPlainObject|isWindow|isXMLDoc|type|isEmptyObject|globalEval|camelCase|nodeName|contains|error|parseHTML|parseJSON|parseXML|noop|now|trim|isArray|isFunction|isNumeric|isEmptyObject|isPlainObject|isWindow|isXMLDoc|type|escape|_data)\s*\(/g, name: 'jQuery utility functions' },
    { pattern: /\$\.(extend|each|map|grep|inArray|merge|unique|parseJSON|parseXML|noop|now|trim|isArray|isFunction|isNumeric|isEmptyObject|isPlainObject|isWindow|isXMLDoc|type|isEmptyObject|globalEval|camelCase|nodeName|contains|error|parseHTML|parseJSON|parseXML|noop|now|trim|isArray|isFunction|isNumeric|isEmptyObject|isPlainObject|isWindow|isXMLDoc|type|escape|_data)\s*\(/g, name: 'jQuery $ utility functions' },
    
    // jQuery object methods
    { pattern: /\.(length|size|get|index|toArray|pushStack|end|andSelf|addBack)\s*\(/g, name: 'jQuery object methods' },
    
    // jQuery deferred/promise
    { pattern: /jQuery\.(Deferred|when|promise)\s*\(/g, name: 'jQuery Deferred/Promise' },
    { pattern: /\$\.(Deferred|when|promise)\s*\(/g, name: 'jQuery $ Deferred/Promise' },
    
    // jQuery animation
    { pattern: /\.(animate|stop|finish|delay|queue|dequeue|clearQueue)\s*\(/g, name: 'jQuery animation' },
    
    // jQuery form methods
    { pattern: /\.(serialize|serializeArray|param)\s*\(/g, name: 'jQuery form methods' },
    
    // jQuery data methods
    { pattern: /\.(data|removeData)\s*\(/g, name: 'jQuery data methods' },
    
    // jQuery ready/document ready
    { pattern: /jQuery\s*\(\s*document\s*\)\s*\.\s*ready\s*\(/g, name: 'jQuery document ready' },
    { pattern: /\$\s*\(\s*document\s*\)\s*\.\s*ready\s*\(/g, name: 'jQuery $ document ready' },
    { pattern: /\$\s*\(\s*function\s*\(/g, name: 'jQuery $ ready shorthand' },
    
    // jQuery plugin patterns
    { pattern: /jQuery\.fn\./g, name: 'jQuery plugin definition' },
    { pattern: /\$\.fn\./g, name: 'jQuery $ plugin definition' },
    
    // jQuery noConflict
    { pattern: /jQuery\.noConflict\s*\(/g, name: 'jQuery noConflict' },
    { pattern: /\$\.noConflict\s*\(/g, name: 'jQuery $ noConflict' },
    
    // jQuery holdReady
    { pattern: /jQuery\.holdReady\s*\(/g, name: 'jQuery holdReady' },
    { pattern: /\$\.holdReady\s*\(/g, name: 'jQuery $ holdReady' },
    
    // jQuery sub
    { pattern: /jQuery\.sub\s*\(/g, name: 'jQuery sub' },
    { pattern: /\$\.sub\s*\(/g, name: 'jQuery $ sub' },
    
    // jQuery speed
    { pattern: /jQuery\.speed\s*\(/g, name: 'jQuery speed' },
    { pattern: /\$\.speed\s*\(/g, name: 'jQuery $ speed' },
    
    // jQuery expr
    { pattern: /jQuery\.expr\s*\[/g, name: 'jQuery expr' },
    { pattern: /\$\.expr\s*\[/g, name: 'jQuery $ expr' },
    
    // jQuery fx
    { pattern: /jQuery\.fx\s*\./g, name: 'jQuery fx' },
    { pattern: /\$\.fx\s*\./g, name: 'jQuery $ fx' },
    
    // jQuery support
    { pattern: /jQuery\.support\s*\./g, name: 'jQuery support' },
    { pattern: /\$\.support\s*\./g, name: 'jQuery $ support' },
    
    // jQuery browser
    { pattern: /jQuery\.browser\s*\./g, name: 'jQuery browser' },
    { pattern: /\$\.browser\s*\./g, name: 'jQuery $ browser' },
    
    // jQuery boxModel
    { pattern: /jQuery\.boxModel/g, name: 'jQuery boxModel' },
    { pattern: /\$\.boxModel/g, name: 'jQuery $ boxModel' },
    
    // jQuery cssHooks
    { pattern: /jQuery\.cssHooks\s*\[/g, name: 'jQuery cssHooks' },
    { pattern: /\$\.cssHooks\s*\[/g, name: 'jQuery $ cssHooks' },
    
    // jQuery cssNumber
    { pattern: /jQuery\.cssNumber\s*\[/g, name: 'jQuery cssNumber' },
    { pattern: /\$\.cssNumber\s*\[/g, name: 'jQuery $ cssNumber' },
    
    // jQuery cssProps
    { pattern: /jQuery\.cssProps\s*\[/g, name: 'jQuery cssProps' },
    { pattern: /\$\.cssProps\s*\[/g, name: 'jQuery $ cssProps' },
    
    // jQuery error
    { pattern: /jQuery\.error\s*\(/g, name: 'jQuery error' },
    { pattern: /\$\.error\s*\(/g, name: 'jQuery $ error' },
    
    // jQuery expando
    { pattern: /jQuery\.expando/g, name: 'jQuery expando' },
    { pattern: /\$\.expando/g, name: 'jQuery $ expando' },
    
    // jQuery guid
    { pattern: /jQuery\.guid/g, name: 'jQuery guid' },
    { pattern: /\$\.guid/g, name: 'jQuery $ guid' },
    
    // jQuery now
    { pattern: /jQuery\.now\s*\(/g, name: 'jQuery now' },
    { pattern: /\$\.now\s*\(/g, name: 'jQuery $ now' },
    
    // jQuery proxy
    { pattern: /jQuery\.proxy\s*\(/g, name: 'jQuery proxy' },
    { pattern: /\$\.proxy\s*\(/g, name: 'jQuery $ proxy' },
    
    // jQuery type
    { pattern: /jQuery\.type\s*\(/g, name: 'jQuery type' },
    { pattern: /\$\.type\s*\(/g, name: 'jQuery $ type' },
    
    // jQuery unique
    { pattern: /jQuery\.unique\s*\(/g, name: 'jQuery unique' },
    { pattern: /\$\.unique\s*\(/g, name: 'jQuery $ unique' },
    
    // jQuery merge
    { pattern: /jQuery\.merge\s*\(/g, name: 'jQuery merge' },
    { pattern: /\$\.merge\s*\(/g, name: 'jQuery $ merge' },
    
    // jQuery grep
    { pattern: /jQuery\.grep\s*\(/g, name: 'jQuery grep' },
    { pattern: /\$\.grep\s*\(/g, name: 'jQuery $ grep' },
    
    // jQuery map
    { pattern: /jQuery\.map\s*\(/g, name: 'jQuery map' },
    { pattern: /\$\.map\s*\(/g, name: 'jQuery $ map' },
    
    // jQuery inArray
    { pattern: /jQuery\.inArray\s*\(/g, name: 'jQuery inArray' },
    { pattern: /\$\.inArray\s*\(/g, name: 'jQuery $ inArray' },
    
    // jQuery makeArray
    { pattern: /jQuery\.makeArray\s*\(/g, name: 'jQuery makeArray' },
    { pattern: /\$\.makeArray\s*\(/g, name: 'jQuery $ makeArray' },
    
    // jQuery parseJSON
    { pattern: /jQuery\.parseJSON\s*\(/g, name: 'jQuery parseJSON' },
    { pattern: /\$\.parseJSON\s*\(/g, name: 'jQuery $ parseJSON' },
    
    // jQuery parseXML
    { pattern: /jQuery\.parseXML\s*\(/g, name: 'jQuery parseXML' },
    { pattern: /\$\.parseXML\s*\(/g, name: 'jQuery $ parseXML' },
    
    // jQuery noop
    { pattern: /jQuery\.noop/g, name: 'jQuery noop' },
    { pattern: /\$\.noop/g, name: 'jQuery $ noop' },
    
    // jQuery globalEval
    { pattern: /jQuery\.globalEval\s*\(/g, name: 'jQuery globalEval' },
    { pattern: /\$\.globalEval\s*\(/g, name: 'jQuery $ globalEval' },
    
    // jQuery camelCase
    { pattern: /jQuery\.camelCase\s*\(/g, name: 'jQuery camelCase' },
    { pattern: /\$\.camelCase\s*\(/g, name: 'jQuery $ camelCase' },
    
    // jQuery nodeName
    { pattern: /jQuery\.nodeName\s*\(/g, name: 'jQuery nodeName' },
    { pattern: /\$\.nodeName\s*\(/g, name: 'jQuery $ nodeName' },
    
    // jQuery contains
    { pattern: /jQuery\.contains\s*\(/g, name: 'jQuery contains' },
    { pattern: /\$\.contains\s*\(/g, name: 'jQuery $ contains' },
    
    // jQuery escape (custom function in your codebase)
    { pattern: /jQuery\.escape\s*\(/g, name: 'jQuery escape' },
    { pattern: /\$\.escape\s*\(/g, name: 'jQuery $ escape' },
    
    // jQuery _data (internal data access)
    { pattern: /jQuery\._data\s*\(/g, name: 'jQuery _data' },
    { pattern: /\$\._data\s*\(/g, name: 'jQuery $ _data' }
];

// Files/directories to exclude
const EXCLUDE_PATTERNS = [
    /node_modules/,
    /\.git/,
    /dist/,
    /build/,
    /coverage/,
    /\.vscode/,
    /\.github/,
    /\.devcontainer/,
    /package-lock\.json$/,
    /\.min\.js$/,
    /jquery.*\.js$/  // Exclude jQuery library files themselves
];

function shouldExcludeFile(filePath) {
    return EXCLUDE_PATTERNS.some(pattern => pattern.test(filePath));
}

function findJsFiles(dir, files = []) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            if (!shouldExcludeFile(fullPath)) {
                findJsFiles(fullPath, files);
            }
        } else if (item.endsWith('.js') && !shouldExcludeFile(fullPath)) {
            files.push(fullPath);
        }
    }
    
    return files;
}

function analyzeFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const results = {
            file: filePath,
            patterns: [],
            totalMatches: 0,
            lines: new Set()
        };
        
        for (const { pattern, name } of JQUERY_PATTERNS) {
            let match;
            pattern.lastIndex = 0; // Reset regex state
            
            while ((match = pattern.exec(content)) !== null) {
                const lineNumber = content.substring(0, match.index).split('\n').length;
                results.patterns.push({
                    name,
                    line: lineNumber,
                    match: match[0].trim(),
                    context: getContext(content, match.index, 50)
                });
                results.totalMatches++;
                results.lines.add(lineNumber);
            }
        }
        
        return results.totalMatches > 0 ? results : null;
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error.message);
        return null;
    }
}

function getContext(content, index, contextLength) {
    const start = Math.max(0, index - contextLength);
    const end = Math.min(content.length, index + contextLength);
    return content.substring(start, end).replace(/\n/g, ' ').trim();
}

function main() {
    const targetDir = process.argv[2] || '.';
    
    if (!fs.existsSync(targetDir)) {
        console.error(`Directory ${targetDir} does not exist.`);
        process.exit(1);
    }
    
    console.log(`🔍 Scanning for jQuery usage in: ${targetDir}`);
    console.log('=' .repeat(60));
    
    const jsFiles = findJsFiles(targetDir);
    console.log(`📁 Found ${jsFiles.length} JavaScript files to analyze\n`);
    
    const results = [];
    let totalFilesWithJQuery = 0;
    let totalJQueryUsage = 0;
    
    for (const file of jsFiles) {
        const result = analyzeFile(file);
        if (result) {
            results.push(result);
            totalFilesWithJQuery++;
            totalJQueryUsage += result.totalMatches;
        }
    }
    
    // Sort results by total matches (most jQuery usage first)
    results.sort((a, b) => b.totalMatches - a.totalMatches);
    
    // Summary
    console.log(`📊 SUMMARY:`);
    console.log(`   Files with jQuery usage: ${totalFilesWithJQuery}/${jsFiles.length}`);
    console.log(`   Total jQuery patterns found: ${totalJQueryUsage}`);
    console.log(`   Files to modernize: ${totalFilesWithJQuery}\n`);
    
    // Detailed results
    console.log(`📋 DETAILED RESULTS:\n`);
    
    for (const result of results) {
        console.log(`📄 ${result.file}`);
        console.log(`   Total patterns: ${result.totalMatches}`);
        console.log(`   Lines affected: ${result.lines.size}`);
        
        // Group patterns by type
        const patternGroups = {};
        for (const pattern of result.patterns) {
            if (!patternGroups[pattern.name]) {
                patternGroups[pattern.name] = [];
            }
            patternGroups[pattern.name].push(pattern);
        }
        
        for (const [patternName, patterns] of Object.entries(patternGroups)) {
            console.log(`   • ${patternName}: ${patterns.length} occurrences`);
            if (patterns.length <= 3) {
                for (const pattern of patterns) {
                    console.log(`     Line ${pattern.line}: ${pattern.match}`);
                }
            }
        }
        console.log('');
    }
    
    // Generate file list for modernization
    console.log(`📝 FILES TO MODERNIZE (${totalFilesWithJQuery} files):`);
    console.log('=' .repeat(60));
    for (const result of results) {
        console.log(result.file);
    }
    
    // Save detailed report to file
    const reportPath = 'jquery-usage-report.json';
    const report = {
        summary: {
            totalFiles: jsFiles.length,
            filesWithJQuery: totalFilesWithJQuery,
            totalJQueryUsage: totalJQueryUsage
        },
        files: results,
        generatedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Detailed report saved to: ${reportPath}`);
    
    // Save simple file list
    const fileListPath = 'files-to-modernize.txt';
    const fileList = results.map(r => r.file).join('\n');
    fs.writeFileSync(fileListPath, fileList);
    console.log(`📋 File list saved to: ${fileListPath}`);
}

if (require.main === module) {
    main();
}

module.exports = { findJsFiles, analyzeFile, JQUERY_PATTERNS }; 
