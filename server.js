import express from 'express';
import { MongoClient } from 'mongodb';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

console.log('🎮 MIDNIGHT FIGHTER - Starting server...');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = 8000;
const ROOM_TTL_MS = 15 * 60 * 1000;
const ROOM_CLIENT_TIMEOUT_MS = 45 * 1000;

// MongoDB Connection Strings
const MONGO_URI = process.env.MONGO_URI;           // Room database
const MONGO_URI1 = process.env.MONGO_URI1;         // Leaderboard database
const DB_NAME = 'midnight_fighter';
const COLLECTION_NAME = 'leaderboard';
const ROOMS_COLLECTION_NAME = 'rooms';

if (!MONGO_URI) {
    console.error('❌ MONGO_URI environment variable is not set!');
    console.error('Please check your .env file');
    process.exit(1);
}

if (!MONGO_URI1) {
    console.error('❌ MONGO_URI1 environment variable is not set!');
    console.error('Please check your .env file');
    process.exit(1);
}

let leaderboardDb;
let leaderboardCollection;
let leaderboardClient;

let roomsDb;
let roomsCollection;
let roomsClient;

const liveRooms = new Map();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js') || filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// Connect to MongoDB
async function connectDB() {
    try {
        console.log('🔄 Connecting to MongoDB Atlas (Leaderboard)...');
        leaderboardClient = await MongoClient.connect(MONGO_URI1, {
            tls: true,
            tlsAllowInvalidCertificates: false,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });

        leaderboardDb = leaderboardClient.db(DB_NAME);
        leaderboardCollection = leaderboardDb.collection(COLLECTION_NAME);

        // Create index on score for efficient sorting
        await leaderboardCollection.createIndex({ score: -1 });
        console.log('✅ Connected to Leaderboard Database successfully!');

        console.log('🔄 Connecting to MongoDB Atlas (Rooms)...');
        roomsClient = await MongoClient.connect(MONGO_URI, {
            tls: true,
            tlsAllowInvalidCertificates: false,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });

        roomsDb = roomsClient.db(DB_NAME);
        roomsCollection = roomsDb.collection(ROOMS_COLLECTION_NAME);

        // Unique room id index for co-op rooms
        await roomsCollection.createIndex({ roomId: 1 }, { unique: true });
        await roomsCollection.createIndex({ expiresAt: 1 });
        console.log('✅ Connected to Rooms Database successfully!');

        console.log('✅ Connected to all MongoDB Atlas databases!');
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

// Co-op Rooms (Collaborate Feature) 
// Routes for creation and joining are below

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

        const updateResult = await roomsCollection.updateOne(
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

        if (updateResult.matchedCount === 0) {
            return res.status(409).json({ success: false, error: 'Room is no longer available' });
        }

        const updated = await roomsCollection.findOne({ roomId });
        return res.json({ success: true, room: updated });
    } catch (error) {
        console.error('Error joining room:', error);
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

// POLLING ENDPOINTS (for serverless/Vercel compatibility - no WebSocket)

// POST: Join room (polling-based)
app.post('/api/rooms/:roomId/join', async (req, res) => {
    try {
        const { roomId } = req.params;
        const { playerName, shipType } = req.body;

        if (!roomId || !playerName) {
            return res.status(400).json({ success: false, error: 'Room ID and player name required' });
        }

        const room = await roomsCollection.findOne({ roomId });
        if (!room) {
            return res.status(404).json({ success: false, error: 'Room not found' });
        }

        if (room.status !== 'full' && room.status !== 'waiting') {
            return res.status(409).json({ success: false, error: 'Room unavailable' });
        }

        let role = null;
        if (room.hostName === playerName) role = 'host';
        else if (room.guestName === playerName) role = 'guest';

        if (!role) {
            return res.status(409).json({ success: false, error: 'Player not in room' });
        }

        // Initialize polling state if needed
        if (!liveRooms.has(roomId)) {
            liveRooms.set(roomId, {
                clients: new Map(),
                state: { players: {} },
                lastSync: Date.now()
            });
        }

        const liveRoom = liveRooms.get(roomId);
        liveRoom.clients.set(role, {
            playerName,
            shipType: shipType || 'default',
            lastSeen: Date.now(),
            isPolling: true
        });

        return res.json({
            success: true,
            role,
            roomId,
            hostName: room.hostName,
            guestName: room.guestName,
            players: liveRoom.state.players
        });
    } catch (error) {
        console.error('Polling join error:', error);
        return res.status(500).json({ success: false, error: 'Failed to join room' });
    }
});

// GET: Fetch peer state (polling)
app.get('/api/rooms/:roomId/state', async (req, res) => {
    try {
        const { roomId } = req.params;
        const playerName = req.query.playerName;

        const liveRoom = liveRooms.get(roomId);
        if (!liveRoom) {
            return res.json({ success: false, peerState: null });
        }

        // Find peer's state
        let peerState = null;
        for (const [role, client] of liveRoom.clients.entries()) {
            if (client.playerName !== playerName && liveRoom.state.players[role]) {
                peerState = liveRoom.state.players[role];
                break;
            }
        }

        return res.json({ success: true, peerState });
    } catch (error) {
        return res.status(500).json({ success: false, peerState: null });
    }
});

// POST: Sync player messages/state (polling)
app.post('/api/rooms/:roomId/sync', async (req, res) => {
    try {
        const { roomId } = req.params;
        const { playerName, messages } = req.body;

        if (!roomId || !playerName || !Array.isArray(messages)) {
            return res.status(400).json({ success: false });
        }

        const liveRoom = liveRooms.get(roomId);
        if (!liveRoom) {
            return res.status(404).json({ success: false });
        }

        // Determine player role
        let role = null;
        for (const [r, client] of liveRoom.clients.entries()) {
            if (client.playerName === playerName) {
                role = r;
                client.lastSeen = Date.now();
                break;
            }
        }

        if (!role) {
            return res.status(409).json({ success: false });
        }

        // Process messages
        for (const msg of messages) {
            if (msg.type === 'state_update' && msg.state) {
                liveRoom.state.players[role] = {
                    ...msg.state,
                    playerName,
                    updatedAt: Date.now()
                };
            }
        }

        liveRoom.lastSync = Date.now();
        return res.json({ success: true });
    } catch (error) {
        console.error('Polling sync error:', error);
        return res.status(500).json({ success: false });
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
    const io = new SocketIOServer(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 30000,
        pingInterval: 10000
    });

    console.log('[Socket.IO] Server initialized');

    io.on('connection', (socket) => {
        console.log('[Socket.IO] New client connected:', socket.id);
        let context = {
            roomId: null,
            playerName: null,
            role: null
        };

        socket.on('join_room', async ({ roomId, playerName, shipType }) => {
            console.log(`[Socket.IO] Player "${playerName}" joining room "${roomId}"`);

            if (!roomId || !playerName) {
                console.error('[Socket.IO] Missing roomId or playerName');
                socket.emit('error', { error: 'roomId and playerName are required' });
                return;
            }

            const room = await roomsCollection.findOne({ roomId });
            if (!room || room.status === 'closed' || room.status === 'expired') {
                console.error(`[Socket.IO] Room unavailable: ${roomId}`);
                socket.emit('error', { error: 'Room unavailable' });
                return;
            }

            if (room.expiresAt && new Date(room.expiresAt).getTime() < Date.now()) {
                console.error(`[Socket.IO] Room expired: ${roomId}`);
                socket.emit('error', { error: 'Room expired' });
                return;
            }

            let role = null;
            if (room.hostName === playerName) role = 'host';
            else if (room.guestName === playerName) role = 'guest';

            if (!role) {
                console.error(`[Socket.IO] Player not in room: ${playerName} in ${roomId}`);
                socket.emit('error', { error: 'Player is not part of this room' });
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
                socket,
                playerName,
                shipType: shipType || 'default',
                lastSeen: Date.now()
            });

            context = { roomId, playerName, role };

            // Join Socket.IO room for easier broadcasting
            socket.join(roomId);

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

            socket.emit('joined_room', {
                role,
                roomId,
                hostName: room.hostName,
                guestName: room.guestName,
                players: liveRoom.state.players
            });

            console.log(`[Socket.IO] Player "${playerName}" (${role}) joined room "${roomId}"`);
            console.log(`[Socket.IO] Room "${roomId}" now has ${liveRoom.clients.size} clients`);

            // Notify peers
            for (const [peerRole, peer] of liveRoom.clients.entries()) {
                if (peerRole !== role) {
                    peer.socket.emit('peer_joined', { role, playerName, shipType: shipType || 'default' });
                    console.log(`[Socket.IO] Notified peer (${peerRole}) about new player (${role})`);
                }
            }
        });

        socket.on('heartbeat', async () => {
            if (!context.roomId || !context.role) return;

            const liveRoom = liveRooms.get(context.roomId);
            if (!liveRoom) return;
            const client = liveRoom.clients.get(context.role);
            if (!client) return;

            client.lastSeen = Date.now();

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
        });

        socket.on('state_update', async ({ state }) => {
            if (!context.roomId || !context.role) return;

            const liveRoom = liveRooms.get(context.roomId);
            if (!liveRoom) return;
            const client = liveRoom.clients.get(context.role);
            if (!client) return;

            client.lastSeen = Date.now();

            liveRoom.state.players[context.role] = {
                ...(state || {}),
                playerName: context.playerName,
                updatedAt: Date.now()
            };

            // Broadcast to other players in the room
            for (const [peerRole, peer] of liveRoom.clients.entries()) {
                if (peerRole !== context.role) {
                    peer.socket.emit('peer_state', {
                        from: context.role,
                        state: liveRoom.state.players[context.role]
                    });
                }
            }
        });

        socket.on('input_update', async ({ input }) => {
            if (!context.roomId || !context.role) return;

            const liveRoom = liveRooms.get(context.roomId);
            if (!liveRoom) return;
            const client = liveRoom.clients.get(context.role);
            if (!client) return;

            client.lastSeen = Date.now();

            // Broadcast to other players in the room
            for (const [peerRole, peer] of liveRoom.clients.entries()) {
                if (peerRole !== context.role) {
                    peer.socket.emit('peer_input', {
                        from: context.role,
                        input: input || {}
                    });
                }
            }
        });

        socket.on('player_died', async () => {
            if (!context.roomId) return;

            const liveRoom = liveRooms.get(context.roomId);
            if (!liveRoom) return;

            // Notify all players in the room
            for (const [, peer] of liveRoom.clients.entries()) {
                peer.socket.emit('force_game_over', {
                    reason: 'shared_death'
                });
            }
        });

        socket.on('leave_room', async () => {
            if (!context.roomId) return;
            await closeRoomForEveryone(context.roomId, 'left');
        });

        socket.on('disconnect', async () => {
            console.log(`[Socket.IO] Client disconnected: ${socket.id} (room: ${context.roomId}, role: ${context.role})`);
            if (!context.roomId || !context.role) return;
            await closeRoomForEveryone(context.roomId, 'disconnected');
        });

        socket.on('error', (error) => {
            console.error(`[Socket.IO] Error on connection:`, error.message);
        });
    });
}

async function closeRoomForEveryone(roomId, reason = 'closed') {
    const liveRoom = liveRooms.get(roomId);
    if (liveRoom) {
        for (const [, client] of liveRoom.clients.entries()) {
            try {
                client.socket.emit('room_closed', { roomId, reason });
            } catch (err) {
                console.error('[Socket.IO] Error sending room_closed:', err.message);
            }
            try {
                client.socket.disconnect(true);
            } catch (err) {
                console.error('[Socket.IO] Error disconnecting socket:', err.message);
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
        console.log(`🔌 Socket.IO ready on port ${PORT}`);
        console.log('========================================');
    });
}

startServer();
