import { InputHandler } from './input.js';
import { Player } from './entities/player.js';
import { Enemy } from './entities/enemy.js';
import { Explosion } from './entities/particle.js';
import { AudioController } from './audio.js';
import { ScreenShake, Nebula, CosmicDust, Planet, Asteroid } from './utils.js';
import { PowerUp } from './entities/powerup.js';
import { LeaderboardManager } from './leaderboard.js';
import { NetplayClient } from './netplay.js';

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
    'solar': { name: 'SOLAR FLARE', price: 18000, hp: 4, speed: 310, damage: 2, fireRate: 0.25, missileCooldown: 3.5, missileCount: 1, color: '#ffcc00', bulletType: 'explosive', desc: 'Explosive solar rounds.' },
    'eclipse': { name: 'ECLIPSE SERAPH', price: 45000, hp: 16, speed: 360, damage: 5, fireRate: 0.08, missileCooldown: 2.2, missileCount: 3, color: '#66ccff', bulletType: 'piercing', invincible: true, desc: 'Angel core. Invincible hull.' },
    'obliterator': { name: 'OBLITERATOR PRIME', price: 75000, hp: 20, speed: 300, damage: 7, fireRate: 0.12, missileCooldown: 2.8, missileCount: 4, color: '#ff3366', bulletType: 'explosive', invincible: true, desc: 'Siege frame. Invincible core.' },
    'starborn': { name: 'STARBORN TITAN', price: 120000, hp: 28, speed: 340, damage: 8, fireRate: 0.1, missileCooldown: 2.0, missileCount: 5, color: '#99ffcc', bulletType: 'railgun', invincible: true, desc: 'Mythic relic. Invincible.' }
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
        
        // Ensure guardian is not equipped by default
        if (this.selectedShip === 'guardian') {
            this.selectedShip = 'default';
            localStorage.setItem('midnight_selected_ship', this.selectedShip);
        }

        this.gameOver = false;
        this.isRunning = false;
        this.fromPauseMenu = false; // Track if armory opened from pause

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
        this.playerTwo = null;
        this.input = new InputHandler({
            bindings: InputHandler.bindings.singlePlayer,
            enableTouch: true,
            enabled: true
        });
        this.inputTwo = new InputHandler({
            bindings: InputHandler.bindings.coopPlayerTwo,
            enableTouch: false,
            enabled: false
        });
        this.audio = new AudioController();
        this.screenShake = new ScreenShake();
        this.assets = new AssetLoader();

        // Initialize audio settings
        const musicEnabled = localStorage.getItem('midnight_music_enabled') !== 'false';
        if (!musicEnabled) {
            this.audio.masterGain.gain.value = 0;
        }

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
        this.bossJustDefeated = false;
        this.bossDefeatTimer = 0;
        this.firstBossAppeared = false;
        this.lastBossLevel = 0;
        this.timeScale = 1.0;
        this.slowMoTimer = 0;

        // Enemy Tracking for Unique Spawning
        this.spawnedEnemyTypes = new Set();

        // Timers
        this.enemyTimer = 0;
        this.enemyInterval = 2.0;
        this.powerupTimer = 0;
        this.powerupInterval = 12.0;
        this.comboMultiplier = 1;
        this.comboTimer = 0;

        // Gameplay Extras
        this.comboMultiplier = 1;
        this.comboTimer = 0;
        this.comboWindow = 3.0;
        this.comboMax = 5.0;
        this.enemyDropChance = 0.08;

        // Settings
        this.autoTargetEnabled = localStorage.getItem('midnight_autotarget_enabled') !== 'false';

        // Leaderboard
        this.leaderboard = new LeaderboardManager();

        // Co-op state
        this.coopMode = false;
        this.collabRoomId = null;
        this.collabTeamMembers = null;
        this.collabPollTimer = null;
        this.onlineCoop = false;
        this.onlineRole = null;
        this.remotePlayerState = null;
        this.remoteInputState = {
            keys: { up: false, down: false, left: false, right: false, fire: false, missile: false, dash: false },
            getMovementVector() {
                let x = 0;
                let y = 0;
                if (this.keys.left) x -= 1;
                if (this.keys.right) x += 1;
                if (this.keys.up) y -= 1;
                if (this.keys.down) y += 1;
                if (x !== 0 || y !== 0) {
                    const len = Math.sqrt(x * x + y * y);
                    x /= len;
                    y /= len;
                }
                return { x, y };
            }
        };
        this.remoteShipType = this.selectedShip;
        this.localShipType = this.selectedShip;
        this.netplay = new NetplayClient();
        this.netSyncTimer = 0;

        // Fullscreen management
        this.fullscreenCheckTimer = 0;

        // Bindings
        this.loop = this.loop.bind(this);
        this.resize = this.resize.bind(this);

        this.initAtmosphere();
        this.addEventListeners();
        this.updatePlayerNameDisplay();
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
            // Auto-fullscreen on game start
            this.enterFullscreen();
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

        const pauseArmoryBtn = document.getElementById('pause-armory-btn');
        if (pauseArmoryBtn) {
            pauseArmoryBtn.addEventListener('click', () => this.openStoreFromPause());
            pauseArmoryBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.openStoreFromPause(); }, { passive: false });
        }

        // Settings Button
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.toggleSettingsMenu());
            settingsBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.toggleSettingsMenu(); }, { passive: false });
        }

        const closeSettingsBtn = document.getElementById('close-settings-btn');
        if (closeSettingsBtn) {
            closeSettingsBtn.addEventListener('click', () => this.toggleSettingsMenu());
            closeSettingsBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.toggleSettingsMenu(); }, { passive: false });
        }

        // Settings Checkboxes
        const musicToggle = document.getElementById('music-toggle');
        if (musicToggle) {
            musicToggle.checked = localStorage.getItem('midnight_music_enabled') !== 'false';
            musicToggle.addEventListener('change', (e) => {
                localStorage.setItem('midnight_music_enabled', e.target.checked);
                this.audio.masterGain.gain.value = e.target.checked ? 0.3 : 0;
            });
        }

        const autoTargetToggle = document.getElementById('autotarget-toggle');
        if (autoTargetToggle) {
            autoTargetToggle.checked = localStorage.getItem('midnight_autotarget_enabled') !== 'false';
            autoTargetToggle.addEventListener('change', (e) => {
                localStorage.setItem('midnight_autotarget_enabled', e.target.checked);
                this.autoTargetEnabled = e.target.checked;
            });
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
                this.goToStoreFromGameOver();
            };
            goToStoreBtn.addEventListener('click', handleStore);
            goToStoreBtn.addEventListener('touchstart', handleStore, { passive: false });
        }

        const goToMainBtn = document.getElementById('go-to-main-btn');
        if (goToMainBtn) {
            const handleMain = (e) => {
                if (e.type === 'touchstart') e.preventDefault();
                this.goToMainMenu();
            };
            goToMainBtn.addEventListener('click', handleMain);
            goToMainBtn.addEventListener('touchstart', handleMain, { passive: false });
        }

        // Leaderboard Buttons
        const leaderboardBtn = document.getElementById('leaderboard-btn');
        if (leaderboardBtn) {
            leaderboardBtn.addEventListener('click', () => this.openLeaderboard());
            leaderboardBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.openLeaderboard(); }, { passive: false });
        }

        const collabBtn = document.getElementById('collab-btn');
        if (collabBtn) {
            collabBtn.addEventListener('click', () => this.openCollaborate());
            collabBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.openCollaborate(); }, { passive: false });
        }

        const backFromLeaderboardBtn = document.getElementById('back-from-leaderboard-btn');
        if (backFromLeaderboardBtn) {
            backFromLeaderboardBtn.addEventListener('click', () => this.closeLeaderboard());
            backFromLeaderboardBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.closeLeaderboard(); }, { passive: false });
        }

        const collabBackBtn = document.getElementById('collab-back-btn');
        if (collabBackBtn) {
            collabBackBtn.addEventListener('click', () => this.closeCollaborate());
            collabBackBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.closeCollaborate(); }, { passive: false });
        }

        const collabCreateBtn = document.getElementById('collab-create-btn');
        if (collabCreateBtn) {
            collabCreateBtn.addEventListener('click', () => this.createCollaborateRoom());
            collabCreateBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.createCollaborateRoom(); }, { passive: false });
        }

        const collabJoinBtn = document.getElementById('collab-join-btn');
        if (collabJoinBtn) {
            collabJoinBtn.addEventListener('click', () => this.joinCollaborateRoom());
            collabJoinBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.joinCollaborateRoom(); }, { passive: false });
        }

        const collabLeaveBtn = document.getElementById('collab-leave-btn');
        if (collabLeaveBtn) {
            collabLeaveBtn.addEventListener('click', () => this.leaveCollaborateRoom());
            collabLeaveBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.leaveCollaborateRoom(); }, { passive: false });
        }

        const pauseLeaveBtn = document.getElementById('leave-room-btn');
        if (pauseLeaveBtn) {
            pauseLeaveBtn.addEventListener('click', () => this.leaveCollaborateRoom(true));
            pauseLeaveBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.leaveCollaborateRoom(true); }, { passive: false });
        }

        const goToLeaderboardBtn = document.getElementById('go-to-leaderboard-btn');
        if (goToLeaderboardBtn) {
            goToLeaderboardBtn.addEventListener('click', () => this.openLeaderboardFromGameOver());
            goToLeaderboardBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.openLeaderboardFromGameOver(); }, { passive: false });
        }

        const refreshLeaderboardBtn = document.getElementById('refresh-leaderboard-btn');
        if (refreshLeaderboardBtn) {
            refreshLeaderboardBtn.addEventListener('click', () => this.leaderboard.displayLeaderboard());
            refreshLeaderboardBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.leaderboard.displayLeaderboard(); }, { passive: false });
        }

        const setNameBtn = document.getElementById('set-name-btn');
        if (setNameBtn) {
            setNameBtn.addEventListener('click', () => this.setPlayerName());
            setNameBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.setPlayerName(); }, { passive: false });
        }

        const playerNameInput = document.getElementById('player-name-input');
        if (playerNameInput) {
            playerNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.setPlayerName();
            });
        }

        // Keyboard Pause
        window.addEventListener('keydown', (e) => {
            if ((e.key === 'Escape' || e.key.toLowerCase() === 'p') && this.isRunning && !this.gameOver) {
                this.togglePause();
            }
        });

        this.netplay.on('peer_state', (message) => this.applyPeerState(message));
        this.netplay.on('peer_input', (message) => this.applyPeerInput(message));
        this.netplay.on('peer_joined', (message) => {
            if (message?.shipType) {
                this.remoteShipType = message.shipType;
                this.updatePlayerHudInfo();
            }
        });
        this.netplay.on('force_game_over', () => this.handleGameOver());
        this.netplay.on('room_closed', () => {
            this.leaveCollaborateRoom(true, true);
        });
        this.netplay.on('closed', () => {
            if (this.onlineCoop) {
                this.leaveCollaborateRoom(true, true);
            }
        });
    }

    init() {
        this.resize();
        this.drawBackground();

        // Load Ships
        // this.assets.load('interceptor', 'assets/ships/interceptor.png');
        // this.assets.load('tank', 'assets/ships/tank.png');
        // this.assets.load('scout', 'assets/ships/scout.png');
        // this.assets.load('enemy_chaser', 'assets/ships/enemy_chaser.png');
        // this.assets.load('boss', 'assets/ships/boss.png');

        // Initialize cosmic atmosphere
        this.initializeCosmicAtmosphere();

        // Update coin display on start screen
        const coinEl = document.getElementById('total-coins-display');
        if (coinEl) coinEl.innerText = `COINS: ${this.coins}`;

        this.updatePlayerHudInfo();

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
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    enterFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
            });
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
        // Mark first boss appearance
        if (!this.firstBossAppeared) {
            this.firstBossAppeared = true;
        }
        this.lastBossLevel = this.currentLevel;
        
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
        this.isRunning = true;
        this.gameOver = false;
        this.isPaused = false;
        this.score = 0;
        this.currentLevel = 1; // Reset to level 1 on new game
        this.boss = null;
        this.bossJustDefeated = false;
        this.bossDefeatTimer = 0;
        this.firstBossAppeared = false;
        this.lastBossLevel = 0;
        this.spawnedEnemyTypes.clear(); // Reset enemy type tracking
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

        this.startScreen.classList.remove('active');
        this.gameOverScreen.classList.remove('active');
        if (this.hud) this.hud.style.display = 'flex';

        // Always enter fullscreen when starting game
        this.enterFullscreen();

        // Fix: Ensure Boss HUD is hidden on restart
        const bossHud = document.getElementById('boss-hud');
        if (bossHud) bossHud.classList.remove('active');

        const healthP2 = document.getElementById('health-container-p2');
        if (healthP2) healthP2.style.display = this.coopMode ? 'flex' : 'none';

        if (this.coopMode) {
            this.input.setBindings(InputHandler.bindings.coopPlayerOne);
            this.inputTwo.setEnabled(!this.onlineCoop || this.onlineRole === 'host');
        } else {
            this.input.setBindings(InputHandler.bindings.singlePlayer);
            this.inputTwo.setEnabled(false);
        }

        const localPlayerId = this.onlineCoop && this.onlineRole === 'guest' ? 'player2' : 'player1';
        const remotePlayerId = localPlayerId === 'player1' ? 'player2' : 'player1';
        const localShip = this.coopMode ? this.localShipType : this.selectedShip;
        const remoteShip = this.coopMode ? this.remoteShipType : this.selectedShip;

        this.player = new Player(this, localShip, { playerId: localPlayerId });
        if (this.coopMode) {
            this.playerTwo = new Player(this, remoteShip, { playerId: remotePlayerId });
            this.playerTwo.x = this.player.x + 80;
            this.playerTwo.y = this.player.y + 80;
        } else {
            this.playerTwo = null;
        }

        const leaveRoomBtn = document.getElementById('leave-room-btn');
        if (leaveRoomBtn) leaveRoomBtn.style.display = this.onlineCoop ? 'inline-block' : 'none';

        this.updatePlayerHudInfo();

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

    toggleSettingsMenu() {
        if (!this.isRunning || this.gameOver) return;

        const settingsMenu = document.getElementById('settings-menu');
        settingsMenu.classList.toggle('active');

        if (settingsMenu.classList.contains('active')) {
            this.isPaused = true;
        } else {
            this.isPaused = false;
            this.lastTime = 0; // Reset delta time to prevent jump
        }
    }

    goToMainMenu() {
        if (this.onlineCoop) {
            this.leaveCollaborateRoom(true, true);
            return;
        }

        this.isRunning = false;
        this.isPaused = false;
        this.gameOver = false;

        this.stopCollabPolling();
        this.resetCoop();

        document.getElementById('pause-menu').classList.remove('active');
        document.getElementById('settings-menu').classList.remove('active');
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

    // Leaderboard Methods
    openLeaderboard() {
        this.startScreen.classList.remove('active');
        document.getElementById('leaderboard-screen').classList.add('active');
        this.leaderboard.displayLeaderboard();
        
        // Set player name input value if exists
        const input = document.getElementById('player-name-input');
        if (input && this.leaderboard.getPlayerName()) {
            input.value = this.leaderboard.getPlayerName();
        }
        
        // Hide SET NAME button if player already has a name
        const setNameBtn = document.getElementById('set-name-btn');
        const playerName = this.leaderboard.getPlayerName();
        if (setNameBtn) {
            setNameBtn.style.display = playerName ? 'none' : 'inline-block';
        }
    }

    openLeaderboardFromGameOver() {
        this.gameOverScreen.classList.remove('active');
        document.getElementById('leaderboard-screen').classList.add('active');
        this.leaderboard.displayLeaderboard();
        
        // Set player name input value if exists
        const input = document.getElementById('player-name-input');
        if (input && this.leaderboard.getPlayerName()) {
            input.value = this.leaderboard.getPlayerName();
        }
        
        // Hide SET NAME button if player already has a name
        const setNameBtn = document.getElementById('set-name-btn');
        const playerName = this.leaderboard.getPlayerName();
        if (setNameBtn) {
            setNameBtn.style.display = playerName ? 'none' : 'inline-block';
        }
    }

    closeLeaderboard() {
        document.getElementById('leaderboard-screen').classList.remove('active');
        this.startScreen.classList.add('active');
    }

    openCollaborate() {
        this.startScreen.classList.remove('active');
        const screen = document.getElementById('collab-screen');
        if (screen) screen.classList.add('active');

        const roomInput = document.getElementById('collab-room-input');
        if (roomInput) roomInput.value = '';

        const roomDisplay = document.getElementById('collab-room-display');
        const waiting = document.getElementById('collab-waiting');
        const status = document.getElementById('collab-status');
        const leaveBtn = document.getElementById('collab-leave-btn');
        if (roomDisplay) roomDisplay.classList.add('hidden');
        if (waiting) waiting.classList.add('hidden');
        if (leaveBtn) leaveBtn.classList.add('hidden');
        if (status) status.innerText = '';
    }

    closeCollaborate() {
        const screen = document.getElementById('collab-screen');
        if (screen) screen.classList.remove('active');
        this.startScreen.classList.add('active');
        this.stopCollabPolling();
    }

    async createCollaborateRoom() {
        const status = document.getElementById('collab-status');
        if (status) status.innerText = '';

        const hostName = this.leaderboard.getPlayerName();
        if (!hostName) {
            if (status) status.innerText = 'Set your pilot name first.';
            return;
        }

        try {
            const response = await fetch(`${window.location.origin}/api/rooms/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hostName })
            });

            const data = await response.json();
            if (!data.success) {
                if (status) status.innerText = data.error || 'Failed to create room.';
                return;
            }

            this.collabRoomId = data.roomId;

            const roomIdEl = document.getElementById('collab-room-id');
            const roomDisplay = document.getElementById('collab-room-display');
            const waiting = document.getElementById('collab-waiting');
            const leaveBtn = document.getElementById('collab-leave-btn');

            if (roomIdEl) roomIdEl.innerText = data.roomId;
            if (roomDisplay) roomDisplay.classList.remove('hidden');
            if (waiting) waiting.classList.remove('hidden');
            if (leaveBtn) leaveBtn.classList.remove('hidden');

            this.startCollabPolling(data.roomId, hostName);
        } catch (error) {
            if (status) status.innerText = 'Failed to create room.';
        }
    }

    async joinCollaborateRoom() {
        const status = document.getElementById('collab-status');
        if (status) status.innerText = '';

        const playerName = this.leaderboard.getPlayerName();
        if (!playerName) {
            if (status) status.innerText = 'Set your pilot name first.';
            return;
        }

        const roomInput = document.getElementById('collab-room-input');
        const roomId = roomInput ? roomInput.value.trim() : '';
        if (!roomId) {
            if (status) status.innerText = 'Enter a room ID.';
            return;
        }

        try {
            const response = await fetch(`${window.location.origin}/api/rooms/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId, playerName })
            });

            const data = await response.json();
            if (!data.success) {
                console.error('Failed to join room:', data.error);
                if (status) status.innerText = data.error || 'Failed to join room.';
                return;
            }

            const room = data.room;
            await this.activateCoop(room.roomId, room.hostName, room.guestName, 'guest');
            this.closeCollaborate();
            this.startGame();
        } catch (error) {
            console.error('Error joining room:', error);
            if (status) status.innerText = 'Failed to join room. Check room ID.';
        }
    }

    startCollabPolling(roomId, hostName) {
        this.stopCollabPolling();
        this.collabPollTimer = setInterval(async () => {
            try {
                const response = await fetch(`${window.location.origin}/api/rooms/${roomId}`);
                const data = await response.json();
                if (!data.success) return;

                const room = data.room;
                if (room.status === 'full' && room.guestName) {
                    await this.activateCoop(room.roomId, hostName, room.guestName, 'host');
                    this.closeCollaborate();
                    this.startGame();
                }
            } catch (error) {
                // Ignore polling errors
            }
        }, 2000);
    }

    stopCollabPolling() {
        if (this.collabPollTimer) {
            clearInterval(this.collabPollTimer);
            this.collabPollTimer = null;
        }
    }

    async activateCoop(roomId, hostName, guestName, role = 'host') {
        this.coopMode = true;
        this.onlineCoop = true;
        this.onlineRole = role;
        this.collabRoomId = roomId;
        this.collabTeamMembers = [hostName, guestName];
        this.localShipType = this.selectedShip;
        this.remoteShipType = this.selectedShip;
        this.input.setBindings(InputHandler.bindings.coopPlayerOne);
        this.inputTwo.setEnabled(role === 'host');

        const healthP2 = document.getElementById('health-container-p2');
        if (healthP2) healthP2.style.display = 'flex';

        try {
            console.log('[Game] Activating co-op mode...');
            await this.connectNetplay();
            console.log('[Game] Co-op mode activated successfully');
        } catch (error) {
            console.error('[Game] Failed to activate co-op:', error);
            alert(`Connection failed: ${error.message}\n\nMake sure the server is running (npm start)`);
            this.resetCoop();
            throw error;
        }
        this.updatePlayerNameDisplay();
        this.updatePlayerHudInfo();
    }

    resetCoop() {
        this.coopMode = false;
        this.onlineCoop = false;
        this.onlineRole = null;
        this.collabRoomId = null;
        this.collabTeamMembers = null;
        this.remotePlayerState = null;
        this.remoteShipType = this.selectedShip;
        this.localShipType = this.selectedShip;
        this.netplay.disconnect();
        this.input.setBindings(InputHandler.bindings.singlePlayer);
        this.inputTwo.setEnabled(false);

        const healthP2 = document.getElementById('health-container-p2');
        if (healthP2) healthP2.style.display = 'none';

        const leaveRoomBtn = document.getElementById('leave-room-btn');
        if (leaveRoomBtn) leaveRoomBtn.style.display = 'none';

        this.updatePlayerNameDisplay();
        this.updatePlayerHudInfo();
    }

    async connectNetplay() {
        if (!this.collabRoomId) {
            console.error('No room ID available for connection');
            throw new Error('No room ID');
        }

        const playerName = this.leaderboard.getPlayerName();
        console.log(`[Game] Connecting to room ${this.collabRoomId} as ${playerName}...`);
        
        try {
            const joined = await this.netplay.connect({
                roomId: this.collabRoomId,
                playerName,
                shipType: this.localShipType
            });

            console.log('[Game] Successfully connected to room');

            const peerRole = this.onlineRole === 'host' ? 'guest' : 'host';
            const peerState = joined?.players?.[peerRole];
            if (peerState?.shipType) {
                this.remoteShipType = peerState.shipType;
            }
        } catch (error) {
            console.error('[Game] WebSocket connection failed:', error.message);
            throw error;
        }
    }

    async leaveCollaborateRoom(goMainMenu = false, silent = false) {
        if (this.collabRoomId) {
            try {
                await fetch(`${window.location.origin}/api/rooms/leave`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        roomId: this.collabRoomId,
                        playerName: this.leaderboard.getPlayerName()
                    })
                });
            } catch {
                // ignore leave errors
            }
        }

        this.stopCollabPolling();
        this.resetCoop();

        if (goMainMenu) {
            this.isRunning = false;
            this.gameOver = false;
            document.getElementById('pause-menu').classList.remove('active');
            document.getElementById('settings-menu').classList.remove('active');
            if (this.hud) this.hud.style.display = 'none';
            this.startScreen.classList.add('active');
            if (!silent) {
                const status = document.getElementById('collab-status');
                if (status) status.innerText = 'Room closed.';
            }
            return;
        }

        this.closeCollaborate();
    }

    setPlayerName() {
        const input = document.getElementById('player-name-input');
        if (!input || !input.value.trim()) {
            alert('Please enter a valid pilot name!');
            return;
        }
        
        const name = input.value.trim();
        this.leaderboard.setPlayerName(name);
        this.updatePlayerNameDisplay();
        alert(`Pilot name set to: ${name}`);
        
        // Hide SET NAME button after setting the name
        const setNameBtn = document.getElementById('set-name-btn');
        if (setNameBtn) {
            setNameBtn.style.display = 'none';
        }
    }

    updatePlayerNameDisplay() {
        const displayEl = document.getElementById('current-player-name');
        if (displayEl) {
            const playerName = this.leaderboard.getPlayerName();
            if (this.coopMode && this.collabTeamMembers && this.collabTeamMembers.length === 2) {
                displayEl.innerText = this.collabTeamMembers.join(' & ');
            } else {
                displayEl.innerText = playerName || 'UNKNOWN';
            }
        }
    }

    updatePlayerHudInfo() {
        const p1NameEl = document.getElementById('p1-hud-name');
        const p1ShipEl = document.getElementById('p1-hud-ship');
        const p2NameEl = document.getElementById('p2-hud-name');
        const p2ShipEl = document.getElementById('p2-hud-ship');

        const localName = this.leaderboard.getPlayerName() || 'UNKNOWN';
        const peerName = this.collabTeamMembers
            ? this.collabTeamMembers.find(name => name !== localName) || 'UNKNOWN'
            : 'UNKNOWN';

        if (p1NameEl) p1NameEl.innerText = `YOU: ${localName}`;
        if (p1ShipEl) p1ShipEl.innerText = `SHIP: ${(SHIP_DATA[this.localShipType]?.name || this.localShipType || 'DEFAULT').toUpperCase()}`;

        const showP2 = this.coopMode;
        if (p2NameEl) {
            p2NameEl.style.display = showP2 ? 'block' : 'none';
            p2NameEl.innerText = `ALLY: ${peerName}`;
        }
        if (p2ShipEl) {
            p2ShipEl.style.display = showP2 ? 'block' : 'none';
            p2ShipEl.innerText = `SHIP: ${(SHIP_DATA[this.remoteShipType]?.name || this.remoteShipType || 'DEFAULT').toUpperCase()}`;
        }
    }

    applyPeerInput(message) {
        if (!this.onlineCoop || this.onlineRole !== 'host') return;
        if (!message || !message.input) return;
        // Reset all keys to false first, then apply incoming input
        // This prevents sticky keys (auto-shooting bug)
        this.remoteInputState.keys = {
            up: false,
            down: false,
            left: false,
            right: false,
            fire: false,
            missile: false,
            dash: false,
            ...message.input
        };
    }

    applyPeerState(message) {
        if (!this.onlineCoop || !this.playerTwo || !message || !message.state) return;
        const state = message.state;

        // Both host and guest should apply peer state for proper synchronization
        this.playerTwo.x = typeof state.x === 'number' ? state.x : this.playerTwo.x;
        this.playerTwo.y = typeof state.y === 'number' ? state.y : this.playerTwo.y;
        this.playerTwo.angle = typeof state.angle === 'number' ? state.angle : this.playerTwo.angle;
        if (typeof state.currentHealth === 'number') this.playerTwo.currentHealth = state.currentHealth;
        if (typeof state.maxHealth === 'number') this.playerTwo.maxHealth = state.maxHealth;

        if (state.shipType && state.shipType !== this.remoteShipType) {
            this.remoteShipType = state.shipType;
            this.updatePlayerHudInfo();
        }

        // Only guest syncs game state from host
        if (this.onlineRole === 'guest') {
            if (typeof state.score === 'number') this.score = state.score;
            if (typeof state.level === 'number') this.currentLevel = state.level;
            if (state.gameOver && !this.gameOver) {
                this.handleGameOver();
            }
        }
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

    getPlayers() {
        const players = [];
        if (this.player) players.push(this.player);
        if (this.coopMode && this.playerTwo) players.push(this.playerTwo);
        return players;
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

        // Periodically check and maintain fullscreen during gameplay
        this.fullscreenCheckTimer += dt;
        if (this.fullscreenCheckTimer >= 2.0) { // Check every 2 seconds
            this.fullscreenCheckTimer = 0;
            if (!document.fullscreenElement && this.isRunning && !this.gameOver) {
                this.enterFullscreen();
            }
        }

        this.screenShake.update(dt);

        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.comboMultiplier = 1;
            }
        }

        // Handle boss defeat timer - allows unique enemies to spawn for ~10 seconds
        if (this.bossJustDefeated) {
            this.bossDefeatTimer += dt;
            if (this.bossDefeatTimer > 15.0) { // 15 seconds of unique enemy spawning
                this.bossJustDefeated = false;
                this.bossDefeatTimer = 0;
            }
        }

        if (!this.gameOver) {
            const players = this.getPlayers();
            if (players.length > 0) {
                if (this.onlineCoop && this.coopMode) {
                    // Update local player with local input
                    if (this.player) {
                        this.player.update(dt, this.input);
                    }
                    // Update remote player with remote input for shooting/cooldowns
                    // Position will be corrected by state updates
                    if (this.playerTwo) {
                        this.playerTwo.update(dt, this.remoteInputState);
                    }
                } else {
                    players.forEach((player, index) => {
                        const input = index === 0 ? this.input : this.inputTwo;
                        player.update(dt, input);
                    });
                }
            }

            if (this.onlineCoop) {
                this.netSyncTimer += dt;

                this.netplay.emit('input_update', { input: { ...this.input.keys } });

                if (this.netSyncTimer >= 0.05 && this.player) {
                    this.netSyncTimer = 0;
                    this.netplay.emit('state_update', {
                        state: {
                            x: this.player.x,
                            y: this.player.y,
                            angle: this.player.angle,
                            currentHealth: this.player.currentHealth,
                            maxHealth: this.player.maxHealth,
                            shipType: this.player.shipType,
                            score: this.score,
                            level: this.currentLevel,
                            gameOver: this.gameOver
                        }
                    });
                }
            }

            // Spawn logic
            this.enemyTimer += dt;
            // No enemies spawn during boss fights - only boss appears
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
            this.bossJustDefeated = true;
            this.spawnedEnemyTypes.clear(); // Clear spawned types for new unique enemies
            this.removeLowestHPEnemy(); // Remove the weakest enemy after boss defeat
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

        // Draw Players
        if (!this.gameOver) {
            if (this.player) this.player.draw(this.ctx);
            if (this.coopMode && this.playerTwo) this.playerTwo.draw(this.ctx);
        }

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

    addScore(points, useCombo = true) {
        if (useCombo) {
            if (this.comboTimer > 0) {
                this.comboMultiplier = Math.min(this.comboMax, this.comboMultiplier + 0.25);
            } else {
                this.comboMultiplier = 1;
            }
            this.comboTimer = this.comboWindow;
            this.score += Math.round(points * this.comboMultiplier);
        } else {
            this.score += points;
        }
    }

    handleEnemyDefeat(enemy, useCombo = true) {
        if (!enemy || enemy.markedForDeletion) return;
        enemy.markedForDeletion = true;
        this.addScore(enemy.points, useCombo);
        this.particles.push(new Explosion(this, enemy.x, enemy.y, enemy.color));
        if (this.audio) this.audio.explosion();

        if (enemy.splitOnDeath) {
            for (let i = 0; i < enemy.splitCount; i++) {
                const child = new Enemy(this, enemy.splitType || 'swarm');
                child.x = enemy.x + (Math.random() - 0.5) * 20;
                child.y = enemy.y + (Math.random() - 0.5) * 20;
                this.enemies.push(child);
            }
        }

        if (this.powerups.length < 3 && Math.random() < this.enemyDropChance) {
            this.spawnPowerUpAt(enemy.x, enemy.y);
        }
    }

    spawnEnemy() {
        const typeRand = Math.random();
        const level = this.currentLevel || 1;
        let type = 'chaser';
        
        // Get available enemy types based on level
        const availableTypes = this.getAvailableEnemyTypes(level);
        
        // If boss just defeated, only spawn types not yet seen
        if (this.bossJustDefeated) {
            const uniqueTypes = availableTypes.filter(t => !this.spawnedEnemyTypes.has(t));
            if (uniqueTypes.length > 0) {
                type = uniqueTypes[Math.floor(Math.random() * uniqueTypes.length)];
            } else {
                // Fallback to normal spawn if all types have been seen
                this.bossJustDefeated = false;
                type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
            }
        } else {
            // Normal spawn logic with probability
            type = this.selectEnemyTypeByProbability(typeRand, level, availableTypes);
        }
        
        // Track that this enemy type has been spawned
        this.spawnedEnemyTypes.add(type);
        
        this.enemies.push(new Enemy(this, type));
    }

    getAvailableEnemyTypes(level) {
        // Return array of enemy types available at this level
        if (level >= 21) {
            return ['chaser', 'heavy', 'shooter', 'swarm', 'sniper', 'splitter', 'phantom', 'titan', 'wraith', 'vortex', 
                    'bomber', 'interceptor', 'decoy', 'launcher', 'shielder', 'pulsar', 'blade', 'tractor', 'mirror', 'swarmer'];
        } else if (level >= 16) {
            return ['chaser', 'heavy', 'shooter', 'swarm', 'sniper', 'splitter', 'wraith', 
                    'bomber', 'interceptor', 'decoy', 'launcher', 'shielder', 'pulsar', 'blade', 'tractor', 'mirror', 'swarmer'];
        } else if (level >= 14) {
            return ['chaser', 'heavy', 'shooter', 'swarm', 'sniper', 'titan', 
                    'bomber', 'interceptor', 'decoy', 'launcher', 'shielder', 'pulsar', 'blade', 'swarmer'];
        } else if (level >= 12) {
            return ['chaser', 'heavy', 'shooter', 'swarm', 'sniper', 'titan', 
                    'bomber', 'interceptor', 'decoy', 'launcher', 'shielder', 'pulsar', 'blade', 'tractor'];
        } else if (level >= 10) {
            return ['chaser', 'heavy', 'shooter', 'swarm', 'sniper', 'phantom', 
                    'bomber', 'interceptor', 'decoy', 'launcher', 'shielder', 'blade'];
        } else if (level >= 8) {
            return ['chaser', 'heavy', 'shooter', 'swarm', 'sniper', 'phantom', 
                    'bomber', 'interceptor', 'decoy', 'launcher', 'shielder'];
        } else if (level >= 6) {
            return ['chaser', 'heavy', 'shooter', 'swarm', 'sniper', 'phantom', 
                    'bomber', 'interceptor', 'decoy', 'launcher'];
        } else if (level >= 4) {
            return ['chaser', 'heavy', 'shooter', 'swarm', 
                    'bomber', 'interceptor', 'decoy'];
        } else if (level >= 3) {
            return ['chaser', 'heavy', 'shooter', 'bomber'];
        } else {
            return ['chaser', 'heavy', 'shooter'];
        }
    }

    selectEnemyTypeByProbability(typeRand, level, availableTypes) {
        // Progressive enemy unlock system with all 16 enemy types integrated
        if (level >= 21) {
            // LEVEL 21+ | All enemy types available with maximum variety
            if (typeRand > 0.96) return 'vortex';
            else if (typeRand > 0.92) return 'titan';
            else if (typeRand > 0.88) return 'wraith';
            else if (typeRand > 0.84) return 'mirror';
            else if (typeRand > 0.80) return 'tractor';
            else if (typeRand > 0.76) return 'blade';
            else if (typeRand > 0.72) return 'pulsar';
            else if (typeRand > 0.68) return 'shielder';
            else if (typeRand > 0.62) return 'swarmer';
            else if (typeRand > 0.56) return 'launcher';
            else if (typeRand > 0.50) return 'phantom';
            else if (typeRand > 0.44) return 'splitter';
            else if (typeRand > 0.38) return 'sniper';
            else if (typeRand > 0.30) return 'swarm';
            else if (typeRand > 0.20) return 'shooter';
            else if (typeRand > 0.10) return 'heavy';
            else return 'chaser';
        } else if (level >= 16) {
            // LEVEL 16-20 | Wraith and advanced new enemies
            if (typeRand > 0.92) return 'wraith';
            else if (typeRand > 0.88) return 'mirror';
            else if (typeRand > 0.84) return 'tractor';
            else if (typeRand > 0.80) return 'blade';
            else if (typeRand > 0.76) return 'swarmer';
            else if (typeRand > 0.72) return 'launcher';
            else if (typeRand > 0.68) return 'pulsar';
            else if (typeRand > 0.62) return 'splitter';
            else if (typeRand > 0.56) return 'sniper';
            else if (typeRand > 0.42) return 'swarm';
            else if (typeRand > 0.28) return 'shooter';
            else if (typeRand > 0.14) return 'heavy';
            else return 'chaser';
        } else if (level >= 14) {
            // LEVEL 14-15 | Swarmer emerges - coordinated squadron threat
            if (typeRand > 0.88) return 'swarmer';
            else if (typeRand > 0.84) return 'mirror';
            else if (typeRand > 0.80) return 'tractor';
            else if (typeRand > 0.76) return 'blade';
            else if (typeRand > 0.72) return 'launcher';
            else if (typeRand > 0.68) return 'phantom';
            else if (typeRand > 0.62) return 'titan';
            else if (typeRand > 0.56) return 'sniper';
            else if (typeRand > 0.42) return 'swarm';
            else if (typeRand > 0.28) return 'shooter';
            else if (typeRand > 0.14) return 'heavy';
            else return 'chaser';
        } else if (level >= 13) {
            // LEVEL 13 | Mirror appears - reflective threat
            if (typeRand > 0.86) return 'mirror';
            else if (typeRand > 0.82) return 'tractor';
            else if (typeRand > 0.78) return 'blade';
            else if (typeRand > 0.74) return 'launcher';
            else if (typeRand > 0.70) return 'pulsar';
            else if (typeRand > 0.66) return 'phantom';
            else if (typeRand > 0.60) return 'titan';
            else if (typeRand > 0.54) return 'sniper';
            else if (typeRand > 0.40) return 'swarm';
            else if (typeRand > 0.26) return 'shooter';
            else if (typeRand > 0.13) return 'heavy';
            else return 'chaser';
        } else if (level >= 12) {
            // LEVEL 12 | Tractor emerges - gravitational threat
            if (typeRand > 0.84) return 'tractor';
            else if (typeRand > 0.80) return 'blade';
            else if (typeRand > 0.76) return 'launcher';
            else if (typeRand > 0.72) return 'pulsar';
            else if (typeRand > 0.68) return 'phantom';
            else if (typeRand > 0.62) return 'titan';
            else if (typeRand > 0.54) return 'sniper';
            else if (typeRand > 0.40) return 'swarm';
            else if (typeRand > 0.26) return 'shooter';
            else if (typeRand > 0.13) return 'heavy';
            else return 'chaser';
        } else if (level >= 11) {
            // LEVEL 11 | Titan awakens - armored colossus threat
            if (typeRand > 0.84) return 'titan';
            else if (typeRand > 0.80) return 'blade';
            else if (typeRand > 0.76) return 'launcher';
            else if (typeRand > 0.72) return 'pulsar';
            else if (typeRand > 0.68) return 'phantom';
            else if (typeRand > 0.54) return 'sniper';
            else if (typeRand > 0.40) return 'swarm';
            else if (typeRand > 0.26) return 'shooter';
            else if (typeRand > 0.13) return 'heavy';
            else return 'chaser';
        } else if (level >= 10) {
            // LEVEL 10 | Blade emerges - melee slashing threat
            if (typeRand > 0.82) return 'blade';
            else if (typeRand > 0.78) return 'launcher';
            else if (typeRand > 0.74) return 'pulsar';
            else if (typeRand > 0.70) return 'phantom';
            else if (typeRand > 0.64) return 'shielder';
            else if (typeRand > 0.52) return 'sniper';
            else if (typeRand > 0.38) return 'swarm';
            else if (typeRand > 0.24) return 'shooter';
            else if (typeRand > 0.12) return 'heavy';
            else return 'chaser';
        } else if (level >= 9) {
            // LEVEL 9 | Pulsar emerges - energy wave threat
            if (typeRand > 0.80) return 'pulsar';
            else if (typeRand > 0.76) return 'launcher';
            else if (typeRand > 0.72) return 'phantom';
            else if (typeRand > 0.68) return 'shielder';
            else if (typeRand > 0.60) return 'sniper';
            else if (typeRand > 0.46) return 'swarm';
            else if (typeRand > 0.32) return 'shooter';
            else if (typeRand > 0.16) return 'heavy';
            else return 'chaser';
        } else if (level >= 8) {
            // LEVEL 8 | Shielder emerges - protected barrier threat
            if (typeRand > 0.78) return 'shielder';
            else if (typeRand > 0.74) return 'launcher';
            else if (typeRand > 0.70) return 'phantom';
            else if (typeRand > 0.62) return 'sniper';
            else if (typeRand > 0.48) return 'swarm';
            else if (typeRand > 0.34) return 'shooter';
            else if (typeRand > 0.17) return 'heavy';
            else return 'chaser';
        } else if (level >= 6) {
            // LEVEL 6-7 | Launcher appears - missile platform threat
            if (typeRand > 0.76) return 'launcher';
            else if (typeRand > 0.72) return 'phantom';
            else if (typeRand > 0.64) return 'sniper';
            else if (typeRand > 0.50) return 'swarm';
            else if (typeRand > 0.36) return 'shooter';
            else if (typeRand > 0.18) return 'heavy';
            else return 'chaser';
        } else if (level >= 5) {
            // LEVEL 5 | Decoy emerges - holographic clone threat
            if (typeRand > 0.74) return 'decoy';
            else if (typeRand > 0.70) return 'phantom';
            else if (typeRand > 0.62) return 'sniper';
            else if (typeRand > 0.50) return 'swarm';
            else if (typeRand > 0.36) return 'shooter';
            else if (typeRand > 0.18) return 'heavy';
            else return 'chaser';
        } else if (level >= 4) {
            // LEVEL 4 | Interceptor appears - speed threat
            if (typeRand > 0.72) return 'interceptor';
            else if (typeRand > 0.68) return 'phantom';
            else if (typeRand > 0.60) return 'sniper';
            else if (typeRand > 0.48) return 'swarm';
            else if (typeRand > 0.34) return 'shooter';
            else if (typeRand > 0.17) return 'heavy';
            else return 'chaser';
        } else if (level >= 3) {
            // LEVEL 3 | Bomber emerges - explosive threat
            if (typeRand > 0.70) return 'bomber';
            else if (typeRand > 0.66) return 'phantom';
            else if (typeRand > 0.58) return 'sniper';
            else if (typeRand > 0.46) return 'swarm';
            else if (typeRand > 0.32) return 'shooter';
            else if (typeRand > 0.16) return 'heavy';
            else return 'chaser';
        } else {
            // LEVEL 1-2 | Early game - basic enemies only
            if (typeRand > 0.70) return 'shooter';
            else if (typeRand > 0.40) return 'heavy';
            else return 'chaser';
        }
    }

    removeLowestHPEnemy() {
        if (this.enemies.length === 0) return;
        
        // Sort enemies by health (ascending) and remove the lowest HP enemy
        let lowestHPEnemy = this.enemies[0];
        let lowestIndex = 0;
        
        for (let i = 1; i < this.enemies.length; i++) {
            if (this.enemies[i].health < lowestHPEnemy.health) {
                lowestHPEnemy = this.enemies[i];
                lowestIndex = i;
            }
        }
        
        // Mark the lowest HP enemy for deletion
        lowestHPEnemy.markedForDeletion = true;
    }

    spawnPowerUp() {
        const types = ['speed', 'slowmo', 'invulnerability', 'health_recover', 'health_boost', 'shield', 'double_damage', 'rapid_fire'];
        const type = types[Math.floor(Math.random() * types.length)];
        this.powerups.push(new PowerUp(this, type));
    }

    spawnPowerUpAt(x, y) {
        const types = ['speed', 'slowmo', 'invulnerability', 'health_recover', 'shield', 'double_damage', 'rapid_fire'];
        const type = types[Math.floor(Math.random() * types.length)];
        this.powerups.push(new PowerUp(this, type, x, y));
    }

    checkCollisions() {
        if (this.gameOver || this.isWarping) return;

        const players = this.getPlayers();
        if (players.length === 0) return;

        this.enemies.forEach(enemy => {
            if (enemy.markedForDeletion) return;

            for (let i = 0; i < players.length; i += 1) {
                const player = players[i];
                const dx = enemy.x - player.x;
                const dy = enemy.y - player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < enemy.radius + player.radius) {
                    if (player.isInvulnerable()) {
                        this.handleEnemyDefeat(enemy, true);
                    } else {
                        const playerDied = player.takeDamage(1);
                        this.triggerImpact(0.1, 0.5);
                        this.hudFlashDamage();
                        if (playerDied) {
                            this.handleGameOver();
                        } else {
                            this.handleEnemyDefeat(enemy, false);
                        }
                    }
                    break;
                }
            }
        });

        // Boss Collision
        if (this.boss) {
            players.forEach(player => {
                if (player.isInvulnerable()) return;
                const dx = this.boss.x - player.x;
                const dy = this.boss.y - player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < this.boss.radius + player.radius) {
                    const died = player.takeDamage(1);
                    this.triggerImpact(0.15, 0.6);
                    this.hudFlashDamage();
                    if (died) this.handleGameOver();
                }
            });
        }
    }

    checkProjectileCollisions() {
        if (this.isWarping) return;

        this.projectiles.forEach(proj => {
            if (proj.markedForDeletion) return;

            // Player vs Enemies/Boss
            const isPlayerProjectile = proj.side === 'player' || (typeof proj.side === 'string' && proj.side.startsWith('player'));
            if (isPlayerProjectile) {
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
                                this.handleEnemyDefeat(enemy, true);
                            }
                        } else {
                            proj.markedForDeletion = true;
                            const dead = enemy.takeDamage(proj.damage);
                            if (dead) {
                                this.handleEnemyDefeat(enemy, true);
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
                const players = this.getPlayers();
                players.forEach(player => {
                    if (!player || player.isInvulnerable() || proj.markedForDeletion) return;
                    const dx = proj.x - player.x;
                    const dy = proj.y - player.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < player.radius + proj.radius) {
                        proj.markedForDeletion = true;
                        const died = player.takeDamage(proj.damage);
                        this.triggerImpact(0.1, 0.5);
                        this.hudFlashDamage();
                        if (died) this.handleGameOver();
                    }
                });
            }
        });
    }

    triggerExplosion(x, y, radius, damage) {
        // Visual explosion
        this.particles.push(new Explosion(this, x, y, '#ffaa00'));

        // Damage all enemies in range
        this.enemies.forEach(enemy => {
            const dx = enemy.x - x;
            const dy = enemy.y - y;
            const dist = Math.hypot(dx, dy);
            if (dist < radius + enemy.radius) {
                const dead = enemy.takeDamage(damage);
                if (dead) {
                    this.handleEnemyDefeat(enemy, true);
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
        if (this.gameOver) return;

        const players = this.getPlayers();
        if (players.length === 0) return;

        this.powerups.forEach(p => {
            if (p.markedForDeletion) return;
            for (let i = 0; i < players.length; i += 1) {
                const player = players[i];
                const dx = p.x - player.x;
                const dy = p.y - player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < p.radius + player.radius) {
                    player.applyPowerUp(p.type);
                    p.markedForDeletion = true;
                    this.screenShake.trigger(10, 0.1);
                    if (this.audio) this.audio.dash();
                    break;
                }
            }
        });
    }

    updateUI() {
        const scoreEl = document.getElementById('score-display');
        const levelEl = document.getElementById('level-display');
        const healthFill = document.getElementById('health-fill');
        const healthFillP2 = document.getElementById('health-fill-p2');

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



        }

        if (healthFillP2) {
            if (this.coopMode && this.playerTwo) {
                const pct = (this.playerTwo.currentHealth / this.playerTwo.maxHealth) * 100;
                healthFillP2.style.width = pct + '%';
            } else {
                healthFillP2.style.width = '0%';
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

        // Update Dash Cooldown Bar
        const dashFill = document.getElementById('dash-fill');
        if (dashFill && this.player) {
            const cooldownPct = Math.max(0, (this.player.dashCooldown - this.player.dashCooldownTimer) / this.player.dashCooldown) * 100;
            dashFill.style.width = (100 - cooldownPct) + '%';

            if (this.player.dashCooldownTimer <= 0) {
                dashFill.style.background = '#00ff00';
            } else {
                dashFill.style.background = 'linear-gradient(90deg, #33ccff, #0066ff)';
            }
        }

        // Update Enemy Counter

    }

    handleGameOver() {
        if (this.gameOver) return; // Prevent multiple calls
        this.gameOver = true;
        if (this.onlineCoop) {
            this.netplay.emit('player_died', { reason: 'hp_zero' });
        }
        // Do NOT set isRunning to false, so particles can animate

        // Calculate Coins (1 coin per 10 score)
        const earnedCoins = Math.floor(this.score / 10);
        this.coins += earnedCoins;
        localStorage.setItem('midnight_coins', this.coins);

        if (this.player) {
            this.particles.push(new Explosion(this, this.player.x, this.player.y, '#00f3ff'));
        }
        if (this.coopMode && this.playerTwo) {
            this.particles.push(new Explosion(this, this.playerTwo.x, this.playerTwo.y, '#33ff99'));
        }

        if (this.audio && this.audio.gameOver) {
            // Safe call
            try {
                this.audio.gameOver();
            } catch (e) {
            }
        }

        this.screenShake.trigger(50, 0.5);
        this.triggerGameOver(earnedCoins);
    }

    async triggerGameOver(earnedCoins) {
        const finalScoreEl = document.getElementById('final-score');
        if (finalScoreEl) finalScoreEl.innerText = this.score;
        const finalHighScoreEl = document.getElementById('final-high-score');
        if (finalHighScoreEl) finalHighScoreEl.innerText = this.highScore;

        // Show coins earned
        const coinsEarnedEl = document.getElementById('coins-earned-display');
        if (coinsEarnedEl) coinsEarnedEl.innerText = `+${earnedCoins} COINS`;

        // Submit score to leaderboard
        // In collaborative mode, only the host submits to prevent duplicate entries
        const shouldSubmit = !this.onlineCoop || this.onlineRole === 'host';
        if (shouldSubmit) {
            const teamMembers = this.coopMode ? this.collabTeamMembers : null;
            await this.leaderboard.submitScore(this.score, this.currentLevel, this.selectedShip, teamMembers);
        }

        // Hide boss HUD on termination screen
        const bossHud = document.getElementById('boss-hud');
        if (bossHud) bossHud.classList.remove('active');

        if (this.gameOverScreen) this.gameOverScreen.classList.add('active');
        if (this.hud) this.hud.style.display = 'none';
    }

    // Store System
    openStore() {
        this.fromPauseMenu = false;
        this.startScreen.classList.remove('active');
        document.getElementById('store-screen').classList.add('active');
        this.renderStore();
    }

    openStoreFromPause() {
        this.fromPauseMenu = true;
        document.getElementById('pause-menu').classList.remove('active');
        document.getElementById('store-screen').classList.add('active');
        this.renderStore();
    }

    closeStore() {
        document.getElementById('store-screen').classList.remove('active');
        if (this.fromPauseMenu) {
            // Return to pause menu
            document.getElementById('pause-menu').classList.add('active');
            
            // Ensure player is updated with selected ship if changed while paused
            if (this.isRunning && this.player && !this.gameOver) {
                if (this.player.shipType !== this.selectedShip) {
                    const oldX = this.player.x;
                    const oldY = this.player.y;
                    const oldHealth = this.player.currentHealth;
                    const oldPowerups = {
                        speedBoostTimer: this.player.speedBoostTimer,
                        doubleDamageTimer: this.player.doubleDamageTimer,
                        rapidFireTimer: this.player.rapidFireTimer,
                        invulnerabilityTimer: this.player.invulnerabilityTimer
                    };
                    
                    // Create new player with selected ship
                    this.player = new Player(this, this.selectedShip, { playerId: this.player.playerId || 'player1' });
                    
                    // Restore position and health (capped at new max)
                    this.player.x = oldX;
                    this.player.y = oldY;
                    this.player.currentHealth = Math.min(oldHealth, this.player.maxHealth);
                    
                    // Restore power-ups
                    this.player.speedBoostTimer = oldPowerups.speedBoostTimer;
                    this.player.doubleDamageTimer = oldPowerups.doubleDamageTimer;
                    this.player.rapidFireTimer = oldPowerups.rapidFireTimer;
                    this.player.invulnerabilityTimer = oldPowerups.invulnerabilityTimer;
                }
            }
            
            this.fromPauseMenu = false;
        } else {
            // Return to start screen
            this.startScreen.classList.add('active');
        }
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
            const dashStatus = ship.dash === false ? 'NO' : 'YES';
            stats.innerHTML = `
                HP: ${ship.hp}<br>
                SPD: ${ship.speed}<br>
                DMG: ${ship.damage}<br>
                DASH: ${dashStatus}<br>
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
            this.localShipType = type;

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
            this.localShipType = type;
            localStorage.setItem('midnight_selected_ship', this.selectedShip);
            if (this.audio) this.audio.dash(); // Select sound
            
            // Always update player if game is running, even if paused
            if (this.isRunning && this.player && !this.gameOver) {
                // Check if ship actually changed
                const oldShipType = this.player.shipType;
                if (oldShipType !== type) {
                    const oldX = this.player.x;
                    const oldY = this.player.y;
                    const oldHealth = this.player.currentHealth;
                    const oldPowerups = {
                        speedBoostTimer: this.player.speedBoostTimer,
                        doubleDamageTimer: this.player.doubleDamageTimer,
                        rapidFireTimer: this.player.rapidFireTimer,
                        invulnerabilityTimer: this.player.invulnerabilityTimer
                    };
                    
                    // Create new player with selected ship
                    this.player = new Player(this, this.selectedShip, { playerId: this.player.playerId || 'player1' });
                    
                    // Restore position and health (capped at new max)
                    this.player.x = oldX;
                    this.player.y = oldY;
                    this.player.currentHealth = Math.min(oldHealth, this.player.maxHealth);
                    
                    // Restore power-ups
                    this.player.speedBoostTimer = oldPowerups.speedBoostTimer;
                    this.player.doubleDamageTimer = oldPowerups.doubleDamageTimer;
                    this.player.rapidFireTimer = oldPowerups.rapidFireTimer;
                    this.player.invulnerabilityTimer = oldPowerups.invulnerabilityTimer;
                }
            }

            this.updatePlayerHudInfo();
            
            this.renderStore();
        }
    }
}
