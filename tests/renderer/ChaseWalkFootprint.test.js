import { describe, it, expect, vi } from 'vitest';
import { leaveFootprint } from 'Renderer/Entity/EntityWalk.js';
import StatusState from 'DB/Status/StatusState.js';
import FootprintHook from 'Renderer/Entity/FootprintHook.js';

/** A walker as leaveFootprint sees it: its effect state, cell and direction, and the footprint hook. */
function walker(effectState) {
	FootprintHook.leave = vi.fn();
	return { _effectState: effectState, position: [10, 10, 0], direction: 6 };
}

describe('Chase Walk footprints', () => {
	it('leaves one print per cell stepped on, left and right in turn, turned the walker\'s way', () => {
		const e = walker(StatusState.EffectState.CHASEWALK);
		leaveFootprint(e);
		e.position[0] = 10.3; // still the same cell
		leaveFootprint(e);
		e.position[0] = 11;
		leaveFootprint(e);
		e.position[0] = 12;
		e.direction = 7;
		leaveFootprint(e);
		expect(FootprintHook.leave.mock.calls).toEqual([
			[10, 10, 6, true],
			[11, 10, 6, false],
			[12, 10, 7, true]
		]);
	});

	it('leaves none for a walker not in Chase Walk', () => {
		const e = walker(StatusState.EffectState.HIDE);
		leaveFootprint(e);
		e.position[0] = 11;
		leaveFootprint(e);
		expect(FootprintHook.leave).not.toHaveBeenCalled();
	});
});
