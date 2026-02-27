import { getRoomsCollection } from '../_db.js';

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function generateRoomId(length) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i += 1) {
        result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return result;
}

const ROOM_TTL_MS = 15 * 60 * 1000;

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
        const hostName = typeof body.hostName === 'string' ? body.hostName.trim() : '';
        if (!hostName) {
            return res.status(400).json({ success: false, error: 'Host name is required' });
        }

        const collection = await getRoomsCollection();

        let roomId = null;
        let created = false;

        while (!created) {
            roomId = generateRoomId(8);
            try {
                const now = new Date();
                await collection.insertOne({
                    roomId,
                    hostName,
                    guestName: null,
                    status: 'waiting',
                    createdAt: now,
                    updatedAt: now,
                    expiresAt: new Date(now.getTime() + ROOM_TTL_MS),
                    hostLastSeenAt: now,
                    guestLastSeenAt: null
                });
                created = true;
            } catch (error) {
                if (error.code !== 11000) {
                    throw error;
                }
            }
        }

        return res.status(200).json({ success: true, roomId });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to create room' });
    }
}
