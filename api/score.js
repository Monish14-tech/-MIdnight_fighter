import { getLeaderboardCollection } from './_db.js';

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
    setCors(res);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const playerName = typeof body.playerName === 'string' ? body.playerName.trim() : '';
        const score = Number(body.score);
        const level = Number(body.level) || 1;
        const shipType = typeof body.shipType === 'string' ? body.shipType : 'default';

        if (!playerName || Number.isNaN(score)) {
            return res.status(400).json({ success: false, error: 'Player name and score are required' });
        }

        const collection = await getLeaderboardCollection();
        const existingPlayer = await collection.findOne({ playerName });

        if (existingPlayer) {
            if (score > existingPlayer.score) {
                await collection.updateOne(
                    { playerName },
                    {
                        $set: {
                            score,
                            level: level || existingPlayer.level,
                            shipType: shipType || existingPlayer.shipType,
                            updatedAt: new Date()
                        }
                    }
                );

                const rank = await collection.countDocuments({ score: { $gt: score } }) + 1;
                return res.status(200).json({
                    success: true,
                    message: 'New high score!',
                    rank,
                    newRecord: true
                });
            }

            const rank = await collection.countDocuments({ score: { $gt: existingPlayer.score } }) + 1;
            return res.status(200).json({
                success: true,
                message: 'Score submitted',
                rank,
                newRecord: false
            });
        }

        await collection.insertOne({
            playerName,
            score,
            level,
            shipType,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        const rank = await collection.countDocuments({ score: { $gt: score } }) + 1;
        return res.status(200).json({
            success: true,
            message: 'Score submitted successfully!',
            rank,
            newRecord: true
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to submit score' });
    }
}
