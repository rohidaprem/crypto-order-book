/**
 * Created By: Prem
 * Created At: 2025-11-30
 * Last Modified At: 2025-11-30
 *
 * Description:
 * Centralized type definitions for the order book system.
 * Includes interfaces for order book structure, market orders,
 * WebSocket messages, and CCXT integration types.
 */

/**
 * Represents a single price level in the order book
 * [price, quantity]
 */
export type PriceLevel = [number, number];

/**
 * Order book snapshot containing bids and asks
 */
export interface OrderBook {
    bids: PriceLevel[]; // Sorted high to low (best bid first)
    asks: PriceLevel[]; // Sorted low to high (best ask first)
    timestamp: number;
}

/**
 * Delta update containing only changed price levels
 * Used for efficient WebSocket communication
 */
export interface OrderBookDelta {
    bids: PriceLevel[];
    asks: PriceLevel[];
    timestamp: number;
}

/**
 * Market order request validated by Zod
 */
export interface MarketOrderRequest {
    side: 'buy' | 'sell';
    amount: number; // Amount in BTC
}

/**
 * Market order execution result
 */
export interface MarketOrderResult {
    filled: number; // Total amount filled in BTC
    avg_price: number; // Weighted average execution price
    slippage_pct: number; // Percentage slippage vs best price
    status: 'filled' | 'partial' | 'rejected';
    details?: FillDetail[]; // Optional breakdown of fills
}

/**
 * Individual fill detail for transparency
 */
export interface FillDetail {
    price: number;
    quantity: number;
}

/**
 * Redis stored order book entry
 * Used for ZADD operations
 */
export interface RedisOrderBookEntry {
    score: number; // Price (or -price for bids)
    member: string; // Quantity as string
}

/**
 * WebSocket message types
 */
export enum WSMessageType {
    SNAPSHOT = 'snapshot',
    DELTA = 'delta',
    ERROR = 'error',
}

/**
 * WebSocket outgoing message structure
 */
export interface WSMessage {
    type: WSMessageType;
    data: OrderBook | OrderBookDelta | { message: string };
}

/**
 * CCXT order book response structure
 */
export interface CCXTOrderBook {
    bids: [number, number][]; // [price, quantity]
    asks: [number, number][]; // [price, quantity]
    timestamp: number;
    datetime: string;
    nonce?: number;
}

