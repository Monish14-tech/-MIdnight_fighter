import { getRoomsCollection } from '../_db.js';

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

    // ⏳ Coming Soon: Collaborate Feature
    return res.status(503).json({
        success: false,
        coming_soon: true,
        message: '🎮 Co-op Collaborate Feature Coming Soon!',
        error: 'This feature is under development and will be available soon.'
    });

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : '';
        const playerName = typeof body.playerName === 'string' ? body.playerName.trim() : '';

        if (!roomId || !playerName) {
            return res.status(400).json({ success: false, error: 'Room ID and player name are required' });
        }

        const collection = await getRoomsCollection();
        const room = await collection.findOne({ roomId });

        if (!room) {
            return res.status(404).json({ success: false, error: 'Room not found' });
        }

        if (room.hostName === playerName || room.guestName === playerName) {
            await collection.updateOne(
                { roomId },
                {
                    $set: {
                        status: 'closed',
                        updatedAt: new Date(),
                        expiresAt: new Date()
                    }
                }
            );
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to leave room' });
    }
}
