import { describe, it, expect } from 'vitest';
import { buildUrl } from '../../src/Network/SocketHelpers/WebSocket.js';

describe('WebSocket buildUrl', () => {
	it('fills {role} in a socketUrl template', () => {
		expect(buildUrl('play.example.net', 6901, null, 'wss://ws.example.net/{role}', 'login')).toBe('wss://ws.example.net/login');
		expect(buildUrl('play.example.net', 5122, null, 'wss://ws.example.net/{role}/{port}', 'map')).toBe(
			'wss://ws.example.net/map/5122'
		);
	});

	it('fills {host} and {port} in a socketUrl template', () => {
		expect(buildUrl('play.example.net', 6122, null, 'wss://ws.example.net/{port}')).toBe('wss://ws.example.net/6122');
		expect(buildUrl('play.example.net', 6122, null, 'wss://ws.example.net/{host}/{port}')).toBe(
			'wss://ws.example.net/play.example.net/6122'
		);
	});

	it('prefers socketUrl over socketProxy', () => {
		expect(buildUrl('play.example.net', 5122, 'wss://proxy.example.net/', 'wss://ws.example.net/{port}')).toBe(
			'wss://ws.example.net/5122'
		);
	});

	it('appends host:port to a socketProxy, adding the slash if missing', () => {
		expect(buildUrl('play.example.net', 6901, 'wss://proxy.example.net/', null)).toBe(
			'wss://proxy.example.net/play.example.net:6901'
		);
		expect(buildUrl('play.example.net', 6901, 'wss://proxy.example.net', null)).toBe(
			'wss://proxy.example.net/play.example.net:6901'
		);
	});

	it('connects to the server itself without either', () => {
		expect(buildUrl('127.0.0.1', 6900, null, null)).toBe('ws://127.0.0.1:6900/');
	});
});
