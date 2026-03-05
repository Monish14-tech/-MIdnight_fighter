export const ACHIEVEMENT_DATA = [
    { id: 'first_blood', name: 'FIRST BLOOD', desc: 'Destroy 50 total enemies.', type: 'kills', target: 50, reward: 5000 },
    { id: 'exterminator', name: 'EXTERMINATOR', desc: 'Destroy 500 total enemies.', type: 'kills', target: 500, reward: 25000 },
    { id: 'boss_slayer', name: 'BOSS SLAYER', desc: 'Defeat your first Boss.', type: 'bosses', target: 1, reward: 10000 },
    { id: 'boss_hunter', name: 'BOSS HUNTER', desc: 'Defeat 10 total Bosses.', type: 'bosses', target: 10, reward: 50000 },
    { id: 'veteran', name: 'VETERAN PILOT', desc: 'Play 5 total games.', type: 'games', target: 5, reward: 15000 },
    { id: 'die_hard', name: 'DIE HARD', desc: 'Die 20 times.', type: 'deaths', target: 20, reward: 10000 },
];

export class AchievementManager {
    constructor(game) {
        this.game = game;

        // Load persist state
        this.stats = JSON.parse(localStorage.getItem('midnight_stats')) || {
            kills: 0,
            bosses: 0,
            games: 0,
            deaths: 0
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

        this.initUI();
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
            });
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
    }

    checkUnlocks(type) {
        const relevant = ACHIEVEMENT_DATA.filter(a => a.type === type);

        relevant.forEach(ach => {
            // If already completed or claimed, skip
            if (this.claimed.includes(ach.id) || this.completedButUnclaimed.includes(ach.id)) return;

            // Check if threshold met
            if (this.stats[type] >= ach.target) {
                this.unlock(ach);
            }
        });
    }

    unlock(ach) {
        this.completedButUnclaimed.push(ach.id);
        this.save();
        this.showToast(ach.name);
    }

    showToast(name) {
        if (!this.toastEl) return;

        this.toastNameEl.textContent = name;
        this.toastEl.classList.remove('hidden', 'fade-out');

        // Reset animation by triggering reflow
        void this.toastEl.offsetWidth;

        setTimeout(() => {
            this.toastEl.classList.add('fade-out');
            setTimeout(() => {
                this.toastEl.classList.add('hidden');
            }, 500); // Wait for fade out animation
        }, 4000); // Show for 4 seconds
    }

    claim(achId) {
        if (!this.completedButUnclaimed.includes(achId)) return;
        if (this.claimed.includes(achId)) return;

        const ach = ACHIEVEMENT_DATA.find(a => a.id === achId);
        if (!ach) return;

        // Give reward
        this.game.coins += ach.reward;
        localStorage.setItem('midnight_coins', this.game.coins);

        // Mark as claimed
        this.completedButUnclaimed = this.completedButUnclaimed.filter(id => id !== achId);
        this.claimed.push(achId);
        this.save();

        this.updateCoinsDisplay();
        this.renderList();
    }

    updateCoinsDisplay() {
        if (this.coinsDisplay) {
            this.coinsDisplay.textContent = `COINS: ${this.game.coins}`;
        }
        const storeCoins = document.getElementById('coins-display-store');
        if (storeCoins) {
            storeCoins.textContent = `COINS: ${this.game.coins}`;
        }
        const mainCoins = document.getElementById('total-coins-display');
        if (mainCoins) {
            mainCoins.textContent = `COINS: ${this.game.coins}`;
        }
    }

    renderList() {
        if (!this.listEl) return;
        this.listEl.innerHTML = '';

        ACHIEVEMENT_DATA.forEach(ach => {
            const isClaimed = this.claimed.includes(ach.id);
            const isCompleted = this.completedButUnclaimed.includes(ach.id);
            const currentProgress = Math.min(this.stats[ach.type] || 0, ach.target);
            const progressPercent = (currentProgress / ach.target) * 100;

            const card = document.createElement('div');
            card.className = `achievement-card ${isCompleted ? 'completed' : ''} ${isClaimed ? 'claimed' : ''}`;

            let buttonHtml = '';
            if (isClaimed) {
                buttonHtml = `<div style="text-align:center; color: #555;">CLAIMED</div>`;
            } else if (isCompleted) {
                buttonHtml = `<button class="claim-btn" data-id="${ach.id}">CLAIM</button>`;
            } else {
                buttonHtml = `<div style="text-align:center; color: #555;">LOCKED</div>`;
            }

            card.innerHTML = `
                <div>
                    <div class="achievement-title">${ach.name}</div>
                    <div class="achievement-desc">${ach.desc}</div>
                    <div class="achievement-reward">REWARD: ${ach.reward} COINS</div>
                    
                    <div class="achievement-text">${currentProgress} / ${ach.target}</div>
                    <div class="achievement-progress-bg">
                        <div class="achievement-progress-fill" style="width: ${progressPercent}%;"></div>
                    </div>
                </div>
                <div style="margin-top: 15px;">
                    ${buttonHtml}
                </div>
            `;

            this.listEl.appendChild(card);
        });

        // Attach listeners to newly created claim buttons
        this.listEl.querySelectorAll('.claim-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                this.claim(id);
            });
        });
    }
}
