#!/usr/bin/env python3
"""Fix jQuery(window).addEventListener('mouseup.resize', ...) patterns"""
import re, os

# The standard namespaced resize pattern
PATTERN = r"jQuery\(window\)\.addEventListener\('mouseup\.resize',\s*function\(event\)\s*\{[^}]+clearInterval\(_Interval\);\s*jQuery\(window\)\.off\('mouseup\.resize'\);\s*\}\s*\}\s*\)"

def fix_file(filepath):
    with open(filepath) as f:
        content = f.read()

    orig = content

    # Fix the standard resize pattern with varying whitespace
    # Pattern: jQuery(window).addEventListener('mouseup.resize', function(event){
    #              if (event.which === 1) {
    #                  clearInterval(_Interval);
    #                  jQuery(window).off('mouseup.resize');
    #              }
    #          });
    content = re.sub(
        r"jQuery\(window\)\.addEventListener\('mouseup\.resize',\s*function\s*\(event\)\s*\{[\s\n]*if\s*\(event\.which\s*===\s*1\)\s*\{[\s\n]*(clearInterval\(_Interval\));[\s\n]*jQuery\(window\)\.off\('mouseup\.resize'\);[\s\n]*\}[\s\n]*\}\s*\);",
        lambda m: f"var _resizeHandler = function(event){{\n\t\t\tif (event.which === 1) {{\n\t\t\t\t{m.group(1)};\n\t\t\t\twindow.removeEventListener('mouseup', _resizeHandler);\n\t\t\t}}\n\t\t}};\n\t\twindow.addEventListener('mouseup', _resizeHandler);",
        content,
        flags=re.MULTILINE|re.DOTALL
    )

    # Fix ChatRoom style: jQuery(window).addEventListener('mouseup', fn) - simple, no namespace
    # Already handled if it ends with just addEventListener, no .off

    # Fix ShortCuts jQuery('.macro_').classList.remove
    content = re.sub(
        r"jQuery\(\"(.+?)\"\)\.classList\.remove\(",
        r"var _macro = document.querySelector(\"\1\"); if (_macro) _macro.classList.remove(",
        content
    )

    # Fix jQuery(`#macro_${index}`).value
    content = re.sub(
        r"jQuery\(`#macro_\$\{index\}`\)\.value",
        r"(document.getElementById('macro_' + index) || {}).value",
        content
    )

    # Fix jQuery(event.currentTarget).value
    content = re.sub(
        r"jQuery\(event\.currentTarget\)\.value",
        r"event.currentTarget.value",
        content
    )

    if content != orig:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f'Fixed: {filepath}')
    else:
        print(f'No change: {filepath}')

files = [
    'src/UI/Components/PartyFriends/PartyFriends.js',
    'src/UI/Components/MakeReadBook/MakeReadBook.js',
    'src/UI/Components/MakeItemSelection/ItemListWindowSelection.js',
    'src/UI/Components/MakeItemSelection/ItemConvertSelection/ConvertItems.js',
    'src/UI/Components/ShortCuts/ShortCuts.js',
    'src/UI/Components/Mail/ReadMail.js',
    'src/UI/Components/Mail/Mail.js',
    'src/UI/Components/ChatRoom/ChatRoom.js',
]

for f in files:
    fix_file(f)
