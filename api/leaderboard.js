import { getLeaderboardCollection } from './_db.js';

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
        const limit = parseInt(req.query.limit, 10) || 10;
        const collection = await getLeaderboardCollection();
        const leaderboard = await collection
            .find({})
            .sort({ score: -1 })
            .limit(limit)
            .toArray();

        return res.status(200).json({ success: true, data: leaderboard });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
    }
}
