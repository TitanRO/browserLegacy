/**
 * Network/SocketHelpers/WebSocket.js
 *
 * HTML5 WebSocket if the server support the protocole
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

/**
 * HTML5 WebSocket System
 *
 * @param {string} host
 * @param {number} port
 * @param {?string} proxy - wsProxy URL (server option `socketProxy`)
 * @param {?string} urlTemplate - direct WebSocket URL with {host}/{port} (server option `socketUrl`)
 */
function Socket(host, port, proxy, urlTemplate) {
	const url = buildUrl(host, port, proxy, urlTemplate);
	const self = this;
	this.connected = false;

	// Open Websocket
	this.ws = new WebSocket(url);
	this.ws.binaryType = 'arraybuffer';

	this.ws.onopen = function OnOpen() {
		self.connected = true;
		self.onComplete(true);
	};

	this.ws.onerror = function OnError() {
		if (!self.connected) {
			self.onComplete(false);
		}
	};

	this.ws.onmessage = function OnMessage(event) {
		self.onMessage(event.data);
	};

	this.ws.onclose = function OnClose() {
		self.connected = false;
		this.close();

		if (self.onClose) {
			self.onClose();
		}
	};
}

/**
 * Sending packet to applet
 *
 * @param {ArrayBuffer} buffer
 */
Socket.prototype.send = function Send(buffer) {
	if (this.connected) {
		this.ws.send(buffer);
	}
};

/**
 * Closing connection to server
 */
Socket.prototype.close = function Close() {
	if (this.connected) {
		this.ws.close();
		this.connected = false;
	}
};

/**
 * WebSocket URL for a game server at host:port.
 *
 * - urlTemplate (server option `socketUrl`): the game servers accept WebSocket clients themselves; `{host}` and
 *   `{port}` are replaced, e.g. 'wss://ws.example.com/{port}' when an HTTPS edge routes each path to a server.
 * - proxy (server option `socketProxy`): a wsProxy; the target goes in the path, e.g. 'wss://proxy/host:port'.
 * - neither: the server itself, ws://host:port/.
 *
 * @param {string} host
 * @param {number} port
 * @param {?string} proxy
 * @param {?string} urlTemplate
 * @return {string}
 */
export function buildUrl(host, port, proxy, urlTemplate) {
	if (urlTemplate) {
		return urlTemplate.replace(/\{host\}/g, host).replace(/\{port\}/g, String(port));
	}
	if (proxy) {
		return proxy + (proxy.match(/\/$/) ? '' : '/') + host + ':' + port;
	}
	return 'ws://' + host + ':' + port + '/';
}

/**
 * Export
 */
export default Socket;
