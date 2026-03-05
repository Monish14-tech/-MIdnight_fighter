import { SHIP_DATA } from './public/game.js';
import { Boss } from './public/entities/boss.js';

// Mock Game
const mockGame = {
    width: 1280,
    height: 720,
    currentLevel: 1,
    selectedShip: 'default',
    getShipStats: function (type) {
        return SHIP_DATA[type] || SHIP_DATA['default'];
    },
    getPlayerPowerMultiplier: function () {
        const ship = this.getShipStats(this.selectedShip);
        const playerDps = ship.damage / ship.fireRate;
        const baseDps = 25;
        const rawMultiplier = playerDps / baseDps;
        return Math.max(1, Math.pow(rawMultiplier, 0.85));
    }
};

console.log("=== DEFAULT SHIP ===");
console.log("DPS Multiplier:", mockGame.getPlayerPowerMultiplier());
console.log("L1 Boss HP:", new Boss(mockGame, 1).maxHealth);
console.log("L5 Boss HP:", new Boss(mockGame, 5).maxHealth);
console.log("L10 Boss HP:", new Boss(mockGame, 10).maxHealth);

mockGame.selectedShip = 'nova';
console.log("\n=== NOVA ASCENDANT ===");
console.log("DPS Multiplier:", mockGame.getPlayerPowerMultiplier());
console.log("L1 Boss HP:", new Boss(mockGame, 1).maxHealth);
console.log("L5 Boss HP:", new Boss(mockGame, 5).maxHealth);
console.log("L10 Boss HP:", new Boss(mockGame, 10).maxHealth);
