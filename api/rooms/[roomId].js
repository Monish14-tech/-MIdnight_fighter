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
        const roomId = req.query.roomId;
        if (!roomId) {
            return res.status(400).json({ success: false, error: 'Room ID is required' });
        }

        const collection = await getRoomsCollection();
        const room = await collection.findOne({ roomId });

        if (!room) {
            return res.status(404).json({ success: false, error: 'Room not found' });
        }

        if (room.expiresAt && new Date(room.expiresAt).getTime() < Date.now()) {
            await collection.updateOne(
                { roomId },
                { $set: { status: 'expired', updatedAt: new Date() } }
            );
            return res.status(410).json({ success: false, error: 'Room expired' });
        }

        return res.status(200).json({ success: true, room });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch room' });
    }
}
