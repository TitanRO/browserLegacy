#!/usr/bin/env python3
"""Fix remaining multi-line delegation and .css() in Inventory files"""
import re
import os

INVENTORY_PATTERN = """		this.ui
			.addEventListener('drop', onDrop)
			.addEventListener('dragover', stopPropagation)

		// Items event
			.querySelector('.container .content')
				.addEventListener('mousewheel DOMMouseScroll', onScroll)
				.addEventListener('mouseover',  '.item', onItemOver)
				.addEventListener('mouseout',  '.item', onItemOut)
				.addEventListener('dragstart',  '.item', onItemDragStart)
				.addEventListener('dragend',  '.item', onItemDragEnd)
				.addEventListener('contextmenu',  '.item', onItemInfo)
				.addEventListener('dblclick',  '.item', onItemUsed);"""

INVENTORY_REPLACEMENT = """		this.ui.addEventListener('drop', onDrop);
		this.ui.addEventListener('dragover', stopPropagation);
		// Items event
		var _invContent = this.ui.querySelector('.container .content');
		_invContent.addEventListener('mousewheel', onScroll);
		_invContent.addEventListener('DOMMouseScroll', onScroll);
		DOM.addDelegatedEvent(_invContent, 'mouseover', '.item', onItemOver);
		DOM.addDelegatedEvent(_invContent, 'mouseout', '.item', onItemOut);
		DOM.addDelegatedEvent(_invContent, 'dragstart', '.item', onItemDragStart);
		DOM.addDelegatedEvent(_invContent, 'dragend', '.item', onItemDragEnd);
		DOM.addDelegatedEvent(_invContent, 'contextmenu', '.item', onItemInfo);
		DOM.addDelegatedEvent(_invContent, 'dblclick', '.item', onItemUsed);"""

files = [
    'src/UI/Components/Inventory/InventoryV0/InventoryV0.js',
    'src/UI/Components/Inventory/InventoryV1/InventoryV1.js',
    'src/UI/Components/Inventory/InventoryV2/InventoryV2.js',
    'src/UI/Components/Inventory/InventoryV3/InventoryV3.js',
]

for fpath in files:
    with open(fpath, 'r') as f:
        content = f.read()

    orig = content

    # Fix delegation chain
    content = content.replace(INVENTORY_PATTERN, INVENTORY_REPLACEMENT)

    # Fix .css( on .querySelector results
    content = re.sub(
        r"(this\.ui\.querySelector\('[^']+'\))\.css\(\{",
        r"DOM.setCss(\1, {",
        content
    )

    # Fix overlay.css - needs to be fixed for all occurrences
    content = re.sub(
        r'overlay\.css\(\{([^}]+)\}\);',
        r'DOM.setCss(overlay, {\1});',
        content
    )

    if content != orig:
        with open(fpath, 'w') as f:
            f.write(content)
        print(f'Fixed: {fpath}')
    else:
        print(f'No change: {fpath}')
