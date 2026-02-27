export class NetplayClient {
    constructor() {
        this.socket = null;
        this.handlers = {};
        this.heartbeatTimer = null;
    }

    on(type, handler) {
        this.handlers[type] = handler;
    }

    emit(type, payload = {}) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        this.socket.send(JSON.stringify({ type, ...payload }));
    }

    connect({ roomId, playerName, shipType }) {
        return new Promise((resolve, reject) => {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const socketUrl = `${protocol}//${window.location.host}/ws`;
            this.socket = new WebSocket(socketUrl);

            const onOpen = () => {
                this.emit('join_room', { roomId, playerName, shipType });
            };

            const onMessage = (event) => {
                let message;
                try {
                    message = JSON.parse(event.data);
                } catch {
                    return;
                }

                if (message.type === 'joined_room') {
                    this.startHeartbeat();
                    resolve(message);
                }

                if (message.type === 'error') {
                    reject(new Error(message.error || 'Network error'));
                }

                const handler = this.handlers[message.type];
                if (handler) handler(message);
            };

            const onClose = () => {
                this.stopHeartbeat();
                const handler = this.handlers.closed;
                if (handler) handler({ type: 'closed' });
            };

            const onError = () => {
                reject(new Error('Failed to connect to realtime server'));
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
