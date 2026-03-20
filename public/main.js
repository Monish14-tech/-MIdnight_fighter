import { Game } from './game.js?v=58';
import { InputHandler } from './input.js?v=56';
import { LeaderboardManager } from './leaderboard.js?v=56';

window.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.init();
    window.__midnightGame = game;
    window.__midnightShowNamePrompt = () => showNamePrompt(game);

    // Fallback click router: ensures core buttons still work if direct bindings fail.
    document.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const g = window.__midnightGame;
        if (!g) return;

        switch (button.id) {
            case 'start-btn':
            case 'restart-btn':
                g.startRequested = true;
                g.lastStartIntent = Date.now();
                g.startGame();
                break;
            case 'store-btn':
                g.openStore();
                break;
            case 'back-btn':
                g.closeStore();
                break;
            case 'leaderboard-btn':
                g.openLeaderboard();
                break;
            case 'back-from-leaderboard-btn':
                g.closeLeaderboard();
                break;
            default:
                break;
        }
    }, true);

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

    if (game.leaderboard?.isPlayerNameLocked?.()) {
        modal.style.display = 'none';
        return;
    }

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
        if (game.leaderboard?.isPlayerNameLocked?.()) {
            modal.style.display = 'none';
            return;
        }

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
        const saved = game.leaderboard.setPlayerName(name);
        if (!saved) {
            alert('Pilot name is locked and cannot be changed.');
            modal.style.display = 'none';
            return;
        }
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
