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

        // Determine player role
        let role = null;
        let isNewGuest = false;

        if (room.hostName === playerName) {
            // Host re-joining
            role = 'host';
        } else if (room.guestName === playerName) {
            // Guest re-joining
            role = 'guest';
        } else if (!room.guestName) {
            // NEW guest joining empty slot
            role = 'guest';
            isNewGuest = true;
        } else {
            // Room is full (both host and guest already assigned to different players)
            return res.status(409).json({ success: false, error: 'Room is full' });
        }

        // If new guest joining, update guestName
        if (isNewGuest) {
            await collection.updateOne(
                { roomId },
                {
                    $set: {
                        guestName: playerName,
                        status: 'full',
                        updatedAt: new Date()
                    }
                }
            );
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
                        state: {},
                        messages: []
                    },
                    updatedAt: new Date()
                }
            }
        );

        return res.json({
            success: true,
            role,
            roomId,
            hostName: room.hostName,
            guestName: isNewGuest ? playerName : room.guestName
        });
    } catch (error) {
        console.error('Polling join error:', error);
        return res.status(500).json({ success: false, error: 'Failed to join room' });
    }
}
