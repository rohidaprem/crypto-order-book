/**
 * WebSocket Test Script for Crypto Order Book
 * 
 * Tests real-time WebSocket connections and depth updates
 * 
 * Usage:
 * node test-websocket.js
 */

const io = require('socket.io-client');

// Configuration
// For online testing via ngrok, use the full URL with proper Socket.io handling
// For local testing, use: const WEBSOCKET_URL = 'http://localhost:3000';
const WEBSOCKET_URL = 'https://lobular-unreproachfully-inez.ngrok-free.dev';

console.log('🚀 Connecting to WebSocket:', WEBSOCKET_URL);
console.log('⏳ Waiting for connection...\n');

// Create Socket.io connection with proper configuration for ngrok
const socket = io(WEBSOCKET_URL, {
    transports: ['websocket', 'polling'],  // Try websocket first, fallback to polling
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    upgrade: true,
    rejectUnauthorized: false,  // For self-signed certs via ngrok
    secure: true,
    path: '/socket.io'
});

// Connection event
socket.on('connect', () => {
    console.log('✅ Connected to WebSocket server');
    console.log('📊 Listening for depth updates...\n');
});

// Depth update event
socket.on('depth', (data) => {
    console.log('📈 Depth Update Received:');
    console.log('   Bids (top 3):', data.bids ? data.bids.slice(0, 3) : 'N/A');
    console.log('   Asks (top 3):', data.asks ? data.asks.slice(0, 3) : 'N/A');
    console.log('   Timestamp:', new Date().toISOString());
    console.log('---');
});

// Error event
socket.on('error', (error) => {
    console.error('❌ WebSocket Error:', error);
});

// Disconnect event
socket.on('disconnect', (reason) => {
    console.log('🔌 Disconnected:', reason);
});

// Connection error
socket.on('connect_error', (error) => {
    console.error('❌ Connection Error:', error.message);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Closing WebSocket connection...');
    socket.disconnect();
    process.exit(0);
});

console.log('Press CTRL+C to exit\n');
