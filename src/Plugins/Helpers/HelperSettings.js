/**
 * Plugins/Helpers/HelperSettings.js
 *
 * The player's helper settings (TitanRO/account-service /v1/helper-settings): one document per master account, shared
 * with the launcher and the Windows client, so they follow the player between clients. The service validates every
 * change and fills in the defaults; this keeps the last copy it answered, applies changes at once, and sends them as
 * merge patches (`null` resets to the default), a second after the last change so a dragged panel is one request.
 *
 * It signs in with the helper token that comes with the launch token (MasterAccount passes it on in a
 * `titanro-helper-token` event). Without one (a Quick Invite guest, or the account service unreachable) the settings
 * are the defaults plus this browser's own changes, kept in localStorage.
 *
 * @author Trojal
 */

export const TOKEN_EVENT = 'titanro-helper-token';
const TOKEN_KEY = 'titanro.helperToken';
const LOCAL_KEY = 'titanro.helperSettings';
const SAVE_DELAY_MS = 1000;

/** account-service src/helperSettings.ts, version 1: what applies before the service answers, or without it. */
export const DEFAULT_SETTINGS = {
	keys: { helperWindow: 'Ctrl+H', panels: 'Ctrl+Shift+H' },
	targetPanel: { enabled: true },
	expTracker: { enabled: true },
	lootAlerts: { enabled: true, sound: true, cards: true, maxRatePercent: 0.1, watchList: [] },
	dropSprites: { enabled: true },
	mvpTimers: { panel: false },
	vendingSearch: { enabled: true },
	lowEffects: { level: 0 },
	castCircles: { enabled: true },
	trapMarkers: { enabled: true },
	chatScope: { enabled: false },
	castRange: { enabled: false },
	flatMap: { enabled: false, hideProps: false },
	transparentProps: { enabled: false },
	noAdelay: { enabled: false },
	bigStatusIcons: { enabled: false },
	smallWoeObjects: { enabled: false },
	instantVanish: { enabled: false },
	bigMvps: { enabled: false },
	smallEmperium: { enabled: false },
	damageLog: { enabled: false },
	autopot: { panel: false },
	woeTracker: { panel: false },
	zonePanel: { enabled: false },
	performance: { enabled: false },
	// the chat window's tabs (Plugins/Helpers/ChatSync.js); no tabs = never saved
	chat: { tabs: [], active: 0, window: null },
	panels: {}
};

const isObject = v => typeof v === 'object' && v !== null && !Array.isArray(v);

/** JSON merge patch (RFC 7396): what the patch names is set, null removes it. */
export function mergePatch(target, patch) {
	if (!isObject(patch)) return patch;
	const out = isObject(target) ? { ...target } : {};
	for (const [key, value] of Object.entries(patch)) {
		if (value === null) delete out[key];
		else out[key] = mergePatch(out[key], value);
	}
	return out;
}

/**
 * The document with the defaults under it (a reset setting falls back to its default). The cell grid used to be its
 * own setting (cellGrid.enabled); it is part of Grayworld (flatMap.enabled) now, so a grid that was on turns Grayworld on.
 */
function withDefaults(defaults, settings) {
	if (settings?.cellGrid?.enabled === true && settings?.flatMap?.enabled !== true) {
		settings = { ...settings, flatMap: { ...(settings.flatMap || {}), enabled: true } };
	}
	const out = {};
	for (const [section, values] of Object.entries(defaults)) {
		out[section] =
			section === 'panels' ? { ...(settings?.panels || {}) } : { ...values, ...(settings?.[section] || {}) };
	}
	return out;
}

function readStorage(storage, key) {
	try {
		return storage.getItem(key);
	} catch {
		return null;
	}
}

function writeStorage(storage, key, value) {
	try {
		if (value === null) storage.removeItem(key);
		else storage.setItem(key, value);
	} catch {
		// private mode or blocked storage: the settings still apply for this page
	}
}

export class HelperSettingsClient {
	/**
	 * @param {object} options
	 * @param {string} options.accountApi - the account service's base URL
	 * @param {function} [options.fetch]
	 * @param {Storage} [options.local] - localStorage (the guest's own settings)
	 * @param {Storage} [options.session] - sessionStorage (the helper token, for a reload of the page)
	 */
	constructor({ accountApi, fetch, local, session } = {}) {
		this.accountApi = (accountApi || 'https://account-api.titanro.net').replace(/\/+$/, '');
		this._fetch = fetch || ((...args) => globalThis.fetch(...args));
		this._local = local || globalThis.localStorage;
		this._session = session || globalThis.sessionStorage;
		this.defaults = DEFAULT_SETTINGS;
		this.revision = 0;
		this.token = null;
		this._pending = null;
		this._timer = null;
		this._listeners = new Set();

		let saved = null;
		try {
			saved = JSON.parse(readStorage(this._local, LOCAL_KEY) || 'null');
		} catch {
			saved = null;
		}
		this.settings = withDefaults(this.defaults, saved);
	}

	/** The account's settings are used from now on (the token from the launch). */
	async setToken(token) {
		this.token = typeof token === 'string' && token.startsWith('th1.') ? token : null;
		writeStorage(this._session, TOKEN_KEY, this.token);
		if (this.token) await this.load();
	}

	/** A token kept by this tab (a reload of the page while in the game). */
	restoreToken() {
		const token = readStorage(this._session, TOKEN_KEY);
		return token ? this.setToken(token) : Promise.resolve();
	}

	get signedIn() {
		return !!this.token;
	}

	/** Reads the settings from the service (signed in) and tells the listeners. */
	async load() {
		if (!this.token) return;
		try {
			const response = await this._request('GET');
			if (response) this._accept(response);
		} catch (error) {
			console.warn('[Helpers] could not read the helper settings', error);
		}
	}

	/** One setting, e.g. get('zonePanel', 'enabled'). */
	get(section, key) {
		const values = this.settings[section];
		return values ? values[key] : undefined;
	}

	/** A panel's window: {visible, x, y}, with the defaults. */
	panel(id) {
		return { visible: false, x: 100, y: 100, ...(this.settings.panels[id] || {}) };
	}

	/**
	 * Changes settings: a partial document, e.g. {zonePanel: {enabled: true}} or {panels: {zone: {x: 10, y: 20}}};
	 * null resets to the default. Applies at once; saved a second after the last change.
	 */
	set(change) {
		this.settings = withDefaults(this.defaults, mergePatch(this.settings, change));
		this._pending = mergePatch(this._pending || {}, change);
		// a null has to reach the service, which mergePatch dropped from _pending
		for (const [section, values] of Object.entries(change)) {
			if (values === null) this._pending[section] = null;
			else if (isObject(values)) {
				for (const [key, value] of Object.entries(values)) {
					if (value === null) this._pending[section] = { ...(this._pending[section] || {}), [key]: null };
				}
			}
		}
		this._notify();
		clearTimeout(this._timer);
		this._timer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
	}

	/** Sends the changes not saved yet (also on leaving the page). */
	async flush() {
		clearTimeout(this._timer);
		this._timer = null;
		const change = this._pending;
		this._pending = null;
		if (!change) return;
		if (!this.token) {
			const { panels, ...rest } = this.settings;
			writeStorage(this._local, LOCAL_KEY, JSON.stringify({ ...rest, panels }));
			return;
		}
		try {
			const response = await this._request('PATCH', { settings: change });
			if (response) this._accept(response, this._pending);
		} catch (error) {
			console.warn('[Helpers] could not save the helper settings', error);
		}
	}

	/** listener(settings) after every change, here or from the service. Returns a function to stop. */
	onChange(listener) {
		this._listeners.add(listener);
		return () => this._listeners.delete(listener);
	}

	async _request(method, body) {
		const response = await this._fetch(`${this.accountApi}/v1/helper-settings`, {
			method,
			headers: {
				authorization: `Bearer ${this.token}`,
				...(body ? { 'content-type': 'application/json' } : {})
			},
			...(body ? { body: JSON.stringify(body) } : {})
		});
		if (response.status === 401) {
			// the token expired (a week) or the service's secret changed: this browser's settings until the next launch
			console.warn('[Helpers] the helper token was refused');
			this.token = null;
			writeStorage(this._session, TOKEN_KEY, null);
			return null;
		}
		const json = await response.json();
		if (!response.ok) {
			console.warn('[Helpers] helper settings:', json && json.error);
			return null;
		}
		return json;
	}

	/** The service's answer, with any change made since it was sent still over it. */
	_accept(response, unsaved) {
		/** The service has answered this session: the account's settings are known. */
		this.answered = true;
		this.revision = response.revision;
		if (response.defaults) this.defaults = response.defaults;
		this.settings = withDefaults(
			this.defaults,
			unsaved ? mergePatch(response.settings, unsaved) : response.settings
		);
		this._notify();
	}

	_notify() {
		for (const listener of this._listeners) {
			try {
				listener(this.settings);
			} catch (error) {
				console.error('[Helpers] settings listener failed', error);
			}
		}
	}
}
