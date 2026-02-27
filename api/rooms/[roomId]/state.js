import { getRoomsCollection } from '../../_db.js';

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
        const { roomId } = req.query;
        const playerName = req.query.playerName;

        if (!roomId || !playerName) {
            return res.status(400).json({ success: false, error: 'Room ID and player name required' });
        }

        const collection = await getRoomsCollection();
        const room = await collection.findOne({ roomId });

        if (!room) {
            return res.json({ success: false, peerState: null });
        }

        // Find peer's state from polling state
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
    } catch (error) {
        console.warn('State polling error:', error);
        return res.json({ success: false, peerState: null });
    }
}
