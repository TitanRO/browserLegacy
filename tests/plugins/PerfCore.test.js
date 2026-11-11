import { describe, expect, it } from 'vitest';
import { Perf, WINDOW_S } from 'Plugins/Helpers/PerfCore.js';

describe('performance panel', () => {
	it('FPS, frame and CPU time over the last second', () => {
		const p = new Perf();
		expect(p.fps()).toBe(null);
		for (let i = 0; i <= 50; i++) p.frame(10000 + 20 * i, 5);
		expect(p.fps()).toBe(50);
		const [frame, cpu] = p.frameMs();
		expect(frame).toBeCloseTo(20);
		expect(cpu).toBeCloseTo(5);
	});

	it('low and high over the last ten seconds', () => {
		const p = new Perf();
		for (let s = 0; s < 12; s++) {
			const per = s === 5 ? 10 : 60;
			for (let k = 1; k <= per; k++) p.frame(s * 1000 + Math.floor((k * 1000) / per) - 1, 1);
		}
		const [lo, hi] = p.lowHigh();
		expect(lo).toBeLessThanOrEqual(11);
		expect(hi).toBeGreaterThanOrEqual(59);
		expect(p.seconds.length).toBeLessThanOrEqual(WINDOW_S);
	});

	it('ping and pong', () => {
		const p = new Perf();
		expect(p.pingDue(1000)).toEqual({ type: 'ping', id: 1 });
		expect(p.pingDue(1500)).toBe(null);
		p.pong(1080, { id: 7, server_ms: 1, server_max_ms: 2 });
		expect(p.latencyMs).toBe(null);
		p.pong(1080, { id: 1, server_ms: 0.8, server_max_ms: 3.5 });
		expect(p.latencyMs).toBe(80);
		expect(p.server).toEqual([0.8, 3.5]);
		expect(p.pingDue(4000)).not.toBe(null);
		expect(p.pingDue(9000)).toBe(null);
		expect(p.pingDue(14001)).not.toBe(null);
	});

	it('what the browser cannot measure says N/A', () => {
		const text = new Perf().lines().map(l => l.text);
		for (const name of ['GPU', 'VRAM', 'DRIVE', 'SHADER']) {
			expect(text.find(t => t.startsWith(name))).toMatch(/N\/A$/);
		}
	});
});
