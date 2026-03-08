import { Game } from './game.js?v=16';
import { InputHandler } from './input.js?v=16';
import { LeaderboardManager } from './leaderboard.js?v=16';

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

    // Resume audio on any click in modal
    modal.addEventListener('mousedown', () => {
        if (game.audio && game.audio.ctx) {
            game.audio.ctx.resume().then(() => {
                game.audio.playTrack('menu');
            });
        }
    }, { once: true });

    // Focus on input
    setTimeout(() => input.focus(), 100);

    // Also resume on typing
    input.addEventListener('input', () => {
        if (game.audio && game.audio.ctx && game.audio.ctx.state === 'suspended') {
            game.audio.ctx.resume().then(() => {
                game.audio.playTrack('menu');
            });
        }
    }, { once: true });

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
    };

    // Submit on button click
    submitBtn.addEventListener('click', () => {
        if (game.audio && game.audio.ctx) {
            game.audio.ctx.resume();
            game.audio.playTrack('menu');
        }
        handleSubmit();
    });

    // Resume audio on first interaction if possible
    input.addEventListener('mousedown', () => {
        if (game.audio && game.audio.ctx) game.audio.ctx.resume();
    });

    // Submit on Enter key
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            if (game.audio && game.audio.ctx) {
                game.audio.ctx.resume();
                game.audio.playTrack('menu');
            }
            handleSubmit();
        }
    });
}
