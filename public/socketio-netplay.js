/**
 * SocketIONetplay - Socket.IO based co-op synchronization
 * Provides reliable real-time sync with automatic reconnection and fallback support
 */
export class SocketIONetplay {
    constructor() {
        this.socket = null;
        this.roomId = null;
        this.playerName = null;
        this.handlers = {};
        this.isConnected = false;
        this.connectTimeout = 10000; // 10 second timeout
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    on(type, handler) {
        this.handlers[type] = handler;
    }

    emit(type, payload = {}) {
        if (!this.socket || !this.socket.connected) {
            console.warn(`[SocketIONetplay] Cannot emit ${type}: socket not connected`);
            return;
        }
        this.socket.emit(type, payload);
    }

    async connect({ roomId, playerName, shipType }) {
        return new Promise((resolve, reject) => {
            this.roomId = roomId;
            this.playerName = playerName;
            this.shipType = shipType || 'default';

            console.log(`[SocketIONetplay] Connecting to room ${roomId} as ${playerName}...`);

            // Check if socket.io library is loaded
            if (typeof io === 'undefined') {
                reject(new Error('Socket.IO library not loaded. Please include socket.io-client in your HTML.'));
                return;
            }

            // Initialize Socket.IO connection
            this.socket = io({
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: this.maxReconnectAttempts,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: this.connectTimeout
            });

            // Set up connection timeout
            const timeoutId = setTimeout(() => {
                console.error('[SocketIONetplay] Connection timeout');
                if (this.socket) {
                    this.socket.disconnect();
                }
                reject(new Error('Connection timeout - server may be offline'));
            }, this.connectTimeout);

            // Connection established
            this.socket.on('connect', () => {
                console.log('[SocketIONetplay] Socket.IO connected, joining room...');
                this.socket.emit('join_room', { 
                    roomId: this.roomId, 
                    playerName: this.playerName, 
                    shipType: this.shipType 
                });
            });

            // Successfully joined room
            this.socket.on('joined_room', (data) => {
                clearTimeout(timeoutId);
                console.log('[SocketIONetplay] Successfully joined room:', data);
                this.isConnected = true;
                this.reconnectAttempts = 0;
                
                // Start heartbeat
                this._startHeartbeat();
                
                // Trigger handler
                const handler = this.handlers['joined_room'];
                if (handler) {
                    handler(data);
                }
                
                resolve(data);
            });

            // Peer joined
            this.socket.on('peer_joined', (data) => {
                console.log('[SocketIONetplay] Peer joined:', data);
                const handler = this.handlers['peer_joined'];
                if (handler) {
                    handler(data);
                }
            });

            // Peer state update
            this.socket.on('peer_state', (data) => {
                const handler = this.handlers['peer_state'];
                if (handler) {
                    handler(data);
                }
            });

            // Peer input update
            this.socket.on('peer_input', (data) => {
                const handler = this.handlers['peer_input'];
                if (handler) {
                    handler(data);
                }
            });

            // Force game over
            this.socket.on('force_game_over', (data) => {
                console.log('[SocketIONetplay] Force game over:', data);
                const handler = this.handlers['force_game_over'];
                if (handler) {
                    handler(data);
                }
            });

            // Room closed
            this.socket.on('room_closed', (data) => {
                console.log('[SocketIONetplay] Room closed:', data);
                this.isConnected = false;
                const handler = this.handlers['room_closed'];
                if (handler) {
                    handler(data);
                }
            });

            // Error handling
            this.socket.on('error', (error) => {
                clearTimeout(timeoutId);
                console.error('[SocketIONetplay] Server error:', error);
                reject(new Error(error.error || 'Network error'));
            });

            // Connection error
            this.socket.on('connect_error', (error) => {
                console.error('[SocketIONetplay] Connection error:', error.message);
                this.reconnectAttempts++;
                
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    clearTimeout(timeoutId);
                    reject(new Error('Failed to connect after multiple attempts'));
                }
            });

            // Disconnection
            this.socket.on('disconnect', (reason) => {
                console.log('[SocketIONetplay] Disconnected:', reason);
                this.isConnected = false;
                this._stopHeartbeat();
                
                const handler = this.handlers['closed'];
                if (handler) {
                    handler({ type: 'closed', reason });
                }

                // If server initiated disconnect, don't try to reconnect
                if (reason === 'io server disconnect') {
                    this.socket.connect();
                }
            });

            // Reconnection attempt
            this.socket.on('reconnect_attempt', (attemptNumber) => {
                console.log(`[SocketIONetplay] Reconnect attempt ${attemptNumber}/${this.maxReconnectAttempts}`);
            });

            // Reconnected
            this.socket.on('reconnect', (attemptNumber) => {
                console.log('[SocketIONetplay] Reconnected after', attemptNumber, 'attempts');
                this.reconnectAttempts = 0;
                
                // Rejoin room after reconnection
                if (this.roomId && this.playerName) {
                    this.socket.emit('join_room', { 
                        roomId: this.roomId, 
                        playerName: this.playerName, 
                        shipType: this.shipType 
                    });
                }
            });

            // Failed to reconnect
            this.socket.on('reconnect_failed', () => {
                console.error('[SocketIONetplay] Failed to reconnect');
                const handler = this.handlers['closed'];
                if (handler) {
                    handler({ type: 'closed', reason: 'reconnect_failed' });
                }
            });
        });
    }

    _startHeartbeat() {
        this._stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (this.socket && this.socket.connected) {
                this.socket.emit('heartbeat');
            }
        }, 5000);
    }

    _stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    disconnect() {
        this._stopHeartbeat();
        this.isConnected = false;
        
        if (this.socket) {
            this.socket.emit('leave_room');
            this.socket.disconnect();
            this.socket = null;
        }
        
        this.roomId = null;
        this.playerName = null;
        
        console.log('[SocketIONetplay] Disconnected');
    }
}
