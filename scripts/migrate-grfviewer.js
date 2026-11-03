#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');

var file = path.join(__dirname, '../src/UI/Components/GrfViewer/GrfViewer.js');
var code = fs.readFileSync(file, 'utf8');

// Remove jQuery import, add DOM
code = code.replace(/\tvar jQuery\s+= require\('Utils\/jquery'\);\n\n/, "\tvar DOM = require('Utils/DOM');\n\n");

// head append
code = code.replace(
	/jQuery\('head(?::first)?'\)\.append\(\s*'<style type="text\/css">' \+/,
	"(function(){ var s = document.createElement('style'); s.type = 'text/css'; s.textContent ="
);
code = code.replace(
	/"<\/style>'\s*\);/,
	"'; document.head.appendChild(s); })();"
);

// ui.find -> ui.querySelector (simple selectors only first)
code = code.replace(/ui\.find\(/g, 'ui.querySelector(');
code = code.replace(/Viewer\.ui\.find\(/g, 'Viewer.ui.querySelector(');

// Fix multi-remove: querySelector('.icon').remove() only removes first - use querySelectorAll
code = code.replace(
	/ui\.querySelector\('\.icon'\)\.remove\(\)/g,
	"ui.querySelectorAll('.icon').forEach(function(el){ el.remove(); })"
);

// Delegated events on ui
code = code.replace(
	/ui\s*\n\t\t\t\.on\('click', '\.directory',\s+onDirectoryClick\)\s*\n\t\t\t\.on\('click', '\.audio',\s+onAudioClick\)\s*\n\t\t\t\.on\('click', '\.img, \.thumb', onImageClick\)\s*\n\t\t\t\.on\('click', '\.txt',\s+onTextClick\)\s*\n\t\t\t\.on\('click', '\.map',\s+onWorldClick\)\s*\n\t\t\t\.on\('click', '\.3d',\s+onObjectClick\)\s*\n\t\t\t\.on\('click', '\.gr2',\s+onGrannyClick\)\s*\n\t\t\t\.on\('click', '\.fx',\s+onEffectClick\)\s*\n\t\t\t\.on\('contextmenu', '\.icon', function\(event\)\{ showContextMenu\(this,event\); return false; \}\);/,
	"DOM.addDelegatedEvent(ui, 'click', '.directory', onDirectoryClick);\n\t\tDOM.addDelegatedEvent(ui, 'click', '.audio', onAudioClick);\n\t\tDOM.addDelegatedEvent(ui, 'click', '.img, .thumb', onImageClick);\n\t\tDOM.addDelegatedEvent(ui, 'click', '.txt', onTextClick);\n\t\tDOM.addDelegatedEvent(ui, 'click', '.map', onWorldClick);\n\t\tDOM.addDelegatedEvent(ui, 'click', '.3d', onObjectClick);\n\t\tDOM.addDelegatedEvent(ui, 'click', '.gr2', onGrannyClick);\n\t\tDOM.addDelegatedEvent(ui, 'click', '.fx', onEffectClick);\n\t\tDOM.addDelegatedEvent(ui, 'contextmenu', '.icon', function(event){ showContextMenu(this, event); event.preventDefault(); });"
);

// Simple .on/.change/.mousedown/.keydown/.click chains on querySelector results
code = code.replace(/\.on\('dragover',\s+/g, ".addEventListener('dragover', ");
code = code.replace(/\.on\('dragleave',\s+/g, ".addEventListener('dragleave', ");
code = code.replace(/\.on\('drop',\s+/g, ".addEventListener('drop', ");
code = code.replace(/\.change\(/g, ".addEventListener('change', ");
code = code.replace(/\.mousedown\(/g, ".addEventListener('mousedown', ");
code = code.replace(/\.keydown\(/g, ".addEventListener('keydown', ");
code = code.replace(/\.click\(/g, ".addEventListener('click', ");
code = code.replace(/\.focus\(/g, ".addEventListener('focus', ");
code = code.replace(/\.blur\(/g, ".addEventListener('blur', ");

// .show() / .hide()
code = code.replace(/\.show\(\)/g, ".style.display = ''");
code = code.replace(/\.hide\(\)/g, ".style.display = 'none'");

// .val(x) -> .value = x
code = code.replace(/\.val\(([^)]+)\)/g, '.value = $1');

// .text(x) -> .textContent = x
code = code.replace(/\.text\(([^)]+)\)/g, '.textContent = $1');

// jQuery(window).height() -> window.innerHeight
code = code.replace(/jQuery\(window\)\.height\(\)/g, 'window.innerHeight');

// jQuery(html).appendTo('#grfviewer')
code = code.replace(
	/jQuery\(html\)\.appendTo\('#grfviewer'\)/g,
	"(function(){ var c = document.getElementById('grfviewer'); if(c){ c.insertAdjacentHTML('beforeend', html); } })()"
);

// jQuery('.img:lt(5)') -> first 5 .img elements
code = code.replace(
	/jQuery\('\.img:lt\(5\)'\)/g,
	"Array.prototype.slice.call(document.querySelectorAll('.img'), 0, 5)"
);

// .each(function -> .forEach(function
code = code.replace(/\.each\(function/g, '.forEach(function');

// jQuery(this) -> this
code = code.replace(/jQuery\(this\)/g, 'this');
code = code.replace(/var self = jQuery\(this\)/g, 'var self = this');

// jQuery(iconElement) -> iconElement
code = code.replace(/var icon = jQuery\(iconElement\)/g, 'var icon = iconElement');

// contextmenu.find -> querySelector
code = code.replace(/contextmenu\.find\(/g, 'contextmenu.querySelector(');

// .get(0) -> direct (elements are already native)
code = code.replace(/\.get\(0\)/g, '');

// .data('path') -> getAttribute
code = code.replace(/\.data\('path'\)/g, ".getAttribute('data-path')");

// save.attr({ href:url, download:...})
code = code.replace(
	/\.attr\(\{\s*href:\s*url,\s*download:\s*([^}]+)\}\)/g,
	".setAttribute('href', url); save.setAttribute('download', $1)"
);

// jQuery(audio).click -> addEventListener on audio
code = code.replace(
	/\.append\(jQuery\(audio\)\.click\(function\(event\)\{\s*event\.stopPropagation\(\);\s*\}\)\)/g,
	".appendChild(audio); audio.addEventListener('click', function(event){ event.stopPropagation(); })"
);

// box.append(x) -> appendChild
code = code.replace(/box\.append\(/g, 'box.appendChild(');

// .find('img:first') -> querySelector('img')
code = code.replace(/\.find\('img:first'\)/g, ".querySelector('img')");

// .one('click' -> addEventListener once
code = code.replace(/\.one\('click',\s*function/g, ".addEventListener('click', function");
code = code.replace(/\.one\('click',function/g, ".addEventListener('click', function");

// jQuery(this).hide in one handlers - already handled

// box.find(...).unbind().remove()
code = code.replace(/box\.find\('audio'\)\.unbind\(\)\.remove\(\)/g, "var a = box.querySelector('audio'); if(a){ a.remove(); }");
code = code.replace(/box\.find\('img, canvas'\)\.remove\(\)/g, "box.querySelectorAll('img, canvas').forEach(function(el){ el.remove(); })");
code = code.replace(/box\.find\('pre'\)\.unbind\(\)\.remove\(\)/g, "var p = box.querySelector('pre'); if(p){ p.remove(); }");

// showContextMenu - replace broken jQuery block
code = code.replace(
	/function showContextMenu\( iconElement, event \)\s*\{[\s\S]*?\t\tinfo\.classList\.add\('disable'\);\s*\}/,
	"function showContextMenu( iconElement, event )\n\t{\n\t\tvar contextmenu = Viewer.ui.querySelector('#contextmenu');\n\t\tvar overlay     = Viewer.ui.querySelector('.overlay');\n\t\tvar header = contextmenu.querySelector('.header');\n\t\tvar open = contextmenu.querySelector('.open');\n\t\tvar save = contextmenu.querySelector('.save');\n\t\tvar info = contextmenu.querySelector('.info');\n\t\tvar icon = iconElement;\n\t\tvar path = icon.getAttribute('data-path');\n\n\t\tcontextmenu.style.left = event.pageX + 'px';\n\t\tcontextmenu.style.top = event.pageY + 'px';\n\t\tcontextmenu.style.display = '';\n\n\t\toverlay.onmousedown = function(){\n\t\t\tcontextmenu.style.display = 'none';\n\t\t\toverlay.style.display = 'none';\n\t\t};\n\t\toverlay.style.display = '';\n\n\t\topen.classList.remove('disable');\n\t\tsave.classList.remove('disable');\n\t\tinfo.classList.remove('disable');\n\n\t\theader.textContent = 'Path: ' + path;\n\t\theader.style.backgroundColor = '';\n\t\theader.onclick = function(){\n\t\t\tnavigator.clipboard.writeText(path);\n\t\t\theader.textContent = 'Copied: ' + path;\n\t\t\theader.style.backgroundColor = '#AAFFAA';\n\t\t};\n\n\t\tif (icon.classList.contains('file')) {\n\t\t\topen.classList.add('disable');\n\t\t} else {\n\t\t\topen.onmousedown = function(){\n\t\t\t\ticon.click();\n\t\t\t\toverlay.onmousedown();\n\t\t\t};\n\t\t}\n\n\t\tif (icon.classList.contains('directory')) {\n\t\t\tsave.classList.add('disable');\n\t\t\tsave.removeAttribute('download');\n\t\t} else {\n\t\t\tsave.onmouseup = function(){ overlay.onmousedown(); };\n\t\t\tClient.getFile(path, function(buffer) {\n\t\t\t\tvar url = URL.createObjectURL(new Blob([buffer], {type: 'application/octet-stream'}));\n\t\t\t\tsave.setAttribute('href', url);\n\t\t\t\tsave.setAttribute('download', icon.textContent.trim());\n\t\t\t});\n\t\t}\n\n\t\tinfo.classList.add('disable');\n\t}"
);

// onTextClick pre block
code = code.replace(
	/\.append\(\s*jQuery\('<pre\/>'\)\s*\.html\( text \)\s*\.click\(function\(event\)\{\s*event\.stopPropagation\(\);\s*\}\)\s*\.css\(\{[\s\S]*?\}\)\s*\)/,
	".appendChild((function(){ var pre = document.createElement('pre'); pre.textContent = text; pre.addEventListener('click', function(event){ event.stopPropagation(); }); pre.style.background = 'white'; pre.style.width = '500px'; pre.style.display = 'inline-block'; pre.style.height = '300px'; pre.style.overflow = 'scroll'; pre.style.textAlign = 'left'; pre.style.padding = '10px'; return pre; })())"
);

// .css('top', expr) -> .style.top = expr + 'px' (when numeric expression)
code = code.replace(/\.css\('top',\s*([^)]+)\)/g, ".style.top = ($1) + 'px'");
code = code.replace(/\.css\('top',\s*200\)/g, ".style.top = '200px'");

// Chained .css().append -> split (pal/tga/image cases)
code = code.replace(
	/box\s*\n\t\t\t\t\t\.css\('top',\s*([^)]+)\)\s*\n\t\t\t\t\t\.append\(\s*canvas\s*\)/g,
	"box.style.top = ($1) + 'px';\n\t\t\t\t\tbox.appendChild(canvas)"
);
code = code.replace(
	/box\s*\n\t\t\t\t\t\.css\('top',\s*([^)]+)\)\s*\n\t\t\t\t\t\.append\(\s*tga\.getCanvas\(\)\s*\)/g,
	"box.style.top = ($1) + 'px';\n\t\t\t\t\tbox.appendChild(tga.getCanvas())"
);
code = code.replace(
	/box\s*\n\t\t\t\t\t\t\.css\('top',\s*([^)]+)\)\s*\n\t\t\t\t\t\t\.append\(this\)/g,
	"box.style.top = ($1) + 'px';\n\t\t\t\t\t\tbox.appendChild(this)"
);

// audio box chain
code = code.replace(
	/box\s*\n\t\t\t\t\.css\('top',\s*\(\s*jQuery\(window\)\.height\(\)\s*-\s*100\s*\)\s*\/\s*2\s*\)/g,
	"box.style.top = ((window.innerHeight - 100) / 2) + 'px'"
);

// preview box css top
code = code.replace(
	/\.css\('top',\s*\(jQuery\(window\)\.height\(\)-400\)\*\s*0\.5\s*\)/g,
	".style.top = ((window.innerHeight - 400) * 0.5) + 'px'"
);
code = code.replace(
	/\.css\('top',\s*\(jQuery\(window\)\.height\(\)-480\)\*\s*0\.5\s*\)/g,
	".style.top = ((window.innerHeight - 480) * 0.5) + 'px'"
);
code = code.replace(
	/\.css\('top',\s*\(\s*jQuery\(window\)\.height\(\)-300\s*\)\s*\/\s*2\s*\)/g,
	".style.top = ((window.innerHeight - 300) / 2) + 'px'"
);

// ui.find('#preview .box').css -> querySelector style
code = code.replace(/ui\.find\('#preview \.box'\)/g, "ui.querySelector('#preview .box')");

// Remaining ui.find
code = code.replace(/ui\.find\(/g, 'ui.querySelector(');

// overlay.mousedown() -> trigger mousedown handler
code = code.replace(/overlay\.mousedown\(\)/g, 'if(overlay.onmousedown){ overlay.onmousedown(); }');

// icon.click() - native click() works on elements

// self.find -> self.querySelector  
code = code.replace(/self\.find\(/g, 'self.querySelector(');

// jQuery(this) in preview handlers
code = code.replace(/jQuery\(this\)\.hide\(\)/g, 'this.style.display = "none"');

// .append(element) on querySelector results for preview box
code = code.replace(/ui\.querySelector\('#preview \.box'\)\.append\(/g, "ui.querySelector('#preview .box').appendChild(");

// event.originalEvent -> event (in drop handler may need dataTransfer fix - keep originalEvent for drop)
// Don't replace in drop handler - actually for drop, native event IS the event with dataTransfer

fs.writeFileSync(file, code, 'utf8');
console.log('GrfViewer migrated');
