import { getRoomsCollection } from '../_db.js';

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
        const { roomId, playerName } = req.query;

        if (!roomId) {
            return res.status(400).json({ success: false, error: 'Room ID required' });
        }

        const collection = await getRoomsCollection();
        const room = await collection.findOne({ roomId });

        if (!room) {
            return res.status(404).json({ success: false, error: 'Room not found' });
        }

        // If playerName provided, return peer state (for during gameplay)
        if (playerName) {
            let peerState = null;
            const pollingState = room.pollingState || {};

            if (room.hostName === playerName && pollingState.guest) {
                // Host requesting guest's state
                peerState = pollingState.guest.state || {};
            } else if (room.guestName === playerName && pollingState.host) {
                // Guest requesting host's state
                peerState = pollingState.host.state || {};
            }

            return res.json({ success: true, peerState });
        }

        // Otherwise return full room status (for host waiting for guest)
        return res.json({ success: true, room });
    } catch (error) {
        console.warn('State polling error:', error);
        return res.json({ success: false, peerState: null });
    }
}
