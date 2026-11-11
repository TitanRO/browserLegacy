import { describe, it, expect, vi } from 'vitest';
import { webcrypto } from 'node:crypto';

vi.mock('Core/Client.js', () => ({ default: { loadFile: vi.fn() } }));
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
const { findRecording, replay, runLuaRecipe } = await import('DB/LuaRecipeRunner.js');
const { QUEST_RECIPE, recipeHash, recordingPath, tableRecipe, valueRecipe } = await import('DB/LuaRecipes.js');

const bytes = s => Uint8Array.from(s, c => c.charCodeAt(0));
const hex = async b => Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256', b)), x => x.toString(16).padStart(2, '0')).join('');
const recording = async (recipe, files, calls, over = {}) =>
	bytes(
		JSON.stringify({
			format: 1,
			recipe: recipeHash(recipe),
			source: 'x',
			files: await Promise.all(files.map(async ([path, b]) => ({ path, sha256: await hex(b) }))),
			calls,
			...over
		})
	);

describe('Lua recipes', () => {
	it('name a recording by recipe and files, under SystemEN/luatables', () => {
		const p = recordingPath(QUEST_RECIPE, ['System/OngoingQuestInfoList_true.lub']);
		expect(p).toBe(`SystemEN/luatables/${recipeHash(QUEST_RECIPE)}/System_OngoingQuestInfoList_true.lub.json`);
		expect(recipeHash(valueRecipe('A'))).not.toBe(recipeHash(valueRecipe('B')));
		expect(tableRecipe('JobNameTable').driver).toContain('pairs(JobNameTable)');
		expect(tableRecipe('JobNameTable').keep).toEqual([0]);
	});
});

describe('Lua recipe runner', () => {
	const files = [['System/OngoingQuestInfoList_true.lub', bytes('lua bytes')]];

	it('finds a recording made from these very bytes and this recipe', async () => {
		const calls = [[0, 1, 'Té', 'S', 'i', '', '', 0, 0, 10, 5]];
		const data = await recording(QUEST_RECIPE, files, calls);
		const load = vi.fn(async p => (p === recordingPath(QUEST_RECIPE, [files[0][0]]) ? data : Promise.reject()));
		expect(await findRecording(QUEST_RECIPE, files, load)).toEqual(calls);
	});

	it("doesn't use one made from other bytes, another recipe or another format", async () => {
		const other = await recording(QUEST_RECIPE, [[files[0][0], bytes('older release')]], [[0]]);
		expect(await findRecording(QUEST_RECIPE, files, async () => other)).toBe(null);
		const recipe = await recording(QUEST_RECIPE, files, [[0]], { recipe: 'ffffffff' });
		expect(await findRecording(QUEST_RECIPE, files, async () => recipe)).toBe(null);
		const format = await recording(QUEST_RECIPE, files, [[0]], { format: 2 });
		expect(await findRecording(QUEST_RECIPE, files, async () => format)).toBe(null);
		expect(await findRecording(QUEST_RECIPE, files, () => Promise.reject(new Error('404')))).toBe(null);
	});

	it('replays the calls with Lua strings as their bytes, in slices', async () => {
		const got = [];
		let pauses = 0;
		const calls = Array.from({ length: 50 }, (_, i) => [i % 2 ? 1 : 0, i, 'dÿ', null, true]);
		await replay(
			QUEST_RECIPE,
			calls,
			{ AddQuestInfo: (...a) => got.push(['info', ...a]), AddQuestDescription: (...a) => got.push(['desc', ...a]) },
			{ pause: () => (pauses++, Promise.resolve()), budget: -1 }
		);
		expect(got).toHaveLength(50);
		expect(got[1]).toEqual(['desc', 1, Uint8Array.from([0x64, 0xff]), null, true]);
		expect(pauses).toBe(50);
	});

	it('runs the Lua when there is no recording, with the callbacks set on the Lua context', async () => {
		const Client = (await import('Core/Client.js')).default;
		Client.loadFile.mockImplementation((path, ok, fail) => fail('404'));
		const lua = { ctx: {}, mountFile: vi.fn(), doFile: vi.fn(async () => {}), doStringSync: vi.fn() };
		const cb = { AddQuestInfo: () => 1 };
		expect(await runLuaRecipe(lua, QUEST_RECIPE, files, cb)).toBe(false);
		expect(lua.ctx.AddQuestInfo).toBe(cb.AddQuestInfo);
		expect(lua.mountFile).toHaveBeenCalledWith(files[0][0], files[0][1]);
		expect(lua.doStringSync).toHaveBeenCalledWith(QUEST_RECIPE.driver);
	});

	it('replays a recording and still runs the files the recipe keeps', async () => {
		const Client = (await import('Core/Client.js')).default;
		const recipe = tableRecipe('T');
		const two = [['id.lub', bytes('ids')], ['names.lub', bytes('names')]];
		const data = await recording(recipe, two, [[0, 7, 'Name']]);
		Client.loadFile.mockImplementation((path, ok) => ok(data));
		const lua = { ctx: {}, mountFile: vi.fn(), doFile: vi.fn(async () => {}), doStringSync: vi.fn() };
		const table = {};
		const replayed = await runLuaRecipe(lua, recipe, two, { addKeyAndValueToTable: (k, v) => (table[k] = String.fromCharCode(...v)) });
		expect(replayed).toBe(true);
		expect(table).toEqual({ 7: 'Name' });
		expect(lua.doFile).toHaveBeenCalledTimes(1);
		expect(lua.doFile).toHaveBeenCalledWith('id.lub');
		expect(lua.doStringSync).not.toHaveBeenCalled();
	});
});
