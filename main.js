import { Game } from './game.js';
import { LeaderboardManager } from './leaderboard.js';

window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.init();
    
    // Check if player has a name set
    const leaderboard = new LeaderboardManager();
    const playerName = leaderboard.getPlayerName();
    
    if (!playerName) {
        // Show name prompt modal
        showNamePrompt(game);
    }
});

function showNamePrompt(game) {
    const modal = document.getElementById('name-prompt-modal');
    const input = document.getElementById('name-prompt-input');
    const submitBtn = document.getElementById('name-prompt-submit');
    
    if (!modal || !input || !submitBtn) return;
    
    modal.style.display = 'flex';
    
    // Focus on input
    setTimeout(() => input.focus(), 100);
    
    const handleSubmit = () => {
        const name = input.value.trim();
        
        if (!name) {
            alert('⚠️ Please enter your pilot name!');
            input.focus();
            return;
        }
        
        if (name.length < 2) {
            alert('⚠️ Pilot name must be at least 2 characters!');
            input.focus();
            return;
        }
        
        // Set the name
        game.leaderboard.setPlayerName(name);
        game.updatePlayerNameDisplay();
        
        // Hide modal
        modal.style.display = 'none';
        
        // Show welcome message
        console.log(`✅ Welcome, Pilot ${name}!`);
    };
    
    // Submit on button click
    submitBtn.addEventListener('click', handleSubmit);
    
    // Submit on Enter key
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    });
}
