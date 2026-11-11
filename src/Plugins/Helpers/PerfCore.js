/**
 * Plugins/Helpers/PerfCore.js
 *
 * The performance panel's numbers (performance.enabled, off by default), as the Windows client's (TitanRONet.dll
 * perf.rs): what the browser lets us measure honestly, N/A for the rest.
 *
 * - FPS and frame ms: rendered frames in the last second (Renderer/FrameStats.js) and the mean time between them;
 * - FPS low/high: the lowest and highest one-second FPS of the last WINDOW_S seconds;
 * - CPU ms: the JavaScript work of a frame (events, the render callbacks), averaged over the last second;
 * - MEM: the JavaScript heap in use (performance.memory, Chromium only; N/A elsewhere);
 * - LATENCY and SERVER: the round trip of a {"type":"ping"} on the map WebSocket and the map server's average and
 *   longest timer pass of the last 10 s, from its pong (the client_tools plugin);
 * - GPU, VRAM, DRIVE, SHADER: N/A (browsers don't expose them).
 *
 * @author Trojal
 */

export const WINDOW_S = 10;
export const PING_EVERY_MS = 2000;
export const LOST_MS = 10000;

export class Perf {
	constructor() {
		this.frames = []; // [time ms, frame ms, work ms] of the last second
		this.lastFrame = null;
		this.seconds = []; // one-second FPS samples, newest last
		this.secondStart = null;
		this.framesThisSecond = 0;
		this.mem = null; // bytes
		this.latencyMs = null;
		this.server = null; // [avg ms, max ms]
		this.ping = null; // [id, sent at]
		this.lastPing = null;
		this.nextId = 0;
	}

	/** A frame was rendered at `now` (ms); its JavaScript work took `workMs`. */
	frame(now, workMs) {
		if (this.lastFrame !== null) this.frames.push([now, now - this.lastFrame, workMs]);
		this.lastFrame = now;
		while (this.frames.length && now - this.frames[0][0] > 1000) this.frames.shift();
		if (this.secondStart === null) this.secondStart = now;
		if (now - this.secondStart >= 1000) {
			this.seconds.push(this.framesThisSecond);
			while (this.seconds.length > WINDOW_S) this.seconds.shift();
			this.secondStart += 1000 * Math.floor((now - this.secondStart) / 1000);
			this.framesThisSecond = 0;
		}
		this.framesThisSecond++;
	}

	fps() {
		return this.frames.length ? this.frames.length : null;
	}

	/** [mean frame ms, mean work ms] over the last second, or null. */
	frameMs() {
		const n = this.frames.length;
		if (!n) return null;
		let frame = 0;
		let work = 0;
		for (const f of this.frames) {
			frame += f[1];
			work += f[2];
		}
		return [frame / n, work / n];
	}

	lowHigh() {
		return this.seconds.length ? [Math.min(...this.seconds), Math.max(...this.seconds)] : null;
	}

	/** The ping message to send now, if one is due, else null. */
	pingDue(now) {
		if (this.lastPing !== null && now - this.lastPing < PING_EVERY_MS) return null;
		if (this.ping && now - this.ping[1] < LOST_MS) return null;
		this.nextId++;
		this.ping = [this.nextId, now];
		this.lastPing = now;
		return { type: 'ping', id: this.nextId };
	}

	/** The server's pong; a stale or unknown id is ignored. */
	pong(now, answer) {
		if (!this.ping || !answer || answer.id !== this.ping[0]) return;
		this.latencyMs = now - this.ping[1];
		this.server = [Number(answer.server_ms) || 0, Number(answer.server_max_ms) || 0];
		this.ping = null;
	}

	/** The panel's lines: {text, na}. */
	lines() {
		const ms = v => `${v.toFixed(1)} ms`;
		const fm = this.frameMs();
		const lh = this.lowHigh();
		const rows = [
			['CPU', fm ? ms(fm[1]) : null],
			['GPU', null],
			['LATENCY', this.latencyMs !== null ? `${Math.round(this.latencyMs)} ms` : null],
			['SERVER', this.server ? `${ms(this.server[0])} (max ${this.server[1].toFixed(1)})` : null],
			['MEM', this.mem !== null ? `${Math.floor(this.mem / (1024 * 1024))} MB (JS heap)` : null],
			['VRAM', null],
			['DRIVE', null],
			['SHADER', null]
		];
		return [
			{ text: `FPS ${this.fps() ?? 'N/A'}   frame ${fm ? ms(fm[0]) : 'N/A'}`, na: false },
			{
				text: lh
					? `FPS low ${lh[0]} / high ${lh[1]} (last ${WINDOW_S} s)`
					: `FPS low / high: N/A (last ${WINDOW_S} s)`,
				na: false
			},
			...rows.map(([name, value]) => ({ text: `${name.padEnd(8)}${value ?? 'N/A'}`, na: value === null }))
		];
	}
}
