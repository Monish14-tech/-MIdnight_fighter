// Ranks — hard to climb. Only truly dedicated pilots reach the top.
// Thresholds are single-game HIGH SCORE based.
// With score reduction, typical runs: Default ~3K-8K, Mid-tier ~15K-40K, Elite ~80K-200K, Prestige x3 ~300K+.
export const RANK_DATA = [
    // ── Prestige Tier — essentially unreachable without prestige ships + marathon runs ──
    { threshold: 50000000, name: "COSMIC DEITY", color: "#ff44ff", badge: "DEITY", glow: true },
    { threshold: 20000000, name: "ETERNAL WARLORD", color: "#ff0066", badge: "WARLORD", glow: true },
    { threshold: 8000000, name: "GALACTIC LEGEND", color: "#ff00ff", badge: "LEGEND", glow: true },
    // ── Elite Tier — top ships, very long runs required ──────────────────────
    { threshold: 2000000, name: "ACE COMMANDER", color: "#ff2200", badge: "ACE", glow: false },
    { threshold: 800000, name: "APEX PREDATOR", color: "#ff6600", badge: "APEX", glow: false },
    { threshold: 300000, name: "ELITE VANGUARD", color: "#ffaa00", badge: "ELITE", glow: false },
    // ── Veteran Tier — mid-high tier ships, sustained good performance ────────
    { threshold: 100000, name: "SHADOW HUNTER", color: "#00ff88", badge: "SHADOW", glow: false },
    { threshold: 40000, name: "VETERAN FIGHTER", color: "#00ff44", badge: "VETERAN", glow: false },
    { threshold: 15000, name: "STRIKE PILOT", color: "#00f3ff", badge: "STRIKE", glow: false },
    // ── Rookie Tier — accessible to normal players ────────────────────────────
    { threshold: 5000, name: "RECON SCOUT", color: "#aaaaaa", badge: "RECON", glow: false },
    { threshold: 2000, name: "CADET", color: "#666666", badge: "CADET", glow: false },
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
