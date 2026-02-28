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
        // Get roomId from query, playerName and messages from body
        const { roomId } = req.query;
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { playerName, messages } = body;

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

        // Store incoming messages for this player
        if (messages && Array.isArray(messages) && messages.length > 0) {
            await collection.updateOne(
                { roomId },
                {
                    $set: {
                        [`pollingState.${role}.messages`]: messages,
                        [`pollingState.${role}.lastSeen`]: new Date(),
                        updatedAt: new Date()
                    }
                },
                { upsert: false }
            );
        }

        // Get peer's messages to return
        const peerRole = role === 'host' ? 'guest' : 'host';
        const peerMessages = room.pollingState?.[peerRole]?.messages || [];

        // Clear peer messages after retrieval to prevent re-sending
        if (peerMessages.length > 0) {
            await collection.updateOne(
                { roomId },
                {
                    $set: {
                        [`pollingState.${peerRole}.messages`]: [],
                        updatedAt: new Date()
                    }
                }
            );
        }

        return res.json({ 
            success: true, 
            synced: messages?.length || 0,
            peerMessages: peerMessages
        });
    } catch (error) {
        console.error('Sync error:', error);
        return res.status(500).json({ success: false, error: 'Failed to sync state' });
    }
}
