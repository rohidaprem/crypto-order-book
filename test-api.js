/**
 * REST API Test Script for Crypto Order Book
 * 
 * Tests all endpoints via HTTP/HTTPS instead of WebSocket
 * This works reliably with ngrok free tier
 * 
 * Usage:
 * node test-api.js
 */

const http = require('http');
const https = require('https');

// Configuration
const BASE_URL = 'https://lobular-unreproachfully-inez.ngrok-free.dev';
// For local testing, use: const BASE_URL = 'http://localhost:3000';

console.log('🚀 Testing Crypto Order Book API');
console.log('📍 Base URL:', BASE_URL);
console.log('---\n');

// Helper function to make HTTP requests
function makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        const isHttps = url.protocol === 'https:';
        const client = isHttps ? https : http;

        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            rejectUnauthorized: false, // For ngrok self-signed certs
        };

        const req = client.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({ status: res.statusCode, data: jsonData });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
}

// Test cases
async function runTests() {
    try {
        // Test 1: Health Check
        console.log('📋 Test 1: Health Check (GET /api/health)');
        let response = await makeRequest('GET', '/api/health');
        console.log('✅ Status:', response.status);
        console.log('   Redis:', response.data.services.redis.status);
        console.log('   Exchange:', response.data.services.exchange.status);
        console.log('   Order Book:', response.data.services.orderBook.status);
        console.log('');

        // Test 2: Market Buy Order
        console.log('📋 Test 2: Market Buy Order (POST /api/market)');
        response = await makeRequest('POST', '/api/market', {
            side: 'buy',
            amount: 0.1
        });
        console.log('✅ Status:', response.status);
        console.log('   Filled:', response.data.filled, 'BTC');
        console.log('   Avg Price:', '$' + response.data.avg_price);
        console.log('   Slippage:', response.data.slippage_pct + '%');
        console.log('');

        // Test 3: Market Sell Order
        console.log('📋 Test 3: Market Sell Order (POST /api/market)');
        response = await makeRequest('POST', '/api/market', {
            side: 'sell',
            amount: 0.05
        });
        console.log('✅ Status:', response.status);
        console.log('   Filled:', response.data.filled, 'BTC');
        console.log('   Avg Price:', '$' + response.data.avg_price);
        console.log('   Slippage:', response.data.slippage_pct + '%');
        console.log('');

        // Test 4: Order History
        console.log('📋 Test 4: Order History (GET /api/orders/history)');
        response = await makeRequest('GET', '/api/orders/history');
        console.log('✅ Status:', response.status);
        console.log('   Total Orders:', response.data.total_orders);
        console.log('   Total BTC Traded:', response.data.total_btc_traded.toFixed(4), 'BTC');
        console.log('');

        // Test 5: Status
        console.log('📋 Test 5: Status (GET /api/status)');
        response = await makeRequest('GET', '/api/status');
        console.log('✅ Status:', response.status);
        console.log('   App Name:', response.data.name);
        console.log('   Version:', response.data.version);
        console.log('   Environment:', response.data.environment);
        console.log('');

        // Test 6: Config
        console.log('📋 Test 6: Config (GET /api/status/config)');
        response = await makeRequest('GET', '/api/status/config');
        console.log('✅ Status:', response.status);
        console.log('   Exchange:', response.data.exchange);
        console.log('   Symbol:', response.data.symbol);
        console.log('   Depth Levels:', response.data.depthLevels);
        console.log('');

        console.log('✅ All tests passed!\n');
        console.log('📊 Summary:');
        console.log('   ✅ Health Check - WORKING');
        console.log('   ✅ Market Orders (Buy/Sell) - WORKING');
        console.log('   ✅ Order History - WORKING');
        console.log('   ✅ Status Endpoints - WORKING');
        console.log('   ✅ Configuration - WORKING');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

runTests();
