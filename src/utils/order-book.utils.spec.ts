/**
 * Created By: Prem
 * Created At: 2025-11-30
 * Last Modified At: 2025-11-30
 *
 * Description:
 * Unit tests for market order simulation logic.
 * Tests buy/sell execution, slippage calculation, and edge cases.
 */

import {
    simulateMarketBuy,
    simulateMarketSell,
    validateOrderBook,
} from '../utils/order-book.utils';
import { OrderBook } from '../types';

describe('Market Order Simulation', () => {
    describe('simulateMarketBuy', () => {
        it('should fill a buy order completely when liquidity is sufficient', () => {
            const orderBook: OrderBook = {
                bids: [
                    [100000, 1.0],
                    [99900, 2.0],
                ],
                asks: [
                    [100100, 0.5],
                    [100200, 1.0],
                    [100300, 2.0],
                ],
                timestamp: Date.now(),
            };

            const result = simulateMarketBuy(orderBook, 1.0);

            expect(result.status).toBe('filled');
            expect(result.filled).toBe(1.0);
            expect(result.avg_price).toBeCloseTo(100150, 2);
            expect(result.slippage_pct).toBeGreaterThan(0);
            expect(result.details).toHaveLength(2);
        });

        it('should calculate correct slippage for market buy', () => {
            const orderBook: OrderBook = {
                bids: [[100000, 1.0]],
                asks: [
                    [100100, 1.0],
                    [100200, 1.0],
                ],
                timestamp: Date.now(),
            };

            const result = simulateMarketBuy(orderBook, 1.5);

            // Best ask is 100100, but we also fill at 100200
            // Average price should be higher than best ask
            expect(result.avg_price).toBeGreaterThan(100100);
            expect(result.slippage_pct).toBeGreaterThan(0);
        });

        it('should handle partial fills when liquidity is insufficient', () => {
            const orderBook: OrderBook = {
                bids: [[100000, 1.0]],
                asks: [
                    [100100, 0.3],
                    [100200, 0.5],
                ],
                timestamp: Date.now(),
            };

            const result = simulateMarketBuy(orderBook, 1.0);

            expect(result.status).toBe('partial');
            expect(result.filled).toBe(0.8);
            expect(result.filled).toBeLessThan(1.0);
        });

        it('should reject order when no liquidity available', () => {
            const orderBook: OrderBook = {
                bids: [[100000, 1.0]],
                asks: [],
                timestamp: Date.now(),
            };

            const result = simulateMarketBuy(orderBook, 0.5);

            expect(result.status).toBe('rejected');
            expect(result.filled).toBe(0);
            expect(result.avg_price).toBe(0);
            expect(result.slippage_pct).toBe(0);
        });

        it('should handle small order amounts correctly', () => {
            const orderBook: OrderBook = {
                bids: [[100000, 1.0]],
                asks: [[100100, 5.0]],
                timestamp: Date.now(),
            };

            const result = simulateMarketBuy(orderBook, 0.001);

            expect(result.status).toBe('filled');
            expect(result.filled).toBe(0.001);
            expect(result.avg_price).toBe(100100);
            expect(result.slippage_pct).toBe(0);
        });

        it('should walk multiple price levels for large orders', () => {
            const orderBook: OrderBook = {
                bids: [[100000, 1.0]],
                asks: [
                    [100100, 0.1],
                    [100200, 0.2],
                    [100300, 0.3],
                    [100400, 0.5],
                ],
                timestamp: Date.now(),
            };

            const result = simulateMarketBuy(orderBook, 1.0);

            expect(result.status).toBe('filled');
            expect(result.filled).toBe(1.0);
            expect(result.details?.length).toBe(4);
            expect(result.avg_price).toBeGreaterThan(100100);
        });
    });

    describe('simulateMarketSell', () => {
        it('should fill a sell order completely when liquidity is sufficient', () => {
            const orderBook: OrderBook = {
                bids: [
                    [100000, 1.0],
                    [99900, 2.0],
                    [99800, 3.0],
                ],
                asks: [
                    [100100, 0.5],
                    [100200, 1.0],
                ],
                timestamp: Date.now(),
            };

            const result = simulateMarketSell(orderBook, 2.0);

            expect(result.status).toBe('filled');
            expect(result.filled).toBe(2.0);
            expect(result.avg_price).toBeCloseTo(99950, 2);
            expect(result.slippage_pct).toBeLessThan(0); // Negative slippage for sells
            expect(result.details).toHaveLength(2);
        });

        it('should calculate correct slippage for market sell', () => {
            const orderBook: OrderBook = {
                bids: [
                    [100000, 0.5],
                    [99900, 1.0],
                ],
                asks: [[100100, 1.0]],
                timestamp: Date.now(),
            };

            const result = simulateMarketSell(orderBook, 1.0);

            // Best bid is 100000, but we also fill at 99900
            // Average price should be lower than best bid
            expect(result.avg_price).toBeLessThan(100000);
            expect(result.slippage_pct).toBeLessThan(0); // Negative for worse sell price
        });

        it('should handle partial fills when liquidity is insufficient', () => {
            const orderBook: OrderBook = {
                bids: [
                    [100000, 0.2],
                    [99900, 0.3],
                ],
                asks: [[100100, 1.0]],
                timestamp: Date.now(),
            };

            const result = simulateMarketSell(orderBook, 1.0);

            expect(result.status).toBe('partial');
            expect(result.filled).toBe(0.5);
            expect(result.filled).toBeLessThan(1.0);
        });

        it('should reject order when no liquidity available', () => {
            const orderBook: OrderBook = {
                bids: [],
                asks: [[100100, 1.0]],
                timestamp: Date.now(),
            };

            const result = simulateMarketSell(orderBook, 0.5);

            expect(result.status).toBe('rejected');
            expect(result.filled).toBe(0);
            expect(result.avg_price).toBe(0);
            expect(result.slippage_pct).toBe(0);
        });

        it('should handle small order amounts correctly', () => {
            const orderBook: OrderBook = {
                bids: [[100000, 5.0]],
                asks: [[100100, 1.0]],
                timestamp: Date.now(),
            };

            const result = simulateMarketSell(orderBook, 0.001);

            expect(result.status).toBe('filled');
            expect(result.filled).toBe(0.001);
            expect(result.avg_price).toBe(100000);
            expect(result.slippage_pct).toBe(0);
        });

        it('should walk multiple price levels for large orders', () => {
            const orderBook: OrderBook = {
                bids: [
                    [100000, 0.1],
                    [99900, 0.2],
                    [99800, 0.3],
                    [99700, 0.5],
                ],
                asks: [[100100, 1.0]],
                timestamp: Date.now(),
            };

            const result = simulateMarketSell(orderBook, 1.0);

            expect(result.status).toBe('filled');
            expect(result.filled).toBe(1.0);
            expect(result.details?.length).toBe(4);
            expect(result.avg_price).toBeLessThan(100000);
        });
    });

    describe('validateOrderBook', () => {
        it('should validate a correct order book', () => {
            const orderBook: OrderBook = {
                bids: [
                    [100000, 1.0],
                    [99900, 2.0],
                    [99800, 3.0],
                ],
                asks: [
                    [100100, 0.5],
                    [100200, 1.0],
                    [100300, 1.5],
                ],
                timestamp: Date.now(),
            };

            expect(validateOrderBook(orderBook)).toBe(true);
        });

        it('should reject order book with unsorted bids', () => {
            const orderBook: OrderBook = {
                bids: [
                    [99900, 1.0],
                    [100000, 2.0], // Wrong order
                ],
                asks: [[100100, 0.5]],
                timestamp: Date.now(),
            };

            expect(validateOrderBook(orderBook)).toBe(false);
        });

        it('should reject order book with unsorted asks', () => {
            const orderBook: OrderBook = {
                bids: [[100000, 1.0]],
                asks: [
                    [100200, 0.5],
                    [100100, 1.0], // Wrong order
                ],
                timestamp: Date.now(),
            };

            expect(validateOrderBook(orderBook)).toBe(false);
        });

        it('should reject order book with overlapping prices', () => {
            const orderBook: OrderBook = {
                bids: [[100100, 1.0]], // Bid >= Ask (invalid)
                asks: [[100100, 0.5]],
                timestamp: Date.now(),
            };

            expect(validateOrderBook(orderBook)).toBe(false);
        });

        it('should handle empty order book', () => {
            const orderBook: OrderBook = {
                bids: [],
                asks: [],
                timestamp: Date.now(),
            };

            expect(validateOrderBook(orderBook)).toBe(true);
        });

        it('should handle order book with only bids', () => {
            const orderBook: OrderBook = {
                bids: [
                    [100000, 1.0],
                    [99900, 2.0],
                ],
                asks: [],
                timestamp: Date.now(),
            };

            expect(validateOrderBook(orderBook)).toBe(true);
        });

        it('should handle order book with only asks', () => {
            const orderBook: OrderBook = {
                bids: [],
                asks: [
                    [100100, 0.5],
                    [100200, 1.0],
                ],
                timestamp: Date.now(),
            };

            expect(validateOrderBook(orderBook)).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero quantity orders', () => {
            const orderBook: OrderBook = {
                bids: [[100000, 1.0]],
                asks: [[100100, 1.0]],
                timestamp: Date.now(),
            };

            const buyResult = simulateMarketBuy(orderBook, 0);
            expect(buyResult.filled).toBe(0);
            expect(buyResult.status).toBe('rejected');

            const sellResult = simulateMarketSell(orderBook, 0);
            expect(sellResult.filled).toBe(0);
            expect(sellResult.status).toBe('rejected');
        });

        it('should handle precise decimal calculations', () => {
            const orderBook: OrderBook = {
                bids: [[100000, 1.0]],
                asks: [[100100.123456, 0.12345678]],
                timestamp: Date.now(),
            };

            const result = simulateMarketBuy(orderBook, 0.12345678);

            expect(result.status).toBe('filled');
            expect(result.filled).toBeCloseTo(0.12345678, 8);
        });

        it('should handle very large orders', () => {
            const orderBook: OrderBook = {
                bids: [[100000, 100]],
                asks: [
                    [100100, 50],
                    [100200, 100],
                    [100300, 200],
                ],
                timestamp: Date.now(),
            };

            const result = simulateMarketBuy(orderBook, 300);

            expect(result.status).toBe('filled');
            expect(result.filled).toBe(300);
        });
    });
});

