'use strict';

/**
 * Smoke test for WinLogin DOM wiring (catches addEventListener assignment bugs).
 *
 * Run: node --test scripts/smoke-winlogin.test.js
 */

var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var test = require('node:test');
var { JSDOM } = require('jsdom');

var ROOT = path.join(__dirname, '..');

function loadWinLoginHtml() {
	return fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/WinLogin/WinLogin/WinLogin.html'),
		'utf8'
	);
}

function initWinLoginElements(ui) {
	var inputUsername = ui.querySelector('.user');
	var inputPassword = ui.querySelector('.pass');
	var buttonSave = ui.querySelector('.save');

	inputUsername.addEventListener('mousedown', function() {});
	inputPassword.addEventListener('mousedown', function() {});
	buttonSave.addEventListener('mousedown', function() {});

	return {
		inputUsername: inputUsername,
		inputPassword: inputPassword,
		buttonSave: buttonSave
	};
}

function onAppendWinLogin(elements, preferences) {
	elements.inputUsername.value = preferences.saveID ? preferences.ID : '';
	elements.inputPassword.value = '';
	elements.buttonSave.style.backgroundImage = 'url(test.bmp)';
}

test('WinLogin init stores DOM elements (not addEventListener return value)', function() {
	var dom = new JSDOM('<!DOCTYPE html><body></body>');
	var ui = dom.window.document.createElement('div');
	ui.innerHTML = loadWinLoginHtml();

	var elements = initWinLoginElements(ui);

	assert.ok(elements.inputUsername, 'username input element should exist');
	assert.ok(elements.inputPassword, 'password input element should exist');
	assert.ok(elements.buttonSave, 'save button element should exist');
	assert.equal(typeof elements.inputUsername.addEventListener, 'function');
});

test('WinLogin onAppend can set input values without throwing', function() {
	var dom = new JSDOM('<!DOCTYPE html><body></body>');
	var ui = dom.window.document.createElement('div');
	ui.innerHTML = loadWinLoginHtml();

	var elements = initWinLoginElements(ui);

	assert.doesNotThrow(function() {
		onAppendWinLogin(elements, { saveID: true, ID: 'testuser' });
	});

	assert.equal(elements.inputUsername.value, 'testuser');
	assert.equal(elements.inputPassword.value, '');
});

test('WinLogin source does not assign addEventListener return value', function() {
	var source = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/WinLogin/WinLogin/WinLogin.js'),
		'utf8'
	);

	assert.doesNotMatch(
		source,
		/=\s*\w+\.querySelector\([^)]+\)\.addEventListener\s*\(/,
		'WinLogin.js should assign querySelector result before addEventListener'
	);
});

test('WinLoginV2 source does not assign addEventListener return value', function() {
	var source = fs.readFileSync(
		path.join(ROOT, 'src/UI/Components/WinLogin/WinLoginV2/WinLoginV2.js'),
		'utf8'
	);

	assert.doesNotMatch(
		source,
		/=\s*\w+\.ui\.querySelector\([^)]+\)\.addEventListener\s*\(/,
		'WinLoginV2.js should assign querySelector result before addEventListener'
	);
});
