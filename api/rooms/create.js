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

    // ⏳ Coming Soon: Collaborate Feature
    return res.status(503).json({
        success: false,
        coming_soon: true,
        message: '🎮 Co-op Collaborate Feature Coming Soon!',
        error: 'This feature is under development and will be available soon.'
    });
}
