/**
 * PollingNetplay - HTTP Polling based co-op synchronization
 * Works with serverless platforms like Vercel (no WebSocket required)
 */
export class PollingNetplay {
    constructor() {
        this.roomId = null;
        this.playerName = null;
        this.handlers = {};
        this.pollingTimer = null;
        this.syncTimer = null;
        this.lastPeerState = null;
        this.isConnected = false;
        this.pollInterval = 100; // Poll every 100ms for ~10 updates/second
        this.syncInterval = 50;  // Sync local state every 50ms
    }

    on(type, handler) {
        this.handlers[type] = handler;
    }

    emit(type, payload = {}) {
        // Queue message to be sent in next sync
        this._queueMessage(type, payload);
    }

    _queueMessage(type, payload) {
        if (!this._messageQueue) this._messageQueue = [];
        this._messageQueue.push({ type, ...payload });
    }

    async connect({ roomId, playerName, shipType }) {
        return new Promise((resolve, reject) => {
            this.roomId = roomId;
            this.playerName = playerName;
            this.shipType = shipType || 'default';
            this._messageQueue = [];

            console.log(`[PollingNetplay] Connecting to room ${roomId} as ${playerName}...`);

            // Try to join room
            this._joinRoom()
                .then((result) => {
                    console.log('[PollingNetplay] Successfully joined room');
                    this.isConnected = true;
                    this._startPolling();
                    this._startSyncing();
                    resolve(result);
                })
                .catch(reject);
        });
    }

    async _joinRoom() {
        try {
            const response = await fetch(`${window.location.origin}/api/rooms/join?roomId=${encodeURIComponent(this.roomId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerName: this.playerName, shipType: this.shipType || 'default' })
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to join room');
            }

            return {
                type: 'joined_room',
                roomId: this.roomId,
                role: data.role,
                players: data.players || {}
            };
        } catch (error) {
            console.error('[PollingNetplay] Failed to join room:', error);
            throw error;
        }
    }

    async _pollPeerState() {
        if (!this.isConnected) return;

        try {
            const url = `${window.location.origin}/api/rooms/state?roomId=${encodeURIComponent(this.roomId)}&playerName=${encodeURIComponent(this.playerName)}`;
            const response = await fetch(url, {
                method: 'GET'
            });

            if (!response.ok) return;

            const data = await response.json();
            if (data.success && data.peerState) {
                // Only trigger handler if state actually changed
                if (JSON.stringify(data.peerState) !== JSON.stringify(this.lastPeerState)) {
                    this.lastPeerState = data.peerState;
                    const handler = this.handlers['peer_state'];
                    if (handler) {
                        handler({
                            type: 'peer_state',
                            state: data.peerState
                        });
                    }
                }
            }
        } catch (error) {
            console.warn('[PollingNetplay] Polling error:', error.message);
        }
    }

    async _syncLocalState() {
        if (!this.isConnected || !this._messageQueue || this._messageQueue.length === 0) return;

        const messages = this._messageQueue;
        this._messageQueue = [];

        try {
            const response = await fetch(`${window.location.origin}/api/rooms/sync?roomId=${encodeURIComponent(this.roomId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playerName: this.playerName, messages })
            });

            if (!response.ok) {
                // Re-queue messages if sync failed
                this._messageQueue = [...messages, ...this._messageQueue];
                return;
            }

            const data = await response.json();
            
            // Process peer messages if any
            if (data.peerMessages && Array.isArray(data.peerMessages)) {
                for (const msg of data.peerMessages) {
                    // Convert outgoing message types to incoming handler types
                    let eventType = msg.type;
                    if (msg.type === 'input_update') eventType = 'peer_input';
                    if (msg.type === 'state_update') eventType = 'peer_state';
                    
                    const handler = this.handlers[eventType];
                    if (handler) {
                        handler(msg);
                    }
                }
            }
        } catch (error) {
            console.warn('[PollingNetplay] Sync error:', error.message);
            // Re-queue messages if sync failed
            this._messageQueue = [...messages, ...this._messageQueue];
        }
    }

    _startPolling() {
        this._stopPolling();
        this.pollingTimer = setInterval(() => this._pollPeerState(), this.pollInterval);
    }

    _stopPolling() {
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
            this.pollingTimer = null;
        }
    }

    _startSyncing() {
        this._stopSyncing();
        this.syncTimer = setInterval(() => this._syncLocalState(), this.syncInterval);
    }

    _stopSyncing() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
    }

    disconnect() {
        this._stopPolling();
        this._stopSyncing();
        this.isConnected = false;
        this.roomId = null;
        this.playerName = null;
        this._messageQueue = [];
        
        console.log('[PollingNetplay] Disconnected');
    }
}
