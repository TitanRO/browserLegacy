/**
 * tests/ui/MasterAccount.language.test.js
 *
 * The MasterAccount plugin loads the game's client files in the master account's language: a language other than
 * English (kept in localStorage) points the remote client at grfhost's lang/<code>/ before anything loads, and a
 * different language announced by the TitanRO shell (`titanro-language` with the code) is kept and reloads the page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('Engine/SessionStorage.js', () => ({ default: {} }));
vi.mock('DB/DBManager.js', () => ({ default: { isLoaded: false, startedLazyInit: false, lazyInit: vi.fn() } }));
vi.mock('UI/Components/WinLogin/WinLogin.js', () => ({ default: { __active: false } }));

const reload = vi.fn();
// Each Init adds a listener on window; they're removed after each test so one test's plugin doesn't hear the next's.
let listeners = [];

async function start(stored) {
	vi.resetModules();
	window.localStorage.clear();
	if (stored) window.localStorage.setItem('titanro.language', stored);
	const Configs = (await import('Core/Configs.js')).default;
	Configs.set('remoteClient', 'https://grf.titanro.net/');
	const Init = (await import('Plugins/MasterAccount/MasterAccount.js')).default;
	const add = window.addEventListener;
	vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
		listeners.push([type, listener]);
		add.call(window, type, listener, options);
	});
	Init({ shell: 'data:text/javascript,export function mount(){return {unmount(){}}}' });
	return Configs;
}

describe('MasterAccount language', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		reload.mockClear();
		Object.defineProperty(window, 'location', {
			configurable: true,
			value: { ...window.location, search: '', reload }
		});
	});
	afterEach(() => {
		for (const [type, listener] of listeners) window.removeEventListener(type, listener);
		listeners = [];
		vi.restoreAllMocks();
		vi.useRealTimers();
		document.getElementById('titanro-shell')?.remove();
	});

	it('loads English files without a stored language', async () => {
		const Configs = await start(null);
		expect(Configs.get('remoteClient')).toBe('https://grf.titanro.net/');
	});

	it("loads a stored language's files from grfhost's lang/<code>/", async () => {
		const Configs = await start('qps-ploc');
		expect(Configs.get('remoteClient')).toBe('https://grf.titanro.net/lang/qps-ploc/');
	});

	it('ignores a stored value that is not a language code', async () => {
		const Configs = await start('../x');
		expect(Configs.get('remoteClient')).toBe('https://grf.titanro.net/');
	});

	it('keeps the announced language and reloads into it when it differs', async () => {
		await start('en');
		window.dispatchEvent(new CustomEvent('titanro-language', { detail: 'en' }));
		expect(reload).not.toHaveBeenCalled();
		window.dispatchEvent(new CustomEvent('titanro-language', { detail: 'qps' }));
		expect(window.localStorage.getItem('titanro.language')).toBe('qps');
		expect(reload).toHaveBeenCalledTimes(1);
	});

	it('ignores an announcement that is not a language code', async () => {
		await start('en');
		window.dispatchEvent(new CustomEvent('titanro-language', { detail: 'x/../y' }));
		expect(window.localStorage.getItem('titanro.language')).toBe('en');
		expect(reload).not.toHaveBeenCalled();
	});
});
