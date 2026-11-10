/**
 * The autopot and vending search panels: what they send and how they read the answers.
 */
import { describe, expect, it, vi } from 'vitest';
import { autopotPanel, parseRuleLine, ruleCommand } from 'Plugins/Helpers/AutopotPanel.js';
import { marketPanel } from 'Plugins/Helpers/MarketPanel.js';

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

describe('vending search panel', () => {
	it('lists the offers and the medians', async () => {
		const answers = {
			'/v1/public/market?q=red': {
				items: [{ id: 501, name: 'Red Potion', type: 0, slots: 0 }],
				cards: [],
				offers: [{ kind: 'sell', itemId: 501, refine: 0, cards: [0, 0, 0, 0], amount: 5, price: 40, owner: 'A', shop: 'S', map: 'prontera', x: 1, y: 2 }]
			},
			'/v1/public/market/history/501': { median7: 45, sales7: 3, median30: 50, sales30: 9 }
		};
		const fetch = vi.fn(url => {
			const path = url.replace('https://api.test', '');
			return Promise.resolve({ ok: true, json: () => Promise.resolve(answers[path]) });
		});
		const panel = marketPanel({ accountApi: 'https://api.test', fetch });
		const body = document.createElement('div');
		panel.mount(body);
		body.querySelector('.q').value = 'red';
		body.querySelector('form').dispatchEvent(new Event('submit', { cancelable: true }));
		await vi.waitFor(() => expect(body.querySelector('.summary').textContent).toContain('median 45 z'));
		expect(body.querySelectorAll('.offers tr').length).toBe(1);
		expect(body.querySelector('.offers td').textContent).toBe('Red Potion');
	});
});
