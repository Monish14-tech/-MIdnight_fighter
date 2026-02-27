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

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { roomId, playerName } = req.query;
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { messages } = body;

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
        if (room.hostName === playerName) role = 'host';
        else if (room.guestName === playerName) role = 'guest';

        if (!role) {
            return res.status(409).json({ success: false, error: 'Player not in room' });
        }

        // Merge messages into player state
        if (messages && Array.isArray(messages) && messages.length > 0) {
            const stateUpdate = {};
            
            for (const msg of messages) {
                if (msg.type === 'player_move') {
                    stateUpdate.position = msg.position;
                    stateUpdate.velocity = msg.velocity;
                }
            }

            // Update player state in MongoDB
            await collection.updateOne(
                { roomId },
                {
                    $set: {
                        [`pollingState.${role}.state`]: stateUpdate,
                        [`pollingState.${role}.lastSeen`]: new Date(),
                        updatedAt: new Date()
                    }
                },
                { upsert: false }
            );
        }

        return res.json({ success: true, synced: messages?.length || 0 });
    } catch (error) {
        console.error('Sync error:', error);
        return res.status(500).json({ success: false, error: 'Failed to sync state' });
    }
}
