// ═══════════════════════════════════════════════════════════════════
//  ACHIEVEMENT_DATA — 50 achievements tracking many stat dimensions
//  Special achievements unlock PRESTIGE jets (shipUnlock field)
// ═══════════════════════════════════════════════════════════════════

export const ACHIEVEMENT_DATA = [

    // ──────────────────── KILLS ────────────────────────────────────
    {
        id: 'first_blood', name: 'FIRST BLOOD', icon: '💀',
        desc: 'Destroy 50 enemies.',
        type: 'kills', target: 50, reward: 500
    },

    {
        id: 'exterminator', name: 'EXTERMINATOR', icon: '☠️',
        desc: 'Destroy 500 enemies.',
        type: 'kills', target: 500, reward: 2500
    },

    {
        id: 'massacre', name: 'MASSACRE', icon: '🔥',
        desc: 'Destroy 2,000 enemies.',
        type: 'kills', target: 2000, reward: 10000
    },

    {
        id: 'genocidal', name: 'GENOCIDAL ENGINE', icon: '💥',
        desc: 'Destroy 10,000 enemies.',
        type: 'kills', target: 10000, reward: 50000
    },

    {
        id: 'annihilator', name: 'ANNIHILATOR', icon: '🌋',
        desc: 'Destroy 25,000 enemies.',
        type: 'kills', target: 25000, reward: 100000
    },

    {
        id: 'god_of_war', name: 'GOD OF WAR', icon: '⚡',
        desc: 'Destroy 50,000 enemies.',
        type: 'kills', target: 50000, reward: 200000,
        shipUnlock: 'nemesis'
    },     // Unlocks NEMESIS

    // ──────────────────── BOSSES ───────────────────────────────────
    {
        id: 'boss_slayer', name: 'BOSS SLAYER', icon: '🎯',
        desc: 'Defeat your first Boss.',
        type: 'bosses', target: 1, reward: 1000
    },

    {
        id: 'boss_hunter', name: 'BOSS HUNTER', icon: '🗡️',
        desc: 'Defeat 10 Bosses.',
        type: 'bosses', target: 10, reward: 8000
    },

    {
        id: 'boss_destroyer', name: 'BOSS DESTROYER', icon: '🌟',
        desc: 'Defeat 50 Bosses.',
        type: 'bosses', target: 50, reward: 40000
    },

    {
        id: 'boss_executioner', name: 'BOSS EXECUTIONER', icon: '⚔️',
        desc: 'Defeat 100 Bosses.',
        type: 'bosses', target: 100, reward: 100000
    },

    {
        id: 'anomaly_killer', name: 'ANOMALY KILLER', icon: '🌌',
        desc: 'Defeat 200 Bosses. True endgame hunter.',
        type: 'bosses', target: 200, reward: 200000,
        shipUnlock: 'phantom_x'
    },  // Unlocks PHANTOM-X

    // ──────────────────── GAMES ────────────────────────────────────
    {
        id: 'first_sortie', name: 'FIRST SORTIE', icon: '🚀',
        desc: 'Play 1 game.',
        type: 'games', target: 1, reward: 200
    },

    {
        id: 'veteran', name: 'VETERAN PILOT', icon: '🛸',
        desc: 'Play 10 games.',
        type: 'games', target: 10, reward: 1500
    },

    {
        id: 'battle_worn', name: 'BATTLE WORN', icon: '⚔️',
        desc: 'Play 50 games.',
        type: 'games', target: 50, reward: 8000
    },

    {
        id: 'eternal_soldier', name: 'ETERNAL SOLDIER', icon: '🏹',
        desc: 'Play 200 games. Dedication defines you.',
        type: 'games', target: 200, reward: 40000
    },

    {
        id: 'war_machine', name: 'WAR MACHINE', icon: '🤖',
        desc: 'Play 500 games. You ARE the game.',
        type: 'games', target: 500, reward: 100000
    },

    // ──────────────────── DEATHS ───────────────────────────────────
    {
        id: 'die_hard', name: 'DIE HARD', icon: '💔',
        desc: 'Get shot down 20 times.',
        type: 'deaths', target: 20, reward: 800
    },

    {
        id: 'unkillable', name: 'UNKILLABLE', icon: '🛡️',
        desc: 'Get shot down 100 times — and keep coming back.',
        type: 'deaths', target: 100, reward: 5000
    },

    {
        id: 'phoenix_rise', name: 'PHOENIX RISING', icon: '🔄',
        desc: 'Get shot down 500 times. Undying spirit.',
        type: 'deaths', target: 500, reward: 30000
    },

    // ──────────────────── LEVELS ───────────────────────────────────
    {
        id: 'depth_charge', name: 'DEPTH CHARGE', icon: '🔢',
        desc: 'Survive to Wave 10 in a single run.',
        type: 'max_level', target: 10, reward: 2000
    },

    {
        id: 'deep_runner', name: 'DEEP RUNNER', icon: '🌊',
        desc: 'Survive to Wave 25 in a single run.',
        type: 'max_level', target: 25, reward: 12000
    },

    {
        id: 'infinite_war', name: 'INFINITE WAR', icon: '♾️',
        desc: 'Survive to Wave 50 in a single run.',
        type: 'max_level', target: 50, reward: 60000
    },

    {
        id: 'endless_void', name: 'ENDLESS VOID', icon: '🕳️',
        desc: 'Survive to Wave 75 in a single run.',
        type: 'max_level', target: 75, reward: 120000
    },

    {
        id: 'eternal_night', name: 'ETERNAL NIGHT', icon: '🌑',
        desc: 'Survive to Wave 100 in a single run.',
        type: 'max_level', target: 100, reward: 250000
    },

    // ──────────────────── SCORE ────────────────────────────────────
    {
        id: 'high_scorer', name: 'HIGH SCORER', icon: '🏆',
        desc: 'Score 50,000 in a single run.',
        type: 'best_score', target: 50000, reward: 5000
    },

    {
        id: 'elite_score', name: 'ELITE SCORE', icon: '💎',
        desc: 'Score 250,000 in a single run.',
        type: 'best_score', target: 250000, reward: 25000
    },

    {
        id: 'million_club', name: 'MILLION CLUB', icon: '💫',
        desc: 'Score 1,000,000 in a single run.',
        type: 'best_score', target: 1000000, reward: 80000
    },

    {
        id: 'legendary_score', name: 'REACH TO THE TOP', icon: '🌠',
        desc: 'Reach Ace Commander (Rank 10) or better.',
        type: 'global_rank', target: 10, reward: 150000,
        shipUnlock: 'celestial'
    },  // Unlocks CELESTIAL STRIKER

    // ──────────────────── POWERUPS ─────────────────────────────────
    {
        id: 'collector', name: 'COLLECTOR', icon: '⭐',
        desc: 'Collect 50 power-ups.',
        type: 'powerups', target: 50, reward: 1000
    },

    {
        id: 'power_addict', name: 'POWER ADDICT', icon: '🌀',
        desc: 'Collect 500 power-ups.',
        type: 'powerups', target: 500, reward: 8000
    },

    {
        id: 'power_god', name: 'POWER GOD', icon: '✨',
        desc: 'Collect 2,000 power-ups.',
        type: 'powerups', target: 2000, reward: 40000
    },

    // ──────────────────── MISSILES ─────────────────────────────────
    {
        id: 'rocket_man', name: 'ROCKET MAN', icon: '🚀',
        desc: 'Fire 500 missiles.',
        type: 'missiles', target: 500, reward: 2000
    },

    {
        id: 'devastator', name: 'DEVASTATOR', icon: '💣',
        desc: 'Fire 5,000 missiles.',
        type: 'missiles', target: 5000, reward: 15000
    },

    {
        id: 'arsenal_king', name: 'ARSENAL KING', icon: '🎆',
        desc: 'Fire 20,000 missiles.',
        type: 'missiles', target: 20000, reward: 60000
    },

    // ──────────────────── COINS ────────────────────────────────────
    {
        id: 'coin_earner', name: 'COIN EARNER', icon: '💰',
        desc: 'Earn a total of 10,000 coins.',
        type: 'total_coins', target: 10000, reward: 2000
    },

    {
        id: 'coin_baron', name: 'COIN BARON', icon: '👑',
        desc: 'Earn a total of 100,000 coins.',
        type: 'total_coins', target: 100000, reward: 15000
    },

    {
        id: 'coin_king', name: 'COIN KING', icon: '🏅',
        desc: 'Earn a total of 1,000,000 coins.',
        type: 'total_coins', target: 1000000, reward: 80000
    },

    {
        id: 'coin_emperor', name: 'COIN EMPEROR', icon: '💎',
        desc: 'Earn a total of 5,000,000 coins.',
        type: 'total_coins', target: 5000000, reward: 200000
    },

    // ──────────────────── DASHES ───────────────────────────────────
    {
        id: 'quick_step', name: 'QUICK STEP', icon: '💨',
        desc: 'Dash 100 times.',
        type: 'dashes', target: 100, reward: 1500
    },

    {
        id: 'flash_pilot', name: 'FLASH PILOT', icon: '⚡',
        desc: 'Dash 1,000 times.',
        type: 'dashes', target: 1000, reward: 12000
    },

    {
        id: 'phantom_dash', name: 'PHANTOM DASH', icon: '👻',
        desc: 'Dash 5,000 times. You blur reality.',
        type: 'dashes', target: 5000, reward: 50000
    },

    // ──────────────────── COMBOS ───────────────────────────────────
    {
        id: 'combo_starter', name: 'COMBO STARTER', icon: '🔗',
        desc: 'Get a 10 kill streak without taking damage.',
        type: 'max_killstreak', target: 10, reward: 2000
    },

    {
        id: 'combo_master', name: 'COMBO MASTER', icon: '🔥',
        desc: 'Get a 25 kill streak without taking damage.',
        type: 'max_killstreak', target: 25, reward: 15000
    },

    {
        id: 'combo_legend', name: 'COMBO LEGEND', icon: '💥',
        desc: 'Get a 50 kill streak without taking damage.',
        type: 'max_killstreak', target: 50, reward: 50000
    },

    {
        id: 'combo_god', name: 'COMBO GOD', icon: '🌟',
        desc: 'Get a 100 kill streak without taking damage.',
        type: 'max_killstreak', target: 100, reward: 150000
    },

    // ──────────────────── SURVIVAL ─────────────────────────────────
    {
        id: 'survivor', name: 'SURVIVOR', icon: '🏕️',
        desc: 'Play 100 games without giving up.',
        type: 'games', target: 100, reward: 20000
    },

    {
        id: 'sharpshooter', name: 'SHARPSHOOTER', icon: '🎯',
        desc: 'Fire 10,000 missiles. Trigger happy.',
        type: 'missiles', target: 10000, reward: 30000
    },

    {
        id: 'ironclad', name: 'IRONCLAD', icon: '🛡️',
        desc: 'Get shot down 250 times. Unbreakable will.',
        type: 'deaths', target: 250, reward: 15000
    },

    {
        id: 'legend_void', name: 'LEGEND OF THE VOID', icon: '🌠',
        desc: 'Score 500,000 in a single run.',
        type: 'best_score', target: 500000, reward: 50000
    },

    // ──────────────────── PRESTIGE UNLOCK ──────────────────────────
    {
        id: 'the_absolute', name: 'THE ABSOLUTE', icon: '🌌',
        desc: 'Complete ALL other achievements. True mastery.',
        type: 'all_achievements', target: 1, reward: 500000,
        shipUnlock: 'absolute'
    },  // Unlocks THE ABSOLUTE (final ship)
];

// ═══════════════════════════════════════════════════════════════════
//  AchievementManager
// ═══════════════════════════════════════════════════════════════════
export class AchievementManager {
    constructor(game) {
        this.game = game;

        // Load persist state — includes new stat dimensions
        this.stats = JSON.parse(localStorage.getItem('midnight_stats')) || {
            kills: 0,
            bosses: 0,
            games: 0,
            deaths: 0,
            max_level: 0,
            best_score: 0,
            powerups: 0,
            missiles: 0,
            total_coins: 0,
            all_achievements: 0,
            global_rank: 999999,
            dashes: 0,
            max_combo: 0,
            max_killstreak: 0,
        };
        this.claimed = JSON.parse(localStorage.getItem('midnight_claimed_achievements')) || [];
        this.completedButUnclaimed = JSON.parse(localStorage.getItem('midnight_unclaimed_achievements')) || [];

        this.toastEl = document.getElementById('achievement-toast');
        this.toastNameEl = document.getElementById('toast-name');

        this.menuBtn = document.getElementById('achievements-menu-btn');
        this.screenEl = document.getElementById('achievements-screen');
        this.backBtn = document.getElementById('back-from-achievements-btn');
        this.listEl = document.getElementById('achievement-list');
        this.coinsDisplay = document.getElementById('coins-display-achievements');
        this.notifDot = document.getElementById('achievement-notification-dot');

        this.initUI();
        this.updateNotificationState();
    }

    initUI() {
        if (this.menuBtn) {
            this.menuBtn.addEventListener('click', () => {
                document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
                this.screenEl.classList.add('active');
                this.renderList();
                this.updateCoinsDisplay();
            });
        }

        if (this.backBtn) {
            this.backBtn.addEventListener('click', () => {
                this.screenEl.classList.remove('active');
                document.getElementById('start-screen').classList.add('active');
                this.updateNotificationState();
            });
        }
    }

    updateNotificationState() {
        if (!this.notifDot) return;
        const count = this.completedButUnclaimed.length;
        if (count > 0) {
            this.notifDot.classList.remove('hidden');
        } else {
            this.notifDot.classList.add('hidden');
        }
    }

    save() {
        localStorage.setItem('midnight_stats', JSON.stringify(this.stats));
        localStorage.setItem('midnight_claimed_achievements', JSON.stringify(this.claimed));
        localStorage.setItem('midnight_unclaimed_achievements', JSON.stringify(this.completedButUnclaimed));
    }

    addStat(type, amount) {
        if (this.stats[type] === undefined) this.stats[type] = 0;
        this.stats[type] += amount;
        this.save();
        this.checkUnlocks(type);

        // Track total coins earned
        if (type === 'coins_earned') {
            this.stats['total_coins'] = (this.stats['total_coins'] || 0) + amount;
            this.checkUnlocks('total_coins');
        }
    }

    updateGlobalRank(rank) {
        if (!rank || rank < 1) return;
        this.stats['global_rank'] = rank;
        this.save();
        this.checkUnlocks('global_rank');
    }

    updateMaxLevel(level) {
        if (level > (this.stats['max_level'] || 0)) {
            this.stats['max_level'] = level;
            this.save();
            this.checkUnlocks('max_level');
        }
    }

    updateBestScore(score) {
        if (score > (this.stats['best_score'] || 0)) {
            this.stats['best_score'] = score;
            this.save();
            this.checkUnlocks('best_score');
        }
    }

    updateMaxCombo(combo) {
        if (combo > (this.stats['max_combo'] || 0)) {
            this.stats['max_combo'] = combo;
            this.save();
            this.checkUnlocks('max_combo');
        }
    }

    updateMaxKillstreak(streak) {
        if (streak > (this.stats['max_killstreak'] || 0)) {
            this.stats['max_killstreak'] = streak;
            this.save();
            this.checkUnlocks('max_killstreak');
        }
    }

    checkUnlocks(type) {
        const relevant = ACHIEVEMENT_DATA.filter(a => a.type === type);

        relevant.forEach(ach => {
            if (this.claimed.includes(ach.id) || this.completedButUnclaimed.includes(ach.id)) return;

            if (type === 'global_rank') {
                // For rank, LOWER is better
                if (this.stats[type] <= ach.target) {
                    this.unlock(ach);
                }
            } else {
                if (this.stats[type] >= ach.target) {
                    this.unlock(ach);
                }
            }
        });
    }

    // Check if ALL normal achievements are done (for 'the_absolute')
    checkAllAchievements() {
        const excluding = ['the_absolute'];
        const allDone = ACHIEVEMENT_DATA
            .filter(a => !excluding.includes(a.id))
            .every(a => this.claimed.includes(a.id) || this.completedButUnclaimed.includes(a.id));

        if (allDone && !this.claimed.includes('the_absolute') && !this.completedButUnclaimed.includes('the_absolute')) {
            const ach = ACHIEVEMENT_DATA.find(a => a.id === 'the_absolute');
            if (ach) {
                this.stats['all_achievements'] = 1;
                this.save();
                this.unlock(ach);
            }
        }
    }

    unlock(ach) {
        this.completedButUnclaimed.push(ach.id);
        this.save();
        this.showToast(ach.name, ach.icon);
        this.updateNotificationState();

        // If this achievement unlocks a ship, add it to ownedShips
        if (ach.shipUnlock) {
            const owned = JSON.parse(localStorage.getItem('midnight_owned_ships')) || ['default'];
            if (!owned.includes(ach.shipUnlock)) {
                owned.push(ach.shipUnlock);
                localStorage.setItem('midnight_owned_ships', JSON.stringify(owned));
                // Sync to live game if running
                if (this.game && this.game.ownedShips && !this.game.ownedShips.includes(ach.shipUnlock)) {
                    this.game.ownedShips.push(ach.shipUnlock);
                }
            }
        }

        // Check if all others done after any unlock
        setTimeout(() => this.checkAllAchievements(), 100);
    }

    showToast(name, icon = '🏆') {
        if (!this.toastEl) return;

        const iconEl = this.toastEl.querySelector('.toast-icon');
        if (iconEl) iconEl.textContent = icon;
        if (this.toastNameEl) this.toastNameEl.textContent = name;

        this.toastEl.classList.remove('hidden', 'fade-out');
        void this.toastEl.offsetWidth;

        setTimeout(() => {
            this.toastEl.classList.add('fade-out');
            setTimeout(() => this.toastEl.classList.add('hidden'), 500);
        }, 4000);
    }

    claim(achId) {
        if (!this.completedButUnclaimed.includes(achId)) return;
        if (this.claimed.includes(achId)) return;

        const ach = ACHIEVEMENT_DATA.find(a => a.id === achId);
        if (!ach) return;

        this.game.coins += ach.reward;
        this.stats['total_coins'] = (this.stats['total_coins'] || 0) + ach.reward;
        localStorage.setItem('midnight_coins', this.game.coins);

        this.completedButUnclaimed = this.completedButUnclaimed.filter(id => id !== achId);
        this.claimed.push(achId);
        this.save();

        this.updateCoinsDisplay();
        this.renderList();
        this.updateNotificationState();
    }

    updateCoinsDisplay() {
        if (this.coinsDisplay) this.coinsDisplay.textContent = `COINS: ${this.game.coins}`;
        const s = document.getElementById('coins-display-store');
        if (s) s.textContent = `COINS: ${this.game.coins}`;
        const m = document.getElementById('total-coins-display');
        if (m) m.textContent = `COINS: ${this.game.coins}`;
    }

    // Check if a prestige ship's achievement has been completed
    isShipUnlocked(shipKey) {
        const ach = ACHIEVEMENT_DATA.find(a => a.shipUnlock === shipKey);
        if (!ach) return true; // Not an achievement-locked ship
        return this.claimed.includes(ach.id) || this.completedButUnclaimed.includes(ach.id);
    }

    // Render achievement list with categories
    renderList() {
        if (!this.listEl) return;
        this.listEl.innerHTML = '';

        const claimedCount = this.claimed.length;
        const total = ACHIEVEMENT_DATA.length;

        // Header progress
        const header = document.createElement('div');
        header.className = 'achievement-header';
        header.innerHTML = `
            <div class="achievement-global-progress">
                <span class="ach-global-label">COMPLETION: ${claimedCount} / ${total}</span>
                <div class="achievement-progress-bg" style="height:8px; margin-top:6px;">
                    <div class="achievement-progress-fill" style="width:${(claimedCount / total * 100).toFixed(1)}%;"></div>
                </div>
            </div>
        `;
        this.listEl.appendChild(header);

        ACHIEVEMENT_DATA.forEach(ach => {
            const isClaimed = this.claimed.includes(ach.id);
            const isCompleted = this.completedButUnclaimed.includes(ach.id);
            const currentProgress = (ach.type === 'all_achievements')
                ? (isCompleted || isClaimed ? 1 : 0)
                : Math.min(this.stats[ach.type] || 0, ach.target);
            const progressPercent = (currentProgress / ach.target) * 100;

            const card = document.createElement('div');
            card.className = `achievement-card ${isCompleted ? 'completed' : ''} ${isClaimed ? 'claimed' : ''}`;

            let buttonHtml = '';
            if (isClaimed) {
                buttonHtml = `<div class="ach-claimed-label">✓ CLAIMED</div>`;
            } else if (isCompleted) {
                buttonHtml = `<button class="claim-btn" data-id="${ach.id}">CLAIM ${ach.reward.toLocaleString()} ⬡</button>`;
            } else {
                buttonHtml = `<div class="ach-locked-label">LOCKED</div>`;
            }

            const shipBadge = ach.shipUnlock
                ? `<div class="ach-ship-unlock">🚀 UNLOCKS: ${ach.shipUnlock.toUpperCase().replace('_', ' ')}</div>`
                : '';

            card.innerHTML = `
                <div class="ach-icon">${ach.icon}</div>
                <div class="ach-body">
                    <div class="achievement-title">${ach.name}</div>
                    <div class="achievement-desc">${ach.desc}</div>
                    ${shipBadge}
                    <div class="achievement-text">${currentProgress.toLocaleString()} / ${ach.target.toLocaleString()}</div>
                    <div class="achievement-progress-bg">
                        <div class="achievement-progress-fill" style="width: ${progressPercent}%;"></div>
                    </div>
                </div>
                <div class="ach-action">
                    ${buttonHtml}
                </div>
            `;

            this.listEl.appendChild(card);
        });

        // Claim button listeners
        this.listEl.querySelectorAll('.claim-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                const id = e.target.getAttribute('data-id');
                this.claim(id);
            });
        });
    }
}
