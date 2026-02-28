import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI;          // Room database
const MONGO_URI1 = process.env.MONGO_URI1;        // Leaderboard database
const DB_NAME = 'midnight_fighter';
const COLLECTION_NAME = 'leaderboard';
const ROOMS_COLLECTION_NAME = 'rooms';

if (!MONGO_URI) {
    throw new Error('MONGO_URI is not set.');
}

if (!MONGO_URI1) {
    throw new Error('MONGO_URI1 is not set.');
}

let roomsClientPromise;
let leaderboardClientPromise;

// Connect to rooms database
if (!global._roomsClientPromise) {
    const client = new MongoClient(MONGO_URI);
    global._roomsClientPromise = client.connect();
}
roomsClientPromise = global._roomsClientPromise;

// Connect to leaderboard database
if (!global._leaderboardClientPromise) {
    const client = new MongoClient(MONGO_URI1);
    global._leaderboardClientPromise = client.connect();
}
leaderboardClientPromise = global._leaderboardClientPromise;

export async function getLeaderboardCollection() {
    const client = await leaderboardClientPromise;
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    if (!global._leaderboardIndexCreated) {
        await collection.createIndex({ score: -1 });
        global._leaderboardIndexCreated = true;
    }

    return collection;
}

export async function getRoomsCollection() {
    const client = await roomsClientPromise;
    const db = client.db(DB_NAME);
    const collection = db.collection(ROOMS_COLLECTION_NAME);

    if (!global._roomsIndexCreated) {
        await collection.createIndex({ roomId: 1 }, { unique: true });
        global._roomsIndexCreated = true;
    }

    return collection;
}
