#!/usr/bin/env python3
"""
Fix remaining jQuery patterns in browserLegacy UI components.
Run from the browserLegacy directory.
"""

import re
import sys
import os

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # -------------------------------------------------------------------------
    # 1. Single-line delegation: el.addEventListener('event', '.selector', fn)
    # Pattern: .addEventListener('eventname',  '.selector', handler)
    # We convert SINGLE-LINE occurrences where the whole thing is on one line
    # like: this.ui.addEventListener('click', '.item', handler);
    # -------------------------------------------------------------------------
    # This regex matches the FULL expression on a single line:
    # group1 = element before .addEventListener
    # group2 = event name
    # group3 = selector
    # group4 = handler
    # We match cases where 2nd arg is a string (quoted), and element is on same line

    # Pattern: someExpr.addEventListener('event', 'selector', handler);
    # Where selector contains CSS chars (starts with . # or contains spaces/brackets etc.)
    # We identify broken delegation by: 2nd arg is a string literal

    # Simple single-line case: ends with ;
    # someEl.addEventListener('click', '.item', handler);
    def fix_single_line_delegation(m):
        indent = m.group(1)
        element = m.group(2).strip()
        event = m.group(3)
        selector = m.group(4)
        handler = m.group(5).strip().rstrip(';').rstrip()
        return f"{indent}DOM.addDelegatedEvent({element}, '{event}', '{selector}', {handler});"

    # Match: <indent><element>.addEventListener('<event>', '<selector>', <handler>);
    # where selector is a string (we detect it by presence of quotes)
    content = re.sub(
        r'^(\s*)(\S[^;\n]*?)\.addEventListener\(\'([a-z]+)\',\s*\'([^\']+)\',\s*([^;]+)\);$',
        fix_single_line_delegation,
        content,
        flags=re.MULTILINE
    )

    # -------------------------------------------------------------------------
    # 2. jQuery('#id') → document.getElementById('id')
    # -------------------------------------------------------------------------
    content = re.sub(
        r"jQuery\('#([^']+)'\)",
        r"document.getElementById('\1')",
        content
    )
    content = re.sub(
        r'jQuery\("#([^"]+)"\)',
        r'document.getElementById("\1")',
        content
    )

    # -------------------------------------------------------------------------
    # 3. jQuery('.class') → document.querySelector('.class')
    # -------------------------------------------------------------------------
    content = re.sub(
        r"jQuery\('(\.[^']+)'\)",
        r"document.querySelector('\1')",
        content
    )

    # -------------------------------------------------------------------------
    # 4. jQuery.escape(x) → DOM.escapeHtml(x)
    # -------------------------------------------------------------------------
    content = re.sub(r'jQuery\.escape\(', r'DOM.escapeHtml(', content)

    # -------------------------------------------------------------------------
    # 5. jQuery.isNumeric(x) → !isNaN(+x) -- not doing this here since it changes semantics
    # -------------------------------------------------------------------------

    # -------------------------------------------------------------------------
    # 6. .clone() and .clone(true) → .cloneNode(true)
    # -------------------------------------------------------------------------
    content = re.sub(r'\.clone\(true\)', '.cloneNode(true)', content)
    content = re.sub(r'\.clone\(\)', '.cloneNode(true)', content)

    # -------------------------------------------------------------------------
    # 7. el.find('.sel') → el.querySelector('.sel')
    #    el.find('.sel', ...) is harder to auto-fix, skip those
    # -------------------------------------------------------------------------
    # Only fix cases where .find has one argument (a simple CSS string)
    content = re.sub(
        r'\.find\(\'([^\']+)\'\)',
        r".querySelector('\1')",
        content
    )

    # Fix jQuery(':first') pseudo-selector that doesn't work in querySelector
    content = re.sub(r"\.querySelector\('([^']+):first'\)", r".querySelector('\1')", content)

    # -------------------------------------------------------------------------
    # 8. .text(content) → .textContent = content  (single-line only)
    # -------------------------------------------------------------------------
    # el.text('string') → el.textContent = 'string'
    # el.text(expr) → el.textContent = expr
    # NOTE: Only fix when el is a DOM element (querySelector result), not component method calls
    # We can detect: el.querySelector(...).text(...) or similar
    # This is risky to do broadly, so we do it conservatively

    # .text( someExpr ); → .textContent = someExpr;
    # Only match when the thing before .text is a querySelector result
    content = re.sub(
        r'(\.querySelector\([^)]+\))\.text\(([^)]+)\);',
        r'\1.textContent = \2;',
        content
    )

    # -------------------------------------------------------------------------
    # 9. .html(content) → .innerHTML = content (single-line)
    # -------------------------------------------------------------------------
    content = re.sub(
        r'(\.querySelector\([^)]+\))\.html\(([^)]+)\);',
        r'\1.innerHTML = \2;',
        content
    )

    # -------------------------------------------------------------------------
    # Write back if changed
    # -------------------------------------------------------------------------
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed: {filepath}")
        return True
    return False

def main():
    target_dirs = [
        'src/UI/Components',
        'src/UI',
        'src/Engine',
        'src/App',
    ]

    files_fixed = 0
    for target_dir in target_dirs:
        for root, dirs, files in os.walk(target_dir):
            # Skip node_modules
            dirs[:] = [d for d in dirs if d != 'node_modules']
            for fname in files:
                if fname.endswith('.js'):
                    fpath = os.path.join(root, fname)
                    if fix_file(fpath):
                        files_fixed += 1

    print(f"\nTotal files fixed: {files_fixed}")

if __name__ == '__main__':
    main()
