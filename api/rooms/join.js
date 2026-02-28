import { getRoomsCollection } from '../_db.js';

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
    setCors(res);

    // DEBUG: Log incoming request
    console.log("METHOD:", req.method);
    console.log("BODY:", req.body);
    console.log("QUERY:", req.query);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        // Get roomId from query, playerName and shipType from body
        const { roomId } = req.query;
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { playerName, shipType } = body;

        if (!roomId || !playerName) {
            return res.status(400).json({ success: false, error: 'Room ID and player name required' });
        }

        const collection = await getRoomsCollection();
        const room = await collection.findOne({ roomId });

        if (!room) {
            return res.status(404).json({ success: false, error: 'Room not found' });
        }

        if (room.status !== 'full' && room.status !== 'waiting') {
            return res.status(409).json({ success: false, error: 'Room unavailable' });
        }

        let role = null;
        if (room.hostName === playerName) role = 'host';
        else if (room.guestName === playerName) role = 'guest';

        if (!role) {
            return res.status(409).json({ success: false, error: 'Player not in room' });
        }

        // Initialize polling state in MongoDB for this player
        await collection.updateOne(
            { roomId },
            {
                $set: {
                    [`pollingState.${role}`]: {
                        playerName,
                        shipType: shipType || 'default',
                        lastSeen: new Date(),
                        isPolling: true,
                        state: {}
                    },
                    updatedAt: new Date()
                }
            },
            { upsert: false }
        );

        return res.json({
            success: true,
            role,
            roomId,
            hostName: room.hostName,
            guestName: room.guestName
        });
    } catch (error) {
        console.error('Polling join error:', error);
        return res.status(500).json({ success: false, error: 'Failed to join room' });
    }
}
