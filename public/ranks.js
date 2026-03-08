// Ranks are now purely based on GLOBAL LEADERBOARD POSITION.
// threshold has been replaced by rankTarget (the required position to achieve this rank)
export const RANK_DATA = [
    // ── Peak Tier ──
    { rankTarget: 1, name: "GUARDIAN OF THE GALAXY", color: "#ff44ff", badge: "GUARDIAN", glow: true, perk: { coinBonus: 0.50, hpMercy: true, nameGlow: true, hudBorder: true } },
    { rankTarget: 2, name: "ETERNAL WARLORD", color: "#ff0066", badge: "WARLORD", glow: true, perk: { coinBonus: 0.45, hpMercy: true, nameGlow: true, hudBorder: true } },
    { rankTarget: 3, name: "GALACTIC LEGEND", color: "#ff00ff", badge: "LEGEND", glow: true, perk: { coinBonus: 0.40, hpMercy: true, nameGlow: true, hudBorder: true } },
    // ── Elite Tier ──
    { rankTarget: 10, name: "ACE COMMANDER", color: "#ff2200", badge: "ACE", glow: false, perk: { coinBonus: 0.35, hpMercy: true, nameGlow: true, hudBorder: true } },
    { rankTarget: 50, name: "APEX PREDATOR", color: "#ff6600", badge: "APEX", glow: false, perk: { coinBonus: 0.30, hpMercy: true, nameGlow: false, hudBorder: true } },
    { rankTarget: 100, name: "ELITE VANGUARD", color: "#ffaa00", badge: "ELITE", glow: false, perk: { coinBonus: 0.25, hpMercy: false, nameGlow: false, hudBorder: true } },
    // ── Veteran Tier ──
    { rankTarget: 500, name: "SHADOW HUNTER", color: "#00ff88", badge: "SHADOW", glow: false, perk: { coinBonus: 0.20, hpMercy: false, nameGlow: false, hudBorder: true } },
    { rankTarget: 1000, name: "VETERAN FIGHTER", color: "#00ff44", badge: "VETERAN", glow: false, perk: { coinBonus: 0.15, hpMercy: false, nameGlow: false, hudBorder: false } },
    { rankTarget: 5000, name: "STRIKE PILOT", color: "#00f3ff", badge: "STRIKE", glow: false, perk: { coinBonus: 0.10, hpMercy: false, nameGlow: false, hudBorder: false } },
    // ── Rookie Tier ──
    { rankTarget: 10000, name: "RECON SCOUT", color: "#aaaaaa", badge: "RECON", glow: false, perk: { coinBonus: 0.05, hpMercy: false, nameGlow: false, hudBorder: false } },
    { rankTarget: 50000, name: "CADET", color: "#666666", badge: "CADET", glow: false, perk: { coinBonus: 0.00, hpMercy: false, nameGlow: false, hudBorder: false } },
    { rankTarget: Infinity, name: "ROOKIE PILOT", color: "#444444", badge: "ROOKIE", glow: false, perk: { coinBonus: 0.00, hpMercy: false, nameGlow: false, hudBorder: false } },
];

export function getRankByGlobalPosition(globalRank) {
    if (!globalRank || globalRank < 1) {
        return RANK_DATA[RANK_DATA.length - 1]; // Default Rookie if unranked/offline
    }
    return RANK_DATA.find(r => globalRank <= r.rankTarget) || RANK_DATA[RANK_DATA.length - 1];
}

// Get rank index (0 = highest) based on position
export function getRankIndex(globalRank) {
    if (!globalRank || globalRank < 1) return RANK_DATA.length - 1;
    const idx = RANK_DATA.findIndex(r => globalRank <= r.rankTarget);
    return idx === -1 ? RANK_DATA.length - 1 : idx;
}
