import { InputHandler } from './input.js';
import { Player } from './entities/player.js';
import { Enemy } from './entities/enemy.js';
import { Explosion } from './entities/particle.js';
import { AudioController } from './audio.js';
import { ScreenShake, Nebula, CosmicDust, Planet, Asteroid } from './utils.js';
import { PowerUp } from './entities/powerup.js';

class AssetLoader {
    constructor() {
        this.assets = new Map();
        this.loadingPromises = [];
    }

    load(name, src) {
        const promise = new Promise((resolve, reject) => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                this.assets.set(name, img);
                resolve(img);
            };
            img.onerror = () => {
                console.error(`Failed to load asset: ${name} at ${src}`);
                resolve(null); // Fallback to vector
            };
        });
        this.loadingPromises.push(promise);
        return promise;
    }

    async loadAll() {
        return Promise.all(this.loadingPromises);
    }

    get(name) {
        return this.assets.get(name);
    }
}

export const SHIP_DATA = {
    'default': { name: 'INTERCEPTOR', price: 0, hp: 3, speed: 320, damage: 1, fireRate: 0.15, missileCooldown: 3.0, missileCount: 1, color: '#00f3ff', bulletType: 'normal', desc: 'Standard issue.' },
    'tank': { name: 'V.G. TITAN', price: 1000, hp: 5, speed: 280, damage: 2, fireRate: 0.25, missileCooldown: 4.0, missileCount: 1, color: '#00ff44', bulletType: 'piercing', desc: 'Heavy armor, piercing shots.' },
    'scout': { name: 'RAZORBACK', price: 1500, hp: 2, speed: 420, damage: 1, fireRate: 0.12, missileCooldown: 2.5, missileCount: 1, color: '#ffff00', bulletType: 'spread', desc: 'Fast, spread fire.' },
    'fighter': { name: 'CRIMSON FURY', price: 3000, hp: 3, speed: 340, damage: 2, fireRate: 0.15, missileCooldown: 3.0, missileCount: 1, color: '#ff0055', bulletType: 'normal', desc: 'High damage fighter.' },
    'rapid': { name: 'STORM BRINGER', price: 5000, hp: 3, speed: 320, damage: 1, fireRate: 0.06, missileCooldown: 2.0, missileCount: 1, color: '#aa00ff', bulletType: 'normal', desc: 'Extreme fire rate.' },
    'bomber': { name: 'DOOMSDAY', price: 8000, hp: 4, speed: 280, damage: 2, fireRate: 0.2, missileCooldown: 4.0, missileCount: 3, color: '#ff6600', bulletType: 'normal', desc: 'Triple missile barrage.' },
    'phantom': { name: 'PHANTOM', price: 6000, hp: 2, speed: 400, damage: 1, fireRate: 0.1, missileCooldown: 2.0, missileCount: 1, color: '#9900ff', bulletType: 'spread', desc: 'Nimbly spread.' },
    'vanguard': { name: 'VANGUARD', price: 10000, hp: 5, speed: 340, damage: 2, fireRate: 0.12, missileCooldown: 3.0, missileCount: 2, color: '#00ffcc', bulletType: 'piercing', desc: 'Elite piercing fighter.' },
    'juggernaut': { name: 'JUGGERNAUT', price: 15000, hp: 8, speed: 240, damage: 3, fireRate: 0.3, missileCooldown: 5.0, missileCount: 4, color: '#ff9900', bulletType: 'piercing', desc: 'God of War, 4 missiles.' },
    'void': { name: 'VOID STALKER', price: 20000, hp: 4, speed: 360, damage: 5, fireRate: 0.4, missileCooldown: 3.0, missileCount: 1, color: '#4400ff', bulletType: 'railgun', desc: 'Experimental Railgun.' },
    'pulse': { name: 'NEON PULSE', price: 12000, hp: 3, speed: 380, damage: 1, fireRate: 0.04, missileCooldown: 2.5, missileCount: 1, color: '#00ffff', bulletType: 'normal', desc: 'Hyper-frequency pulse.' },
    'guardian': { name: 'GALAXY GUARDIAN', price: 25000, hp: 12, speed: 260, damage: 2, fireRate: 0.2, missileCooldown: 4.0, missileCount: 2, color: '#ffffff', bulletType: 'normal', desc: 'Invincible protector.' },
    'solar': { name: 'SOLAR FLARE', price: 18000, hp: 4, speed: 310, damage: 2, fireRate: 0.25, missileCooldown: 3.5, missileCount: 1, color: '#ffcc00', bulletType: 'explosive', desc: 'Explosive solar rounds.' }
};

export class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;

        this.lastTime = 0;
        this.score = 0;

        // Persistence
        this.highScore = parseInt(localStorage.getItem('midnight_highscore')) || 0;
        this.coins = parseInt(localStorage.getItem('midnight_coins')) || 0;
        this.ownedShips = JSON.parse(localStorage.getItem('midnight_owned_ships')) || ['default'];
        this.selectedShip = localStorage.getItem('midnight_selected_ship') || 'default';

        this.gameOver = false;
        this.isRunning = false;

        // Level System
        this.currentLevel = 1;
        this.levelScore = 0;
        this.levelThresholds = this.generateLevelThresholds();
        this.difficultyMultiplier = 1.0;

        // UI Elements
        this.startScreen = document.getElementById('start-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.hud = document.getElementById('hud');
        this.startBtn = document.getElementById('start-btn');
        this.restartBtn = document.getElementById('restart-btn');

        // Controllers
        this.player = null;
        this.input = new InputHandler();
        this.audio = new AudioController();
        this.screenShake = new ScreenShake();
        this.assets = new AssetLoader();

        // Arrays
        this.enemies = [];
        this.particles = [];
        this.projectiles = [];
        this.afterburners = [];
        this.powerups = [];
        this.nebulas = [];
        this.cosmicDust = [];
        this.planets = [];
        this.asteroids = [];

        // AAA State
        this.impactTimer = 0;
        this.isWarping = false;
        this.warpTimer = 0;
        this.boss = null;
        this.bossTimer = 0;
        this.timeScale = 1.0;
        this.slowMoTimer = 0;

        // Timers
        this.enemyTimer = 0;
        this.enemyInterval = 2.0;
        this.powerupTimer = 0;
        this.powerupInterval = 12.0;

        // Bindings
        this.loop = this.loop.bind(this);
        this.resize = this.resize.bind(this);

        this.initAtmosphere();
        this.addEventListeners();
    }

    initAtmosphere() {
        import('./utils.js').then(m => {
            for (let i = 0; i < 5; i++) this.nebulas.push(new m.Nebula(this));
            for (let i = 0; i < 30; i++) this.cosmicDust.push(new m.CosmicDust(this));
        });
    }

    triggerImpact(freezeTime = 0.05, flashIntense = 0.2) {
        this.impactTimer = freezeTime;
        const overlay = document.getElementById('impact-overlay');
        if (overlay) {
            overlay.style.opacity = flashIntense;
            setTimeout(() => { if (overlay) overlay.style.opacity = 0; }, 50);
        }
        this.screenShake.trigger(15, 0.1);
    }

    addEventListeners() {
        window.addEventListener('resize', this.resize);

        const handleStart = (e) => {
            if (e.type === 'touchstart') e.preventDefault();
            console.log(`${e.target.id} triggered via ${e.type}`);
            this.startGame();
        };

        this.startBtn.addEventListener('click', handleStart);
        this.startBtn.addEventListener('touchstart', handleStart, { passive: false });

        this.restartBtn.addEventListener('click', handleStart);
        this.restartBtn.addEventListener('touchstart', handleStart, { passive: false });

        // Store Buttons
        const storeBtn = document.getElementById('store-btn');
        if (storeBtn) {
            storeBtn.addEventListener('click', () => this.openStore());
            storeBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.openStore(); }, { passive: false });
        }

        const backBtn = document.getElementById('back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.closeStore());
            backBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.closeStore(); }, { passive: false });
        }

        // Pause & Menu Buttons
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => this.togglePause());
            pauseBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.togglePause(); }, { passive: false });
        }

        const resumeBtn = document.getElementById('resume-btn');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', () => this.togglePause());
            resumeBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.togglePause(); }, { passive: false });
        }

        const mainMenuBtn = document.getElementById('main-menu-btn');
        if (mainMenuBtn) {
            mainMenuBtn.addEventListener('click', () => this.goToMainMenu());
            mainMenuBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.goToMainMenu(); }, { passive: false });
        }

        // Game Over Buttons
        // Game Over Buttons
        const goToStoreBtn = document.getElementById('go-to-store-btn');
        if (goToStoreBtn) {
            const handleStore = (e) => {
                if (e.type === 'touchstart') e.preventDefault();
                console.log('Go To Store Clicked');
                this.goToStoreFromGameOver();
            };
            goToStoreBtn.addEventListener('click', handleStore);
            goToStoreBtn.addEventListener('touchstart', handleStore, { passive: false });
        }

        const goToMainBtn = document.getElementById('go-to-main-btn');
        if (goToMainBtn) {
            const handleMain = (e) => {
                if (e.type === 'touchstart') e.preventDefault();
                console.log('Go To Main Menu Clicked');
                this.goToMainMenu();
            };
            goToMainBtn.addEventListener('click', handleMain);
            goToMainBtn.addEventListener('touchstart', handleMain, { passive: false });
        }

        // Keyboard Pause
        window.addEventListener('keydown', (e) => {
            if ((e.key === 'Escape' || e.key.toLowerCase() === 'p') && this.isRunning && !this.gameOver) {
                this.togglePause();
            }
        });
    }

    init() {
        this.resize();
        this.drawBackground();

        // Load Ships
        this.assets.load('interceptor', 'assets/ships/interceptor.png');
        this.assets.load('tank', 'assets/ships/tank.png');
        this.assets.load('scout', 'assets/ships/scout.png');
        this.assets.load('enemy_chaser', 'assets/ships/enemy_chaser.png');
        this.assets.load('boss', 'assets/ships/boss.png');

        // Initialize cosmic atmosphere
        this.initializeCosmicAtmosphere();

        console.log("MIDNIGHT Initialized");
        // Update coin display on start screen
        const coinEl = document.getElementById('total-coins-display');
        if (coinEl) coinEl.innerText = `COINS: ${this.coins}`;

        // Hide pause menu initially
        document.getElementById('pause-menu').classList.remove('active');

        // Fullscreen Button
        const fsBtn = document.getElementById('fullscreen-btn');
        if (fsBtn) {
            const toggleFs = (e) => {
                if (e.type === 'touchstart') e.preventDefault();
                this.toggleFullScreen();
            };
            fsBtn.addEventListener('click', toggleFs);
            fsBtn.addEventListener('touchstart', toggleFs, { passive: false });
        }

        // Resize listener is already added in constructor/addEventListeners

    }

    toggleFullScreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    enableFullScreen() {
        this.toggleFullScreen();
    }


    getShipStats(type) {
        return SHIP_DATA[type] || SHIP_DATA['default'];
    }

    generateLevelThresholds() {
        const thresholds = [];
        // Level 1: 0, Level 2: 1000, Level 3: 2000, etc.
        for (let i = 0; i <= 100; i++) {
            thresholds.push(i * 1000);
        }
        return thresholds;
    }

    checkLevelUp() {
        // Wave Completion Logic
        // 1. All enemies for the level must have spawned
        // 2. All enemies must be defeated (enemies array empty)
        // 3. Boss must not be active
        if (this.enemiesSpawned >= this.enemiesForLevel &&
            this.enemies.length === 0 &&
            !this.boss) {

            this.currentLevel++;

            // New Level Setup
            this.enemiesForLevel = 5 + (this.currentLevel * 3);
            this.enemiesSpawned = 0;

            // Trigger Boss Warp every 5 levels
            if (this.currentLevel % 5 === 0) {
                this.triggerWarp();
            } else {
                this.levelScore = this.score; // Keep for records
                this.difficultyMultiplier = Math.min(5.0, 1 + (this.currentLevel - 1) * 0.15);
                this.enemyInterval = Math.max(0.3, 2.0 / this.difficultyMultiplier);

                // Level Up Visuals
                this.screenShake.trigger(30, 0.3);
                if (this.audio) this.audio.dash();

                // Show Level Up Text
                const hud = document.getElementById('hud');
                if (hud) {
                    const levelText = document.createElement('div');
                    levelText.innerText = `LEVEL ${this.currentLevel}`;
                    levelText.style.position = 'absolute';
                    levelText.style.top = '40%';
                    levelText.style.left = '50%';
                    levelText.style.transform = 'translate(-50%, -50%)';
                    levelText.style.color = '#fff';
                    levelText.style.fontSize = '4rem';
                    levelText.style.fontWeight = 'bold';
                    levelText.style.textShadow = '0 0 20px #00f3ff';
                    levelText.style.zIndex = '20';
                    levelText.style.animation = 'fadeOut 2s forwards';
                    document.body.appendChild(levelText);
                    setTimeout(() => levelText.remove(), 2000);
                }
            }
        }
    }

    triggerWarp() {
        // Show boss alert instead of slow motion
        this.showBossAlert();

        setTimeout(() => {
            this.spawnBoss();
        }, 2000); // 2 second alert before boss spawns
    }

    showBossAlert() {
        // Create alert overlay
        const alertDiv = document.createElement('div');
        alertDiv.id = 'boss-alert';
        alertDiv.innerHTML = `
            <div class="boss-alert-content">
                <h1 class="glitch" data-text="⚠ WARNING ⚠">⚠ WARNING ⚠</h1>
                <p class="boss-alert-text">ANOMALY DETECTED</p>
                <p class="boss-alert-subtext">PREPARE FOR COMBAT</p>
            </div>
        `;
        document.body.appendChild(alertDiv);

        // Play alert sound
        if (this.audio) this.audio.dash();

        // Remove after 2 seconds
        setTimeout(() => {
            alertDiv.remove();
        }, 2000);
    }

    spawnBoss() {
        // Clear all enemies when boss appears
        this.enemies.forEach(enemy => {
            enemy.markedForDeletion = true;
            this.particles.push(new Explosion(this, enemy.x, enemy.y, enemy.color));
        });
        this.enemies = [];

        import('./entities/boss.js').then(m => {
            const sides = ['top', 'left', 'right'];
            const side = sides[Math.floor(Math.random() * sides.length)];
            this.boss = new m.Boss(this, this.currentLevel, side);
            const bossHud = document.getElementById('boss-hud');
            if (bossHud) bossHud.classList.add('active');
            const bossName = document.getElementById('boss-name');
            if (bossName) bossName.innerText = this.currentLevel % 10 === 0 ? 'ELITE ANOMALY: THE FORTRESS' : 'ANOMALY DETECTED: V-STRIKE';
        });
    }

    resize() {
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;
        this.drawBackground();
    }

    startGame() {
        console.log('startGame() called');
        this.isRunning = true;
        this.gameOver = false;
        this.isPaused = false;
        this.score = 0;
        this.currentLevel = 1; // Reset to level 1 on new game
        this.boss = null;
        this.difficultyMultiplier = 1.0; // Retained from original
        this.lastTime = 0; // Retained from original

        // Level System Init
        this.enemiesForLevel = 5 + (this.currentLevel * 3);
        this.enemiesSpawned = 0;

        this.enemies = [];
        this.particles = [];
        this.projectiles = [];
        this.afterburners = [];
        this.powerups = [];

        this.enemyTimer = 0;
        this.enemyInterval = 2.0;
        this.powerupTimer = 0;
        this.powerupInterval = 12.0;

        // Attempt Fullscreen
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log(`Error attempting to enable fullscreen: ${err.message}`);
            });
        }

        this.startScreen.classList.remove('active');
        this.gameOverScreen.classList.remove('active');
        if (this.hud) this.hud.style.display = 'flex';

        // Fix: Ensure Boss HUD is hidden on restart
        const bossHud = document.getElementById('boss-hud');
        if (bossHud) bossHud.classList.remove('active');

        this.player = new Player(this, this.selectedShip);

        requestAnimationFrame(this.loop);
    }

    togglePause() {
        if (!this.isRunning || this.gameOver) return;

        this.isPaused = !this.isPaused;

        if (this.isPaused) {
            document.getElementById('pause-menu').classList.add('active');
        } else {
            document.getElementById('pause-menu').classList.remove('active');
            this.lastTime = 0; // Reset delta time to prevent jump
        }
    }

    goToMainMenu() {
        this.isRunning = false;
        this.isPaused = false;
        this.gameOver = false;

        document.getElementById('pause-menu').classList.remove('active');
        this.gameOverScreen.classList.remove('active');
        if (this.hud) this.hud.style.display = 'none';

        // Fix: Ensure Boss HUD is hidden when going to main menu
        const bossHud = document.getElementById('boss-hud');
        if (bossHud) bossHud.classList.remove('active');

        this.startScreen.classList.add('active');
        this.init(); // Refresh start screen data
    }

    goToStoreFromGameOver() {
        this.goToMainMenu();
        this.openStore();
    }

    initializeCosmicAtmosphere() {
        // Create nebulas for volumetric gas clouds
        for (let i = 0; i < 5; i++) {
            this.nebulas.push(new Nebula(this));
        }

        // Create cosmic dust particles for velocity effect
        for (let i = 0; i < 100; i++) {
            this.cosmicDust.push(new CosmicDust(this));
        }

        // Create planets
        for (let i = 0; i < 3; i++) {
            this.planets.push(new Planet(this));
        }

        // Create asteroids
        for (let i = 0; i < 15; i++) {
            this.asteroids.push(new Asteroid(this));
        }
    }

    loop(timestamp) {
        if (!this.isRunning) return;

        try {
            if (!this.lastTime || this.isPaused) { // If paused, just keep updating lastTime without processing?
                // actually, if paused, we can just skip the whole loop body effectively,
                // BUT we need to handle the resume properly.
                // Better: if isPaused, just return early or requestFrame but don't update.
                if (this.isPaused) {
                    this.lastTime = timestamp; // Keep clock running so no huge delta on resume
                    requestAnimationFrame(this.loop);
                    return;
                }
            }

            if (!this.lastTime) {
                this.lastTime = timestamp;
            }

            const deltaTime = (timestamp - this.lastTime) / 1000;
            this.lastTime = timestamp;

            this.update(deltaTime);
            this.draw();
        } catch (e) {
            console.error("Game Loop Crash:", e);
            this.isRunning = false;
            throw e; // Re-throw to trigger window.onerror
        }

        requestAnimationFrame(this.loop);
    }

    update(deltaTime) {
        if (this.isPaused) return;

        // Hit-Stop Impact Effect (Temporal Freeze)
        if (this.impactTimer > 0) {
            this.impactTimer -= deltaTime;
            return;
        }

        // Warp Sequence handling
        if (this.isWarping) {
            this.cosmicDust.forEach(d => {
                d.vy *= 10;
                d.draw(this.ctx); // Extra speed visual during update loop too
            });
            return;
        }

        // Safety cap for deltaTime
        const dt = Math.min(deltaTime, 0.1);

        this.screenShake.update(dt);

        if (!this.gameOver) {
            if (this.player) {
                this.player.update(dt, this.input);
            }

            // Spawn logic
            this.enemyTimer += dt;
            // Spawn only if we haven't reached the level limit
            if (this.enemyTimer > this.enemyInterval &&
                this.enemies.length < 50 &&
                !this.boss &&
                this.enemiesSpawned < this.enemiesForLevel) {
                this.spawnEnemy();
                this.enemiesSpawned++; // Count the spawn
                this.enemyTimer = 0;
            }

            this.powerupTimer += dt;
            if (this.powerupTimer > this.powerupInterval && this.powerups.length < 3) {
                this.spawnPowerUp();
                this.powerupTimer = 0;
            }

            // Entity Updates
            this.enemies.forEach(e => e.update(dt));
            this.projectiles.forEach(p => p.update(dt));
            this.powerups.forEach(p => p.update(dt));

            if (this.boss) {
                this.boss.update(dt);
                this.updateBossUI();
            }

            this.afterburners.forEach(a => {
                if (a.update) a.update(dt);
                else {
                    a.life -= dt;
                    if (a.life <= 0) a.markedForDeletion = true;
                }
            });

            // Collisions
            this.checkCollisions();
            this.checkProjectileCollisions();
            this.checkPowerUpCollisions();
            this.checkLevelUp();
        } else {
            this.enemies.forEach(e => e.update(dt));
            this.projectiles.forEach(p => p.update(dt));
            this.afterburners.forEach(a => {
                if (a.update) a.update(dt);
                else { a.life -= dt; if (a.life <= 0) a.markedForDeletion = true; }
            });
        }

        // Always update particles
        this.particles.forEach(p => p.update(dt));

        // Cleanup
        this.enemies = this.enemies.filter(e => !e.markedForDeletion);
        this.projectiles = this.projectiles.filter(p => !p.markedForDeletion);
        this.particles = this.particles.filter(p => !p.markedForDeletion);
        this.powerups = this.powerups.filter(p => !p.markedForDeletion);
        this.afterburners = this.afterburners.filter(a => !a.markedForDeletion);

        // Cleanup Boss
        if (this.boss && this.boss.markedForDeletion) {
            this.boss = null;
            const bossHud = document.getElementById('boss-hud');
            if (bossHud) bossHud.classList.remove('active');
        }

        this.updateUI();
    }

    updateBossUI() {
        if (!this.boss) return;
        const fill = document.getElementById('boss-health-fill');
        if (fill) {
            const pct = (this.boss.health / this.boss.maxHealth) * 100;
            fill.style.width = `${pct}%`;
        }
    }

    draw() {
        // Cosmic Atmosphere Background Layer
        // Draw nebulas (volumetric gas clouds)
        this.nebulas.forEach(nebula => nebula.draw(this.ctx));

        // Draw planets
        this.planets.forEach(planet => planet.draw(this.ctx));

        // Draw asteroids
        this.asteroids.forEach(asteroid => asteroid.draw(this.ctx));

        // Draw cosmic dust (high-speed particles)
        this.cosmicDust.forEach(dust => dust.draw(this.ctx));

        // Background trail
        this.ctx.fillStyle = 'rgba(5, 5, 16, 0.3)';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();
        this.ctx.translate(this.screenShake.offsetX, this.screenShake.offsetY);

        // Draw Player
        if (this.player && !this.gameOver) this.player.draw(this.ctx);

        // Draw Boss
        if (this.boss) this.boss.draw(this.ctx);

        // Draw Entities
        this.enemies.forEach(e => e.draw(this.ctx));
        this.projectiles.forEach(p => p.draw(this.ctx));
        this.afterburners.forEach(a => {
            if (a.draw) a.draw(this.ctx);
        });
        this.particles.forEach(p => p.draw(this.ctx));
        this.powerups.forEach(p => p.draw(this.ctx));

        this.ctx.restore();
    }

    drawBackground() {
        this.ctx.fillStyle = '#050510';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Draw AAA Atmosphere
        this.nebulas.forEach(n => n.draw(this.ctx));
        this.cosmicDust.forEach(d => d.draw(this.ctx));

        // Grid lines
        this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.05)';
        this.ctx.lineWidth = 1;
        const gridSize = 50;
        for (let x = 0; x < this.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }
        for (let y = 0; y < this.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }
    }

    spawnEnemy() {
        const typeRand = Math.random();
        let type = 'chaser';
        if (this.score > 1500 && typeRand > 0.8) type = 'shooter';
        else if (this.score > 500 && typeRand > 0.7) type = 'heavy';
        this.enemies.push(new Enemy(this, type));
    }

    spawnPowerUp() {
        const types = ['speed', 'slowmo', 'invulnerability', 'health_recover', 'health_boost', 'shield', 'double_damage', 'rapid_fire'];
        const type = types[Math.floor(Math.random() * types.length)];
        this.powerups.push(new PowerUp(this, type));
    }

    checkCollisions() {
        if (!this.player || this.gameOver || this.isWarping) return;

        this.enemies.forEach(enemy => {
            if (enemy.markedForDeletion) return;

            const dx = enemy.x - this.player.x;
            const dy = enemy.y - this.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < enemy.radius + this.player.radius) {
                if (this.player.isInvulnerable()) {
                    enemy.markedForDeletion = true;
                    this.score += enemy.points;
                    this.particles.push(new Explosion(this, enemy.x, enemy.y, enemy.color));
                    if (this.audio) this.audio.explosion();
                } else {
                    const playerDied = this.player.takeDamage(1);
                    this.triggerImpact(0.1, 0.5);
                    this.hudFlashDamage();
                    if (playerDied) {
                        this.handleGameOver();
                    } else {
                        enemy.markedForDeletion = true;
                        this.particles.push(new Explosion(this, enemy.x, enemy.y, enemy.color));
                        this.screenShake.trigger(20, 0.2);
                    }
                }
            }
        });

        // Boss Collision
        if (this.boss && !this.player.isInvulnerable()) {
            const dx = this.boss.x - this.player.x;
            const dy = this.boss.y - this.player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < this.boss.radius + this.player.radius) {
                const died = this.player.takeDamage(1);
                this.triggerImpact(0.15, 0.6);
                this.hudFlashDamage();
                if (died) this.handleGameOver();
            }
        }
    }

    checkProjectileCollisions() {
        if (this.isWarping) return;

        this.projectiles.forEach(proj => {
            if (proj.markedForDeletion) return;

            // Player vs Enemies/Boss
            if (proj.side === 'player') {
                this.enemies.forEach(enemy => {
                    if (enemy.markedForDeletion || proj.markedForDeletion) return;
                    const dx = proj.x - enemy.x;
                    const dy = proj.y - enemy.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < enemy.radius + proj.radius) {
                        // Support for Piercing / Explosive
                        if (proj.explosive) {
                            this.triggerExplosion(proj.x, proj.y, 100, proj.damage * 2);
                            proj.markedForDeletion = true;
                        } else if (proj.piercing) {
                            // Don't delete, just damage
                            const dead = enemy.takeDamage(proj.damage);
                            if (dead) {
                                enemy.markedForDeletion = true;
                                this.score += enemy.points;
                                this.particles.push(new Explosion(this, enemy.x, enemy.y, enemy.color));
                            }
                        } else {
                            proj.markedForDeletion = true;
                            const dead = enemy.takeDamage(proj.damage);
                            if (dead) {
                                enemy.markedForDeletion = true;
                                this.score += enemy.points;
                                this.particles.push(new Explosion(this, enemy.x, enemy.y, enemy.color));
                                if (this.audio) this.audio.explosion();
                            }
                        }
                    }
                });

                if (this.boss && !proj.markedForDeletion) {
                    const dx = proj.x - this.boss.x;
                    const dy = proj.y - this.boss.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < this.boss.radius + proj.radius) {
                        if (proj.explosive) {
                            this.triggerExplosion(proj.x, proj.y, 120, proj.damage * 3);
                            proj.markedForDeletion = true;
                        } else if (proj.piercing) {
                            const dead = this.boss.takeDamage(proj.damage);
                            if (dead) this.handleBossDefeat();
                        } else {
                            proj.markedForDeletion = true;
                            const dead = this.boss.takeDamage(proj.damage);
                            if (dead) this.handleBossDefeat();
                        }
                    }
                }
            } else {
                // Enemy vs Player logic omitted here but remains in file
                // Enemy vs Player
                if (this.player && !this.player.isInvulnerable()) {
                    const dx = proj.x - this.player.x;
                    const dy = proj.y - this.player.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < this.player.radius + proj.radius) {
                        proj.markedForDeletion = true;
                        const died = this.player.takeDamage(proj.damage);
                        this.triggerImpact(0.1, 0.5);
                        this.hudFlashDamage();
                        if (died) this.handleGameOver();
                    }
                }
            }
        });
    }

    triggerExplosion(x, y, radius, damage) {
        // Visual explosion
        this.particles.push(new Explosion(this, x, y, '#ffaa00'));
        this.screenShake.trigger(15, 0.3);

        // Damage all enemies in range
        this.enemies.forEach(enemy => {
            const dx = enemy.x - x;
            const dy = enemy.y - y;
            const dist = Math.hypot(dx, dy);
            if (dist < radius + enemy.radius) {
                const dead = enemy.takeDamage(damage);
                if (dead) {
                    enemy.markedForDeletion = true;
                    this.score += enemy.points;
                    this.particles.push(new Explosion(this, enemy.x, enemy.y, enemy.color));
                }
            }
        });

        // Damage boss if in range
        if (this.boss) {
            const dx = this.boss.x - x;
            const dy = this.boss.y - y;
            const dist = Math.hypot(dx, dy);
            if (dist < radius + this.boss.radius) {
                const dead = this.boss.takeDamage(damage);
                if (dead) this.handleBossDefeat();
            }
        }
    }

    hudFlashDamage() {
        const fill = document.getElementById('health-fill');
        if (fill) {
            fill.classList.add('damage-flash');
            setTimeout(() => { if (fill) fill.classList.remove('damage-flash'); }, 200);
        }
    }

    handleBossDefeat() {
        if (!this.boss) return;

        const loot = this.boss.coinReward || 500;
        this.score += this.boss.points;
        this.coins += loot;

        // Save coins
        localStorage.setItem('midnight_coins', this.coins);

        const bossPos = { x: this.boss.x, y: this.boss.y };
        this.boss = null;

        const bossHud = document.getElementById('boss-hud');
        if (bossHud) bossHud.classList.remove('active');

        // Cinematic Finisher - Show Reward
        const rewardText = document.createElement('div');
        rewardText.innerText = `+${loot} COINS`;
        rewardText.style.position = 'absolute';
        rewardText.style.top = '50%';
        rewardText.style.left = '50%';
        rewardText.style.transform = 'translate(-50%, -50%)';
        rewardText.style.color = '#ffd700';
        rewardText.style.fontSize = '3rem';
        rewardText.style.fontWeight = 'bold';
        rewardText.style.textShadow = '0 0 20px #ffd700';
        rewardText.style.zIndex = '30';
        rewardText.style.animation = 'fadeOut 3s forwards';
        document.body.appendChild(rewardText);
        setTimeout(() => rewardText.remove(), 3000);

        this.screenShake.trigger(50, 1.0);
        this.particles.push(new Explosion(this, bossPos.x, bossPos.y, '#ff0000'));
    }

    checkPowerUpCollisions() {
        if (!this.player || this.gameOver) return;

        this.powerups.forEach(p => {
            if (p.markedForDeletion) return;
            const dx = p.x - this.player.x;
            const dy = p.y - this.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < p.radius + this.player.radius) {
                this.player.applyPowerUp(p.type);
                p.markedForDeletion = true;
                this.screenShake.trigger(10, 0.1);
                if (this.audio) this.audio.dash();
            }
        });
    }

    updateUI() {
        const scoreEl = document.getElementById('score-display');
        const levelEl = document.getElementById('level-display');
        const healthFill = document.getElementById('health-fill');

        if (scoreEl) scoreEl.innerText = this.score;

        // Update High Score logic
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('midnight_highscore', this.highScore);
        }

        const highScoreEl = document.getElementById('high-score-display');
        if (highScoreEl) highScoreEl.innerText = this.highScore;

        if (levelEl) levelEl.innerText = this.currentLevel;

        // Update Enemy Count
        const enemyCountEl = document.getElementById('enemy-count');
        if (enemyCountEl) {
            const remaining = (this.enemiesForLevel - this.enemiesSpawned) + this.enemies.length;
            enemyCountEl.innerText = Math.max(0, remaining);
        }

        if (healthFill && this.player) {
            const pct = (this.player.currentHealth / this.player.maxHealth) * 100;
            healthFill.style.width = pct + '%';


            if (Math.random() < 0.01) {
                console.log(`Health Update: ${this.player.currentHealth}/${this.player.maxHealth} (${pct}%)`);
            }
        }

        // Update Missile Reload Bar
        const missileFill = document.getElementById('missile-fill');
        if (missileFill && this.player) {
            const cooldownPct = Math.max(0, (this.player.missileCooldown - this.player.missileTimer) / this.player.missileCooldown) * 100;
            missileFill.style.width = (100 - cooldownPct) + '%';

            // Change color when ready
            if (this.player.missileTimer <= 0) {
                missileFill.style.background = '#00ff00';
            } else {
                missileFill.style.background = 'linear-gradient(90deg, #ff6600, #ff0000)';
            }
        }

        // Update Enemy Counter

    }

    handleGameOver() {
        if (this.gameOver) return; // Prevent multiple calls
        this.gameOver = true;
        // Do NOT set isRunning to false, so particles can animate

        // Calculate Coins (1 coin per 10 score)
        const earnedCoins = Math.floor(this.score / 10);
        this.coins += earnedCoins;
        localStorage.setItem('midnight_coins', this.coins);
        console.log(`Earned ${earnedCoins} coins. Total: ${this.coins}`);

        if (this.player) {
            this.particles.push(new Explosion(this, this.player.x, this.player.y, '#00f3ff'));
        }

        if (this.audio && this.audio.gameOver) {
            // Safe call
            try {
                this.audio.gameOver();
            } catch (e) {
                console.error("Audio error:", e);
            }
        }

        this.screenShake.trigger(50, 0.5);
        this.triggerGameOver(earnedCoins);
    }

    triggerGameOver(earnedCoins) {
        const finalScoreEl = document.getElementById('final-score');
        if (finalScoreEl) finalScoreEl.innerText = this.score;
        const finalHighScoreEl = document.getElementById('final-high-score');
        if (finalHighScoreEl) finalHighScoreEl.innerText = this.highScore;

        // Show coins earned
        const coinsEarnedEl = document.getElementById('coins-earned-display');
        if (coinsEarnedEl) coinsEarnedEl.innerText = `+${earnedCoins} COINS`;

        if (this.gameOverScreen) this.gameOverScreen.classList.add('active');
        if (this.hud) this.hud.style.display = 'none';
    }

    // Store System
    openStore() {
        this.startScreen.classList.remove('active');
        document.getElementById('store-screen').classList.add('active');
        this.renderStore();
    }

    closeStore() {
        document.getElementById('store-screen').classList.remove('active');
        this.startScreen.classList.add('active');
    }

    renderStore() {
        const grid = document.getElementById('ship-grid');
        const coinsDisplay = document.getElementById('coins-display-store');
        grid.innerHTML = '';
        coinsDisplay.innerText = `COINS: ${this.coins}`;
        document.getElementById('total-coins-display').innerText = `COINS: ${this.coins}`;

        for (const [key, ship] of Object.entries(SHIP_DATA)) {
            const card = document.createElement('div');
            card.className = `ship-card ${this.ownedShips.includes(key) ? 'owned' : ''} ${this.selectedShip === key ? 'selected' : ''}`;

            // Visual Preview (Canvas)
            const canvas = document.createElement('canvas');
            canvas.width = 100;
            canvas.height = 100;
            const ctx = canvas.getContext('2d');

            // Draw dummy ship for preview
            ctx.translate(50, 50);
            ctx.rotate(-Math.PI / 2); // Point up
            const mockGame = { width: 100, height: 100 };
            const dummyPlayer = new Player(mockGame, key);

            // 3D Realistic Sprite Preview
            const sprite = this.assets.get(key === 'default' ? 'interceptor' : key);
            if (sprite) {
                const size = 60;
                ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
            } else {
                dummyPlayer.drawShape(ctx, ship.color);
            }

            card.appendChild(canvas);

            const title = document.createElement('h3');
            title.innerText = ship.name;
            card.appendChild(title);

            const stats = document.createElement('div');
            stats.className = 'ship-stats';
            stats.innerHTML = `
                HP: ${ship.hp}<br>
                SPD: ${ship.speed}<br>
                DMG: ${ship.damage}<br>
                RATE: ${(1 / ship.fireRate).toFixed(1)}/s<br>
                <span style="color:#aaa; font-style:italic; font-size:0.75rem">${ship.desc}</span>
            `;
            card.appendChild(stats);

            const btn = document.createElement('button');
            btn.className = 'action-btn';

            if (this.selectedShip === key) {
                btn.innerText = 'EQUIPPED';
                btn.disabled = true;
            } else if (this.ownedShips.includes(key)) {
                btn.innerText = 'EQUIP';
                btn.onclick = () => this.selectShip(key);
            } else {
                btn.innerText = `BUY ${ship.price}`;
                if (this.coins < ship.price) {
                    btn.disabled = true;
                } else {
                    btn.onclick = () => this.buyShip(key);
                }
            }
            card.appendChild(btn);
            grid.appendChild(card);
        }
    }

    buyShip(type) {
        const ship = SHIP_DATA[type];
        if (this.coins >= ship.price) {
            this.coins -= ship.price;
            this.ownedShips.push(type);
            this.selectedShip = type;

            // Save
            localStorage.setItem('midnight_coins', this.coins);
            localStorage.setItem('midnight_owned_ships', JSON.stringify(this.ownedShips));
            localStorage.setItem('midnight_selected_ship', this.selectedShip);

            if (this.audio) this.audio.powerUp(); // Success sound
            this.renderStore();
        }
    }

    selectShip(type) {
        if (this.ownedShips.includes(type)) {
            this.selectedShip = type;
            localStorage.setItem('midnight_selected_ship', this.selectedShip);
            if (this.audio) this.audio.dash(); // Select sound
            this.renderStore();
        }
    }
}
