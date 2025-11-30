
/**
 * Created By: Prem
 * Created At: 2025-11-30
 * Last Modified At: 2025-11-30
 *
 * Description:
 * Order book service that orchestrates the background updater.
 * Fetches data from CCXT, stores in Redis, and publishes updates.
 * Runs automatically on application bootstrap.
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { CcxtService } from './ccxt.service';
import { RedisService } from './redis.service';
import { ORDER_BOOK_CONFIG } from '../constants';
import { validateOrderBook } from '../utils/order-book.utils';

@Injectable()
export class OrderBookService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(OrderBookService.name);
    private updateInterval: NodeJS.Timeout | null = null;
    private isRunning = false;

    constructor(
        private readonly ccxtService: CcxtService,
        private readonly redisService: RedisService,
    ) { }

    /**
    * Start background order book updater on module initialization
    * 
    * This ensures the order book starts updating as soon as the
    * application starts, without requiring manual intervention.
    */
    async onModuleInit() {
        this.logger.log('Starting order book updater...');
        await this.startUpdater();
    }

    /**
    * Stop background updater on module destruction
    */
    async onModuleDestroy() {
        this.logger.log('Stopping order book updater...');
        this.stopUpdater();
    }

    /**
    * Start the background order book updater
    * 
    * Runs every UPDATE_INTERVAL_MS (2 seconds by default):
    * 1. Fetch order book from Binance via CCXT
    * 2. Validate order book integrity
    * 3. Store full order book in Redis
    * 4. Publish top N levels to pub/sub channel
    * 
    * The updater is resilient:
    * - Continues running even if individual updates fail
    * - CCXT service handles retries internally
    * - Logs errors without crashing the application
    */
    async startUpdater(): Promise<void> {
        if (this.isRunning) {
            this.logger.warn('Updater is already running');
            return;
        }

        this.isRunning = true;

        // Perform initial update immediately
        await this.updateOrderBook();

        // Schedule periodic updates
        this.updateInterval = setInterval(async () => {
            await this.updateOrderBook();
        }, ORDER_BOOK_CONFIG.UPDATE_INTERVAL_MS);

        this.logger.log(
            `Order book updater started (interval: ${ORDER_BOOK_CONFIG.UPDATE_INTERVAL_MS}ms)`,
        );
    }

    /**
    * Stop the background updater
    */
    stopUpdater(): void {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.isRunning = false;
        this.logger.log('Order book updater stopped');
    }

    /**
    * Perform a single order book update cycle
    * 
    * This is the core update logic that runs every 2 seconds:
    * 1. Fetch fresh data from Binance
    * 2. Validate the data structure
    * 3. Store complete order book in Redis
    * 4. Extract top N levels for WebSocket clients
    * 5. Publish update to Redis pub/sub channel
    * 
    * Error handling:
    * - Catches and logs all errors
    * - Does not throw (prevents crashing the interval)
    * - CCXT retries are handled in CcxtService
    */
    private async updateOrderBook(): Promise<void> {
        try {
            // Step 1: Fetch order book from Binance
            // CcxtService handles retries with exponential backoff
            const orderBook = await this.ccxtService.fetchOrderBook();

            // Step 2: Validate order book structure
            // Ensures bids are descending, asks are ascending, no overlap
            if (!validateOrderBook(orderBook)) {
                this.logger.error('Invalid order book structure received');
                return;
            }

            // Step 3: Store complete order book in Redis
            // Uses sorted sets with negative scores for bids (descending order)
            // and positive scores for asks (ascending order)
            await this.redisService.storeOrderBook(orderBook);

            // Step 4: Prepare top N levels for WebSocket broadcast
            // We only send top levels to reduce bandwidth and improve performance
            const topLevels = {
                bids: orderBook.bids.slice(0, ORDER_BOOK_CONFIG.TOP_LEVELS),
                asks: orderBook.asks.slice(0, ORDER_BOOK_CONFIG.TOP_LEVELS),
                timestamp: orderBook.timestamp,
            };

            // Step 5: Publish to Redis pub/sub channel
            // WebSocket gateway subscribes to this and pushes to connected clients
            await this.redisService.publishUpdate(topLevels);

            this.logger.debug(
                `Order book updated: ${orderBook.bids.length} bids, ${orderBook.asks.length} asks`,
            );
        } catch (error) {
            // Log error but don't throw - keep the updater running
            // Individual failures should not crash the entire service
            const err = error as Error;
            this.logger.error(`Failed to update order book: ${err.message}`);
        }
    }

    /**
    * Get current updater status
    */
    getStatus(): { running: boolean; interval: number } {
        return {
            running: this.isRunning,
            interval: ORDER_BOOK_CONFIG.UPDATE_INTERVAL_MS,
        };
    }

    /**
    * Manually trigger an update (useful for testing)
    */
    async triggerUpdate(): Promise<void> {
        this.logger.log('Manual update triggered');
        await this.updateOrderBook();
    }
}

