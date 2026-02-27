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
                console.log(`📊 Fetched ${data.data.length} leaderboard entries`);
                return data.data;
            } else {
                console.error('❌ Failed to fetch leaderboard:', data.error);
                return [];
            }
        } catch (error) {
            console.error('❌ Error fetching leaderboard (Server may not be running):', error);
            console.log('💡 Make sure to run start_server.bat first!');
            return [];
        }
    }

    // Submit score
    async submitScore(score, level, shipType) {
        if (!this.playerName) {
            console.warn('⚠️ No player name set. Score not submitted.');
            return null;
        }

        console.log(`📊 Submitting score: ${score} for player: ${this.playerName}`);

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
                console.log(`✅ Score submitted successfully! Rank: #${data.rank}`);
                return data;
            } else {
                console.error('❌ Failed to submit score:', data.error);
                return null;
            }
        } catch (error) {
            console.error('❌ Error submitting score (Server may not be running):', error);
            console.log('💡 Make sure to run start_server.bat first!');
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
                console.error('Failed to fetch player stats:', data.error);
                return null;
            }
        } catch (error) {
            console.error('Error fetching player stats:', error);
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
