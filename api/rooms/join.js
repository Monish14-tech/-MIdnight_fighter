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
        const cleanRoomId = typeof roomId === 'string' ? roomId.trim() : '';
        const cleanPlayer = typeof playerName === 'string' ? playerName.trim() : '';

        if (!cleanRoomId || !cleanPlayer) {
            return res.status(400).json({ success: false, error: 'Room ID and player name are required' });
        }

        const collection = await getRoomsCollection();
        const room = await collection.findOne({ roomId: cleanRoomId });

        if (!room) {
            return res.status(404).json({ success: false, error: 'Room not found' });
        }

        if (room.expiresAt && new Date(room.expiresAt).getTime() < Date.now()) {
            await collection.updateOne(
                { roomId: cleanRoomId },
                { $set: { status: 'expired', updatedAt: new Date() } }
            );
            return res.status(410).json({ success: false, error: 'Room expired' });
        }

        if (room.status === 'full') {
            return res.status(409).json({ success: false, error: 'Room is already full' });
        }

        if (room.hostName === cleanPlayer) {
            return res.status(409).json({ success: false, error: 'Host cannot join as guest' });
        }

        await collection.updateOne(
            { roomId: cleanRoomId, status: 'waiting' },
            {
                $set: {
                    guestName: cleanPlayer,
                    status: 'full',
                    updatedAt: new Date(),
                    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
                    guestLastSeenAt: new Date()
                }
            }
        );

        const updated = await collection.findOne({ roomId: cleanRoomId });
        
        // Determine player role
        let role = null;
        if (updated.hostName === cleanPlayer) role = 'host';
        else if (updated.guestName === cleanPlayer) role = 'guest';
        
        return res.status(200).json({ 
            success: true, 
            room: updated,
            role,
            roomId: cleanRoomId,
            hostName: updated.hostName,
            guestName: updated.guestName,
            players: {}
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to join room' });
    }
}
