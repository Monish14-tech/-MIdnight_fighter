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

        if (room.expiresAt && new Date(room.expiresAt).getTime() < Date.now()) {
            await collection.updateOne(
                { roomId },
                { $set: { status: 'expired', updatedAt: new Date() } }
            );
            return res.status(410).json({ success: false, error: 'Room expired' });
        }

        if (room.status === 'full') {
            return res.status(409).json({ success: false, error: 'Room is already full' });
        }

        if (room.hostName === playerName) {
            return res.status(409).json({ success: false, error: 'Host cannot join as guest' });
        }

        await collection.updateOne(
            { roomId, status: 'waiting' },
            {
                $set: {
                    guestName: playerName,
                    status: 'full',
                    updatedAt: new Date(),
                    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
                    guestLastSeenAt: new Date()
                }
            }
        );

        const updated = await collection.findOne({ roomId });
        return res.status(200).json({ success: true, room: updated });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to join room' });
    }
}
