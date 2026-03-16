/**
 * ServerAuthoritativeNetplay
 * A complete replacement for the old P2P-style SocketIONetplay.
 * This class assumes the Node.js server is running the physics in a headless ServerGame.
 * The client only sends input and receives raw X/Y/HP state data to render.
 */
export class ServerAuthoritativeNetplay {
    constructor(game) {
        this.game = game; // Reference to the main game object so we can overwrite things
        this.socket = null;
        this.roomId = null;
        this.playerName = null;
        this.role = null;
        this.isConnected = false;
        
        // Polling rate for sending inputs to the server (~60Hz)
        this.inputTickRate = 1000 / 60; 
        this.inputLoopId = null;
        
        // We track incoming state here
        this.serverState = null;
        this.handlers = {};
    }

    on(type, handler) {
        this.handlers[type] = handler;
        if (this.socket) {
            this.socket.on(type, handler);
        }
    }

    emit(type, data) {
        if (this.socket) {
            this.socket.emit(type, data);
        }
    }

    async connect({ roomId, playerName, shipType }) {
        return new Promise((resolve, reject) => {
            if (typeof io === 'undefined') {
                return reject(new Error('Socket.IO library not loaded.'));
            }

            this.roomId = roomId;
            this.playerName = playerName;
            this.shipType = shipType || 'default';

            this.socket = io({
                transports: ['websocket', 'polling'],
                reconnection: true
            });

            // Re-attach any handlers registered before connection
            for (const [type, handler] of Object.entries(this.handlers)) {
                this.socket.on(type, handler);
            }

            this.socket.on('connect', () => {
                console.log('[AuthNetplay] Connected. Joining room...');
                this.socket.emit('join_room', {
                    roomId: this.roomId,
                    playerName: this.playerName,
                    shipType: this.shipType
                });
            });

            this.socket.on('joined_room', (data) => {
                console.log('[AuthNetplay] Joined Room!', data);
                this.isConnected = true;
                this.role = data.role;
                
                // Set the game role immediately
                this.game.role = this.role; 

                // Start the 60Hz input pump
                this.startInputPump();

                resolve(data);
            });

            this.socket.on('peer_joined', (data) => {
                console.log('[AuthNetplay] Peer Joined:', data);
                if (this.game.onPeerJoined) {
                    this.game.onPeerJoined(data);
                }
            });

            // The main event: 60Hz snapshot delta from the ServerGame
            this.socket.on('delta', (delta) => {
                this.serverState = delta;
                this.reconcileState(delta);
            });

            // Specific One-Off Events
            this.socket.on('spawn_enemy', (data) => {
                // Used to create the visual representation with the server's randomized ID mapping
                console.log('[AuthNetplay] Server spawned enemy:', data);
                this.game.spawnAuthoritativeEnemy(data);
            });
            
            this.socket.on('spawn_boss', (data) => {
                 this.game.spawnAuthoritativeBoss(data);
            });
            
            this.socket.on('destroy_enemy', (data) => {
                this.game.destroyAuthoritativeEnemy(data.id);
            });
            
            this.socket.on('destroy_boss', (data) => {
                this.game.destroyAuthoritativeBoss();
            });
            
            this.socket.on('level_up', (data) => {
                this.game.authoritativeLevelUp(data);
            });

            // Disconnect handling
            this.socket.on('disconnect', () => {
                this.isConnected = false;
                this.stopInputPump();
                console.warn('[AuthNetplay] Disconnected from server');
            });
        });
    }

    startInputPump() {
        if (this.inputLoopId) clearInterval(this.inputLoopId);
        
        this.inputLoopId = setInterval(() => {
            if (!this.isConnected || !this.game.player || !this.socket) return;
            
            // Only send the raw keys. The server will compute velocity so everyone sees the exact same movement trajectory
            const keys = {
                up: this.game.keys['ArrowUp'] || this.game.keys['w'] || this.game.keys['W'],
                down: this.game.keys['ArrowDown'] || this.game.keys['s'] || this.game.keys['S'],
                left: this.game.keys['ArrowLeft'] || this.game.keys['a'] || this.game.keys['A'],
                right: this.game.keys['ArrowRight'] || this.game.keys['d'] || this.game.keys['D'],
                fire: this.game.keys[' '] || this.game.mouse.button0,
                missile: this.game.keys['Shift'] || this.game.mouse.button2,
                dash: this.game.keys['v'] || this.game.keys['V']
            };

            // Allow mobile joystick overrides
            if (this.game.joystick && this.game.joystick.active) {
                const vec = this.game.joystick.getMovementVector();
                keys.up = vec.y < -0.3;
                keys.down = vec.y > 0.3;
                keys.left = vec.x < -0.3;
                keys.right = vec.x > 0.3;
            }
            if (this.game.fireButton && this.game.fireButton.isPressed) keys.fire = true;
            if (this.game.missileButton && this.game.missileButton.isPressed) keys.missile = true;

            this.socket.emit('input', { keys });
            
        }, this.inputTickRate);
    }

    stopInputPump() {
        if (this.inputLoopId) {
            clearInterval(this.inputLoopId);
            this.inputLoopId = null;
        }
    }

    /**
     * DUMB CLIENT RENDERING APPLIER
     * Instantly apply (or gently lerp) the Server's absolute truth onto our visuals.
     */
    reconcileState(delta) {
        if (!this.game) return;

        // 1. Update Both Players
        for (const [pRole, pData] of Object.entries(delta.players)) {
            // Find the local representation
            let targetPlayer = null;
            if (pRole === this.role) {
                targetPlayer = this.game.player;
            } else if (this.game.peerPlayer) {
                targetPlayer = this.game.peerPlayer;
            }

            if (targetPlayer) {
                // Apply authoritative positions directly
                // (We can add a quick Lerp here later if the 60hz is slightly jittery)
                const lerpFactor = 0.5; // Smooth heavily
                targetPlayer.x += (pData.x - targetPlayer.x) * lerpFactor;
                targetPlayer.y += (pData.y - targetPlayer.y) * lerpFactor;
                targetPlayer.angle = pData.a;
                targetPlayer.currentHealth = pData.hp;
            }
        }

        // 2. Update Enemies by ID
        // The server sends { id: "enemy_1", x: 100, y: 100, hp: 5, a: 1.5 }
        delta.enemies.forEach(sEnemy => {
            const localEnemy = this.game.enemies.find(e => e.remoteId === sEnemy.id);
            if (localEnemy) {
                localEnemy.x = sEnemy.x;
                localEnemy.y = sEnemy.y;
                localEnemy.health = sEnemy.hp;
                localEnemy.angle = sEnemy.a || localEnemy.angle;
            }
        });
        
        // 3. Update Boss
        if (delta.boss && this.game.boss) {
             this.game.boss.x = delta.boss.x;
             this.game.boss.y = delta.boss.y;
             this.game.boss.health = delta.boss.hp;
        }

        // 4. Dumb Bullets Rendering
        // Rather than mapping instance-to-instance, we just blindly overwrite our bullet array with what the server tells us is flying. 
        // We disable 'update' on bullets entirely during co-op mode.
        this.game.authoritativeBullets = delta.bullets;

        // 5. Hard Meta Stats Sync
        this.game.score = delta.score;
        this.game.level = delta.level;
    }

    disconnect() {
        this.stopInputPump();
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.isConnected = false;
        this.roomId = null;
        this.playerName = null;
    }
}
