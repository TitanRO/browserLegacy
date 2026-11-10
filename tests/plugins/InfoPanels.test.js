/**
 * The information panels' state and text (the same cases as TitanRONet.dll's unit tests, so both clients agree).
 */
import { describe, expect, it } from 'vitest';
import {
	Combat,
	ExpTracker,
	KIND,
	LootLog,
	SP,
	alertReason,
	damageLines,
	duration,
	expLines,
	lootRules,
	mvpLines,
	shortNumber,
	targetText
} from 'Plugins/Helpers/InfoCore.js';
import { HELPER_OPTIONS, optionSections } from 'Plugins/Helpers/HelperOptions.js';
import { DEFAULT_SETTINGS } from 'Plugins/Helpers/HelperSettings.js';
import { Info } from 'Plugins/Helpers/InfoPanels.js';

const ME = 2000091;
const PORING = 0x068eb49d;
const unit = (id, kind, name, hp, maxHp) => ({ type: 'Unit', id, kind, job: 1002, level: 1, hp, maxHp, boss: false, name });
const act = (source, target, damage, skill = 0) => ({ type: 'Damage', source, target, damage, skill });

function fighting() {
	const c = new Combat();
	c.event({ type: 'Entered', aid: ME }, 0);
	c.event(unit(PORING, KIND.MONSTER, 'Poring', -1, -1), 0);
	return c;
}

describe('formats', () => {
	it('writes numbers and durations as the Windows client does', () => {
		expect(shortNumber(1234)).toBe('1,234');
		expect(shortNumber(12345)).toBe('12.3k');
		expect(shortNumber(12345678)).toBe('12.3M');
		expect(shortNumber(-5)).toBe('-5');
		expect(duration(3900)).toBe('1h 05m');
		expect(duration(750)).toBe('12m 30s');
		expect(duration(45)).toBe('45s');
		expect(duration(1e9)).toBe('99h+');
	});
});

describe('the exp tracker', () => {
	const start = t => {
		t.param(SP.BASELEVEL, 10, 0);
		t.param(SP.NEXTBASEEXP, 1000, 0);
		t.param(SP.BASEEXP, 100, 0);
		t.param(SP.JOBLEVEL, 5, 0);
		t.param(SP.NEXTJOBEXP, 500, 0);
		t.param(SP.JOBEXP, 0, 0);
		t.param(SP.ZENY, 5000, 0);
	};

	it('counts rates from the first gain', () => {
		const t = new ExpTracker();
		start(t);
		expect(t.report(10).baseGained).toBe(0);
		t.param(SP.BASEEXP, 200, 600);
		t.param(SP.JOBEXP, 50, 600);
		t.param(SP.BASEEXP, 400, 2400);
		t.param(SP.ZENY, 6000, 2400);
		const r = t.report(4200);
		expect(r.baseGained).toBe(300);
		expect(r.basePerHour).toBe(300);
		expect(r.jobPerHour).toBe(50);
		expect(r.zenyPerHour).toBe(1000);
		expect(r.basePercentPerHour).toBe(30);
		expect(r.baseEta).toBe(7200);
	});

	it('counts the rest of the old level on a level up, nothing on the death penalty', () => {
		const t = new ExpTracker();
		start(t);
		t.param(SP.BASELEVEL, 11, 5);
		t.param(SP.NEXTBASEEXP, 1200, 5);
		t.param(SP.BASEEXP, 50, 5);
		expect(t.report(5).baseGained).toBe(950);
		t.param(SP.BASEEXP, 20, 6);
		expect(t.report(6).baseGained).toBe(950);
	});

	it('writes the panel lines', () => {
		const t = new ExpTracker();
		for (const [v, x] of [[11, 10], [22, 1000], [1, 0], [55, 1], [23, 100], [2, 0], [20, 0]]) t.param(v, x, 0);
		t.param(SP.BASEEXP, 100, 10);
		const lines = expLines(t, 3610);
		expect(lines[0]).toBe('Base 100/h (10.00%/h)');
		expect(lines[1]).toBe('  next level in 9h 00m');
		expect(lines[3]).toBe('  next level in -');
		expect(lines[5]).toBe('Session 1h 00m');
	});
});

describe('the target and the damage log', () => {
	it('follows the player and the HP the server sends', () => {
		const c = fighting();
		expect(targetText(c.targetUnit())).toEqual(['No target']);
		c.event(act(ME, PORING, 20), 1);
		expect(targetText(c.targetUnit())).toEqual(['Poring (Lv 1)', 'HP 100%']);
		c.event(unit(PORING, KIND.MONSTER, 'Poring', 30, 50), 1.1);
		expect(targetText(c.targetUnit())[1]).toBe('HP 60.0%  30 / 50');
		c.event({ type: 'UnitGone', id: PORING, how: 1 }, 2);
		expect(targetText(c.targetUnit())[1]).toBe('Dead');
	});

	it('never targets players', () => {
		const c = fighting();
		c.event(unit(77, KIND.PLAYER, 'Someone', -1, -1), 0);
		c.event(act(ME, 77, 50), 1);
		expect(c.targetUnit()).toBeNull();
	});

	it("counts only the player's own units", () => {
		const c = fighting();
		c.event({ type: 'Homunculus', id: 500 }, 0);
		c.event(act(ME, PORING, 100), 10);
		c.event(act(ME, PORING, 300, 5), 11);
		c.event(act(500, PORING, 40), 12);
		c.event(act(600, PORING, 9999), 12.5);
		c.event(act(PORING, ME, 7), 13);
		c.event(act(ME, PORING, 0), 13.5);
		expect(c.totalDamage()).toBe(440);
		expect(c.dps()).toBeCloseTo(440 / 3);
		const lines = damageLines(c, s => (s === 5 ? 'Bash' : `Skill ${s}`));
		expect(lines[0]).toBe('DPS 147   total 440');
		expect(lines[1]).toBe('Bash 300 (1 hits)');
		expect(lines[3]).toBe('Homunculus: Attack 40 (1 hits)');
		expect(lines[4]).toBe('Attack 40 > Poring');
		c.resetDamage();
		expect(c.totalDamage()).toBe(0);
	});
});

describe('loot alerts', () => {
	const rates = { 4001: [1, 1, 'Poring Card'], 909: [7000, 0, 'Jellopy'], 2301: [10, 0, 'Cotton Shirt'], 2302: [500, 0, 'Cotton Shirt [1]'] };

	it('alert on the watch list, cards and rare items', () => {
		const rules = lootRules(DEFAULT_SETTINGS.lootAlerts);
		expect(alertReason(rates, rules, 4001)).toBe('card');
		expect(alertReason(rates, rules, 2301)).toBe('rare');
		expect(alertReason(rates, rules, 2302)).toBeNull();
		expect(alertReason(rates, rules, 909)).toBeNull();
		const watching = lootRules({ ...DEFAULT_SETTINGS.lootAlerts, cards: false, watchList: [909, 12345] });
		expect(alertReason(rates, watching, 909)).toBe('watched');
		expect(alertReason(rates, watching, 12345)).toBe('watched');
		expect(alertReason(rates, watching, 4001)).toBe('rare');
	});

	it('logs each floor item once', () => {
		const log = new LootLog();
		const rules = lootRules();
		expect(log.drop(rates, rules, 1, 909, 3, 0)).toBeNull();
		expect(log.drop(rates, rules, 2, 4001, 1, 1)).toMatchObject({ name: 'Poring Card', reason: 'card' });
		expect(log.drop(rates, rules, 2, 4001, 1, 2)).toBeNull();
	});

	it('another character clears the exp tracker and the loot log', () => {
		const info = new Info({ rates });
		info.event({ type: 'Entered', aid: 7 }, 0);
		info.event({ type: 'Param', varID: SP.BASEEXP, value: 0 }, 0);
		info.event({ type: 'Param', varID: SP.BASEEXP, value: 50 }, 1);
		expect(info.event({ type: 'ItemDrop', floorId: 9, item: 4001, count: 1 }, 1)).toMatchObject({ reason: 'card' });
		info.event({ type: 'Entered', aid: 7 }, 2);
		expect(info.exp.report(3).baseGained).toBe(50);
		info.event({ type: 'Entered', aid: 8 }, 3);
		expect(info.exp.report(4).baseGained).toBe(0);
		expect(info.loot.drops).toEqual([]);
	});
});

describe('MVP timers', () => {
	it('shows the windows due soonest first, then the alive ones', () => {
		const list = {
			skew: 100,
			mvps: [
				{ id: 1039, name: 'Baphomet', map: 'prt_maze03', alive: false, from: 10600, to: 11200 },
				{ id: 1086, name: 'Golden Thief Bug', map: 'prt_sewb4', alive: true },
				{ id: 1115, name: 'Eddga', map: 'pay_fild11', alive: false, from: 9900, to: 10300 },
				{ id: 1150, name: 'Moonlight Flower', map: 'pay_dun04', alive: false, from: 9000, to: 9500 }
			]
		};
		expect(mvpLines(list, 9900).map(l => l.text)).toEqual([
			'Moonlight Flower (pay_dun04) due',
			'Eddga (pay_fild11) due, latest 5m',
			'Baphomet (prt_maze03) in 10m-20m',
			'Golden Thief Bug (prt_sewb4) alive'
		]);
		expect(mvpLines(null, 0)[0].text).toBe('Loading...');
		expect(mvpLines({ skew: 0, mvps: [] }, 0)[0].text).toBe('No MVPs');
	});
});

describe('the helpers window list', () => {
	it('names boolean settings and groups them by section', () => {
		for (const option of HELPER_OPTIONS) {
			const [section, key] = option.key.split('.');
			expect(typeof DEFAULT_SETTINGS[section][key], option.key).toBe('boolean');
		}
		const sections = optionSections([
			{ section: 'Info', key: 'a.enabled', label: 'A', type: 'toggle' },
			{ section: 'Display', key: 'b.enabled', label: 'B', type: 'toggle' },
			{ section: 'Info', key: 'c.enabled', label: 'C', type: 'toggle' },
			{ section: 'Info', key: 'd.level', label: 'D', type: 'number' }
		]);
		expect(sections.map(s => [s.section, s.options.map(o => o.label)])).toEqual([
			['Info', ['A', 'C']],
			['Display', ['B']]
		]);
	});
});
