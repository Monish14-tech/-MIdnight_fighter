// Ranks — only the most dedicated pilots reach the top
// Thresholds are HIGH. A great 10-minute run scores ~5,000–15,000 pts.
// LEGEND rank requires consistent elite performance over many sessions.
export const RANK_DATA = [
    // ── Prestige Tier ────────────────────────────────────────────────────────
    { threshold: 25000000, name: "COSMIC DEITY", color: "#ff44ff", badge: "DEITY", glow: true },
    { threshold: 10000000, name: "ETERNAL WARLORD", color: "#ff0066", badge: "WARLORD", glow: true },
    { threshold: 5000000, name: "GALACTIC LEGEND", color: "#ff00ff", badge: "LEGEND", glow: true },
    // ── Elite Tier ───────────────────────────────────────────────────────────
    { threshold: 2500000, name: "ACE COMMANDER", color: "#ff2200", badge: "ACE", glow: false },
    { threshold: 1000000, name: "APEX PREDATOR", color: "#ff6600", badge: "APEX", glow: false },
    { threshold: 500000, name: "ELITE VANGUARD", color: "#ffaa00", badge: "ELITE", glow: false },
    // ── Veteran Tier ─────────────────────────────────────────────────────────
    { threshold: 200000, name: "SHADOW HUNTER", color: "#00ff88", badge: "SHADOW", glow: false },
    { threshold: 80000, name: "VETERAN FIGHTER", color: "#00ff44", badge: "VETERAN", glow: false },
    { threshold: 30000, name: "STRIKE PILOT", color: "#00f3ff", badge: "STRIKE", glow: false },
    // ── Rookie Tier ──────────────────────────────────────────────────────────
    { threshold: 10000, name: "RECON SCOUT", color: "#aaaaaa", badge: "RECON", glow: false },
    { threshold: 3000, name: "CADET", color: "#666666", badge: "CADET", glow: false },
    { threshold: 0, name: "ROOKIE PILOT", color: "#444444", badge: "ROOKIE", glow: false },
];

export function getRankByScore(score) {
    return RANK_DATA.find(r => score >= r.threshold) || RANK_DATA[RANK_DATA.length - 1];
}

// Get rank index (0 = highest)
export function getRankIndex(score) {
    const idx = RANK_DATA.findIndex(r => score >= r.threshold);
    return idx === -1 ? RANK_DATA.length - 1 : idx;
}
