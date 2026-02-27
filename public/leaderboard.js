// Leaderboard API Manager
export class LeaderboardManager {
    constructor() {
        this.apiUrl = `${window.location.origin}/api`;
        this.playerName = localStorage.getItem('midnight_player_name') || null;
    }

    // Set player name
    setPlayerName(name) {
        this.playerName = name;
        localStorage.setItem('midnight_player_name', name);
    }

    // Get player name
    getPlayerName() {
        return this.playerName;
    }

    // Fetch leaderboard
    async fetchLeaderboard(limit = 10) {
        try {
            const response = await fetch(`${this.apiUrl}/leaderboard?limit=${limit}`);
            const data = await response.json();
            
            if (data.success) {
                return data.data;
            } else {
                return [];
            }
        } catch (error) {
            return [];
        }
    }

    // Submit score
    async submitScore(score, level, shipType) {
        if (!this.playerName) {
            return null;
        }

        try {
            const response = await fetch(`${this.apiUrl}/score`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    playerName: this.playerName,
                    score,
                    level,
                    shipType
                })
            });

            const data = await response.json();
            
            if (data.success) {
                return data;
            } else {
                return null;
            }
        } catch (error) {
            return null;
        }
    }

    // Get player stats
    async getPlayerStats(playerName) {
        try {
            const response = await fetch(`${this.apiUrl}/player/${playerName}`);
            const data = await response.json();
            
            if (data.success) {
                return data.data;
            } else {
                return null;
            }
        } catch (error) {
            return null;
        }
    }

    // Display leaderboard in UI
    async displayLeaderboard() {
        const container = document.getElementById('leaderboard-list');
        
        if (!container) return;

        // Show loading message
        container.innerHTML = '<div class="leaderboard-empty">Loading...</div>';
        
        const leaderboard = await this.fetchLeaderboard(10);

        if (leaderboard.length === 0) {
            container.innerHTML = '<div class="leaderboard-empty">No scores yet. Be the first!<br><small style="margin-top: 10px; display: block;">Make sure you enter the pilot name</small></div>';
            return;
        }

        container.innerHTML = '';
        
        leaderboard.forEach((entry, index) => {
            const rank = index + 1;
            const entryDiv = document.createElement('div');
            entryDiv.className = 'leaderboard-entry';
            
            // Highlight current player
            if (entry.playerName === this.playerName) {
                entryDiv.classList.add('current-player');
            }
            
            // Special styles for top 3
            if (rank === 1) entryDiv.classList.add('rank-1');
            else if (rank === 2) entryDiv.classList.add('rank-2');
            else if (rank === 3) entryDiv.classList.add('rank-3');
            
            entryDiv.innerHTML = `
                <div class="leaderboard-rank">${rank}</div>
                <div class="leaderboard-name">${entry.playerName}</div>
                <div class="leaderboard-score">${entry.score.toLocaleString()}</div>
            `;
            
            container.appendChild(entryDiv);
        });
    }
}
