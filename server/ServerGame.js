import { Player } from '../public/entities/player.js';
import { Enemy } from '../public/entities/enemy.js';
import { Projectile } from '../public/entities/projectile.js';
import { Boss } from '../public/entities/boss.js';

/**
 * ServerGame provides a headless simulation of the Midnight Fighter engine.
 * It manages physics, collisions, spawning, and game loops independently
 * of the DOM/Canvas.
 */
export class ServerGame {
    constructor(roomId, io) {
        this.roomId = roomId;
        this.io = io;
        
        // Game Physics Boundaries
        this.logicalWidth = 1920;
        this.logicalHeight = 1080;
        
        // Game State Core
        this.players = new Map(); // Map of { role -> Player instance }
        this.enemies = [];
        this.projectiles = [];
        this.powerups = [];
        this.boss = null;
        
        // Match State
        this.score = 0;
        this.currentLevel = 1;
        this.enemiesSpawned = 0;
        this.enemiesForLevel = 16;
        this.difficultyMultiplier = 1.0;
        this.isWarping = false;
        
        // Timing & Spawning
        this.lastTime = Date.now();
        this.enemySpawnTimer = 0;
        this.enemySpawnInterval = 1.0;
        this.powerupTimer = 0;
        this.entityCounter = 0;
        
        // Prng seed for deterministic replication if ever needed (though server dicts here anyway)
        this.randomSeed = Math.floor(Math.random() * 100000);
        
        // Simulation Frame Rate (60Hz)
        this.tickRate = 1000 / 60; 
        this.intervalId = setInterval(() => {
            try {
                this.tick();
            } catch (err) {
                console.error(`[ServerGame ${this.roomId}] Tick Error:`, err);
                // Don't stop the interval, but maybe we should if it's fatal?
            }
        }, this.tickRate);
    }
    
    // Entity Compatibility Aliases
    get width() { return this.logicalWidth; }
    get height() { return this.logicalHeight; }

    // Provide a mocked audio/particle/input interface so imported entities don't crash
    get audio() { return { 
        play: () => {}, shoot: () => {}, dash: () => {}, enemyShot: () => {},
        collect: () => {}, levelup: () => {}, gameover: () => {}
    }; }
    get particles() { return { push: () => {} }; }
    get afterburners() { return { push: () => {} }; }
    get floatingTexts() { return { push: () => {} }; }
    get screenShake() { return { trigger: () => {} }; }
    get achievementManager() { return { addStat: () => {} }; }
    get autoTargetEnabled() { return true; }
    
    getShipStats(shipType) {
        // Fallback ship stats since we can't easily import SHIP_DATA from game.js in Node
        const fallbacks = {
            'default': { hp: 3, speed: 300, damage: 1, fireRate: 0.15, missileCount: 1, color: '#00f3ff' },
            'fighter': { hp: 4, speed: 320, damage: 1.2, fireRate: 0.14, missileCount: 1, color: '#ff3300' },
            'scout': { hp: 2, speed: 450, damage: 1, fireRate: 0.12, missileCount: 1, color: '#ffff00' },
            'tank': { hp: 8, speed: 200, damage: 2, fireRate: 0.3, missileCount: 2, color: '#00ff00' },
            'absolute': { hp: 10, speed: 400, damage: 3, fireRate: 0.1, missileCount: 3, color: '#ffffff' }
        };
        return fallbacks[shipType] || fallbacks['default'];
    }

    getPlayers() {
        return Array.from(this.players.values());
    }

    random() {
        // Simple seeded PRNG
        const x = Math.sin(this.randomSeed++) * 10000;
        return x - Math.floor(x);
    }

    addPlayer(role, playerName, shipType) {
        console.log(`[ServerGame ${this.roomId}] Adding player ${role} (${playerName}) - ${shipType}`);
        const player = new Player(this, shipType, { playerId: role });
        
        // Spread players apart slightly
        if (role === 'host') {
            player.x = this.logicalWidth / 2 - 100;
        } else {
            player.x = this.logicalWidth / 2 + 100;
        }
        player.y = this.logicalHeight - 200;
        
        // Mock remote input
        player.inputState = {
            keys: { up: false, down: false, left: false, right: false, fire: false, missile: false, dash: false },
            getMovementVector: function() {
                let vx = 0; let vy = 0;
                if (this.keys.left) vx -= 1;
                if (this.keys.right) vx += 1;
                if (this.keys.up) vy -= 1;
                if (this.keys.down) vy += 1;
                if (vx !== 0 || vy !== 0) {
                    const len = Math.sqrt(vx*vx + vy*vy);
                    vx /= len; vy /= len;
                }
                return { x: vx, y: vy };
            }
        };
        
        this.players.set(role, player);
    }
    
    applyInput(role, inputKeys) {
        const player = this.players.get(role);
        if (player && player.inputState) {
            player.inputState.keys = { ...player.inputState.keys, ...inputKeys };
        }
    }

    tick() {
        const now = Date.now();
        const deltaTime = (now - this.lastTime) / 1000;
        this.lastTime = now;
        
        // 1. Update Players
        this.players.forEach((player, role) => {
            if (!player.markedForDeletion) {
                // Pass our mocked input wrapper
                player.update(Math.min(deltaTime, 0.1), player.inputState);
            }
        });
        
        // 2. Spawn Enemies
        if (!this.boss && !this.isWarping) {
            this.enemySpawnTimer -= deltaTime;
            if (this.enemySpawnTimer <= 0 && this.enemiesSpawned < this.enemiesForLevel) {
                this.spawnEnemy();
                this.enemySpawnTimer = this.enemySpawnInterval;
            } else if (this.enemiesSpawned >= this.enemiesForLevel && this.enemies.length === 0) {
                this.startBossPhase();
            }
        }
        
        // 3. Update Entities
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            e.update(deltaTime);
            if (e.markedForDeletion) this.enemies.splice(i, 1);
        }
        
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(deltaTime);
            if (p.markedForDeletion) this.projectiles.splice(i, 1);
        }
        
        if (this.boss) {
            this.boss.update(deltaTime);
            if (this.boss.markedForDeletion) {
                this.boss = null;
                this.levelUp();
            }
        }
        
        // 4. Collision Detection
        this.checkCollisions();
        
        // 5. Broadcast State to Room
        this.broadcastState();
    }
    
    spawnEnemy() {
        const types = ['chaser', 'heavy', 'shooter', 'swarm', 'sniper'];
        const weights = [10, 3, 5, 4, 2];
        let totalWeight = weights.reduce((a, b) => a + b, 0);
        let r = this.random() * totalWeight;
        let selectedType = 'chaser';
        for (let i = 0; i < types.length; i++) {
            r -= weights[i];
            if (r <= 0) {
                selectedType = types[i];
                break;
            }
        }
        
        const enemy = new Enemy(this, selectedType);
        enemy.remoteId = `enemy_${this.entityCounter++}`;
        this.enemies.push(enemy);
        this.enemiesSpawned++;
        
        // Tell clients to spawn the aesthetic parts
        this.io.to(this.roomId).emit('spawn_enemy', {
            id: enemy.remoteId, type: enemy.type, x: enemy.x, y: enemy.y
        });
    }
    
    startBossPhase() {
        this.spawnBoss('boss1');
    }
    
    spawnBoss(type) {
        this.boss = new Boss(this, this.currentLevel, 'top', 0);
        this.boss.remoteId = `boss_${this.entityCounter++}`;
        this.io.to(this.roomId).emit('spawn_boss', {
            id: this.boss.remoteId, level: this.currentLevel, x: this.boss.x, y: this.boss.y
        });
    }
    
    levelUp() {
        this.isWarping = true;
        setTimeout(() => {
            this.isWarping = false;
            this.currentLevel++;
            this.enemiesForLevel = 12 + (this.currentLevel * 4);
            this.enemiesSpawned = 0;
            this.difficultyMultiplier += 0.2;
            this.enemySpawnInterval = Math.max(0.3, 1.0 - (this.currentLevel * 0.05));
            
            this.io.to(this.roomId).emit('level_up', {
                level: this.currentLevel,
                score: this.score,
                enemiesForLevel: this.enemiesForLevel,
                difficultyMultiplier: this.difficultyMultiplier,
                enemyInterval: this.enemySpawnInterval
            });
        }, 3000);
    }
    
    checkCollisions() {
        // Player Bullets -> Enemies
        this.projectiles.filter(p => !p.markedForDeletion && (p.side === 'host' || p.side === 'guest')).forEach(bullet => {
            // Check enemies
            this.enemies.forEach(enemy => {
                if (!enemy.markedForDeletion && !enemy.isSpawning) {
                    const dx = bullet.x - enemy.x;
                    const dy = bullet.y - enemy.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < bullet.radius + enemy.radius) {
                        bullet.markedForDeletion = true;
                        const dead = enemy.takeDamage(bullet.damage);
                        if (dead) {
                            enemy.markedForDeletion = true;
                            this.score += enemy.points;
                            this.io.to(this.roomId).emit('destroy_enemy', { id: enemy.remoteId });
                        }
                    }
                }
            });
            
            // Check boss
            if (this.boss && !this.boss.markedForDeletion) {
                const dx = bullet.x - this.boss.x;
                const dy = bullet.y - this.boss.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < bullet.radius + this.boss.radius) {
                    bullet.markedForDeletion = true;
                    const dead = this.boss.takeDamage(bullet.damage);
                    if (dead) {
                        this.score += this.boss.points;
                        this.io.to(this.roomId).emit('destroy_boss', { id: this.boss.remoteId });
                    }
                }
            }
        });
        
        // Enemy Bullets -> Players
        this.projectiles.filter(p => !p.markedForDeletion && p.side === 'enemy').forEach(bullet => {
            this.players.forEach((player, role) => {
                if (!player.markedForDeletion && player.invulnerableTimer <= 0) {
                    const dx = bullet.x - player.x;
                    const dy = bullet.y - player.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    
                    if (dist < bullet.radius + player.radius) {
                        bullet.markedForDeletion = true;
                        player.currentHealth -= bullet.damage;
                        player.damageFlashTimer = 0.5;
                        player.invulnerableTimer = 1.0;
                        if (player.currentHealth <= 0) {
                            this.io.to(this.roomId).emit('player_died', { role });
                        }
                    }
                }
            });
        });
    }
    
    broadcastState() {
        // Build a lean state delta
        const delta = {
            players: {},
            enemies: this.enemies.map(e => ({ 
                id: e.remoteId, 
                x: Math.round(e.x || 0), 
                y: Math.round(e.y || 0), 
                hp: e.health || 0, 
                a: Number((e.angle || 0).toFixed(2)) 
            })),
            bullets: this.projectiles.map(p => ({ 
                x: Math.round(p.x || 0), 
                y: Math.round(p.y || 0), 
                c: p.color || '#fff', 
                r: p.radius || 2 
            })), // Minified bullets
            score: this.score,
            level: this.currentLevel
        };
        
        this.players.forEach((player, role) => {
            delta.players[role] = { 
                x: Math.round(player.x || 0), 
                y: Math.round(player.y || 0), 
                a: Number((player.angle || 0).toFixed(2)), 
                hp: player.currentHealth || 0 
            };
        });
        
        if (this.boss) {
            delta.boss = { 
                id: this.boss.remoteId, 
                x: Math.round(this.boss.x || 0), 
                y: Math.round(this.boss.y || 0), 
                hp: this.boss.health || 0 
            };
        }
        
        this.io.to(this.roomId).emit('delta', delta);
    }
    
    stop() {
        clearInterval(this.intervalId);
    }
}
