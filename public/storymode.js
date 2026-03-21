// ═══════════════════════════════════════════════════════════════════
//  StoryMode Manager
//  Handles: intro cinematic, 25-level campaign, boss gauntlet (levels
//  26-30 = 5 sequential bosses), player upgrade, victory sequence.
// ═══════════════════════════════════════════════════════════════════

export class StoryMode {
    constructor(game) {
        this.game = game;

        // Phase tracking
        this.phase = 'intro';        // 'intro' | 'campaign' | 'gauntlet' | 'victory' | 'defeat'
        this.gauntletStarted = false;
        this.gauntletBossIndex = 0;  // 0-4, which of the 5 boss types
        this.gauntletDefeated = 0;   // how many gauntlet bosses killed
        this.playerUpgraded = false;
        this.victoryShown = false;

        // Story text lines for intro
        this.introLines = [
            'An unknown entity has colonized our home...',
            '...the void we once loved is now a graveyard.',
            'Those who stood against them...',
            '...were slaughtered without mercy.',
            'Now, we who survive hide in the deepest shadows.',
            'Our hope is a fragile, fading ember.',
            'Will you be the spark to ignite it?',
            'Pilot... you are our final hope.',
            'Bring us freedom.',
            'Save us... Save the void.'
        ];

        // Victory text lines
        this.victoryLines = [
            'You defeated all the anomalies...',
            '...and proclaimed yourself as the Guardian of the Galaxy.',
            'The void bows down to your bravery.',
            '★ GUARDIAN OF THE GALAXY ★'
        ];

        // Defeat text
        this.defeatMessage = 'The void remains in chains... try again, hero.';

        // Active story playback handles
        this.currentTypeInterval = null;
        this.currentPauseTimeout = null;
    }

    // ── Intro Cinematic ──────────────────────────────────────────
    startIntro() {
        this.phase = 'intro';
        this.isSkipping = false;
        this._cancelStoryPlayback();
        this._createIntroOverlay();
        this._playLines(this.introLines, 0, () => {
            if (this.isSkipping) return;
            this._fadeOutOverlay('story-intro-overlay', () => {
                this.phase = 'campaign';
                this.game.resumeFromStoryIntro();
            });
        });
    }

    _createIntroOverlay() {
        let overlay = document.getElementById('story-intro-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'story-intro-overlay';
            document.body.appendChild(overlay);
        }
        overlay.innerHTML = `
            <div id="story-intro-text" class="story-intro-text"></div>
            <button id="story-skip-btn" class="neon-btn story-skip-btn">SKIP &gt;&gt;</button>
        `;
        overlay.classList.remove('hidden', 'fade-out');
        overlay.style.opacity = '1';

        const skipBtn = document.getElementById('story-skip-btn');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => {
                if (this.isSkipping) return;
                this.isSkipping = true;
                this._cancelStoryPlayback();
                
                // Force finish intro
                this._fadeOutOverlay('story-intro-overlay', () => {
                    this.phase = 'campaign';
                    this.game.resumeFromStoryIntro();
                });
            });
            // Support touch
            skipBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                skipBtn.click();
            }, { passive: false });
        }
    }

    _cancelStoryPlayback() {
        if (this.currentTypeInterval) {
            clearInterval(this.currentTypeInterval);
            this.currentTypeInterval = null;
        }
        if (this.currentPauseTimeout) {
            clearTimeout(this.currentPauseTimeout);
            this.currentPauseTimeout = null;
        }
    }

    _playLines(lines, index, onComplete, textElementId = 'story-intro-text') {
        if (this.isSkipping) return;
        
        if (index >= lines.length) {
            // All lines done — wait 1.5s then call onComplete
            this.currentPauseTimeout = setTimeout(onComplete, 1500);
            return;
        }

        const textEl = document.getElementById(textElementId);
        if (!textEl) { onComplete(); return; }

        // Clear and type the current line
        textEl.textContent = '';
        const line = lines[index];
        let charIndex = 0;

        // Type character by character
        this.currentTypeInterval = setInterval(() => {
            if (this.isSkipping) {
                clearInterval(this.currentTypeInterval);
                return;
            }
            if (charIndex < line.length) {
                textEl.textContent += line[charIndex];
                charIndex++;
            } else {
                clearInterval(this.currentTypeInterval);
                // Pause for 2s between lines
                this.currentPauseTimeout = setTimeout(() => {
                    this._playLines(lines, index + 1, onComplete, textElementId);
                }, 2200);
            }
        }, 55); // ~55ms per character
    }

    _fadeOutOverlay(id, callback) {
        const overlay = document.getElementById(id);
        if (!overlay) { callback(); return; }
        overlay.classList.add('fade-out');
        setTimeout(() => {
            overlay.style.display = 'none';
            if (callback) callback();
        }, 1000);
    }

    // ── Campaign Hooks ─────────────────────────────────────────
    onLevelComplete(level) {
        if (this.phase !== 'campaign') return;

        // Achievement: first chapter
        if (level === 1) {
            this._triggerAchievement('story_chapter_one');
        }
        // Achievement: halfway
        if (level === 13) {
            this._triggerAchievement('story_halfway');
        }
    }

    onBossDefeated() {
        if (this.phase === 'campaign') {
            this._triggerAchievement('story_first_boss');
        } else if (this.phase === 'gauntlet') {
            this.gauntletDefeated++;
            this.game.achievementManager && this.game.achievementManager.addStat('story_bosses_defeated', 1);

            if (this.gauntletDefeated >= 5) {
                // All 5 defeated — victory!
                setTimeout(() => this.startVictory(), 1500);
            } else {
                // Spawn next boss after a short pause
                setTimeout(() => this.spawnNextGauntletBoss(), 2000);
            }
        }
    }

    // ── Gauntlet Phase ─────────────────────────────────────────
    startGauntlet() {
        if (this.gauntletStarted) return;
        this.gauntletStarted = true;
        this.phase = 'gauntlet';
        this.gauntletBossIndex = 0;
        this.gauntletDefeated = 0;
        this.game.storyGauntletStarted = true;

        // Clear any remaining enemies
        this.game.enemies.forEach(e => e.markedForDeletion = true);
        this.game.enemies = [];

        this._triggerAchievement('story_gauntlet');

        // Show the "Entering Boss Area" overlay
        this._showGauntletEntry(() => {
            // Upgrade player ship
            this._upgradePlayer();
            // Spawn first gauntlet boss
            setTimeout(() => this.spawnNextGauntletBoss(), 1000);
        });
    }

    _showGauntletEntry(callback) {
        const div = document.createElement('div');
        div.id = 'story-gauntlet-entry';
        div.className = 'story-gauntlet-entry';
        div.innerHTML = `
            <div class="gauntlet-title">⚠ ENTERING BOSS AREA ⚠</div>
            <div class="gauntlet-subtitle">Brace yourself, pilot. All anomalies ahead.</div>
            <div class="gauntlet-upgrade">★ SHIP SYSTEMS UPGRADED ★</div>
        `;
        document.body.appendChild(div);

        // Play audio alert
        if (this.game.audio) this.game.audio.playTrack('boss');

        setTimeout(() => {
            div.classList.add('fade-out');
            setTimeout(() => { div.remove(); callback(); }, 1000);
        }, 3000);
    }

    _upgradePlayer() {
        if (!this.game.player || this.playerUpgraded) return;
        this.playerUpgraded = true;

        const p = this.game.player;
        // Buff: +50% max HP, restore full HP, +30% damage, +10% speed
        p.maxHealth = Math.ceil(p.maxHealth * 1.5);
        p.health = p.maxHealth;
        p.bulletDamage = Math.ceil((p.bulletDamage || 1) * 1.3);
        p.speed = Math.ceil((p.speed || 450) * 1.1);

        // Visual glow flash
        p.upgradeGlow = 3.0; // seconds of glow

        // Show upgrade toast
        const toast = document.createElement('div');
        toast.className = 'story-upgrade-toast';
        toast.textContent = '⚡ SHIP UPGRADED — MAXIMUM POWER ⚡';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    spawnNextGauntletBoss() {
        if (this.gauntletDefeated >= 5) return;

        const modelIndex = this.gauntletDefeated; // 0, 1, 2, 3, 4
        const bossNames = [
            'ANOMALY: V-STRIKE',
            'ANOMALY: THE FORTRESS',
            'ANOMALY: THE APEX',
            'ANOMALY: SHADOW REAPER',
            'ANOMALY: VOID CARRIER'
        ];

        import('./entities/boss.js?v=4').then(m => {
            const sides = ['top', 'left', 'right'];
            const side = sides[modelIndex % sides.length];

            const BossClass = m.default || m.Boss;
            // Gauntlet bosses are harder: use level 20 base stats
            const gauntletLevel = 20 + this.gauntletDefeated * 5;
            this.game.boss = new BossClass(this.game, gauntletLevel, side, modelIndex);

            // Show boss HUD
            const bossHud = document.getElementById('boss-hud');
            if (bossHud) bossHud.classList.add('active');
            const enemyCounter = document.getElementById('enemy-counter');
            if (enemyCounter) enemyCounter.style.display = 'none';

            const name = `[${this.gauntletDefeated + 1}/5] ${bossNames[modelIndex]}`;
            const bossName = document.getElementById('boss-name');
            if (bossName) {
                bossName.dataset.baseName = name;
                bossName.innerText = name;
            }
            this.game.updateBossUI && this.game.updateBossUI();
            this.game.boss.remoteId = 'boss_gauntlet_' + modelIndex;

            // Show boss entry alert
            this.game.showBossAlert && this.game.showBossAlert(
                `BOSS ${this.gauntletDefeated + 1} / 5`,
                bossNames[modelIndex]
            );
        });
    }

    // ── Victory Sequence ───────────────────────────────────────
    startVictory() {
        if (this.victoryShown) return;
        this.victoryShown = true;
        this.phase = 'victory';
        this.isSkipping = false;
        this._cancelStoryPlayback();

        this._triggerAchievement('story_complete');
        this.game.achievementManager && this.game.achievementManager.addStat('story_completed', 1);

        // Pause the game
        this.game.isPaused = true;

        // Show victory overlay
        const overlay = document.createElement('div');
        overlay.id = 'story-victory-overlay';
        document.body.appendChild(overlay);

        const textEl = document.createElement('div');
        textEl.id = 'story-victory-text';
        textEl.className = 'story-intro-text story-victory-text';
        overlay.appendChild(textEl);

        const skipBtn = document.createElement('button');
        skipBtn.id = 'story-victory-skip-btn';
        skipBtn.className = 'neon-btn story-skip-btn';
        skipBtn.innerHTML = 'SKIP &gt;&gt;';
        overlay.appendChild(skipBtn);

        const showVictoryButtons = () => {
            this._cancelStoryPlayback();
            skipBtn.remove();

            // Show buttons after text
            const btnContainer = document.createElement('div');
            btnContainer.className = 'story-victory-buttons';
            btnContainer.innerHTML = `
                <button id="story-play-again-btn" class="neon-btn">PLAY AGAIN</button>
                <button id="story-menu-btn" class="neon-btn">MAIN MENU</button>
            `;
            overlay.appendChild(btnContainer);

            document.getElementById('story-play-again-btn')?.addEventListener('click', () => {
                overlay.remove();
                this.game.storyMode = false;
                this.game.startGame && this.game.startGame();
            });
            document.getElementById('story-menu-btn')?.addEventListener('click', () => {
                overlay.remove();
                this.game.returnToMenu && this.game.returnToMenu();
            });
        };

        skipBtn.addEventListener('click', () => {
            if (this.isSkipping) return;
            this.isSkipping = true;
            showVictoryButtons();
        });
        skipBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            skipBtn.click();
        }, { passive: false });

        // Type victory lines
        this._playLines(this.victoryLines, 0, () => {
            this.isSkipping = false;
            showVictoryButtons();
        }, 'story-victory-text');
    }

    // ── Defeat ─────────────────────────────────────────────────
    onDefeat() {
        this.phase = 'defeat';
        // Shown via game's regular game-over screen with a custom subtitle
        const subtitleEl = document.getElementById('game-over-subtitle');
        if (subtitleEl) subtitleEl.textContent = this.defeatMessage;
    }

    // ── Helpers ────────────────────────────────────────────────
    _triggerAchievement(id) {
        if (!this.game.achievementManager) return;
        const am = this.game.achievementManager;
        // Directly force-check these custom story achievements
        const ach = am.stats;
        if (!am.claimed.includes(id) && !am.completedButUnclaimed.includes(id)) {
            const achievementData = (am.constructor.STORY_ACHIEVEMENTS || STORY_ACHIEVEMENT_DATA).find(a => a.id === id);
            if (achievementData) {
                am.unlock(achievementData);
            }
        }
    }

    // Campaign HUD: enemies remaining
    getEnemiesRemaining() {
        return Math.max(0, this.game.enemiesForLevel - this.game.enemiesDefeated);
    }

    isComplete() {
        return this.phase === 'victory';
    }
}

// Story Mode specific achievements (exported for use in achievements.js)
export const STORY_ACHIEVEMENT_DATA = [
    {
        id: 'story_chapter_one', name: 'FIRST CHAPTER', icon: '📖',
        desc: 'Complete the first level of Story Mode.',
        type: 'story_chapter_one', target: 1, reward: 1000
    },
    {
        id: 'story_halfway', name: 'HALFWAY THERE', icon: '🌗',
        desc: 'Reach Level 13 in Story Mode.',
        type: 'story_halfway', target: 1, reward: 3000
    },
    {
        id: 'story_first_boss', name: 'BOSS SLAIN', icon: '⚔️',
        desc: 'Defeat your first Story Mode boss.',
        type: 'story_first_boss', target: 1, reward: 2000
    },
    {
        id: 'story_gauntlet', name: 'INTO THE GAUNTLET', icon: '🔥',
        desc: 'Enter the Final Boss Gauntlet in Story Mode.',
        type: 'story_gauntlet', target: 1, reward: 5000
    },
    {
        id: 'story_complete', name: 'GUARDIAN OF THE GALAXY', icon: '🌌',
        desc: 'Defeat all 5 anomaly bosses and complete Story Mode.',
        type: 'story_complete', target: 1, reward: 20000
    }
];
