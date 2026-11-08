/**
 * The homunculus and mercenary AIs' Lua states are made when one is coming, not while the game's databases load:
 * initAI only fetches the scripts, prepare(kind) makes that kind's two states once, and the AI runs once they're
 * ready (a command given meanwhile waits in the AI's message queue, kept outside Lua).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
	const states = [];
	const makeState = () => {
		const state = { ctx: {}, ran: [], closed: false, doStringSync: vi.fn(code => state.ran.push(code)) };
		state.global = { close: vi.fn(() => (state.closed = true)) };
		states.push(state);
		return state;
	};
	return {
		states,
		makeState,
		db: { createLuaState: vi.fn(async () => makeState()) },
		loader: {
			DEFAULT_SEARCH_PATHS: [],
			setup: vi.fn(lua => lua),
			normalizeVfsPath: p => p,
			loadCandidateData: vi.fn(async () => new Uint8Array()),
			loadAndExecuteFiles: vi.fn(async () => {})
		},
		session: { homCustomAI: false, merCustomAI: false }
	};
});

vi.mock('DB/DBManager.js', () => ({ default: mocks.db }));
vi.mock('Core/LuaModuleLoader.js', () => ({ default: mocks.loader }));
vi.mock('Engine/SessionStorage.js', () => ({ default: mocks.session }));
vi.mock('Network/NetworkManager.js', () => ({ default: {} }));
vi.mock('Network/PacketStructure.js', () => ({ default: {} }));
vi.mock('Network/PacketVerManager.js', () => ({ default: { value: 20250716 } }));
vi.mock('DB/Skills/SkillInfo.js', () => ({ default: {} }));
vi.mock('Renderer/EntityManager.js', () => ({ default: { get: () => null } }));
vi.mock('Core/Configs.js', () => ({ default: { get: (_k, d) => d } }));
vi.mock('UI/UIManager.js', () => ({ default: { getComponent: () => ({}) } }));
vi.mock('Utils/CodepageManager.js', () => ({ default: { decode: s => s } }));

const load = async () => {
	vi.resetModules();
	return (await import('Core/AIDriver.js')).default;
};

describe('AI Lua states on demand', () => {
	beforeEach(() => {
		mocks.states.length = 0;
		vi.clearAllMocks();
		mocks.loader.loadAndExecuteFiles.mockImplementation(async () => {});
	});

	it('only fetches the AI scripts while the databases load', async () => {
		const AIDriver = await load();
		const onEnd = vi.fn();
		await AIDriver.initAI(onEnd);
		expect(onEnd).toHaveBeenCalledOnce();
		expect(mocks.db.createLuaState).not.toHaveBeenCalled();
		expect(mocks.loader.loadCandidateData).toHaveBeenCalledWith('AI/USER_AI/AI_M.lua');
	});

	it("makes a kind's two states once, and runs the AI once they're ready", async () => {
		const AIDriver = await load();
		AIDriver.exec('AI(1)', true); // the first tick starts it and doesn't run on a half-made state
		const again = AIDriver.prepare('homun');
		expect(AIDriver.prepare('homun')).toBe(again);
		await again;
		expect(mocks.db.createLuaState).toHaveBeenCalledTimes(2);
		expect(mocks.states.every(state => state.ran.length > 0 && !state.ran.includes('AI(1)'))).toBe(true);

		AIDriver.exec('AI(1)', true);
		expect(AIDriver.default_HO_AI.ran).toContain('AI(1)');
		mocks.session.homCustomAI = true;
		AIDriver.exec('AI(2)', true);
		expect(AIDriver.HO_AI.ran).toContain('AI(2)');
		mocks.session.homCustomAI = false;

		AIDriver.exec('AI(3)', false); // the mercenary's are made separately
		await AIDriver.prepare('merc');
		expect(mocks.db.createLuaState).toHaveBeenCalledTimes(4);
	});

	it("runs the default AI when the player's USER_AI isn't there, and closes its state", async () => {
		const AIDriver = await load();
		mocks.loader.loadAndExecuteFiles.mockImplementation(async (_lua, files) => {
			if (files[0].startsWith('AI/USER_AI/')) {
				throw Object.assign(new Error('not found'), { code: 'LUA_FILE_NOT_FOUND' });
			}
		});
		await AIDriver.prepare('merc');
		expect(AIDriver.MER_AI).toBe(AIDriver.default_MER_AI);
		expect(mocks.states.filter(state => state.closed)).toHaveLength(1);
	});
});
