/**
 * Created By: Prem
 * Created At: 2025-11-30
 * Last Modified At: 2025-11-30
 *
 * Description:
 * CCXT service for fetching order book data from Binance exchange.
 * Implements retry logic with exponential backoff for network resilience.
 * Handles rate limits and API errors gracefully.
 */

import { Injectable, Logger } from '@nestjs/common';
import * as ccxt from 'ccxt';
import Config from '../config';
import { ORDER_BOOK_CONFIG, RETRY_CONFIG, ERROR_MESSAGES } from '../constants';
import { CCXTOrderBook, OrderBook } from '../types';

@Injectable()
export class CcxtService {
    private readonly logger = new Logger(CcxtService.name);
    private readonly exchange: ccxt.binance;

    constructor() {
        // Initialize Binance exchange with optional API credentials
        const exchangeConfig: Record<string, any> = {
            enableRateLimit: Config.exchange.enableRateLimit,
            timeout: Config.exchange.timeout,
        };

        // Add API credentials if provided (optional for public endpoints)
        if (Config.exchange.apiKey && Config.exchange.apiSecret) {
            exchangeConfig.apiKey = Config.exchange.apiKey;
            exchangeConfig.secret = Config.exchange.apiSecret;
            this.logger.log('CCXT initialized with API credentials');
        } else {
            this.logger.log('CCXT initialized without API credentials (public data only)');
        }

        this.exchange = new ccxt.binance(exchangeConfig);
        this.logger.log(`CCXT ${Config.exchange.name} exchange initialized`);
    }

    /**
    * Fetch order book from Binance with retry logic
    * 
    * Uses exponential backoff strategy:
    * - Attempt 1: immediate
    * - Attempt 2: wait 1s
    * - Attempt 3: wait 2s
    * 
    * This prevents hammering the exchange during temporary outages
    * and respects API rate limits
    * 
    * @returns Order book snapshot from Binance
    */
    async fetchOrderBook(): Promise<OrderBook> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= RETRY_CONFIG.MAX_ATTEMPTS; attempt++) {
            try {
                this.logger.debug(`Fetching order book (attempt ${attempt}/${RETRY_CONFIG.MAX_ATTEMPTS})`);

                // Fetch order book with specified depth
                const orderBook = await this.exchange.fetchOrderBook(
                    ORDER_BOOK_CONFIG.SYMBOL,
                    ORDER_BOOK_CONFIG.DEPTH_LEVELS,
                );

                // Transform CCXT response to our internal format
                const result = this.transformOrderBook(orderBook as unknown as CCXTOrderBook);

                this.logger.debug(
                    `Fetched order book: ${result.bids.length} bids, ${result.asks.length} asks`
                );

                return result;
            } catch (error) {
                lastError = error as Error;
                const err = error as Error;
                this.logger.warn(
                    `Attempt ${attempt} failed: ${err.message}`
                );

                // Don't wait after last attempt
                if (attempt < RETRY_CONFIG.MAX_ATTEMPTS) {
                    const delay = RETRY_CONFIG.INITIAL_DELAY_MS *
                        Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt - 1);

                    this.logger.debug(`Waiting ${delay}ms before retry...`);
                    await this.sleep(delay);
                }
            }
        }

        // All retries exhausted
        this.logger.error(
            `Failed to fetch order book after ${RETRY_CONFIG.MAX_ATTEMPTS} attempts: ${lastError?.message}`
        );
        throw new Error(ERROR_MESSAGES.CCXT_FETCH_FAILED);
    }

    /**
    * Transform CCXT order book format to internal format
    * 
    * CCXT returns:
    * {
    * bids: [[price, quantity], ...],
    * asks: [[price, quantity], ...],
    * timestamp: number
    * }
    * 
    * We ensure proper sorting:
    * - Bids: descending (highest price first)
    * - Asks: ascending (lowest price first)
    * 
    * @param ccxtBook - Raw CCXT order book
    * @returns Transformed order book
    */
    private transformOrderBook(ccxtBook: CCXTOrderBook): OrderBook {
        return {
            // Bids should be sorted high to low (CCXT usually provides this)
            // but we ensure it for reliability
            bids: ccxtBook.bids
                .slice(0, ORDER_BOOK_CONFIG.DEPTH_LEVELS)
                .sort((a, b) => b[0] - a[0]) as [number, number][],

            // Asks should be sorted low to high (CCXT usually provides this)
            // but we ensure it for reliability
            asks: ccxtBook.asks
                .slice(0, ORDER_BOOK_CONFIG.DEPTH_LEVELS)
                .sort((a, b) => a[0] - b[0]) as [number, number][],

            timestamp: ccxtBook.timestamp || Date.now(),
        };
    }

    /**
    * Get exchange information for debugging
    */
    getExchangeInfo(): { id: string; name: string; countries: string[] } {
        return {
            id: this.exchange.id,
            name: this.exchange.name || 'binance',
            countries: (this.exchange.countries as string[]) || [],
        };
    }

    /**
    * Utility function to sleep for specified milliseconds
    * 
    * @param ms - Milliseconds to sleep
    */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
