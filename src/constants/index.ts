/**

 * Created By: Prem
 * Created At: 2025-11-30
 * Last Modified At: 2025-11-30
 *
 * Description:
 * Re-export configuration from centralized config module.
 * This file is kept for backward compatibility but all
 * new code should import directly from config/index.ts
 */

import Config from '../config';

/**
 * Order Book Configuration
 */
export const ORDER_BOOK_CONFIG = {
    UPDATE_INTERVAL_MS: Config.exchange.updateIntervalMs,
    DEPTH_LEVELS: Config.exchange.depthLevels,
    TOP_LEVELS: Config.websocket.topLevelsToPublish,
    SYMBOL: Config.exchange.symbol,
    EXCHANGE: Config.exchange.name,
} as const;

/**
 * Redis Configuration
 */
export const REDIS_CONFIG = {
    BIDS_KEY: Config.redis.bidsKey,
    ASKS_KEY: Config.redis.asksKey,
    DEPTH_CHANNEL: Config.redis.depthChannel,
    HOST: Config.redis.host,
    PORT: Config.redis.port,
    KEY_TTL: Config.redis.keyTTL,
} as const;

/**
 * Retry Logic Configuration
 */
export const RETRY_CONFIG = {
    MAX_ATTEMPTS: Config.exchange.maxRetryAttempts,
    INITIAL_DELAY_MS: Config.exchange.retryDelayMs,
    BACKOFF_MULTIPLIER: Config.exchange.retryBackoffMultiplier,
} as const;

/**
 * WebSocket Configuration
 */
export const WEBSOCKET_CONFIG = {
    PATH: Config.websocket.path,
    MAX_CONNECTIONS: Config.websocket.maxConnections,
    CORS: {
        origin: Config.websocket.corsOrigin,
        credentials: Config.websocket.corsCredentials,
    },
    PING_INTERVAL: Config.websocket.pingInterval,
    PING_TIMEOUT: Config.websocket.pingTimeout,
} as const;

/**
 * Market Order Configuration
 */
export const MARKET_ORDER_CONFIG = {
    MIN_ORDER_SIZE: Config.marketOrder.minOrderSize,
    MAX_ORDER_SIZE: Config.marketOrder.maxOrderSize,
    PRICE_PRECISION: Config.marketOrder.pricePrecision,
    QUANTITY_PRECISION: Config.marketOrder.quantityPrecision,
} as const;

/**
 * Application Configuration
 */
export const APP_CONFIG = {
    PORT: Config.app.port,
    API_PREFIX: Config.app.apiPrefix,
    NAME: 'Crypto Order Book Simulator',
    VERSION: '1.0.0',
} as const;

/**
 * Logging Configuration
 */
export const LOG_CONFIG = {
    DEBUG: Config.logging.debug,
    LEVELS: ['log', 'error', 'warn', 'debug', 'verbose'],
} as const;

/**
 * Error Messages
 */
export const ERROR_MESSAGES = {
    INSUFFICIENT_LIQUIDITY: 'Insufficient liquidity to fill order',
    INVALID_ORDER_SIZE: 'Order size must be within allowed limits',
    INVALID_SIDE: 'Order side must be either "buy" or "sell"',
    CCXT_FETCH_FAILED: 'Failed to fetch order book from exchange',
    REDIS_CONNECTION_FAILED: 'Failed to connect to Redis',
    ORDER_BOOK_NOT_AVAILABLE: 'Order book data not available',
} as const;

