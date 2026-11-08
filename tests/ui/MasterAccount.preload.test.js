/**
 * tests/ui/MasterAccount.preload.test.js
 *
 * Once the TitanRO shell announces a signed-in master account's language, the MasterAccount plugin loads the game's
 * databases in the browser's idle time (they'd otherwise load only after a character is picked), once, and not when
 * the announcement reloads the page into another language.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	db: { isLoaded: false, startedLazyInit: false, lazyInit: vi.fn() },
	winLogin: { __active: false, onConnectionRequest: () => {} }
}));
vi.mock('Engine/SessionStorage.js', () => ({ default: {} }));
vi.mock('DB/DBManager.js', () => ({ default: mocks.db }));
vi.mock('UI/Components/WinLogin/WinLogin.js', () => ({ default: mocks.winLogin }));

const reload = vi.fn();
let listeners = [];

async function start(stored) {
	vi.resetModules();
	window.localStorage.clear();
	window.localStorage.setItem('titanro.language', stored);
	const Init = (await import('Plugins/MasterAccount/MasterAccount.js')).default;
	const add = window.addEventListener;
	vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
		listeners.push([type, listener]);
		add.call(window, type, listener, options);
	});
	Init({ shell: 'data:text/javascript,export function mount(){return {unmount(){}}}' });
}

const announce = code => window.dispatchEvent(new CustomEvent('titanro-language', { detail: code }));

describe('MasterAccount database preload', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		reload.mockClear();
		mocks.db.lazyInit.mockClear();
		mocks.db.isLoaded = false;
		mocks.db.startedLazyInit = false;
		mocks.winLogin.__active = false;
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

	it('does not load them before sign-in', async () => {
		await start('en');
		mocks.winLogin.__active = true;
		await vi.advanceTimersByTimeAsync(10000);
		expect(mocks.db.lazyInit).not.toHaveBeenCalled();
	});

	it('loads them once after sign-in, when the login window is up', async () => {
		await start('en');
		announce('en');
		await vi.advanceTimersByTimeAsync(3000);
		expect(mocks.db.lazyInit).not.toHaveBeenCalled();
		mocks.winLogin.__active = true;
		await vi.advanceTimersByTimeAsync(7000);
		expect(mocks.db.lazyInit).toHaveBeenCalledOnce();
		expect(mocks.db.startedLazyInit).toBe(true);
		announce('en');
		await vi.advanceTimersByTimeAsync(7000);
		expect(mocks.db.lazyInit).toHaveBeenCalledOnce();
	});

	it('leaves them to the reload when the language differs', async () => {
		await start('en');
		mocks.winLogin.__active = true;
		announce('qps');
		await vi.advanceTimersByTimeAsync(10000);
		expect(reload).toHaveBeenCalledOnce();
		expect(mocks.db.lazyInit).not.toHaveBeenCalled();
	});
});
