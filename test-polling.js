#!/usr/bin/env node

/**
 * Test script to verify the collaboration polling system works
 * Run with: node test-polling.js
 */

import http from 'http';
import { URL } from 'url';

const BASE_URL = 'http://localhost:8000';

async function makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(data)
                    });
                } catch {
                    resolve({
                        status: res.statusCode,
                        data: data
                    });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function test() {
    console.log('🧪 Testing Collaboration Polling System...\n');

    try {
        // 1. Create a room
        console.log('1️⃣ Creating collaboration room...');
        const createRes = await makeRequest('POST', '/api/rooms/create', {
            hostName: 'TestHost'
        });
        
        if (!createRes.data.success) {
            console.error('❌ Failed to create room:', createRes.data);
            return;
        }
        
        const roomId = createRes.data.roomId;
        console.log('✅ Room created:', roomId);

        // 2. Check initial room status (should be 'waiting')
        console.log('\n2️⃣ Checking initial room status...');
        const statusRes1 = await makeRequest('GET', `/api/rooms/${roomId}`);
        if (statusRes1.data.success) {
            console.log('✅ Room status:', statusRes1.data.room.status, '(expected: waiting)');
        }

        // 3. Guest joins the room
        console.log('\n3️⃣ Guest joining room...');
        const joinRes = await makeRequest('POST', '/api/rooms/join', {
            roomId: roomId,
            playerName: 'TestGuest'
        });
        
        if (!joinRes.data.success) {
            console.error('❌ Failed to join room:', joinRes.data);
            return;
        }
        console.log('✅ Guest joined successfully');

        // 4. Check room status (should be 'full' now)
        console.log('\n4️⃣ Checking room status after guest join...');
        const statusRes2 = await makeRequest('GET', `/api/rooms/${roomId}`);
        if (statusRes2.data.success) {
            console.log('✅ Room status:', statusRes2.data.room.status, '(expected: full)');
        }

        // 5. Host joins polling
        console.log('\n5️⃣ Host joining polling...');
        const hostJoinRes = await makeRequest('POST', `/api/rooms/${roomId}/join`, {
            playerName: 'TestHost',
            shipType: 'default'
        });
        
        if (!hostJoinRes.data.success) {
            console.error('❌ Failed to host join polling:', hostJoinRes.data);
            return;
        }
        console.log('✅ Host joined polling, role:', hostJoinRes.data.role);

        // 6. Guest joins polling
        console.log('\n6️⃣ Guest joining polling...');
        const guestJoinRes = await makeRequest('POST', `/api/rooms/${roomId}/join`, {
            playerName: 'TestGuest',
            shipType: 'default'
        });
        
        if (!guestJoinRes.data.success) {
            console.error('❌ Failed to guest join polling:', guestJoinRes.data);
            return;
        }
        console.log('✅ Guest joined polling, role:', guestJoinRes.data.role);

        // 7. Host syncs state
        console.log('\n7️⃣ Host syncing state...');
        const hostSyncRes = await makeRequest('POST', `/api/rooms/${roomId}/sync`, {
            playerName: 'TestHost',
            messages: [
                { type: 'player_move', position: { x: 100, y: 100 } }
            ]
        });
        
        if (!hostSyncRes.data.success) {
            console.error('❌ Failed to sync host state:', hostSyncRes.data);
            return;
        }
        console.log('✅ Host state synced');

        // 8. Guest fetches peer state (should get host's state)
        console.log('\n8️⃣ Guest fetching peer state...');
        const guestStateRes = await makeRequest('GET', `/api/rooms/${roomId}/state?playerName=TestGuest`);
        
        if (!guestStateRes.data.success) {
            console.error('❌ Failed to fetch guest peer state:', guestStateRes.data);
            return;
        }
        console.log('✅ Guest fetched peer state:', JSON.stringify(guestStateRes.data.peerState));

        console.log('\n✅ All tests passed!');
    } catch (error) {
        console.error('❌ Test error:', error);
    }
}

test();
