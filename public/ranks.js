export const RANK_DATA = [
    { threshold: 500000, name: "GALACTIC LEGEND", color: "#ff00ff", badge: "LEGEND" },
    { threshold: 250000, name: "ACE COMMANDER", color: "#ff0000", badge: "ACE" },
    { threshold: 100000, name: "ELITE VANGUARD", color: "#ffa500", badge: "ELITE" },
    { threshold: 50000, name: "VETERAN FIGHTER", color: "#00ff00", badge: "VETERAN" },
    { threshold: 25000, name: "STRIKE PILOT", color: "#00f3ff", badge: "STRIKE" },
    { threshold: 10000, name: "RECON SCOUT", color: "#ffffff", badge: "RECON" },
    { threshold: 0, name: "ROOKIE PILOT", color: "#888888", badge: "ROOKIE" }
];

export function getRankByScore(score) {
    return RANK_DATA.find(r => score >= r.threshold) || RANK_DATA[RANK_DATA.length - 1];
}
