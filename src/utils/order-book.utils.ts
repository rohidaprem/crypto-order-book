/**
 * Created By: Prem
 * Created At: 2025-11-30
 * Last Modified At: 2025-11-30
 *
 * Description:
 * Utility functions for order book operations including:
 * - Delta calculation between order book snapshots
 * - Market order simulation with slippage calculation
 * - Order book walking for buy/sell execution
 */

import { OrderBook, OrderBookDelta, PriceLevel, MarketOrderResult, FillDetail } from '../types';
import { MARKET_ORDER_CONFIG } from '../constants';

/**
 * Calculate delta between two order book snapshots
 * 
 * This is more efficient than sending full snapshots over WebSocket.
 * Only changed price levels are transmitted.
 * 
 * Note: For production, consider implementing incremental updates
 * tracking individual price level changes. Current implementation
 * sends top N levels as delta for simplicity.
 * 
 * @param previous - Previous order book state
 * @param current - Current order book state
 * @returns Delta containing only changes
 */
export function calculateDelta(
    previous: OrderBook,
    current: OrderBook,
): OrderBookDelta {
    // For simplicity, we return the current top levels as delta
    // In production, you'd implement proper diff logic to detect
    // which specific price levels changed
    return {
        bids: current.bids,
        asks: current.asks,
        timestamp: current.timestamp,
    };
}

/**
 * Simulate market buy order execution
 * 
 * Walks the ask side (sell orders) from lowest to highest price
 * until the requested amount is filled.
 * 
 * Financial logic:
 * - Market buy = take liquidity from ask side
 * - Start from best ask (lowest price)
 * - Consume quantity at each level until filled
 * - Calculate weighted average price
 * - Slippage = how much worse than best price we got
 * 
 * @param orderBook - Current order book state
 * @param amount - Amount to buy in BTC
 * @returns Execution result with fills and slippage
 */
export function simulateMarketBuy(
    orderBook: OrderBook,
    amount: number,
): MarketOrderResult {
    if (orderBook.asks.length === 0) {
        return {
            filled: 0,
            avg_price: 0,
            slippage_pct: 0,
            status: 'rejected',
        };
    }

    const bestAsk = orderBook.asks[0][0]; // Best (lowest) ask price
    let remainingAmount = amount;
    let totalCost = 0;
    let totalFilled = 0;
    const fills: FillDetail[] = [];

    // Walk through ask levels from best to worst
    for (const [price, quantity] of orderBook.asks) {
        if (remainingAmount <= 0) break;

        // How much can we fill at this level?
        const fillQuantity = Math.min(remainingAmount, quantity);
        const fillCost = fillQuantity * price;

        totalCost += fillCost;
        totalFilled += fillQuantity;
        remainingAmount -= fillQuantity;

        fills.push({
            price: parseFloat(price.toFixed(MARKET_ORDER_CONFIG.PRICE_PRECISION)),
            quantity: parseFloat(fillQuantity.toFixed(MARKET_ORDER_CONFIG.QUANTITY_PRECISION)),
        });
    }

    // Calculate weighted average price
    const avgPrice = totalFilled > 0 ? totalCost / totalFilled : 0;

    // Calculate slippage percentage
    // Slippage = ((avg_price - best_price) / best_price) * 100
    // This shows how much worse we did compared to the best available price
    const slippagePct = totalFilled > 0
        ? ((avgPrice - bestAsk) / bestAsk) * 100
        : 0;

    // Determine order status
    let status: 'filled' | 'partial' | 'rejected';
    if (totalFilled === 0) {
        status = 'rejected';
    } else if (totalFilled < amount) {
        status = 'partial';
    } else {
        status = 'filled';
    }

    return {
        filled: parseFloat(totalFilled.toFixed(MARKET_ORDER_CONFIG.QUANTITY_PRECISION)),
        avg_price: parseFloat(avgPrice.toFixed(MARKET_ORDER_CONFIG.PRICE_PRECISION)),
        slippage_pct: parseFloat(slippagePct.toFixed(4)),
        status,
        details: fills,
    };
}

/**
 * Simulate market sell order execution
 * 
 * Walks the bid side (buy orders) from highest to lowest price
 * until the requested amount is filled.
 * 
 * Financial logic:
 * - Market sell = take liquidity from bid side
 * - Start from best bid (highest price)
 * - Consume quantity at each level until filled
 * - Calculate weighted average price
 * - Slippage = how much worse than best price we got
 * 
 * @param orderBook - Current order book state
 * @param amount - Amount to sell in BTC
 * @returns Execution result with fills and slippage
 */
export function simulateMarketSell(
    orderBook: OrderBook,
    amount: number,
): MarketOrderResult {
    if (orderBook.bids.length === 0) {
        return {
            filled: 0,
            avg_price: 0,
            slippage_pct: 0,
            status: 'rejected',
        };
    }

    const bestBid = orderBook.bids[0][0]; // Best (highest) bid price
    let remainingAmount = amount;
    let totalRevenue = 0;
    let totalFilled = 0;
    const fills: FillDetail[] = [];

    // Walk through bid levels from best to worst
    for (const [price, quantity] of orderBook.bids) {
        if (remainingAmount <= 0) break;

        // How much can we fill at this level?
        const fillQuantity = Math.min(remainingAmount, quantity);
        const fillRevenue = fillQuantity * price;

        totalRevenue += fillRevenue;
        totalFilled += fillQuantity;
        remainingAmount -= fillQuantity;

        fills.push({
            price: parseFloat(price.toFixed(MARKET_ORDER_CONFIG.PRICE_PRECISION)),
            quantity: parseFloat(fillQuantity.toFixed(MARKET_ORDER_CONFIG.QUANTITY_PRECISION)),
        });
    }

    // Calculate weighted average price
    const avgPrice = totalFilled > 0 ? totalRevenue / totalFilled : 0;

    // Calculate slippage percentage
    // For sells, slippage is negative (we get worse price = lower)
    // Slippage = ((avg_price - best_price) / best_price) * 100
    // Negative value indicates we got less than best bid
    const slippagePct = totalFilled > 0
        ? ((avgPrice - bestBid) / bestBid) * 100
        : 0;

    // Determine order status
    let status: 'filled' | 'partial' | 'rejected';
    if (totalFilled === 0) {
        status = 'rejected';
    } else if (totalFilled < amount) {
        status = 'partial';
    } else {
        status = 'filled';
    }

    return {
        filled: parseFloat(totalFilled.toFixed(MARKET_ORDER_CONFIG.QUANTITY_PRECISION)),
        avg_price: parseFloat(avgPrice.toFixed(MARKET_ORDER_CONFIG.PRICE_PRECISION)),
        slippage_pct: parseFloat(slippagePct.toFixed(4)),
        status,
        details: fills,
    };
}

/**
 * Format order book for display/logging
 * 
 * @param orderBook - Order book to format
 * @param levels - Number of levels to include
 * @returns Formatted string
 */
export function formatOrderBook(orderBook: OrderBook, levels: number = 5): string {
    const formatLevel = (level: PriceLevel) =>
        ` ${level[0].toFixed(2)} | ${level[1].toFixed(8)}`;

    const bidsStr = orderBook.bids
        .slice(0, levels)
        .map(formatLevel)
        .join('\n');

    const asksStr = orderBook.asks
        .slice(0, levels)
        .map(formatLevel)
        .join('\n');

    return `
Order Book (${new Date(orderBook.timestamp).toISOString()})
Asks (${orderBook.asks.length} levels):
${asksStr}
---
Bids (${orderBook.bids.length} levels):
${bidsStr}
 `.trim();
}

/**
 * Validate order book integrity
 * 
 * Checks:
 * - Bids are sorted descending
 * - Asks are sorted ascending
 * - No overlapping prices (bid < ask)
 * 
 * @param orderBook - Order book to validate
 * @returns True if valid
 */
export function validateOrderBook(orderBook: OrderBook): boolean {
    // Check bids are sorted descending
    for (let i = 1; i < orderBook.bids.length; i++) {
        if (orderBook.bids[i][0] > orderBook.bids[i - 1][0]) {
            return false;
        }
    }

    // Check asks are sorted ascending
    for (let i = 1; i < orderBook.asks.length; i++) {
        if (orderBook.asks[i][0] < orderBook.asks[i - 1][0]) {
            return false;
        }
    }

    // Check no overlap (best bid < best ask)
    if (
        orderBook.bids.length > 0 &&
        orderBook.asks.length > 0 &&
        orderBook.bids[0][0] >= orderBook.asks[0][0]
    ) {
        return false;
    }

    return true;
}



