import express from 'express';
import { MongoClient } from 'mongodb';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8000;

// MongoDB Connection String
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'midnight_fighter';
const COLLECTION_NAME = 'leaderboard';

let db;
let leaderboardCollection;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Connect to MongoDB
async function connectDB() {
    try {
        const client = await MongoClient.connect(MONGO_URI);
        
        db = client.db(DB_NAME);
        leaderboardCollection = db.collection(COLLECTION_NAME);
        
        // Create index on score for efficient sorting
        await leaderboardCollection.createIndex({ score: -1 });
        
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
        const { playerName, score, level, shipType } = req.body;
        
        // Validation
        if (!playerName || score === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Player name and score are required'
            });
        }
        
        // Check if player exists
        const existingPlayer = await leaderboardCollection.findOne({ playerName });
        
        if (existingPlayer) {
            // Update only if new score is higher
            if (score > existingPlayer.score) {
                await leaderboardCollection.updateOne(
                    { playerName },
                    {
                        $set: {
                            score,
                            level: level || existingPlayer.level,
                            shipType: shipType || existingPlayer.shipType,
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
                playerName,
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
    
    app.listen(PORT, () => {
        console.log('========================================');
        console.log('🚀 MIDNIGHT FIGHTER - Server Running');
        console.log('========================================');
        console.log(`🌐 Game URL: http://localhost:${PORT}`);
        console.log(`📊 API: http://localhost:${PORT}/api/leaderboard`);
        console.log('========================================');
    });
}

startServer();
