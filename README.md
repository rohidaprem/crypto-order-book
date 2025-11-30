# Crypto Order Book Simulator

A real-time cryptocurrency order book simulator built with NestJS and WebSocket support. Simulates market order execution on order book data fetched from crypto exchanges via CCXT.

## Overview

This application provides a trading simulator that:
- Fetches real-time order book data from cryptocurrency exchanges (Binance)
- Simulates market order execution with slippage calculation
- Tracks order history by IP and date
- Provides real-time order book updates via WebSocket
- Offers health checks and system status endpoints

## Tech Stack

- **Framework:** NestJS 10
- **Language:** TypeScript 5
- **Exchange API:** CCXT 4
- **Real-time:** Socket.io & WebSocket
- **Caching:** Redis (ioredis)
- **Validation:** Zod
- **Testing:** Jest
- **Rate Limiting:** NestJS Throttler
- **Environment:** Node.js 20+, Docker Compose

## Setup & Commands

```bash
# Start Docker services (Redis)
docker-compose up -d

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Watch mode for development
npm run test:watch
```

## Redis CLI Access

To access Redis CLI when it's running in Docker:

```bash
docker exec -it crypto-order-book-redis-1 redis-cli
```

Once inside redis-cli, use these commands to inspect the order book:

```redis
# View all keys in Redis
> KEYS *

# Check current bids (highest prices first - top 10)
> ZREVRANGE bids 0 9 WITHSCORES

# Check current asks (lowest prices first - top 10)  
> ZRANGE asks 0 9 WITHSCORES

# Get number of bids and asks
> ZCARD bids
> ZCARD asks

# Get the best bid and ask prices
> ZREVRANGE bids 0 0 WITHSCORES
> ZRANGE asks 0 0 WITHSCORES

# Subscribe to real-time depth updates
> SUBSCRIBE depth:update

# Monitor all Redis commands in real-time
> MONITOR

# Check Redis memory usage
> INFO memory

# Get total number of keys
> DBSIZE

# Clear all order book data (use with caution)
> DEL bids asks
> FLUSHDB
```

## API Endpoints

### Market Orders
**POST** `/api/market`
- Simulate market order execution
- **Parameters:**
  - `side` (string, required): `"buy"` or `"sell"`
  - `amount` (number, required): Order amount in BTC (min: 0.001, max: 100)
- **Response:** Execution result with fills, average price, and slippage

**Example:**
```bash
curl -X POST http://localhost:3000/api/market \
  -H "Content-Type: application/json" \
  -d '{"side": "buy", "amount": 0.5}'
```

### Order History
**GET** `/api/orders/history`
- Retrieve all orders grouped by IP and date
- **Response:** Total orders, BTC traded, grouped by IP and date

**GET** `/api/orders/history/ip/{ip}`
- Retrieve orders for specific IP
- **Query Parameters:**
  - `date` (string, optional): Filter by date (YYYY-MM-DD format)
- **Response:** Order count and history for IP

**GET** `/api/orders/history/date/{date}`
- Retrieve orders for specific date
- **Parameters:**
  - `date` (string, required): Date in YYYY-MM-DD format
- **Response:** Orders grouped by IP for the date

**Examples:**
```bash
curl http://localhost:3000/api/orders/history
curl http://localhost:3000/api/orders/history/ip/192.168.1.1
curl http://localhost:3000/api/orders/history/ip/192.168.1.1?date=2025-11-30
curl http://localhost:3000/api/orders/history/date/2025-11-30
```

### Health & Status
**GET** `/api/health`
- Comprehensive health check of all services
- **Response:** Redis, CCXT, order book status, uptime, config

**GET** `/api/status`
- Application status and version
- **Response:** App name, version, environment, uptime, Node/platform info

**GET** `/api/status/config`
- Public configuration
- **Response:** Exchange info, symbol, depth levels, update interval

**Examples:**
```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/status
curl http://localhost:3000/api/status/config
```

### WebSocket
**WS** `/socket.io`
- Real-time order book updates
- Emits depth data on order book changes