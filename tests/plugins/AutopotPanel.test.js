/**
 * The autopot panel: what it sends and how it reads the answers.
 */
import { describe, expect, it } from 'vitest';
import { autopotPanel, parseRuleLine, ruleCommand } from 'Plugins/Helpers/AutopotPanel.js';

describe('autopot panel', () => {
	it('reads the server rule lines', () => {
		expect(parseRuleLine('Autopot HP: White Potion below 50%.')).toEqual({ kind: 'hp', item: 'White Potion', percent: 50 });
		expect(parseRuleLine('Autopot SP: no rule.')).toEqual({ kind: 'sp', item: null, percent: null });
		expect(parseRuleLine('Autopot paused.')).toBeNull();
	});

	it('builds the command only for a usable rule', () => {
		expect(ruleCommand('hp', '50', '504')).toBe('@autopot hp 50 504');
		expect(ruleCommand('sp', 95, 'Blue Potion')).toBeNull();
		expect(ruleCommand('hp', 50, ' ')).toBeNull();
	});

	it('asks for the rules on mount and fills them from the answers', () => {
		const sent = [];
		let listener = null;
		const panel = autopotPanel(
			{ send: t => sent.push(t), onServerMessage: l => ((listener = l), () => {}) },
			() => [{ id: 504, name: 'White Potion' }]
		);
		const body = document.createElement('div');
		const view = panel.mount(body);
		view.update();
		expect(sent).toEqual(['@autopot']);
		expect(body.querySelector('option').value).toBe('504');
		listener('Autopot HP: White Potion below 40%.');
		const hpPct = body.querySelector('tr[data-kind="hp"] .pct');
		expect(hpPct.value).toBe('40');
		body.querySelector('tr[data-kind="sp"] .pct').value = '30';
		body.querySelectorAll('tr[data-kind="sp"]')[1].querySelector('.item').value = '505';
		body.querySelectorAll('tr[data-kind="sp"]')[1].querySelector('.set').click();
		expect(sent).toContain('@autopot sp 30 505');
		body.querySelector('.pause').click();
		expect(sent).toContain('@autopot off');
	});
});
