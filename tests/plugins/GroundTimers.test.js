import { describe, expect, it } from 'vitest';
import { AL_PNEUMA, GroundTimers, JOIN_MS, MG_FIREWALL, MG_SAFETYWALL, SA_LANDPROTECTOR, countdown, timed } from 'Plugins/Helpers/GroundTimers.js';
import { isMarkName, visualOptions } from 'Plugins/Helpers/VisualHelpers.js';
import WoeMarks from 'Plugins/Helpers/WoeMarks.json';

describe('effect countdown timers', () => {
	it('durations by level, as the server', () => {
		expect(timed(AL_PNEUMA, 1)).toEqual([0x85, 10000]);
		expect(timed(MG_SAFETYWALL, 10)).toEqual([0x7e, 50000]);
		expect(timed(SA_LANDPROTECTOR, 1)).toEqual([0x9d, 165000]);
		expect(timed(MG_FIREWALL, 10)).toEqual([0x7f, 14000]);
		expect(timed(92, 5)).toBe(null);
	});

	it('a seen cast counts down until its units go; units already there get none', () => {
		const t = new GroundTimers();
		t.unit(1, 0x9d, 50, 50, 0);
		expect(t.labels(10)).toEqual([]);
		t.groundSkill(AL_PNEUMA, 1, 100, 100, 1000);
		t.unit(10, 0x85, 99, 99, 1050);
		t.unit(11, 0x85, 100, 100, 1050);
		expect(t.labels(1200)).toEqual([{ x: 100, y: 100, text: '10' }]);
		t.unitGone(10);
		expect(t.labels(6100)[0].text).toBe('5');
		t.unitGone(11);
		expect(t.labels(6200)).toEqual([]);
		t.groundSkill(MG_SAFETYWALL, 1, 5, 5, 0);
		t.unit(20, 0x7e, 5, 5, JOIN_MS + 1);
		expect(t.labels(JOIN_MS + 2)).toEqual([]);
	});

	it('no Fire Wall timer near a Violent Gale', () => {
		const t = new GroundTimers();
		t.unit(50, 0x9c, 12, 5, 0);
		t.groundSkill(MG_FIREWALL, 10, 5, 5, 100);
		t.unit(1, 0x7f, 5, 6, 110);
		expect(t.labels(200)).toEqual([]);
	});

	it('countdown text', () => {
		expect(countdown(9001)).toBe('10');
		expect(countdown(165000)).toBe('2:45');
	});
});

describe('WoE map marks and the other batch B options', () => {
	it('castle names and numbered warps', () => {
		expect(WoeMarks.prt_gld.some(([, , text]) => text === 'Kriemhild')).toBe(true);
		expect(isMarkName('Kriemhild')).toBe(true);
		expect(isMarkName('Exit')).toBe(false);
		expect(isMarkName('3>')).toBe(false);
		expect(isMarkName('>3')).toBe(false);
	});

	it('cursor and players follow their settings', () => {
		const get = doc => (section, key) => (doc[section] || {})[key];
		const off = visualOptions(get({}), new Set());
		expect([off.bigPlayers, off.cursorScale, off.cursorTint]).toEqual([false, 1, 0]);
		const on = visualOptions(get({ bigPlayers: { enabled: true }, cursor: { enabled: true, size: 200, color: 2 } }), new Set());
		expect([on.bigPlayers, on.cursorScale, on.cursorTint]).toEqual([true, 2, 2]);
	});
});
