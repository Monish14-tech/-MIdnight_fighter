import { RANK_DATA, getRankByGlobalPosition } from './ranks.js?v=16';

export class LeaderboardManager {
    constructor() {
        this.apiUrl = `${window.location.origin}/api`;
        this.playerName = localStorage.getItem('midnight_player_name') || null;
        this.playerNameLocked = localStorage.getItem('midnight_player_name_locked') === 'true';
        this.mode = 'solo'; // Default mode
    }

    // Set player name
    setPlayerName(name) {
        if (this.playerNameLocked || this.playerName) {
            return false;
        }
        this.playerName = name;
        localStorage.setItem('midnight_player_name', name);
        this.playerNameLocked = true;
        localStorage.setItem('midnight_player_name_locked', 'true');
        return true;
    }

    // Get player name
    getPlayerName() {
        return this.playerName;
    }

    isPlayerNameLocked() {
        return this.playerNameLocked || !!this.playerName;
    }

    // Fetch leaderboard
    async fetchLeaderboard(limit = 10) {
        try {
            const response = await fetch(`${this.apiUrl}/leaderboard?limit=${limit}&type=${this.mode}&t=${Date.now()}`);
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
    async submitScore(score, level, shipType, teamMembers = null) {
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
                    shipType,
                    teamMembers
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
            const response = await fetch(`${this.apiUrl}/player/${playerName}?t=${Date.now()}`);
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

    // Display leaderboard in UI
    async displayLeaderboard() {
        const container = document.getElementById('leaderboard-list');

        if (!container) return;

        // Show loading message
        container.innerHTML = '<div class="leaderboard-empty">Loading...</div>';

        const leaderboard = await this.fetchLeaderboard(10);
        const sortedLeaderboard = [...leaderboard].sort((a, b) => (b.score || 0) - (a.score || 0));

        if (sortedLeaderboard.length === 0) {
            container.innerHTML = '<div class="leaderboard-empty">No scores yet. Be the first!<br><small style="margin-top: 10px; display: block;">Make sure you enter the pilot name</small></div>';
            return;
        }

        container.innerHTML = '';

        sortedLeaderboard.forEach((entry, index) => {
            // Competition Ranking Logic (1, 2, 2, 4)
            let rank;
            if (index > 0 && entry.score === sortedLeaderboard[index - 1].score) {
                rank = entry._rank; // Reuse previous rank for tie
            } else {
                rank = index + 1;
            }
            entry._rank = rank; // Store for next iteration tie-check

            const entryDiv = document.createElement('div');
            entryDiv.className = 'leaderboard-entry';

            // Highlight current player
            if (entry.playerName === this.playerName ||
                (Array.isArray(entry.teamMembers) && entry.teamMembers.includes(this.playerName))) {
                entryDiv.classList.add('current-player');
            }

            // Special styles for top 3
            if (rank === 1) entryDiv.classList.add('rank-1');
            else if (rank === 2) entryDiv.classList.add('rank-2');
            else if (rank === 3) entryDiv.classList.add('rank-3');

            const displayName = Array.isArray(entry.teamMembers) && entry.teamMembers.length > 0
                ? entry.teamMembers.join(' + ')
                : entry.playerName;

            const rankInfo = getRankByGlobalPosition(rank);

            entryDiv.innerHTML = `
                <div class="leaderboard-rank">${rank}</div>
                <div class="leaderboard-name-wrapper">
                    <div class="leaderboard-name">${displayName}</div>
                    <div class="leaderboard-badge" style="background: ${rankInfo.color}">${rankInfo.badge}</div>
                </div>
                <div class="leaderboard-score">${entry.score.toLocaleString()}</div>
            `;

            container.appendChild(entryDiv);
        });
    }
}
