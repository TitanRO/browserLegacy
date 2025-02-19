/**
 * ServiceWorkerSocket.js
 *
 * Websocket Proxy via Service Worker
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Trojal
 */

define(function()
{
	'use strict';

	/**
	 * ServiceWorker Socket
	 */
	function Socket(host, port, proxy) {
		var self = this;
		this.connected = false;
		this.clientId = null;
        this.isZone = false;
		
		// Store connection parameters
		this.host = host;
		this.port = port;
		this.proxy = proxy;
		
		// Create message channel for this socket instance
		this.channel = new BroadcastChannel('sw_socket_' + Date.now());
		
		this.channel.onmessage = function(event) {
			switch(event.data.type) {
				case 'connected':
					self.clientId = event.data.clientId;
					self.connected = true;
					self.onComplete(true);
					break;

				case 'connection_error':
					self.connected = false;
					self.onComplete(false);
					break;

				case 'message':
					self.onMessage(event.data.data);
					break;

				case 'close':
					self.connected = false;
					if (self.onClose) {
						self.onClose();
					}
					break;
			}
		};
	}

	/**
	 * Initiate the connection
	 */
	Socket.prototype.connect = function Connect() {
		// Initialize connection through service worker
		if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
			navigator.serviceWorker.controller.postMessage({
				type: 'connect',
				channelName: this.channel.name,
				config: {
					host: this.host,
					port: this.port,
					proxy: this.proxy,
					isZone: this.isZone,
					encryptionKeys: this.encryptionKeys
				}
			});
		} else {
			console.error('[ServiceWorkerSocket] Service worker not available');
			this.onComplete(false);
		}
	};

	/**
	 * Send data through the socket
	 */
	Socket.prototype.send = function Send(buffer) {
		if (this.connected) {
			navigator.serviceWorker.controller.postMessage({
				type: 'send',
				clientId: this.clientId,
				data: buffer
			});
		} else {
            console.error('[ServiceWorkerSocket] Unable to send data, socket is not connected');
        }
	};

	/**
	 * Close the socket connection
	 */
	Socket.prototype.close = function Close() {
		if (this.connected) {
			navigator.serviceWorker.controller.postMessage({
				type: 'close',
				clientId: this.clientId
			});
			this.channel.close();
			this.connected = false;
		}
        if (this.ping) {
            clearInterval(this.ping);
        }
	};

	/**
	 * Start ping interval
	 */
	Socket.prototype.startPing = function startPing(packetType, packetHeader) {
        if (this.connected) {
            navigator.serviceWorker.controller.postMessage({
                type: 'ping',
                clientId: this.clientId,
                packetType: packetType,
                packetHeader: packetHeader
            });
		}
	};

	/**
	 * Export
	 */
	return Socket;
});
