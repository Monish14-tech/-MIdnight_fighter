import { MongoClient } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'midnight_fighter';
const COLLECTION_NAME = 'leaderboard';

if (!MONGO_URI) {
    throw new Error('MONGO_URI is not set.');
}

let clientPromise;

if (!global._mongoClientPromise) {
    const client = new MongoClient(MONGO_URI);
    global._mongoClientPromise = client.connect();
}

clientPromise = global._mongoClientPromise;

export async function getLeaderboardCollection() {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    if (!global._leaderboardIndexCreated) {
        await collection.createIndex({ score: -1 });
        global._leaderboardIndexCreated = true;
    }

    return collection;
}
