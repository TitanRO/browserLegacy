/**
 * ServiceWorker Plugin
 *
 * Framework for adding a service worker as a proxy for the websocket.
 *
 * This file is a plugin for ROBrowser, (http://www.robrowser.com/).
 *
 * @author Trojal
 */
define(function( require )
{
    // Load dependencies
    var Network = require('Network/NetworkManager');
    var MapEngine = require('Engine/MapEngine');
    var Configs = require('Core/Configs');
    var ServiceWorkerSocket = require('./ServiceWorkerSocket');
    var PacketCrypt    = require('Network/PacketCrypt');
    var BinaryReader = require('Utils/BinaryReader');

    return function Init() {
        // Already loaded.
        if (MapEngine.ServiceWorkerEnabled) {
            return true;
        }

        // Register service worker (for first load)
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('service-worker.js')
            .then(function(registration) {

                // Force update check
                registration.update();

                // If there's a waiting worker, activate it immediately
                if (registration.waiting) {
                    registration.waiting.postMessage({type: 'SKIP_WAITING'});
                }
            })
            .catch(function(error) {
                // Registration failed, but this is not a critical error
            });
        }

        const defaultConnect = Network.connect;
        const customConnect = function connect(host, port, callback, isZone)
        {
            var socket, Socket;
            var proxy = Configs.get('socketProxy', null);

            // NOTE: This is a custom socket implementation that is used to
            // connect to the service worker, which provides a websocket
            // connection.
            Socket = ServiceWorkerSocket;
            socket = new Socket(host, port, proxy);

            // Set up callbacks before connection
            socket.isZone = !!isZone;
            if (isZone) {
                // Initialize PacketCrypt and get keys before connecting
                PacketCrypt.init();
                socket.encryptionKeys = PacketCrypt.getKeys();
            }
            socket.onClose = function() {
                if (socket.ping) {
                    clearInterval(socket.ping);
                }
                Network.onClose.call(socket);
            };

            socket.onComplete = function onComplete(success)
            {
                var msg   = 'Fail';
                var color = 'red';

                if (success) {
                    msg   = 'Success';
                    color = 'green';

                    socket.onMessage = Network.receive;
                    Network.addSocket(socket);
                }

                console.log( '%c[Network] ' + msg + ' to connect to ' + host + ':' + port, 'font-weight:bold;color:' + color);
                callback.call(this, success);
            };

            socket.connect();

            window.addEventListener('beforeunload', () => {
                if (socket.connected) {
                    socket.close();
                }
            });
        }
        Network.connect = customConnect;

        const defaultSetPing = Network.setPing;
        const customSetPing = function setPing(callback) {
            const socket = Network.getSocket();
            if (socket) {
                if (socket.ping) {
                    clearInterval(socket.ping);
                }

                const sockets = Network.getSockets();
                while (sockets.length > 1) {
                    if (socket !== sockets[0]) {
                        sockets[0].close();
                        sockets.splice(0, 1);
                    }
                }

                // Instead of setting the ping interval, we'll just call the callback
                // directly, then set the ping interval in the service worker by
                // capturing it in customSendPacket.
                callback();
            }
        }
        Network.setPing = customSetPing;

        const defaultSendPacket = Network.sendPacket;
        const customSendPacket = function sendPacket(packet) {
            const socket = Network.getSocket();
            if (!socket) {
                return;
            }

            if (packet.constructor.name === 'PACKET_CA_CONNECT_INFO_CHANGED' ||
                packet.constructor.name === 'PACKET_CZ_PING' ||
                packet.constructor.name === 'PACKET_CZ_HBT' ||
                packet.constructor.name === 'PACKET_CZ_REQUEST_TIME' ||
                packet.constructor.name === 'PACKET_CZ_REQUEST_TIME2') {
                // For ping packets, tell service worker to start ping interval
                let pkt = packet.build();
                let reader = new BinaryReader(pkt.buffer);
                let header = reader.readUShort();
                socket.startPing(packet.constructor.name, header);
            } else {
                // Call the default sendPacket function, but note that
                // PacketCrypt.process is disabled here, and this is primarily
                // used to dump the packet data.
                defaultSendPacket.call(this, packet);
            }
        }
        Network.sendPacket = customSendPacket;

        defaultProcess = PacketCrypt.process;
        const customProcess = function process(packet) {
            return packet;
        }
        PacketCrypt.process = customProcess;

        // Record plugin as enabled
        MapEngine.ServiceWorkerEnabled = true;

        return true;
    }
});

