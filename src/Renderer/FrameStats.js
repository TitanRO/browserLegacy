/**
 * Renderer/FrameStats.js
 *
 * The performance panel's frame clock (Plugins/Helpers/PerfCore.js): when a listener is set, the render loop reports
 * each rendered frame's time and how long its JavaScript work took. Nothing is measured while no listener is set.
 *
 * @author Trojal
 */

const FrameStats = {
	/** (now ms, work ms) => void, or null */
	listener: null,

	frame(now, workMs) {
		if (this.listener) this.listener(now, workMs);
	}
};

export default FrameStats;
