// Set up ping interval in service worker
const PING_INTERVAL = 10000; // 10 seconds

class ServiceWorkerManager {
    constructor() {
        this.connections = new Map();
        this.connectionCounter = 0;

        self.addEventListener('install', this.handleInstall.bind(this));
        self.addEventListener('activate', this.handleActivate.bind(this));
        self.addEventListener('message', this.handleMessage.bind(this));
    }

    handleInstall(event) {
        self.skipWaiting();
    }

    handleActivate(event) {
        event.waitUntil(clients.claim());
    }

    handleMessage(event) {
        const data = event.data;

        switch (data.type) {
            case 'connect':
                const connection = new Connection(this, data.channelName, data.config);
                // Initialize encryption if this is a zone server connection
                if (data.config.isZone) {
                    connection.isZone = true;
                    connection.keys = new Uint32Array(data.config.encryptionKeys) 
                }
                this.connections.set(connection.id, connection);
                break;

            case 'send':
                const conn = this.connections.get(data.clientId);
                if (conn) {
                    conn.send(conn.maybeEncryptPacket(data.data));
                }
                break;

            case 'close':
                const connToClose = this.connections.get(data.clientId);
                if (connToClose) {
                    connToClose.cleanup();
                }
                break;

            case 'ping':
                const connToPing = this.connections.get(data.clientId);
                if (connToPing) {
                    connToPing.pingPacketType = data.packetType;
                    connToPing.packetHeader = data.packetHeader;
                    connToPing.startPingInterval();
                }
                break;
            case 'skipWaiting':
                self.skipWaiting();
                break;
        }
    }

    getNextConnectionId() {
        return ++this.connectionCounter;
    }

    removeConnection(id) {
        this.connections.delete(id);
    }
}

class Connection {
    constructor(manager, channelName, config) {
        this.manager = manager;
        this.id = manager.getNextConnectionId();
        this.channel = new BroadcastChannel(channelName);
        this.socket = null;
        this.pingInterval = null;
        this.startTick = null;
        this.pingState = {
            returned: true,
            pingTime: 0
        };
        this.isZone = false;
        this.keys = null;
        
        this.init(config);
        
        // Add listener for when channel is closed/disconnected
        this.channel.onmessageerror = () => {
            this.cleanup();
        };
    }

    init(config) {
        const url = this.buildUrl(config.host, config.port, config.proxy);
        
        this.socket = new WebSocket(url);
        this.socket.binaryType = 'arraybuffer';

        this.socket.onopen = () => {
            this.channel.postMessage({
                type: 'connected',
                clientId: this.id
            });
        };

        this.socket.onerror = (error) => {
            this.channel.postMessage({
                type: 'connection_error'
            });
        };

        this.socket.onmessage = (event) => {
            try {
                this.channel.postMessage({
                    type: 'message',
                    data: event.data
                });
            } catch (e) {
                if (e instanceof InvalidStateError) {
                    try {
                        this.channel.close();
                    } catch (e) {
                        // May be already closed
                    }
                } else {
                    throw e;
                }
            }
        };

        this.socket.onclose = () => {
            this.cleanup();
        };
    }

    buildUrl(host, port, proxy) {
        let url = 'ws://' + host + ':' + port + '/';
        if (proxy) {
            url = proxy;
            if (!url.match(/\/$/)) {
                url += '/';
            }
            url += host + ':' + port;
        }
        return url;
    }

    send(data) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(data);
        }
    }

    startPingInterval() {
        // Clear any existing ping interval first
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        this.startTick = Date.now();
        
        // Send initial ping immediately
        this.sendPing();
        
        this.pingInterval = setInterval(() => {
            this.sendPing();
        }, PING_INTERVAL);
    }

    sendPing() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.cleanup();
            return;
        }

        const clientTime = Date.now() - this.startTick;

        if (!this.pingState.returned && this.pingState.pingTime) {
            // TODO: Handle as in MapEngine.js
            //console.warn('[SendPing] Server did not answer previous ping');
        }

        this.pingState.pingTime = clientTime;
        this.pingState.returned = false;

        let buffer;

        switch (this.pingPacketType) {
            case 'PACKET_CA_CONNECT_INFO_CHANGED':
                buffer = this.buildConnectInfoChangedPacket();
                break;
            case 'PACKET_CZ_HBT':
                buffer = this.buildHBTPacket();
                break;
            case 'PACKET_CZ_REQUEST_TIME':
                buffer = this.buildRequestTimePacket(clientTime);
                break;
            case 'PACKET_CZ_REQUEST_TIME2':
                buffer = this.buildRequestTime2Packet(clientTime);
                break;
            case 'PACKET_CZ_PING':
                buffer = this.buildPingPacket(clientTime);
                break;
            default:
                return;
        }

        try {
            // Health check to ensure channel is still open (page refreshed, etc)
            this.channel.postMessage({ type: 'health_check' });

            const encryptedPacket = this.maybeEncryptPacket(buffer);
            this.socket.send(encryptedPacket);
        } catch (error) {
            this.cleanup();
        }
    }

    buildConnectInfoChangedPacket() {
        const pkt = new DataView(new ArrayBuffer(24));
        pkt.setInt16(0, this.packetHeader, true); // PACKET.CA.CONNECT_INFO_CHANGED
        pkt.setInt32(2, Date.now(), true); // TODO: Get login ID
        return pkt.buffer;
    }

    buildHBTPacket() {
        const pkt = new DataView(new ArrayBuffer(2));
        pkt.setInt16(0, this.packetHeader, true); // PACKET.CZ.HBT
        return pkt.buffer;
    }

    buildRequestTimePacket(clientTime) {
        const pkt = new DataView(new ArrayBuffer(6));
        pkt.setInt16(0, this.packetHeader, true); // PACKET.CZ.REQUEST_TIME
        pkt.setInt32(2, clientTime, true);
        return pkt.buffer;
    }

    buildRequestTime2Packet(clientTime) {
        const pkt = new DataView(new ArrayBuffer(6));
        pkt.setInt16(0, this.packetHeader, true); // PACKET.CZ.REQUEST_TIME2
        pkt.setInt32(2, clientTime, true);
        return pkt.buffer;
    }

    buildPingPacket(clientTime) {
        const pkt = new DataView(new ArrayBuffer(6));
        pkt.setInt16(0, this.packetHeader, true); // PACKET.CZ.PING
        pkt.setInt32(2, clientTime, true); // TODO: Get AID
        return pkt.buffer;
    }

    maybeEncryptPacket(buffer) {
        if (!this.isZone) return buffer;
        
        const view = new DataView(buffer);
        const cmd = view.getInt16(0, true);
        
        // console.log('[ServiceWorker] Encrypting packet for connection', this.id, {
        //     originalCmd: '0x' + cmd.toString(16),
        //     beforeKeys: {
        //         key0: '0x' + (this.keys[0] >>> 0).toString(16),
        //         key1: '0x' + (this.keys[1] >>> 0).toString(16),
        //         key2: '0x' + (this.keys[2] >>> 0).toString(16)
        //     }
        // });

        // Update encryption key using same algorithm as PacketCrypt
        this.keys[0] = (Math.imul(this.keys[0], this.keys[1]) + this.keys[2]) >>> 0;

        const encryptedCmd = cmd ^ ((this.keys[0] >>> 16) & 0x7FFF);
        view.setInt16(0, encryptedCmd, true);

        // console.log('[ServiceWorker] Packet encrypted for connection', this.id, {
        //     afterKeys: {
        //         key0: '0x' + (this.keys[0] >>> 0).toString(16),
        //         key1: '0x' + (this.keys[1] >>> 0).toString(16),
        //         key2: '0x' + (this.keys[2] >>> 0).toString(16)
        //     },
        //     encryptedCmd: '0x' + encryptedCmd.toString(16)
        // });
        
        return buffer;
    }

    cleanup() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        try {
            this.channel.postMessage({
                type: 'close'
            });
        } catch (e) {
            // Channel might already be closed
        }
        try {
            this.channel.close();
        } catch (e) {
            // Channel might already be closed
        }
        
        // Close the WebSocket if it's still open
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.close();
        }
        
        this.manager.removeConnection(this.id);
    }
}

const manager = new ServiceWorkerManager();
