import express from 'express';
import { MongoClient } from 'mongodb';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

console.log('🎮 MIDNIGHT FIGHTER - Starting server...');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = 8000;
const ROOM_TTL_MS = 15 * 60 * 1000;
const ROOM_CLIENT_TIMEOUT_MS = 45 * 1000;

// MongoDB Connection String
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'midnight_fighter';
const COLLECTION_NAME = 'leaderboard';
const ROOMS_COLLECTION_NAME = 'rooms';

if (!MONGO_URI) {
    console.error('❌ MONGO_URI environment variable is not set!');
    console.error('Please check your .env file');
    process.exit(1);
}

let db;
let leaderboardCollection;
let roomsCollection;
const liveRooms = new Map();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB
async function connectDB() {
    try {
        console.log('🔄 Connecting to MongoDB Atlas...');
        const client = await MongoClient.connect(MONGO_URI, {
            tls: true,
            tlsAllowInvalidCertificates: false,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });
        
        db = client.db(DB_NAME);
        leaderboardCollection = db.collection(COLLECTION_NAME);
        roomsCollection = db.collection(ROOMS_COLLECTION_NAME);
        
        // Create index on score for efficient sorting
        await leaderboardCollection.createIndex({ score: -1 });

        // Unique room id index for co-op rooms
        await roomsCollection.createIndex({ roomId: 1 }, { unique: true });
        await roomsCollection.createIndex({ expiresAt: 1 });
        
        console.log('✅ Connected to MongoDB Atlas successfully!');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
        process.exit(1);
    }
}

// API Routes

// GET: Fetch top leaderboard entries
app.get('/api/leaderboard', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const leaderboard = await leaderboardCollection
            .find({})
            .sort({ score: -1 })
            .limit(limit)
            .toArray();
        
        res.json({
            success: true,
            data: leaderboard
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch leaderboard'
        });
    }
});

// POST: Submit a new score
app.post('/api/score', async (req, res) => {
    try {
        const { playerName, score, level, shipType, teamMembers } = req.body;
        
        // Validation
        const isTeam = Array.isArray(teamMembers) && teamMembers.length === 2;
        const normalizedTeam = isTeam ? teamMembers.map((name) => String(name).trim()).filter(Boolean) : null;
        const teamKey = normalizedTeam ? normalizedTeam.slice().sort().join('|') : null;
        const displayName = normalizedTeam ? normalizedTeam.join(' & ') : playerName;

        if (!displayName || score === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Player name and score are required'
            });
        }
        
        // Check if player exists
        const existingPlayer = teamKey
            ? await leaderboardCollection.findOne({ teamKey })
            : await leaderboardCollection.findOne({ playerName: displayName });
        
        if (existingPlayer) {
            // Update only if new score is higher
            if (score > existingPlayer.score) {
                await leaderboardCollection.updateOne(
                    teamKey ? { teamKey } : { playerName: displayName },
                    {
                        $set: {
                            score,
                            level: level || existingPlayer.level,
                            shipType: shipType || existingPlayer.shipType,
                            teamMembers: normalizedTeam || existingPlayer.teamMembers,
                            playerName: displayName,
                            updatedAt: new Date()
                        }
                    }
                );
                
                // Get player's new rank
                const rank = await leaderboardCollection.countDocuments({ score: { $gt: score } }) + 1;
                
                res.json({
                    success: true,
                    message: 'New high score!',
                    rank,
                    newRecord: true
                });
            } else {
                const rank = await leaderboardCollection.countDocuments({ score: { $gt: existingPlayer.score } }) + 1;
                res.json({
                    success: true,
                    message: 'Score submitted',
                    rank,
                    newRecord: false
                });
            }
        } else {
            // New player
            await leaderboardCollection.insertOne({
                playerName: displayName,
                teamKey,
                teamMembers: normalizedTeam,
                score,
                level: level || 1,
                shipType: shipType || 'default',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            
            const rank = await leaderboardCollection.countDocuments({ score: { $gt: score } }) + 1;
            
            res.json({
                success: true,
                message: 'Score submitted successfully!',
                rank,
                newRecord: true
            });
        }
    } catch (error) {
        console.error('Error submitting score:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit score'
        });
    }
});

// POST: Create a co-op room
app.post('/api/rooms/create', async (req, res) => {
    try {
        const { hostName } = req.body;
        if (!hostName || typeof hostName !== 'string') {
            return res.status(400).json({ success: false, error: 'Host name is required' });
        }

        const cleanHost = hostName.trim();
        if (!cleanHost) {
            return res.status(400).json({ success: false, error: 'Host name is required' });
        }

        let roomId = null;
        let created = false;

        while (!created) {
            roomId = generateRoomId(8);
            try {
                const now = new Date();
                await roomsCollection.insertOne({
                    roomId,
                    hostName: cleanHost,
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

        return res.json({ success: true, roomId });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to create room' });
    }
});

// POST: Join a co-op room
app.post('/api/rooms/join', async (req, res) => {
    try {
        const { roomId, playerName } = req.body;
        if (!roomId || !playerName) {
            return res.status(400).json({ success: false, error: 'Room ID and player name are required' });
        }

        const room = await roomsCollection.findOne({ roomId });
        if (!room) {
            return res.status(404).json({ success: false, error: 'Room not found' });
        }

        if (room.expiresAt && new Date(room.expiresAt).getTime() < Date.now()) {
            await roomsCollection.updateOne(
                { roomId },
                { $set: { status: 'expired', updatedAt: new Date() } }
            );
            return res.status(410).json({ success: false, error: 'Room expired' });
        }

        if (room.status === 'full') {
            return res.status(409).json({ success: false, error: 'Room is already full' });
        }

        const cleanPlayer = String(playerName).trim();
        if (!cleanPlayer) {
            return res.status(400).json({ success: false, error: 'Player name is required' });
        }

        if (room.hostName === cleanPlayer) {
            return res.status(409).json({ success: false, error: 'Host cannot join as guest' });
        }

        await roomsCollection.updateOne(
            { roomId, status: 'waiting' },
            {
                $set: {
                    guestName: cleanPlayer,
                    status: 'full',
                    updatedAt: new Date(),
                    expiresAt: new Date(Date.now() + ROOM_TTL_MS),
                    guestLastSeenAt: new Date()
                }
            }
        );

        const updated = await roomsCollection.findOne({ roomId });
        return res.json({ success: true, room: updated });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to join room' });
    }
});

// GET: Fetch a co-op room status
app.get('/api/rooms/:roomId', async (req, res) => {
    try {
        const { roomId } = req.params;
        const room = await roomsCollection.findOne({ roomId });
        if (!room) {
            return res.status(404).json({ success: false, error: 'Room not found' });
        }

        if (room.expiresAt && new Date(room.expiresAt).getTime() < Date.now()) {
            await roomsCollection.updateOne(
                { roomId },
                { $set: { status: 'expired', updatedAt: new Date() } }
            );
            return res.status(410).json({ success: false, error: 'Room expired' });
        }

        return res.json({ success: true, room });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to fetch room' });
    }
});

// POST: Leave co-op room
app.post('/api/rooms/leave', async (req, res) => {
    try {
        const { roomId, playerName } = req.body;
        if (!roomId || !playerName) {
            return res.status(400).json({ success: false, error: 'Room ID and player name are required' });
        }

        const room = await roomsCollection.findOne({ roomId });
        if (!room) {
            return res.status(404).json({ success: false, error: 'Room not found' });
        }

        const cleanPlayer = String(playerName).trim();
        let status = room.status;

        if (room.hostName === cleanPlayer || room.guestName === cleanPlayer) {
            status = 'closed';
            await roomsCollection.updateOne(
                { roomId },
                {
                    $set: {
                        status,
                        updatedAt: new Date(),
                        expiresAt: new Date()
                    }
                }
            );
        }

        const live = liveRooms.get(roomId);
        if (live) {
            for (const [, client] of live.clients.entries()) {
                try {
                    client.ws.send(JSON.stringify({ type: 'room_closed', roomId }));
                } catch {
                    // ignore ws errors
                }
            }
            liveRooms.delete(roomId);
        }

        return res.json({ success: true, status });
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Failed to leave room' });
    }
});

function generateRoomId(length) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i += 1) {
        result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return result;
}

function setupRealtimeServer(httpServer) {
    const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

    wss.on('connection', (ws) => {
        let context = {
            roomId: null,
            playerName: null,
            role: null
        };

        const safeSend = (socket, payload) => {
            if (socket.readyState === socket.OPEN) {
                socket.send(JSON.stringify(payload));
            }
        };

        ws.on('message', async (raw) => {
            let message;
            try {
                message = JSON.parse(raw.toString());
            } catch {
                return;
            }

            if (message.type === 'join_room') {
                const { roomId, playerName, shipType } = message;
                if (!roomId || !playerName) {
                    safeSend(ws, { type: 'error', error: 'roomId and playerName are required' });
                    return;
                }

                const room = await roomsCollection.findOne({ roomId });
                if (!room || room.status === 'closed' || room.status === 'expired') {
                    safeSend(ws, { type: 'error', error: 'Room unavailable' });
                    return;
                }

                if (room.expiresAt && new Date(room.expiresAt).getTime() < Date.now()) {
                    safeSend(ws, { type: 'error', error: 'Room expired' });
                    return;
                }

                let role = null;
                if (room.hostName === playerName) role = 'host';
                else if (room.guestName === playerName) role = 'guest';

                if (!role) {
                    safeSend(ws, { type: 'error', error: 'Player is not part of this room' });
                    return;
                }

                if (!liveRooms.has(roomId)) {
                    liveRooms.set(roomId, {
                        clients: new Map(),
                        state: {
                            players: {}
                        }
                    });
                }

                const liveRoom = liveRooms.get(roomId);
                liveRoom.clients.set(role, {
                    ws,
                    playerName,
                    shipType: shipType || 'default',
                    lastSeen: Date.now()
                });

                context = { roomId, playerName, role };

                await roomsCollection.updateOne(
                    { roomId },
                    {
                        $set: {
                            updatedAt: new Date(),
                            expiresAt: new Date(Date.now() + ROOM_TTL_MS),
                            [role === 'host' ? 'hostLastSeenAt' : 'guestLastSeenAt']: new Date()
                        }
                    }
                );

                safeSend(ws, {
                    type: 'joined_room',
                    role,
                    roomId,
                    hostName: room.hostName,
                    guestName: room.guestName,
                    players: liveRoom.state.players
                });

                for (const [peerRole, peer] of liveRoom.clients.entries()) {
                    if (peerRole !== role) {
                        safeSend(peer.ws, { type: 'peer_joined', role, playerName, shipType: shipType || 'default' });
                    }
                }
                return;
            }

            if (!context.roomId || !context.role) return;

            const liveRoom = liveRooms.get(context.roomId);
            if (!liveRoom) return;
            const client = liveRoom.clients.get(context.role);
            if (!client) return;

            client.lastSeen = Date.now();

            if (message.type === 'heartbeat') {
                await roomsCollection.updateOne(
                    { roomId: context.roomId },
                    {
                        $set: {
                            updatedAt: new Date(),
                            expiresAt: new Date(Date.now() + ROOM_TTL_MS),
                            [context.role === 'host' ? 'hostLastSeenAt' : 'guestLastSeenAt']: new Date()
                        }
                    }
                );
                return;
            }

            if (message.type === 'state_update') {
                liveRoom.state.players[context.role] = {
                    ...(message.state || {}),
                    playerName: context.playerName,
                    updatedAt: Date.now()
                };

                for (const [peerRole, peer] of liveRoom.clients.entries()) {
                    if (peerRole !== context.role) {
                        safeSend(peer.ws, {
                            type: 'peer_state',
                            from: context.role,
                            state: liveRoom.state.players[context.role]
                        });
                    }
                }
                return;
            }

            if (message.type === 'input_update') {
                for (const [peerRole, peer] of liveRoom.clients.entries()) {
                    if (peerRole !== context.role) {
                        safeSend(peer.ws, {
                            type: 'peer_input',
                            from: context.role,
                            input: message.input || {}
                        });
                    }
                }
                return;
            }

            if (message.type === 'player_died') {
                for (const [, peer] of liveRoom.clients.entries()) {
                    safeSend(peer.ws, {
                        type: 'force_game_over',
                        reason: 'shared_death'
                    });
                }
                return;
            }

            if (message.type === 'leave_room') {
                await closeRoomForEveryone(context.roomId, 'left');
            }
        });

        ws.on('close', async () => {
            if (!context.roomId || !context.role) return;
            await closeRoomForEveryone(context.roomId, 'disconnected');
        });
    });
}

async function closeRoomForEveryone(roomId, reason = 'closed') {
    const liveRoom = liveRooms.get(roomId);
    if (liveRoom) {
        for (const [, client] of liveRoom.clients.entries()) {
            try {
                client.ws.send(JSON.stringify({ type: 'room_closed', roomId, reason }));
            } catch {
                // ignore ws errors
            }
            try {
                client.ws.close();
            } catch {
                // ignore ws errors
            }
        }
        liveRooms.delete(roomId);
    }

    await roomsCollection.updateOne(
        { roomId },
        {
            $set: {
                status: reason === 'expired' ? 'expired' : 'closed',
                updatedAt: new Date(),
                expiresAt: new Date()
            }
        }
    );
}

function startRoomCleanup() {
    setInterval(async () => {
        const now = Date.now();

        const expiredRooms = await roomsCollection.find({
            status: { $in: ['waiting', 'full'] },
            expiresAt: { $lt: new Date(now) }
        }).toArray();

        for (const room of expiredRooms) {
            await closeRoomForEveryone(room.roomId, 'expired');
        }

        for (const [roomId, liveRoom] of liveRooms.entries()) {
            let shouldClose = false;
            for (const [, client] of liveRoom.clients.entries()) {
                if ((now - client.lastSeen) > ROOM_CLIENT_TIMEOUT_MS) {
                    shouldClose = true;
                    break;
                }
            }

            if (shouldClose) {
                await closeRoomForEveryone(roomId, 'expired');
            }
        }
    }, 15000);
}

// GET: Get player's rank and stats
app.get('/api/player/:playerName', async (req, res) => {
    try {
        const { playerName } = req.params;
        const player = await leaderboardCollection.findOne({ playerName });
        
        if (!player) {
            return res.status(404).json({
                success: false,
                error: 'Player not found'
            });
        }
        
        const rank = await leaderboardCollection.countDocuments({ score: { $gt: player.score } }) + 1;
        
        res.json({
            success: true,
            data: {
                ...player,
                rank
            }
        });
    } catch (error) {
        console.error('Error fetching player data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch player data'
        });
    }
});

// Start Server
async function startServer() {
    await connectDB();

    const httpServer = createServer(app);
    setupRealtimeServer(httpServer);
    startRoomCleanup();

    httpServer.listen(PORT, () => {
        console.log('========================================');
        console.log('🚀 MIDNIGHT FIGHTER - Server Running');
        console.log('========================================');
        console.log(`🌐 Game URL: http://localhost:${PORT}`);
        console.log(`📊 API: http://localhost:${PORT}/api/leaderboard`);
        console.log(`🔌 WS: ws://localhost:${PORT}/ws`);
        console.log('========================================');
    });
}

startServer();
