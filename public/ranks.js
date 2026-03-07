// Ranks — hard to climb. Only truly dedicated pilots reach the top.
// Thresholds are single-game HIGH SCORE based.
// With score system, typical runs: Default ~3K-8K, Mid-tier ~30K-80K, Elite ~300K+, Prestige ~2M+.
export const RANK_DATA = [
    // ── Prestige Tier — only reachable with prestige ships + marathon runs ──
    { threshold: 150000000, name: "COSMIC DEITY", color: "#ff44ff", badge: "DEITY", glow: true, perk: { coinBonus: 0.50, hpMercy: true, nameGlow: true, hudBorder: true } },
    { threshold: 60000000, name: "ETERNAL WARLORD", color: "#ff0066", badge: "WARLORD", glow: true, perk: { coinBonus: 0.45, hpMercy: true, nameGlow: true, hudBorder: true } },
    { threshold: 25000000, name: "GALACTIC LEGEND", color: "#ff00ff", badge: "LEGEND", glow: true, perk: { coinBonus: 0.40, hpMercy: true, nameGlow: true, hudBorder: true } },
    // ── Elite Tier — top ships, very long runs required ─────────────────────
    { threshold: 8000000, name: "ACE COMMANDER", color: "#ff2200", badge: "ACE", glow: false, perk: { coinBonus: 0.35, hpMercy: true, nameGlow: true, hudBorder: true } },
    { threshold: 3000000, name: "APEX PREDATOR", color: "#ff6600", badge: "APEX", glow: false, perk: { coinBonus: 0.30, hpMercy: true, nameGlow: false, hudBorder: true } },
    { threshold: 1000000, name: "ELITE VANGUARD", color: "#ffaa00", badge: "ELITE", glow: false, perk: { coinBonus: 0.25, hpMercy: false, nameGlow: false, hudBorder: true } },
    // ── Veteran Tier — mid-high tier ships, sustained good performance ────────
    { threshold: 400000, name: "SHADOW HUNTER", color: "#00ff88", badge: "SHADOW", glow: false, perk: { coinBonus: 0.20, hpMercy: false, nameGlow: false, hudBorder: true } },
    { threshold: 150000, name: "VETERAN FIGHTER", color: "#00ff44", badge: "VETERAN", glow: false, perk: { coinBonus: 0.15, hpMercy: false, nameGlow: false, hudBorder: false } },
    { threshold: 60000, name: "STRIKE PILOT", color: "#00f3ff", badge: "STRIKE", glow: false, perk: { coinBonus: 0.10, hpMercy: false, nameGlow: false, hudBorder: false } },
    // ── Rookie Tier — accessible to normal players ────────────────────────────
    { threshold: 20000, name: "RECON SCOUT", color: "#aaaaaa", badge: "RECON", glow: false, perk: { coinBonus: 0.05, hpMercy: false, nameGlow: false, hudBorder: false } },
    { threshold: 5000, name: "CADET", color: "#666666", badge: "CADET", glow: false, perk: { coinBonus: 0.00, hpMercy: false, nameGlow: false, hudBorder: false } },
    { threshold: 0, name: "ROOKIE PILOT", color: "#444444", badge: "ROOKIE", glow: false, perk: { coinBonus: 0.00, hpMercy: false, nameGlow: false, hudBorder: false } },
];

export function getRankByScore(score) {
    return RANK_DATA.find(r => score >= r.threshold) || RANK_DATA[RANK_DATA.length - 1];
}

// Get rank index (0 = highest)
export function getRankIndex(score) {
    const idx = RANK_DATA.findIndex(r => score >= r.threshold);
    return idx === -1 ? RANK_DATA.length - 1 : idx;
}
