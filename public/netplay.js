export class NetplayClient {
    constructor() {
        this.socket = null;
        this.handlers = {};
        this.heartbeatTimer = null;
        this.connectTimeout = 10000; // 10 second timeout
    }

    on(type, handler) {
        this.handlers[type] = handler;
    }

    emit(type, payload = {}) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.warn(`[NetplayClient] Cannot emit ${type}: socket not ready (state: ${this.socket?.readyState})`);
            return;
        }
        this.socket.send(JSON.stringify({ type, ...payload }));
    }

    connect({ roomId, playerName, shipType }) {
        return new Promise((resolve, reject) => {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const socketUrl = `${protocol}//${window.location.host}/ws`;
            
            console.log(`[NetplayClient] Connecting to ${socketUrl}...`);
            
            this.socket = new WebSocket(socketUrl);

            // Set up connection timeout
            const timeoutId = setTimeout(() => {
                console.error('[NetplayClient] Connection timeout');
                this.socket?.close();
                reject(new Error('WebSocket connection timeout - server may be offline'));
            }, this.connectTimeout);

            const onOpen = () => {
                clearTimeout(timeoutId);
                console.log('[NetplayClient] WebSocket connected, sending join_room message');
                this.emit('join_room', { roomId, playerName, shipType });
            };

            const onMessage = (event) => {
                let message;
                try {
                    message = JSON.parse(event.data);
                } catch (e) {
                    console.error('[NetplayClient] Failed to parse message:', event.data);
                    return;
                }

                console.log('[NetplayClient] Received message:', message.type);

                if (message.type === 'joined_room') {
                    clearTimeout(timeoutId);
                    this.startHeartbeat();
                    resolve(message);
                }

                if (message.type === 'error') {
                    clearTimeout(timeoutId);
                    console.error('[NetplayClient] Server error:', message.error);
                    reject(new Error(message.error || 'Network error'));
                }

                const handler = this.handlers[message.type];
                if (handler) handler(message);
            };

            const onClose = () => {
                clearTimeout(timeoutId);
                console.log('[NetplayClient] WebSocket closed');
                this.stopHeartbeat();
                const handler = this.handlers.closed;
                if (handler) handler({ type: 'closed' });
            };

            const onError = (event) => {
                clearTimeout(timeoutId);
                console.error('[NetplayClient] WebSocket error:', event);
                reject(new Error('Failed to connect to realtime server - check if server is running'));
            };

            this.socket.addEventListener('open', onOpen);
            this.socket.addEventListener('message', onMessage);
            this.socket.addEventListener('close', onClose);
            this.socket.addEventListener('error', onError);
        });
    }

    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            this.emit('heartbeat');
        }, 5000);
    }

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    disconnect() {
        this.stopHeartbeat();
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.emit('leave_room');
            this.socket.close();
        }
        this.socket = null;
    }
}
