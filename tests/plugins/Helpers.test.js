/**
 * The helpers' shared foundation in the web client: packet events, the zone signal, key bindings, the helper settings
 * client and asset swaps.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isTyping, matchesKey, parseKey } from 'Plugins/Helpers/Keys.js';
import { FIELD, PVP, WOE, ZoneSignal, zoneFromFlags } from 'Plugins/Helpers/Zone.js';
import { DEFAULT_SETTINGS, HelperSettingsClient, mergePatch } from 'Plugins/Helpers/HelperSettings.js';
import MapState from 'DB/Map/MapState.js';

const { MapFlag, MapProperty, MapType } = MapState;

describe('key bindings', () => {
	it('reads the settings format and matches by physical key', () => {
		expect(parseKey('Ctrl+Shift+H')).toEqual({ ctrl: true, alt: false, shift: true, code: 'KeyH' });
		expect(parseKey('Alt+7')).toEqual({ ctrl: false, alt: true, shift: false, code: 'Digit7' });
		expect(parseKey('F11')).toEqual({ ctrl: false, alt: false, shift: false, code: 'F11' });
		expect(parseKey('')).toBeNull();
		expect(parseKey('Shift+Ctrl+H')).toBeNull();
		const event = { code: 'KeyH', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false };
		expect(matchesKey(event, 'Ctrl+H')).toBe(true);
		expect(matchesKey(event, 'Ctrl+Shift+H')).toBe(false);
		expect(matchesKey({ ...event, shiftKey: true }, 'Ctrl+Shift+H')).toBe(true);
		expect(matchesKey(event, '')).toBe(false);
	});

	it('ignores keys typed in a text field, in a shadow root too', () => {
		const input = document.createElement('input');
		expect(isTyping({ composedPath: () => [input] })).toBe(true);
		expect(isTyping({ composedPath: () => [document.createElement('div')] })).toBe(false);
	});
});

describe('the zone signal', () => {
	it('is field unless the server labels the map PvP or WoE', () => {
		expect(zoneFromFlags(0)).toBe(FIELD);
		expect(zoneFromFlags(MapFlag.USECART)).toBe(FIELD);
		expect(zoneFromFlags(MapFlag.GVG | MapFlag.USECART)).toBe(FIELD); // a castle outside WoE
		expect(zoneFromFlags(MapFlag.PVP | MapFlag.COUNT_PK)).toBe(PVP);
		expect(zoneFromFlags(MapFlag.GVG | MapFlag.SIEGE | MapFlag.USE_SIMPLE_EFFECT)).toBe(WOE);
		expect(zoneFromFlags(MapFlag.GVG | MapFlag.SIEGE | MapFlag.BATTLEFIELD)).toBe(PVP);
	});

	it('resets on every map change and reports the entry once the properties arrive', () => {
		const zone = new ZoneSignal();
		zone.isTown = map => map === 'prontera';
		const seen = [];
		zone.onChange((state, entered) => seen.push([state.map, state.zone, entered, state.town]));

		zone.mapChanged('prt_fild08.gat');
		zone.mapFlags(MapFlag.PVP | MapFlag.USECART);
		zone.mapFlags(MapFlag.PVP | MapFlag.USECART); // nothing new
		zone.mapChanged('prontera.gat');
		zone.mapProperty(MapProperty.FREEPVPZONE); // a duel's, sent before the map's flags
		zone.mapFlags(MapFlag.USECART);

		expect(seen).toEqual([
			['prt_fild08', FIELD, false, false],
			['prt_fild08', PVP, true, false],
			['prontera', FIELD, false, true],
			['prontera', PVP, false, true],
			['prontera', FIELD, true, true]
		]);
	});

	it('uses the old map property without 0x99b, and the battleground map type', () => {
		const zone = new ZoneSignal();
		zone.currentMap = () => 'gef_fild13.gat';
		zone.mapChanged(null);
		zone.mapProperty(MapProperty.AGITZONE);
		expect(zone.state).toMatchObject({ map: 'gef_fild13', zone: WOE });
		zone.mapProperty(MapProperty.NOTHING);
		expect(zone.zone).toBe(FIELD);
		zone.mapType(MapType.BATTLEFIELD);
		expect(zone.state).toMatchObject({ zone: PVP, battleground: true });
	});
});

function memoryStorage() {
	const data = new Map();
	return {
		getItem: k => (data.has(k) ? data.get(k) : null),
		setItem: (k, v) => data.set(k, String(v)),
		removeItem: k => data.delete(k),
		data
	};
}

function response(status, body) {
	return { status, ok: status >= 200 && status < 300, json: async () => body };
}

describe('the helper settings client', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('merges patches as the service does', () => {
		expect(mergePatch({ a: { x: 1, y: 2 }, b: { z: 1 } }, { a: { x: null, w: 3 }, b: null })).toEqual({ a: { y: 2, w: 3 } });
	});

	it('reads the account settings with the helper token and saves changes as one patch', async () => {
		const server = { ...structuredClone(DEFAULT_SETTINGS), zonePanel: { enabled: true } };
		const fetch = vi.fn(async (url, init) => {
			expect(url).toBe('https://account.example/v1/helper-settings');
			expect(init.headers.authorization).toBe('Bearer th1.abc.def');
			if (init.method === 'GET') return response(200, { version: 1, revision: 4, settings: server, defaults: DEFAULT_SETTINGS });
			const body = JSON.parse(init.body);
			return response(200, { version: 1, revision: 5, settings: mergePatch(server, body.settings), defaults: DEFAULT_SETTINGS });
		});
		const settings = new HelperSettingsClient({ accountApi: 'https://account.example/', fetch, local: memoryStorage(), session: memoryStorage() });
		const changes = vi.fn();
		settings.onChange(changes);

		await settings.setToken('th1.abc.def');
		expect(settings.revision).toBe(4);
		expect(settings.get('zonePanel', 'enabled')).toBe(true);

		settings.set({ panels: { zone: { visible: true } } });
		settings.set({ panels: { zone: { x: 30, y: 40 } } });
		expect(settings.panel('zone')).toEqual({ visible: true, x: 30, y: 40 });
		expect(fetch).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1000);
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ settings: { panels: { zone: { visible: true, x: 30, y: 40 } } } });
		expect(fetch.mock.calls[1][1].method).toBe('PATCH');
		expect(settings.revision).toBe(5);

		settings.set({ zonePanel: { enabled: null } });
		expect(settings.get('zonePanel', 'enabled')).toBe(false); // the default
		await vi.advanceTimersByTimeAsync(1000);
		expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ settings: { zonePanel: { enabled: null } } });
		expect(changes).toHaveBeenCalled();
	});

	it('keeps a guest’s settings in this browser, and falls back to them when the token is refused', async () => {
		const local = memoryStorage();
		const settings = new HelperSettingsClient({ fetch: vi.fn(async () => response(401, {})), local, session: memoryStorage() });
		settings.set({ zonePanel: { enabled: true } });
		await vi.advanceTimersByTimeAsync(1000);
		expect(JSON.parse(local.data.get('titanro.helperSettings')).zonePanel.enabled).toBe(true);
		expect(new HelperSettingsClient({ local, session: memoryStorage() }).get('zonePanel', 'enabled')).toBe(true);

		vi.spyOn(console, 'warn').mockImplementation(() => {});
		await settings.setToken('th1.expired.token');
		expect(settings.signedIn).toBe(false);
		expect(settings.get('zonePanel', 'enabled')).toBe(true);
	});
});

describe('packet events', () => {
	let Network, PACKET;

	beforeEach(async () => {
		vi.resetModules();
		Network = (await import('Network/NetworkManager.js')).default;
		PACKET = (await import('Network/PacketStructure.js')).default;
	});

	it('reach every listener after the game’s handler, and a failing listener stops nothing', () => {
		let socket;
		Network.setSocketFactory(() => (socket = { connected: true, close: vi.fn(), send: vi.fn() }));
		Network.connect('map', 1, () => {});
		socket.onComplete(true);

		const order = [];
		Network.hookPacket(PACKET.ZC.MAPPROPERTY_R2, pkt => order.push(['game', pkt.flag]));
		const stop = Network.onPacket(PACKET.ZC.MAPPROPERTY_R2, pkt => order.push(['helper', pkt.flag]));
		vi.spyOn(console, 'error').mockImplementation(() => {});
		Network.onPacket(PACKET.ZC.MAPPROPERTY_R2, () => {
			throw new Error('broken helper');
		});
		Network.onAnyPacket((pkt, id) => order.push(['any', id]));

		// 0x99b <type>.W <flag>.L
		const bytes = new Uint8Array([0x9b, 0x09, 0x28, 0x00, 0x01, 0x02, 0x00, 0x00]);
		socket.onMessage(bytes);
		stop();
		socket.onMessage(bytes);

		expect(order).toEqual([
			['game', 0x201],
			['helper', 0x201],
			['any', 0x99b],
			['game', 0x201],
			['any', 0x99b]
		]);
		expect(() => Network.onPacket({ name: 'unregistered' }, () => {})).toThrow();
	});

	it('JSON messages beside the game data reach their listeners and never the packet stream', () => {
		let socket;
		Network.setSocketFactory(() => (socket = { connected: true, close: vi.fn(), send: vi.fn(), sendText: vi.fn(() => true) }));
		Network.connect('map', 1, () => {}, true);
		socket.onComplete(true);
		const got = [];
		Network.onJson('mvps', message => got.push(message.mvps.length));
		Network.onAnyPacket((pkt, id) => got.push(id));
		socket.onMessage('{"type":"mvps","now":1,"mvps":[{"id":1039}]}');
		socket.onMessage('{"type":"other"}');
		socket.onMessage('not json');
		socket.onMessage(new Uint8Array([0x9b, 0x09, 0x28, 0x00, 0x01, 0x02, 0x00, 0x00]));
		expect(got).toEqual([1, 0x99b]);
		expect(Network.sendJson({ type: 'mvps' })).toBe(true);
		expect(socket.sendText).toHaveBeenCalledWith('{"type":"mvps"}');
	});
});

describe('asset swaps', () => {
	it('load the swapped file in place of the game file, until removed', async () => {
		vi.resetModules();
		const sent = [];
		vi.doMock('Core/Thread.js', () => ({ default: { send: (cmd, input) => sent.push(input.filename) } }));
		vi.doMock('Core/MemoryManager.js', () => ({ default: { exist: () => false, get: name => name } }));
		const Client = (await import('Core/Client.js')).default;

		const remove = Client.addFileSwap(name => (name.endsWith('.gnd') ? name.replace('.gnd', '_flat.gnd') : null));
		Client.addFileSwap(() => {
			throw new Error('broken swap');
		});
		vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(Client.loadFile('data/prontera.gnd')).toBe('data/prontera_flat.gnd');
		expect(Client.getFile('data/sprite/a.spr')).toBe('data/sprite/a.spr');
		remove();
		expect(Client.loadFile('data/prontera.gnd')).toBe('data/prontera.gnd');
		expect(sent).toEqual(['data/prontera_flat.gnd', 'data/sprite/a.spr', 'data/prontera.gnd']);
		vi.doUnmock('Core/Thread.js');
		vi.doUnmock('Core/MemoryManager.js');
	});
});
