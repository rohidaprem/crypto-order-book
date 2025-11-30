/**
 * Created By: Prem
 * Created At: 2025-11-30
 * Last Modified At: 2025-11-30
 *
 * Description:
 * Redis service providing order book storage, retrieval, and pub/sub
 * functionality. Manages sorted sets for bids/asks and publishes
 * real-time updates to connected WebSocket clients.
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import Config from '../config';
import { REDIS_CONFIG, ERROR_MESSAGES } from '../constants';
import { OrderBook, PriceLevel, RedisOrderBookEntry } from '../types';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RedisService.name);
    private readonly client: Redis;
    private readonly publisher: Redis;
    private readonly subscriber: Redis;

    constructor() {
        const redisOptions = {
            host: Config.redis.host,
            port: Config.redis.port,
            password: Config.redis.password,
            db: Config.redis.db,
            retryStrategy: (times: number) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
        };

        // Main client for read/write operations
        this.client = new Redis(redisOptions);

        // Publisher for pub/sub (separate connection required)
        this.publisher = new Redis(redisOptions);

        // Subscriber for pub/sub (separate connection required)
        this.subscriber = new Redis(redisOptions);
    }

    async onModuleInit() {
        this.logger.log('Initializing Redis connections...');

        this.client.on('error', (err) => {
            this.logger.error(`Redis client error: ${err.message}`);
        });

        this.client.on('connect', () => {
            this.logger.log('Redis client connected');
        });

        this.publisher.on('error', (err) => {
            this.logger.error(`Redis publisher error: ${err.message}`);
        });

        this.subscriber.on('error', (err) => {
            this.logger.error(`Redis subscriber error: ${err.message}`);
        });
    }

    async onModuleDestroy() {
        this.logger.log('Closing Redis connections...');
        await this.client.quit();
        await this.publisher.quit();
        await this.subscriber.quit();
    }

    /**
    * Store order book in Redis sorted sets
    * 
    * Bids are stored with negative scores to maintain descending order (highest price first)
    * Asks are stored with positive scores to maintain ascending order (lowest price first)
    * 
    * This design allows efficient retrieval of best prices using ZRANGE
    * 
    * @param orderBook - Order book snapshot to store
    */
    async storeOrderBook(orderBook: OrderBook): Promise<void> {
        try {
            const pipeline = this.client.pipeline();

            // Clear existing data
            pipeline.del(REDIS_CONFIG.BIDS_KEY);
            pipeline.del(REDIS_CONFIG.ASKS_KEY);

            // Store bids with negative scores for descending order
            // This ensures ZRANGE returns highest price first
            if (orderBook.bids.length > 0) {
                const bidsArgs: (string | number)[] = [];
                for (const [price, quantity] of orderBook.bids) {
                    bidsArgs.push(-price, quantity.toString());
                }
                pipeline.zadd(REDIS_CONFIG.BIDS_KEY, ...bidsArgs);
                pipeline.expire(REDIS_CONFIG.BIDS_KEY, REDIS_CONFIG.KEY_TTL);
            }

            // Store asks with positive scores for ascending order
            // This ensures ZRANGE returns lowest price first
            if (orderBook.asks.length > 0) {
                const asksArgs: (string | number)[] = [];
                for (const [price, quantity] of orderBook.asks) {
                    asksArgs.push(price, quantity.toString());
                }
                pipeline.zadd(REDIS_CONFIG.ASKS_KEY, ...asksArgs);
                pipeline.expire(REDIS_CONFIG.ASKS_KEY, REDIS_CONFIG.KEY_TTL);
            }

            await pipeline.exec();
            
            // Log detailed information about what was stored
            if (orderBook.bids.length > 0) {
                const topBids = orderBook.bids.slice(0, 3);
                this.logger.log(`📊 BIDS STORED: ${orderBook.bids.length} levels`);
                topBids.forEach(([price, qty], idx) => {
                    this.logger.log(`   Bid #${idx + 1}: Price=$${price.toFixed(2)} | Qty=${qty.toFixed(8)}`);
                });
            }
            
            if (orderBook.asks.length > 0) {
                const topAsks = orderBook.asks.slice(0, 3);
                this.logger.log(`📊 ASKS STORED: ${orderBook.asks.length} levels`);
                topAsks.forEach(([price, qty], idx) => {
                    this.logger.log(`   Ask #${idx + 1}: Price=$${price.toFixed(2)} | Qty=${qty.toFixed(8)}`);
                });
            }
            
            this.logger.debug(`Stored order book: ${orderBook.bids.length} bids, ${orderBook.asks.length} asks`);
        } catch (error) {
            const err = error as Error;
            this.logger.error(`Failed to store order book: ${err.message}`);
            throw error;
        }
    }

    /**
    * Retrieve top N price levels from Redis
    * 
    * @param limit - Number of levels to retrieve (default: 10)
    * @returns Order book with top levels
    */
    async getOrderBook(limit: number = 10): Promise<OrderBook> {
        try {
            const pipeline = this.client.pipeline();

            // Fetch top bids (ZRANGE 0 to limit-1 for highest prices)
            pipeline.zrange(REDIS_CONFIG.BIDS_KEY, 0, limit - 1, 'WITHSCORES');

            // Fetch top asks (ZRANGE 0 to limit-1 for lowest prices)
            pipeline.zrange(REDIS_CONFIG.ASKS_KEY, 0, limit - 1, 'WITHSCORES');

            const results = await pipeline.exec();

            if (!results) {
                throw new Error(ERROR_MESSAGES.ORDER_BOOK_NOT_AVAILABLE);
            }

            // Parse bids - convert negative scores back to positive prices
            const bids = this.parseRedisZRange(results[0][1] as string[], true);

            // Parse asks - scores are already positive
            const asks = this.parseRedisZRange(results[1][1] as string[], false);

            return {
                bids,
                asks,
                timestamp: Date.now(),
            };
        } catch (error) {
            const err = error as Error;
            this.logger.error(`Failed to retrieve order book: ${err.message}`);
            throw error;
        }
    }

    /**
    * Get all bids and asks for market order simulation
    * 
    * @returns Complete order book
    */
    async getFullOrderBook(): Promise<OrderBook> {
        try {
            const pipeline = this.client.pipeline();

            // Fetch all bids
            pipeline.zrange(REDIS_CONFIG.BIDS_KEY, 0, -1, 'WITHSCORES');

            // Fetch all asks
            pipeline.zrange(REDIS_CONFIG.ASKS_KEY, 0, -1, 'WITHSCORES');

            const results = await pipeline.exec();

            if (!results) {
                throw new Error(ERROR_MESSAGES.ORDER_BOOK_NOT_AVAILABLE);
            }

            const bids = this.parseRedisZRange(results[0][1] as string[], true);
            const asks = this.parseRedisZRange(results[1][1] as string[], false);

            return {
                bids,
                asks,
                timestamp: Date.now(),
            };
        } catch (error) {
            const err = error as Error;
            this.logger.error(`Failed to retrieve full order book: ${err.message}`);
            throw error;
        }
    }


    /**
     * Publish order book update to Redis pub/sub channel
     * 
     * WebSocket gateway subscribes to this channel and pushes updates to clients
     * 
     * @param orderBook - Order book snapshot to publish
     */
    async publishUpdate(orderBook: OrderBook): Promise<void> {
        try {
            const message = JSON.stringify(orderBook);
            await this.publisher.publish(REDIS_CONFIG.DEPTH_CHANNEL, message);
            this.logger.debug('Published order book update to channel');
        } catch (error) {
            const err = error as Error;
            this.logger.error(`Failed to publish update: ${err.message}`);
            throw error;
        }
    }

    /**
    * Subscribe to depth updates channel
    * 
    * @param callback - Function to call when update received
    */
    async subscribeToUpdates(callback: (orderBook: OrderBook) => void): Promise<void> {
        try {
            await this.subscriber.subscribe(REDIS_CONFIG.DEPTH_CHANNEL);

            this.subscriber.on('message', (channel, message) => {
                if (channel === REDIS_CONFIG.DEPTH_CHANNEL) {
                    try {
                        const orderBook = JSON.parse(message) as OrderBook;
                        callback(orderBook);
                    } catch (error) {
                        const err = error as Error;
                        this.logger.error(`Failed to parse published message: ${err.message}`);
                    }
                }
            });

            this.logger.log('Subscribed to depth updates channel');
        } catch (error) {
            const err = error as Error;
            this.logger.error(`Failed to subscribe to updates: ${err.message}`);
            throw error;
        }
    }

    /**
    * Parse Redis ZRANGE result with scores into price levels
    * 
    * Redis returns [member, score, member, score, ...] array
    * We need to convert to [[price, quantity], ...] format
    * 
    * @param data - Redis ZRANGE result
    * @param isBids - Whether parsing bids (need to negate scores)
    * @returns Array of price levels
    */
    private parseRedisZRange(data: string[], isBids: boolean): PriceLevel[] {
        const levels: PriceLevel[] = [];

        for (let i = 0; i < data.length; i += 2) {
            const quantity = parseFloat(data[i]);
            let price = parseFloat(data[i + 1]);

            // For bids, scores are negative, so negate to get actual price
            if (isBids) {
                price = -price;
            }

            levels.push([price, quantity]);
        }

        return levels;
    }

    /**
    * Health check - verify Redis connection
    */
    async healthCheck(): Promise<boolean> {
        try {
            await this.client.ping();
            return true;
        } catch (error) {
            const err = error as Error;
            this.logger.error(`Redis health check failed: ${err.message}`);
            return false;
        }
    }

    /**
    * Get the Redis client for direct operations
    * Use with caution - prefer using service methods when available
    */
    getClient(): Redis {
        return this.client;
    }
}