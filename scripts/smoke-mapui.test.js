'use strict';

/**
 * Smoke tests for map-load UI init patterns (addEventListener chaining, delegation).
 *
 * Run: node --test scripts/smoke-mapui.test.js
 */

var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var test = require('node:test');
var { JSDOM } = require('jsdom');

var ROOT = path.join(__dirname, '..');

function loadHtml(relPath) {
	return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function initChatBoxListeners(ui) {
	ui.addEventListener('mouseover', function() {});
	ui.addEventListener('mouseout', function() {});

	var textInputs = ui.querySelectorAll('input[type=text]');
	assert.ok(textInputs.length > 0, 'ChatBox.html should include text inputs');
	textInputs.forEach(function(input) {
		input.addEventListener('drop', function() {});
		input.addEventListener('dragover', function() {});
	});
}

test('ChatBox addNewTab creates tab elements on empty template', function() {
	var dom = new JSDOM('<!DOCTYPE html><body></body>');
	var ui = dom.window.document.createElement('div');
	ui.innerHTML = loadHtml('src/UI/Components/ChatBox/ChatBox.html');

	var tabID = 1;
	var tabName = 'Public Log';

	assert.doesNotThrow(function() {
		ui.querySelectorAll('table.header tr td.tab div').forEach(function(el) {
			el.classList.remove('on');
		});
		ui.querySelectorAll('.body .content').forEach(function(el) {
			el.classList.remove('active');
		});

		ui.querySelector('table.header tr .opttab').insertAdjacentHTML('beforebegin',
			'<td class="tab" data-tab="' + tabID + '">' +
				'<div class="on">' +
					'<input type="text" value="' + tabName + '"/>' +
				'</div>' +
			'</td>'
		);

		ui.querySelector('.body .contentwrapper').insertAdjacentHTML('beforeend',
			'<div class="content active" data-content="' + tabID + '"></div>'
		);
	});

	assert.ok(
		ui.querySelector('table.header tr td.tab[data-tab="' + tabID + '"]'),
		'addNewTab should insert a tab header cell'
	);
	assert.ok(
		ui.querySelector('.body .content[data-content="' + tabID + '"]'),
		'addNewTab should insert a content panel'
	);
});

test('ChatBox addNewTab avoids classList-on-null and HTML before/append footguns', function() {
	var source = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/ChatBox/ChatBox.js'),
		'utf8'
	);

	assert.doesNotMatch(
		source,
		/\.querySelector\s*\([^)]+\)\s*\n\s*\.classList/,
		'ChatBox should not chain .classList after querySelector when tabs may not exist'
	);
	assert.doesNotMatch(
		source,
		/\.before\s*\(\s*`/,
		'ChatBox should use insertAdjacentHTML instead of .before() with HTML strings'
	);
	assert.match(
		source,
		/insertAdjacentHTML\s*\(\s*['"]beforebegin['"]/,
		'ChatBox addNewTab should insert tab headers with insertAdjacentHTML'
	);
	assert.match(
		source,
		/insertAdjacentHTML\s*\(\s*['"]beforeend['"]/,
		'ChatBox addNewTab should insert content panels with insertAdjacentHTML'
	);
});

test('ChatBox init wiring does not throw with native addEventListener', function() {
	var dom = new JSDOM('<!DOCTYPE html><body></body>');
	var ui = dom.window.document.createElement('div');
	ui.innerHTML = loadHtml('src/UI/Components/ChatBox/ChatBox.html');

	assert.doesNotThrow(function() {
		initChatBoxListeners(ui);
	});
});

test('ChatBox uses delegated events for dynamically created tab inputs', function() {
	var source = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/ChatBox/ChatBox.js'),
		'utf8'
	);

	assert.doesNotMatch(
		source,
		/\.querySelector\s*\(\s*['"]\.header input['"]\s*\)\.addEventListener/,
		'ChatBox should not bind .header input before tabs exist'
	);
	assert.match(
		source,
		/DOM\.addDelegatedEvent\s*\(\s*this\.ui\s*,\s*['"]dblclick['"]\s*,\s*['"]\.header input['"]/
	);
	assert.match(
		source,
		/DOM\.addDelegatedEvent\s*\(\s*this\.ui\s*,\s*['"]mousewheel['"]\s*,\s*['"]\.content['"]/
	);
});

test('Emoticons init uses DOM.addDelegatedEvent for canvas events', function() {
	var source = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/Emoticons/Emoticons.js'),
		'utf8'
	);

	assert.match(source, /DOM\.addDelegatedEvent\s*\([^)]*['"]canvas['"]/);
	assert.doesNotMatch(
		source,
		/\.addEventListener\s*\(\s*['"]dblclick['"]\s*,\s*['"]canvas['"]/
	);
});

test('EquipmentV3 init bindings match its HTML template', function() {
	var dom = new JSDOM('<!DOCTYPE html><body></body>');
	var ui = dom.window.document.createElement('div');
	ui.innerHTML = loadHtml('src/UI/Components/Equipment/EquipmentV3/EquipmentV3.html');
	var root = ui.firstElementChild;

	assert.ok(root.querySelector('.view_status'), 'EquipmentV3.html should include .view_status toggle');
	assert.ok(root.querySelector('.show_equip'), 'EquipmentV3.html should include .show_equip toggle');
	assert.ok(root.querySelector('#lvlup_base'), 'EquipmentV3.html should include #lvlup_base');

	assert.doesNotThrow(function() {
		root.querySelector('.view_status').addEventListener('mousedown', function() {});
		root.querySelector('.show_equip').addEventListener('mousedown', function() {});
		root.querySelector('#lvlup_base').addEventListener('click', function() {});
	});
});

test('EquipmentV3 init uses this.ui for lvlup_base, not document.getElementById', function() {
	var source = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/Equipment/EquipmentV3/EquipmentV3.js'),
		'utf8'
	);

	assert.match(
		source,
		/this\.ui\.querySelector\s*\(\s*['"]#lvlup_base['"]\s*\)/,
		'EquipmentV3 should detach #lvlup_base from this.ui'
	);
	assert.doesNotMatch(
		source,
		/document\.getElementById\s*\(\s*['"]lvlup_base['"]\s*\)/,
		'EquipmentV3 should not rely on document.getElementById for #lvlup_base'
	);
});

test('map-load UI sources avoid addEventListener return-value chaining', function() {
	var files = [
		'src/UI/Components/ChatBox/ChatBox.js',
		'src/UI/Components/ChatBoxSettings/ChatBoxSettings.js',
		'src/UI/Components/Emoticons/Emoticons.js',
		'src/UI/Components/ShortCut/ShortCut.js',
		'src/UI/Components/ChatRoomCreate/ChatRoomCreate.js',
		'src/UI/Components/ShortCuts/ShortCuts.js',
		'src/UI/Components/MobileUI/MobileUI.js',
		'src/UI/Components/FPS/FPS.js'
	];

	files.forEach(function(rel) {
		var source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
		assert.doesNotMatch(
			source,
			/\.addEventListener\s*\([^)]*\)\s*\.addEventListener/,
			rel + ' should not chain addEventListener calls'
		);
		assert.doesNotMatch(
			source,
			/\}\)\s*\.addEventListener/,
			rel + ' should not chain addEventListener after handler closures'
		);
	});
});

test('ChatBoxSettings init bindings match its HTML template', function() {
	var dom = new JSDOM('<!DOCTYPE html><body></body>');
	var ui = dom.window.document.createElement('div');
	ui.innerHTML = loadHtml('src/UI/Components/ChatBoxSettings/ChatBoxSettings.html');

	assert.ok(ui.querySelector('.extend'), 'ChatBoxSettings.html should include .extend resize handle');
	assert.ok(ui.querySelector('.close'), 'ChatBoxSettings.html should include .close button');

	assert.doesNotThrow(function() {
		ui.querySelector('.extend').addEventListener('mousedown', function() {});
		ui.querySelector('.close').addEventListener('click', function() {});
	});
});

test('FPS init does not bind missing .base or .close elements', function() {
	var source = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/FPS/FPS.js'),
		'utf8'
	);

	assert.doesNotMatch(
		source,
		/\.querySelector\s*\(\s*['"]\.base['"]\s*\)\.addEventListener/,
		'FPS.html has no .base element'
	);
	assert.doesNotMatch(
		source,
		/\.querySelector\s*\(\s*['"]\.close['"]\s*\)\.addEventListener/,
		'FPS.html has no .close element'
	);
});

test('ChatBox init appends ChatBoxSettings which must not throw on missing selectors', function() {
	var source = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/ChatBoxSettings/ChatBoxSettings.js'),
		'utf8'
	);

	assert.doesNotMatch(
		source,
		/\.querySelector\s*\(\s*['"]\.extend['"]\s*\)\.addEventListener/,
		'ChatBoxSettings should guard .extend binding'
	);
});

test('Equipment multi-canvas init uses querySelectorAll not querySelector[index]', function() {
	var files = [
		'src/UI/Components/Equipment/EquipmentV1/EquipmentV1.js',
		'src/UI/Components/Equipment/EquipmentV2/EquipmentV2.js',
		'src/UI/Components/Equipment/EquipmentV3/EquipmentV3.js',
		'src/UI/Components/PlayerViewEquip/PlayerViewEquipV1/PlayerViewEquipV1.js',
		'src/UI/Components/PlayerViewEquip/PlayerViewEquipV2/PlayerViewEquipV2.js'
	];

	files.forEach(function(rel) {
		var source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
		assert.doesNotMatch(
			source,
			/\.querySelector\s*\(\s*['"]canvas['"]\s*\)\s*\[\s*1\s*\]\.getContext/,
			rel + ' should use querySelectorAll("canvas")[1] for the second canvas'
		);
		assert.match(
			source,
			/querySelectorAll\s*\(\s*['"]canvas['"]\s*\)/,
			rel + ' should collect canvases with querySelectorAll'
		);
	});
});

test('EquipmentV3 HTML provides two canvases for init getContext', function() {
	var dom = new JSDOM('<!DOCTYPE html><body></body>');
	var ui = dom.window.document.createElement('div');
	ui.innerHTML = loadHtml('src/UI/Components/Equipment/EquipmentV3/EquipmentV3.html');

	var canvases = ui.querySelectorAll('canvas');
	assert.equal(canvases.length, 2, 'EquipmentV3.html should include two character preview canvases');
	assert.ok(canvases[0] instanceof dom.window.HTMLCanvasElement);
	assert.ok(canvases[1] instanceof dom.window.HTMLCanvasElement);
});

test('Emoticons loadFiles callback guards navigation text nodes', function() {
	var source = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/Emoticons/Emoticons.js'),
		'utf8'
	);

	assert.match(
		source,
		/querySelector\s*\(\s*['"]\.navigation \.total['"]\s*\)/,
		'Emoticons should target .navigation .total explicitly'
	);
	assert.match(
		source,
		/if\s*\(\s*totalEl\s*\)/,
		'Emoticons should guard before setting total page textContent'
	);
});

test('Emoticons HTML keeps navigation counters outside prev/next buttons', function() {
	var dom = new JSDOM('<!DOCTYPE html><body></body>');
	var ui = dom.window.document.createElement('div');
	ui.innerHTML = loadHtml('src/UI/Components/Emoticons/Emoticons.html');
	var root = ui.firstElementChild;

	assert.ok(root.querySelector('.navigation .total'), 'Emoticons.html should include .navigation .total');
	assert.ok(root.querySelector('.navigation .current'), 'Emoticons.html should include .navigation .current');
	assert.notEqual(
		root.querySelector('.prev').contains(root.querySelector('.total')),
		true,
		'.total should not be nested inside .prev'
	);
});

test('ShortCuts imports Utils/DOM outside the header comment', function() {
	var source = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/ShortCuts/ShortCuts.js'),
		'utf8'
	);
	var headerMatch = source.match(/^\/\*\*[\s\S]*?\*\//);
	var body = headerMatch ? source.slice(headerMatch[0].length) : source;

	assert.doesNotMatch(
		headerMatch ? headerMatch[0] : '',
		/var\s+DOM\s*=\s*require\s*\(\s*['"]Utils\/DOM['"]\s*\)/,
		'ShortCuts should not keep Utils/DOM import inside the header comment'
	);
	assert.match(
		body,
		/var\s+DOM\s*=\s*require\s*\(\s*['"]Utils\/DOM['"]\s*\)/,
		'ShortCuts should import Utils/DOM in define() dependencies'
	);
});

test('QuestWindow and RodexIcon import Utils/DOM', function() {
	['src/UI/Components/Quest/Quest/QuestWindow.js', 'src/UI/Components/Rodex/RodexIcon.js'].forEach(function(rel) {
		var source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
		assert.match(
			source,
			/var\s+DOM\s*=\s*require\s*\(\s*['"]Utils\/DOM['"]\s*\)/,
			rel + ' should import Utils/DOM'
		);
	});
});

test('StatusIcons prepare path does not appendChild before init creates ui', function() {
	var source = fs.readFileSync(
		path.join(ROOT, 'src/UI/UIComponent.js'),
		'utf8'
	);

	assert.match(
		source,
		/if\s*\(\s*this\.ui\s*\)\s*\{\s*\n\s*document\.body\.appendChild\s*\(\s*this\.ui\s*\)/,
		'UIComponent.prepare should guard appendChild when this.ui is created in init()'
	);
});

test('StatusIcons init creates ui element for map-load append', function() {
	var source = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/StatusIcons/StatusIcons.js'),
		'utf8'
	);

	assert.match(
		source,
		/StatusIcons\.init\s*=\s*function[\s\S]*this\.ui\s*=\s*document\.createElement\s*\(\s*['"]div['"]\s*\)/,
		'StatusIcons.init should create this.ui before append()'
	);
	assert.doesNotMatch(
		source,
		/\.append\s*\(\s*[`'"]\s*</,
		'StatusIcons should not use jQuery-style .append() with HTML strings'
	);
});

test('QuestV1 addQuestToUI parses HTML and binds listeners on created rows', function() {
	var dom = new JSDOM('<!DOCTYPE html><body></body>');
	var template = dom.window.document.createElement('template');
	template.innerHTML = loadHtml('src/UI/Components/Quest/QuestV1/QuestV1.html').trim();
	var root = template.content.firstElementChild;

	var quest = {
		questID: 42,
		active: 1,
		icon: 'SG_FEEL.bmp',
		title: 'Test Quest Title'
	};
	var toggle_id = 'qid' + quest.questID;
	var li_text = '<li id="' + toggle_id + '" class="quest-item ' + toggle_id + '"><div class="quest-item-icon"> <div class="quest-item-icon-image" data-background="item/' + quest.icon + '"></div> </div> <div class="quest-item-title"> <span class="quest-item-title-text">' + quest.title + '</span> </div></li>';

	var parseHTML = function parseHTML() {
		var node = this;
		var background = node.dataset.background;
		if (background) {
			node.style.backgroundImage = 'url(mock://' + background + ')';
		}
	};

	var parseElementTree = function parseElementTree(rootEl) {
		parseHTML.call(rootEl);
		rootEl.querySelectorAll('*').forEach(function(el) {
			parseHTML.call(el);
		});
	};

	assert.doesNotThrow(function() {
		var _tmp = dom.window.document.createElement('div');
		_tmp.innerHTML = li_text;
		var liEl = _tmp.firstChild;
		var listEl = root.querySelector('#active-quest-list');
		listEl.appendChild(liEl);
		liEl.addEventListener('contextmenu', function() {});
		liEl.addEventListener('click', function() {});

		var liClone = liEl.cloneNode(true);
		liClone.addEventListener('click', function() {});
		root.querySelector('#all-quest-list').appendChild(liClone);

		parseElementTree(liEl);
		parseElementTree(liClone);
	});

	var iconEl = root.querySelector('#' + toggle_id + ' .quest-item-icon-image');
	assert.ok(iconEl, 'addQuestToUI should create quest icon element');
	assert.match(
		iconEl.style.backgroundImage,
		/mock:\/\/item\/SG_FEEL\.bmp/,
		'parseElementTree should apply data-background to quest icon nodes'
	);
	assert.ok(
		root.querySelector('#active-quest-list #' + toggle_id),
		'addQuestToUI should create a quest row element with the expected id'
	);
});

test('QuestV1 addQuestToUI uses parseElementTree instead of parseHTML.bind(this)', function() {
	var source = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/Quest/QuestV1/QuestV1.js'),
		'utf8'
	);

	assert.doesNotMatch(
		source,
		/parseHTML\.bind\s*\(\s*this\s*\)/,
		'QuestV1 must not bind component as parseHTML context — parseHTML expects each DOM node as `this`'
	);
	assert.match(
		source,
		/parseElementTree\s*\(\s*li(?:Clone|El)\s*\)/,
		'QuestV1 addQuestToUI should walk quest rows with parseElementTree'
	);
});

test('QuestV1 addQuestToUI avoids jQuery-style append(html) and querySelector addEventListener footguns', function() {
	var source = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/Quest/QuestV1/QuestV1.js'),
		'utf8'
	);

	assert.doesNotMatch(
		source,
		/\.append\s*\(\s*li_text\s*\)/,
		'QuestV1 should not use .append(li_text) — native append() treats strings as text nodes'
	);
	assert.match(
		source,
		/_tmp\.innerHTML\s*=\s*li_text/,
		'QuestV1 addQuestToUI should parse quest row HTML via innerHTML'
	);
	assert.match(
		source,
		/liEl\.addEventListener\s*\(\s*['"]click['"]/,
		'QuestV1 should bind click handlers on the created quest row element'
	);
	assert.doesNotMatch(
		source,
		/\.querySelector\s*\(\s*['"]#['"]\s*\+\s*toggle_id\s*\)\.addEventListener/,
		'QuestV1 should not call addEventListener on a re-queried row that may not exist'
	);
});

test('map-load UI sources avoid jQuery-style element.append(html)', function() {
	var files = [
		'src/UI/Components/Quest/Quest/QuestWindow.js',
		'src/UI/Components/Quest/QuestV1/QuestV1.js',
		'src/UI/Components/ItemInfo/ItemInfo.js',
		'src/UI/Components/Refine/Refine.js',
		'src/UI/Components/CashShop/CashShop.js'
	];

	files.forEach(function(rel) {
		var source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
		assert.doesNotMatch(
			source,
			/\.append\s*\(\s*[`'"]\s*</,
			rel + ' should use insertAdjacentHTML instead of .append() with HTML strings'
		);
	});
});

test('PartyFriends onChangeTab clears selection without dynamic .node rows', function() {
	var dom = new JSDOM('<!DOCTYPE html><body></body>');
	var ui = dom.window.document.createElement('div');
	ui.innerHTML = loadHtml('src/UI/Components/PartyFriends/PartyFriends.html');
	var root = ui.firstElementChild;

	assert.equal(root.querySelectorAll('.content .node').length, 0, 'empty PartyFriends has no friend/party rows');

	assert.doesNotThrow(function() {
		root.querySelectorAll('.content .selection').forEach(function(el) {
			el.classList.remove('selection');
		});
	});
});

test('PartyFriends avoids querySelector(.node).classList on tab change', function() {
	var source = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/PartyFriends/PartyFriends.js'),
		'utf8'
	);

	assert.doesNotMatch(
		source,
		/\.querySelector\s*\(\s*['"]\.node['"]\s*\)\.classList/,
		'PartyFriends should clear selection with querySelectorAll — .node rows are created at runtime'
	);
	assert.match(
		source,
		/querySelectorAll\s*\(\s*['"]\.content \.selection['"]\s*\)/,
		'PartyFriends onChangeTab should clear all selected rows safely'
	);
	assert.doesNotMatch(
		source,
		/\.classList\.remove\s*\(\s*['"]\./,
		'classList.remove() must not use a jQuery-style leading dot in the class name'
	);
});

test('QuestV1 init bindings match its HTML template', function() {
	var dom = new JSDOM('<!DOCTYPE html><body></body>');
	var template = dom.window.document.createElement('template');
	template.innerHTML = loadHtml('src/UI/Components/Quest/QuestV1/QuestV1.html').trim();
	var root = template.content.firstElementChild;

	assert.ok(root.querySelector('.btn-right'), 'QuestV1.html should include .btn-right titlebar close');
	assert.ok(root.querySelector('.footer .close'), 'QuestV1.html should include footer .close button');
	assert.ok(root.querySelector('.footer .btn.view'), 'QuestV1.html should include footer .view button');

	assert.doesNotThrow(function() {
		root.querySelector('.btn-right').addEventListener('click', function() {});
		root.querySelector('.footer .close').addEventListener('click', function() {});
		root.querySelector('.footer .btn.view').addEventListener('click', function() {});
	});
});

test('QuestV1 init uses delegated close handlers instead of bare querySelector', function() {
	var source = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/Quest/QuestV1/QuestV1.js'),
		'utf8'
	);

	assert.doesNotMatch(
		source,
		/\.querySelector\s*\(\s*['"]\.btn-right['"]\s*\)\.addEventListener/,
		'QuestV1 should delegate .btn-right clicks — titlebar buttons are easy to miss with broken HTML'
	);
	assert.match(
		source,
		/DOM\.addDelegatedEvent\s*\(\s*this\.ui\s*,\s*['"]click['"]\s*,\s*['"]\.btn-right, \.footer \.close['"]/,
		'QuestV1 should bind titlebar and footer close buttons via delegation'
	);
	assert.match(
		source,
		/\.querySelector\s*\(\s*['"]\.footer \.btn\.view['"]\s*\)/,
		'QuestV1 should target the footer view button explicitly'
	);
});

test('CashShop init delegates tab clicks for runtime-created tabs', function() {
	var source = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/CashShop/CashShop.js'),
		'utf8'
	);

	assert.doesNotMatch(
		source,
		/\.querySelector\s*\(\s*['"]\.tabs button['"]\s*\)\.addEventListener/,
		'CashShop tabs are created at runtime — use DOM.addDelegatedEvent'
	);
	assert.match(
		source,
		/DOM\.addDelegatedEvent\s*\(\s*this\.ui\s*,\s*['"]mousedown['"]\s*,\s*['"]\.tabs button['"]/,
		'CashShop should delegate mousedown on .tabs button'
	);
});

test('ChatBox avoids comma selector in getElementById', function() {
	var source = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/ChatBox/ChatBox.js'),
		'utf8'
	);

	assert.doesNotMatch(
		source,
		/document\.getElementById\s*\(\s*['"][^'"]*,[^'"]*['"]\s*\)/,
		'ChatBox should not pass comma selectors to getElementById'
	);
});

test('SkillList setSkills clears runtime state without querySelector classList footguns', function() {
	var skillList = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/SkillList/SkillList/SkillList.js'),
		'utf8'
	);
	var skillListV0 = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/SkillList/SkillListV0/SkillListV0.js'),
		'utf8'
	);

	[skillList, skillListV0].forEach(function(source, index) {
		var label = index === 0 ? 'SkillList' : 'SkillListV0';

		assert.doesNotMatch(
			source,
			/\.querySelector\s*\(\s*['"]\.upgradable['"]\s*\)\.classList/,
			label + ' setSkills should clear .upgradable via querySelectorAll — none may exist on first load'
		);
		assert.doesNotMatch(
			source,
			/\.querySelector\s*\(\s*['"]\.needleSkill['"]\s*\)\.classList/,
			label + ' should clear .needleSkill via querySelectorAll — class is applied at runtime'
		);
		assert.doesNotMatch(
			source,
			/\.querySelector\s*\(\s*['"]\.counterSkill['"]\s*\)\.remove/,
			label + ' should remove .counterSkill via querySelectorAll — nodes are created at runtime'
		);
		assert.match(
			source,
			/querySelectorAll\s*\(\s*['"]\.upgradable['"]\s*\)/,
			label + ' setSkills should use querySelectorAll for .upgradable'
		);
	});
});

test('SkillList setSkills on empty template does not throw', function() {
	var dom = new JSDOM('<!DOCTYPE html><body></body>');
	var template = dom.window.document.createElement('template');
	template.innerHTML = loadHtml('src/UI/Components/SkillList/SkillList/SkillList.html').trim();
	var ui = template.content.firstElementChild;

	assert.doesNotThrow(function() {
		ui.querySelectorAll('.upgradable').forEach(function(el) { el.classList.remove('upgradable'); });
		ui.querySelectorAll('.extraRow').forEach(function(el) { el.remove(); });
		ui.querySelector('.content table').innerHTML = '';
		ui.querySelector('.skillCol').innerHTML = '';
	});
});

function assertSkillSeparateLevelGuards(source, label) {
	var re = /element\.querySelector\s*\(\s*['"]\.level \.current(?:Up|Down)['"]\s*\)\.(?:style|addEventListener)/g;
	var match;

	while ((match = re.exec(source))) {
		var before = source.substring(Math.max(0, match.index - 400), match.index);
		assert.match(
			before,
			/if\s*\(\s*sk\.bSeperateLv\s*\)\s*\{/,
			label + ' should guard .level .currentUp/.currentDown access with if (sk.bSeperateLv)'
		);

		var slice = source.substring(before.lastIndexOf('if (sk.bSeperateLv)'), match.index);
		var depth = 0;
		for (var i = 0; i < slice.length; i++) {
			if (slice.charAt(i) === '{') {
				depth++;
			}
			if (slice.charAt(i) === '}') {
				depth--;
			}
		}
		assert.ok(depth > 0, label + ' .level .currentUp/.currentDown access should stay inside if (sk.bSeperateLv)');
	}
}

test('SkillList dynamic rendering guards separate-level buttons', function() {
	var files = [
		'src/UI/Components/SkillList/SkillList/SkillList.js',
		'src/UI/Components/SkillList/SkillListV0/SkillListV0.js',
		'src/UI/Components/SkillListMH/SkillListMH.js',
		'src/UI/Components/Guild/Guild.js'
	];

	files.forEach(function(rel) {
		var source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
		assertSkillSeparateLevelGuards(source, rel);
	});
});

test('Escape exposes toggle() instead of ui.toggle()', function() {
	var source = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/Escape/Escape.js'),
		'utf8'
	);

	assert.match(source, /Escape\.toggle\s*=\s*function\s*toggle\s*\(/);
	assert.match(source, /DOM\.toggleDisplay\s*\(\s*this\.ui\s*\)/);
});

test('BasicInfo option button uses Escape.toggle(), not ui.toggle()', function() {
	var files = [
		'src/UI/Components/BasicInfo/BasicInfo/BasicInfo.js',
		'src/UI/Components/BasicInfo/BasicInfoV0/BasicInfoV0.js',
		'src/UI/Components/BasicInfo/BasicInfoV3/BasicInfoV3.js',
		'src/UI/Components/BasicInfo/BasicInfoV4/BasicInfoV4.js',
		'src/UI/Components/BasicInfo/BasicInfoV5/BasicInfoV5.js'
	];

	files.forEach(function(rel) {
		var source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
		assert.doesNotMatch(source, /Escape\.ui\.toggle\s*\(/, rel + ' should call Escape.toggle()');
		assert.match(source, /Escape\.toggle\s*\(\s*\)/, rel + ' should call Escape.toggle()');
	});
});

test('ChatBox battle mode uses DOM.toggleDisplay instead of element.toggle()', function() {
	var source = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/ChatBox/ChatBox.js'),
		'utf8'
	);

	assert.doesNotMatch(source, /\.querySelector\s*\([^)]+\)\.toggle\s*\(/);
	assert.match(source, /DOM\.toggleDisplay\s*\(\s*input\s*\)/);
	assert.match(source, /DOM\.toggleDisplay\s*\(\s*ChatBox\.ui\.querySelector\s*\(\s*['"]\.input['"]\s*\)\s*\)/);
});

test('ShortCut addElement stores container element before innerHTML', function() {
	var source = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/ShortCut/ShortCut.js'),
		'utf8'
	);

	assert.doesNotMatch(
		source,
		/var\s+\w+\s*=\s*[^=;\n]+\.querySelectorAll\s*\([^)]+\)\s*\[[^\]]+\]\.innerHTML\s*=\s*['"]/,
		'ShortCut addElement must not chain innerHTML assignment into var'
	);
	assert.match(
		source,
		/function getContainer\s*\(\s*index\s*\)/,
		'ShortCut should resolve shortcut slots via getContainer(index)'
	);
});

test('ShortCut setList clears all container slots on empty template', function() {
	var dom = new JSDOM('<!DOCTYPE html><body></body>');
	var template = dom.window.document.createElement('template');
	template.innerHTML = loadHtml('src/UI/Components/ShortCut/ShortCut.html').trim();
	var ui = template.content.firstElementChild;
	var slots = ui.querySelectorAll('.container');

	assert.equal(slots.length, 36, 'ShortCut.html should include 36 shortcut slots');

	assert.doesNotThrow(function() {
		slots.forEach(function(el) {
			el.innerHTML = '<div class="icon"></div>';
		});
		slots.forEach(function(el) {
			el.innerHTML = '';
		});
	});

	var source = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/ShortCut/ShortCut.js'),
		'utf8'
	);

	assert.doesNotMatch(
		source,
		/ShortCut\.setList[\s\S]*?querySelector\s*\(\s*['"]\.container['"]\s*\)\.innerHTML/,
		'ShortCut.setList should clear all .container slots with querySelectorAll'
	);
	assert.match(
		source,
		/querySelectorAll\s*\(\s*['"]\.container['"]\s*\)\.forEach/,
		'ShortCut should iterate all .container slots when clearing'
	);
});

test('map-load onRemove handlers close ItemInfo via ItemInfo.remove(), not document.querySelector', function() {
	var files = [
		'src/UI/Components/ShortCuts/ShortCuts.js',
		'src/UI/Components/Inventory/InventoryV0/InventoryV0.js',
		'src/UI/Components/Inventory/InventoryV1/InventoryV1.js',
		'src/UI/Components/Inventory/InventoryV2/InventoryV2.js',
		'src/UI/Components/Inventory/InventoryV3/InventoryV3.js',
		'src/UI/Components/CartItems/CartItems.js',
		'src/UI/Components/VendingShop/VendingShop.js'
	];

	files.forEach(function(rel) {
		var source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
		assert.doesNotMatch(
			source,
			/document\.querySelector\s*\(\s*['"]\.ItemInfo['"]\s*\)\.remove/,
			rel + ' onRemove must not call document.querySelector(".ItemInfo").remove() — querySelector returns null when popup is closed'
		);
		assert.match(
			source,
			/ItemInfo\.remove\s*\(/,
			rel + ' should close ItemInfo via ItemInfo.remove()'
		);
	});
});

test('ItemInfo.remove() is safe when the popup was never appended', function() {
	var dom = new JSDOM('<!DOCTYPE html><body></body>');
	var ui = dom.window.document.createElement('div');

	// Mirrors UIComponent.prototype.remove guard used by ItemInfo.remove()
	var component = {
		__loaded: true,
		__active: true,
		ui: ui,
		remove: function remove() {
			this.__active = false;
			if (this.__loaded && this.ui && this.ui.parentNode) {
				this.ui.parentNode.removeChild(this.ui);
			}
		}
	};

	assert.equal(ui.parentNode, null, 'detached ItemInfo.ui should have no parent during map teardown');
	assert.doesNotThrow(function() {
		component.remove();
	}, 'guarded remove() should no-op when the popup was never appended');
});

test('ShortCuts onRemove cleanup does not throw without ItemInfo in document', function() {
	var dom = new JSDOM('<!DOCTYPE html><body></body>');
	var doc = dom.window.document;
	var template = doc.createElement('template');
	template.innerHTML = loadHtml('src/UI/Components/ShortCuts/ShortCuts.html').trim();
	var ui = template.content.firstElementChild;

	var ItemInfo = {
		__loaded: true,
		__active: false,
		ui: doc.createElement('div'),
		remove: function remove() {
			this.__active = false;
			if (this.__loaded && this.ui && this.ui.parentNode) {
				this.ui.parentNode.removeChild(this.ui);
			}
		}
	};

	assert.doesNotThrow(function() {
		var content = ui.querySelector('.container .content');
		if (content) {
			content.innerHTML = '';
		}
		ItemInfo.remove();
	}, 'map-change onRemove should tolerate ItemInfo not being open');
});

test('DOM.toggleDisplay shows elements hidden by stylesheet display:none', function() {
	var requirejs = require('requirejs');
	requirejs.config({
		baseUrl: path.join(ROOT, 'src'),
		nodeRequire: require
	});

	return new Promise(function(resolve, reject) {
		requirejs(['Utils/DOM'], function(DOM) {
			var dom = new JSDOM(
				'<!DOCTYPE html><html><head><style>#Escape{display:none;position:absolute}</style></head><body></body></html>',
				{ pretendToBeVisual: true }
			);
			var win = dom.window;
			var prevWindow = global.window;
			var prevDocument = global.document;

			global.window = win;
			global.document = win.document;

			try {
				var ui = win.document.createElement('div');
				ui.id = 'Escape';
				win.document.body.appendChild(ui);

				DOM.hide(ui);
				assert.equal(DOM.isVisible(ui), false, 'Escape.ui should start hidden');

				assert.equal(DOM.toggleDisplay(ui), true, 'toggle should show Escape.ui');
				assert.equal(DOM.isVisible(ui), true, 'Escape.ui should be visible after toggle');
				assert.equal(win.getComputedStyle(ui).display, 'block', 'inline display should override stylesheet none');

				assert.equal(DOM.toggleDisplay(ui), false, 'toggle should hide Escape.ui');
				assert.equal(DOM.isVisible(ui), false, 'Escape.ui should be hidden again');
				assert.equal(ui.style.display, 'none', 'hide should set inline display none');

				resolve();
			}
			catch (err) {
				reject(err);
			}
			finally {
				global.window = prevWindow;
				global.document = prevDocument;
			}
		}, reject);
	});
});

test('NpcBox addNext/addClose use DOM.show for CSS-hidden buttons', function() {
	var requirejs = require('requirejs');
	requirejs.config({
		baseUrl: path.join(ROOT, 'src'),
		nodeRequire: require
	});

	return new Promise(function(resolve, reject) {
		requirejs(['Utils/DOM'], function(DOM) {
			var dom = new JSDOM(
				'<!DOCTYPE html><html><head><style>' +
					loadHtml('src/UI/Components/NpcBox/NpcBox.css') +
				'</style></head><body></body></html>',
				{ pretendToBeVisual: true }
			);
			var win = dom.window;
			var prevWindow = global.window;
			var prevDocument = global.document;

			global.window = win;
			global.document = win.document;

			try {
				var template = win.document.createElement('template');
				template.innerHTML = loadHtml('src/UI/Components/NpcBox/NpcBox.html').trim();
				var ui = template.content.firstChild;
				win.document.body.appendChild(ui);

				var nextBtn = ui.querySelector('.next');
				var closeBtn = ui.querySelector('.close');

				assert.equal(win.getComputedStyle(nextBtn).display, 'none', 'Next starts hidden via CSS');
				assert.equal(win.getComputedStyle(closeBtn).display, 'none', 'Close starts hidden via CSS');

				DOM.show(nextBtn);
				assert.equal(DOM.isVisible(nextBtn), true, 'DOM.show should reveal Next button');
				assert.notEqual(win.getComputedStyle(nextBtn).display, 'none', 'Next should override stylesheet display:none');

				nextBtn.style.display = '';
				assert.equal(DOM.isVisible(nextBtn), false, 'style.display="" must not reveal CSS-hidden Next button');

				DOM.show(closeBtn);
				assert.equal(DOM.isVisible(closeBtn), true, 'DOM.show should reveal Close button');

				var source = fs.readFileSync(
					path.join(ROOT, 'src/UI/Components/NpcBox/NpcBox.js'),
					'utf8'
				);
				assert.match(source, /DOM\.show\s*\(\s*this\.ui\.querySelector\s*\(\s*['"]\.next['"]\s*\)\s*\)/);
				assert.match(source, /DOM\.show\s*\(\s*this\.ui\.querySelector\s*\(\s*['"]\.close['"]\s*\)\s*\)/);
				assert.doesNotMatch(
					source,
					/querySelector\s*\(\s*['"]\.(?:next|close)['"]\s*\)\.style\.display\s*=\s*['"]["']/,
					'NpcBox must not use style.display="" to show Next/Close'
				);

				resolve();
			}
			catch (err) {
				reject(err);
			}
			finally {
				global.window = prevWindow;
				global.document = prevDocument;
			}
		}, reject);
	});
});

test('DOM.isVisible returns false for detached UI nodes', function() {
	var requirejs = require('requirejs');
	requirejs.config({
		baseUrl: path.join(ROOT, 'src'),
		nodeRequire: require
	});

	return new Promise(function(resolve, reject) {
		requirejs(['Utils/DOM'], function(DOM) {
			var dom = new JSDOM(
				'<!DOCTYPE html><html><body><div id="NpcBox"></div></body></html>',
				{ pretendToBeVisual: true }
			);
			var win = dom.window;
			var prevWindow = global.window;
			var prevDocument = global.document;

			global.window = win;
			global.document = win.document;

			try {
				var ui = win.document.getElementById('NpcBox');
				ui.style.width = '100px';
				ui.style.height = '100px';

				assert.equal(DOM.isVisible(ui), true, 'attached node with layout should be visible');

				ui.parentNode.removeChild(ui);
				assert.equal(DOM.isVisible(ui), false, 'detached node should not be visible (jQuery :visible)');

				resolve();
			}
			catch (err) {
				reject(err);
			}
			finally {
				global.window = prevWindow;
				global.document = prevDocument;
			}
		}, reject);
	});
});

test('EntityControl guards NPC interaction with NpcBox.__active', function() {
	var source = fs.readFileSync(
		path.join(ROOT, 'src/Controls/EntityControl.js'),
		'utf8'
	);
	assert.match(
		source,
		/!NpcBox\.__active\s*\|\|\s*!NpcBox\.ui\s*\|\|\s*!DOM\.isVisible\s*\(\s*NpcBox\.ui\s*\)/,
		'NPC hover/click must guard on NpcBox.__active after UIComponent.remove()'
	);
});

test('Inventory clearNewItems clears .new_item markers without querySelector footgun', function() {
	var files = [
		'src/UI/Components/Inventory/InventoryV0/InventoryV0.js',
		'src/UI/Components/Inventory/InventoryV1/InventoryV1.js',
		'src/UI/Components/Inventory/InventoryV2/InventoryV2.js',
		'src/UI/Components/Inventory/InventoryV3/InventoryV3.js'
	];

	files.forEach(function(rel) {
		var source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
		assert.doesNotMatch(
			source,
			/\.querySelector\s*\(\s*['"]\.new_item['"]\s*\)\.style/,
			rel + ' should clear .new_item via querySelectorAll in clearNewItems — none may exist when inventory is empty'
		);
		assert.match(
			source,
			/querySelectorAll\s*\(\s*['"]\.new_item['"]\s*\)\.forEach/,
			rel + ' clearNewItems should iterate all .new_item markers'
		);
	});
});

test('Inventory onShortCut TOGGLE close path does not throw on empty inventory', function() {
	var dom = new JSDOM('<!DOCTYPE html><body></body>');
	var template = dom.window.document.createElement('template');
	template.innerHTML = loadHtml('src/UI/Components/Inventory/InventoryV2/InventoryV2.html').trim();
	var ui = template.content.firstElementChild;

	var component = {
		ui: ui,
		newItems: [{ index: 1 }],
		clearNewItems: function clearNewItems() {
			this.newItems = [];
			this.ui.querySelectorAll('.new_item').forEach(function(el) {
				el.style.backgroundImage = '';
			});
		}
	};

	assert.equal(ui.querySelector('.new_item'), null, 'empty inventory template has no .new_item rows');

	assert.doesNotThrow(function() {
		component.clearNewItems();
	}, 'clearNewItems must tolerate zero .new_item elements (jQuery .css on empty set was a no-op)');
});

test('MobileUI onShortCut SHOW uses this.ui, not this.style', function() {
	var source = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/MobileUI/MobileUI.js'),
		'utf8'
	);

	assert.doesNotMatch(
		source,
		/MobileUI\.onShortCut[\s\S]*?this\.style\.display/,
		'MobileUI.onShortCut must not use this.style — UIComponent is not a DOM element'
	);
	assert.match(
		source,
		/case\s*['"]SHOW['"][\s\S]*?DOM\.show\s*\(\s*this\.ui\s*\)/,
		'MobileUI SHOW shortcut should reveal the component via DOM.show(this.ui)'
	);
});

test('DOM.clampWindowPosition keeps magnet-bottom windows on screen', function() {
	var requirejs = require('requirejs');
	requirejs.config({
		baseUrl: path.join(ROOT, 'src'),
		nodeRequire: require
	});

	return new Promise(function(resolve, reject) {
		requirejs(['Utils/DOM'], function(DOM) {
			var dom = new JSDOM('<!DOCTYPE html><body></body>');
			var win = dom.window;
			var prevWindow = global.window;
			var prevDocument = global.document;

			global.window = win;
			global.document = win.document;

			try {
				var ui = win.document.createElement('div');
				ui.style.position = 'absolute';
				ui.style.width = '200px';
				ui.style.height = '400px';
				ui.style.top = '-100px';
				ui.style.left = '0px';
				Object.defineProperty(ui, 'offsetWidth', { configurable: true, get: function() { return 200; } });
				Object.defineProperty(ui, 'offsetHeight', { configurable: true, get: function() { return 400; } });
				win.document.body.appendChild(ui);

				DOM.clampWindowPosition(ui, 300, 300, { BOTTOM: true });

				assert.equal(parseInt(ui.style.top, 10), 0, 'magnet bottom on a short viewport should not place the titlebar above the screen');
				assert.equal(parseInt(ui.style.left, 10), 0, 'left edge should stay in bounds');

				ui.style.top = '350px';
				DOM.clampWindowPosition(ui, 300, 300, null);
				assert.equal(parseInt(ui.style.top, 10), 0, 'overflow bottom should clamp into the viewport');

				resolve();
			}
			catch (err) {
				reject(err);
			}
			finally {
				global.window = prevWindow;
				global.document = prevDocument;
			}
		}, reject);
	});
});
