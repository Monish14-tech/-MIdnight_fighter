import { getLeaderboardCollection } from '../_db.js';

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
    setCors(res);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const playerName = req.query.playerName;
        if (!playerName) {
            return res.status(400).json({ success: false, error: 'Player name is required' });
        }

        const collection = await getLeaderboardCollection();
        const player = await collection.findOne({ playerName });

        if (!player) {
            return res.status(404).json({ success: false, error: 'Player not found' });
        }

        const rank = await collection.countDocuments({ score: { $gt: player.score } }) + 1;

        return res.status(200).json({
            success: true,
            data: {
                ...player,
                rank
            }
        });
    } catch (error) {
        console.error('Error fetching player data:', error);
        return res.status(500).json({ success: false, error: 'Failed to fetch player data' });
    }
}
