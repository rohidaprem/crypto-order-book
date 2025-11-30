/**
 * Created By: Prem
 * Created At: 2025-11-30
 * Last Modified At: 2025-11-30
 *
 * Description:
 * Centralized configuration management using environment variables.
 * All sensitive data and configurable parameters are loaded from .env
 * and accessed through this config module for consistency across the app.
 */

import { config } from 'dotenv';

// Load environment variables from .env file
config();

/**
 * Validates required environment variables
 */
function validateEnv(): void {
    const required = ['REDIS_HOST', 'REDIS_PORT'];
    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

// Validate on load (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
    validateEnv();
}

/**
 * Application Configuration
 */
export const AppConfig = {
    // Server configuration
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
    apiPrefix: process.env.API_PREFIX || 'api',

    // CORS configuration
    corsOrigin: process.env.CORS_ORIGIN || '*',
    corsCredentials: process.env.CORS_CREDENTIALS === 'true',
} as const;

/**
 * Redis Configuration
 */
export const RedisConfig = {
    // Connection settings
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),

    // Key configuration
    bidsKey: process.env.REDIS_BIDS_KEY || 'bids',
    asksKey: process.env.REDIS_ASKS_KEY || 'asks',
    depthChannel: process.env.REDIS_DEPTH_CHANNEL || 'depth:update',

    // TTL configuration
    keyTTL: parseInt(process.env.REDIS_KEY_TTL || '600', 10), // 10 minutes

    // Retry configuration
    retryAttempts: parseInt(process.env.REDIS_RETRY_ATTEMPTS || '3', 10),
    retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '1000', 10),
} as const;

/**
 * Exchange (CCXT) Configuration
 */
export const ExchangeConfig = {
    // Exchange settings
    name: process.env.EXCHANGE_NAME || 'binance',
    symbol: process.env.TRADING_SYMBOL || 'BTC/USDT',

    // API credentials (optional for public endpoints)
    apiKey: process.env.EXCHANGE_API_KEY || undefined,
    apiSecret: process.env.EXCHANGE_API_SECRET || undefined,

    // Fetch settings
    depthLevels: parseInt(process.env.DEPTH_LEVELS || '20', 10),
    updateIntervalMs: parseInt(process.env.UPDATE_INTERVAL_MS || '2000', 10),
    timeout: parseInt(process.env.EXCHANGE_TIMEOUT || '10000', 10),

    // Retry settings
    maxRetryAttempts: parseInt(process.env.EXCHANGE_MAX_RETRY_ATTEMPTS || '3', 10),
    retryDelayMs: parseInt(process.env.EXCHANGE_RETRY_DELAY_MS || '1000', 10),
    retryBackoffMultiplier: parseFloat(process.env.EXCHANGE_RETRY_BACKOFF || '2'),

    // Rate limiting
    enableRateLimit: process.env.EXCHANGE_RATE_LIMIT !== 'false',
} as const;

/**
 * WebSocket Configuration
 */
export const WebSocketConfig = {
    // Path and connection settings
    path: process.env.WS_PATH || '/ws/depth',
    maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS || '100', 10),

    // CORS settings
    corsOrigin: process.env.WS_CORS_ORIGIN || process.env.CORS_ORIGIN || '*',
    corsCredentials: process.env.WS_CORS_CREDENTIALS === 'true',

    // Heartbeat settings
    pingInterval: parseInt(process.env.WS_PING_INTERVAL || '25000', 10),
    pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '5000', 10),

    // Data settings
    topLevelsToPublish: parseInt(process.env.WS_TOP_LEVELS || '10', 10),
} as const;

/**
 * Rate Limiting Configuration
 */
export const RateLimitConfig = {
    // Global rate limiting
    ttl: parseInt(process.env.RATE_LIMIT_TTL || '60000', 10), // 60 seconds
    limit: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10', 10), // 10 requests

    // Per-endpoint overrides
    marketEndpoint: {
        ttl: parseInt(process.env.RATE_LIMIT_MARKET_TTL || '60000', 10),
        limit: parseInt(process.env.RATE_LIMIT_MARKET_MAX_REQUESTS || '10', 10),
    },
} as const;

/**
 * Market Order Configuration
 */
export const MarketOrderConfig = {
    // Order size limits
    minOrderSize: parseFloat(process.env.MIN_ORDER_SIZE || '0.0001'),
    maxOrderSize: parseFloat(process.env.MAX_ORDER_SIZE || '1000'),

    // Precision settings
    pricePrecision: parseInt(process.env.PRICE_PRECISION || '2', 10),
    quantityPrecision: parseInt(process.env.QUANTITY_PRECISION || '8', 10),
} as const;

/**
 * Logging Configuration
 */
export const LoggingConfig = {
    // Log level
    level: process.env.LOG_LEVEL || 'log',

    // Enable debug mode
    debug: process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development',

    // Enable verbose logging
    verbose: process.env.VERBOSE === 'true',
} as const;

/**
 * Feature Flags
 */
export const FeatureFlags = {
    // Enable/disable features
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    enableHealthCheck: process.env.ENABLE_HEALTH_CHECK !== 'false',
    enableSwagger: process.env.ENABLE_SWAGGER === 'true',
} as const;

/**
 * Export all configuration as a single object
 */
export const Config = {
    app: AppConfig,
    redis: RedisConfig,
    exchange: ExchangeConfig,
    websocket: WebSocketConfig,
    rateLimit: RateLimitConfig,
    marketOrder: MarketOrderConfig,
    logging: LoggingConfig,
    features: FeatureFlags,
} as const;

export default Config;