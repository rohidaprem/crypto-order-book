/**
 * Created By: Prem
 * Created At: 2025-11-30
 * Last Modified At: 2025-11-30
 *
 * Description:
 * Market order controller implementing POST /market endpoint.
 * Simulates market order execution with slippage calculation.
 * Uses Zod validation for request validation.
 *
 * Sample curl tests:
 *
 * # Buy 0.5 BTC (market buy)
 * curl -X POST http://localhost:3000/api/market \
 * -H "Content-Type: application/json" \
 * -d '{"side": "buy", "amount": 0.5}'
 *
 * # Sell 1.2 BTC (market sell)
 * curl -X POST http://localhost:3000/api/market \
 * -H "Content-Type: application/json" \
 * -d '{"side": "sell", "amount": 1.2}'
 *
 * # Invalid request (amount too small)
 * curl -X POST http://localhost:3000/api/market \
 * -H "Content-Type: application/json" \
 * -d '{"side": "buy", "amount": 0.00001}'
 *
 * # Invalid request (invalid side)
 * curl -X POST http://localhost:3000/api/market \
 * -H "Content-Type: application/json" \
 * -d '{"side": "long", "amount": 1.0}'
 */

import {
    Controller,
    Post,
    Body,
    HttpException,
    HttpStatus,
    Logger,
    UsePipes,
    Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import Config from '../config';
import { RedisService } from '../services/redis.service';
import { OrderHistoryService } from '../services/order-history.service';
import {
    simulateMarketBuy,
    simulateMarketSell,
} from '../utils/order-book.utils';
import { MarketOrderRequestSchema, MarketOrderRequestDto } from '../validators/market-order.validator';
import { MarketOrderResult } from '../types';
import { ERROR_MESSAGES } from '../constants';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

@Controller('market')
export class MarketController {
    private readonly logger = new Logger(MarketController.name);

    constructor(
        private readonly redisService: RedisService,
        private readonly orderHistoryService: OrderHistoryService,
    ) { }

    /**
    * POST /api/market - Simulate market order execution
    * 
    * This endpoint performs a SIMULATION ONLY - it does not:
    * - Place real orders on Binance
    * - Modify the order book in Redis
    * - Execute any actual trades
    * 
    * Process:
    * 1. Validate request using Zod schema
    * 2. Fetch current order book from Redis
    * 3. Walk through order book levels (bids for sell, asks for buy)
    * 4. Calculate fills, average price, and slippage
    * 5. Return execution result
    * 
    * Financial logic:
    * - Buy orders walk the ask side (taking liquidity from sellers)
    * - Sell orders walk the bid side (taking liquidity from buyers)
    * - Slippage measures execution price vs best available price
    * - Higher slippage = worse execution (common for large orders)
    * 
    * Rate limiting: Configured via environment variables
    * 
    * @param request - Market order request (side + amount)
    * @returns Execution result with fills and slippage
    */
    @Post()
    @Throttle({
        default: {
            limit: Config.rateLimit.marketEndpoint.limit,
            ttl: Config.rateLimit.marketEndpoint.ttl
        }
    })
    @UsePipes(new ZodValidationPipe(MarketOrderRequestSchema))
    async simulateMarketOrder(
        @Body() request: MarketOrderRequestDto,
        @Req() req: Request,
    ): Promise<MarketOrderResult> {
        // Extract client IP address
        const clientIP = this.getClientIP(req);

        this.logger.log(
            `💰 NEW ORDER: ${request.side.toUpperCase()} ${request.amount} BTC | IP: ${clientIP}`,
        );

        try {
            // Fetch current order book from Redis
            // We need the full book to handle large orders that walk multiple levels
            const orderBook = await this.redisService.getFullOrderBook();

            // Validate order book is available
            if (!orderBook || (orderBook.bids.length === 0 && orderBook.asks.length === 0)) {
                throw new HttpException(
                    ERROR_MESSAGES.ORDER_BOOK_NOT_AVAILABLE,
                    HttpStatus.SERVICE_UNAVAILABLE,
                );
            }

            let result: MarketOrderResult;

            if (request.side === 'buy') {
                // Market buy: walk asks (sell orders) from lowest to highest price
                // We're taking liquidity from sellers, so we get filled at their ask prices
                result = simulateMarketBuy(orderBook, request.amount);
            } else {
                // Market sell: walk bids (buy orders) from highest to lowest price
                // We're taking liquidity from buyers, so we get filled at their bid prices
                result = simulateMarketSell(orderBook, request.amount);
            }

            // Log execution summary with detailed breakdown
            this.logger.log(`✅ ORDER EXECUTED`);
            this.logger.log(`   Status: ${result.status.toUpperCase()}`);
            this.logger.log(`   Requested: ${request.amount} BTC`);
            this.logger.log(`   Filled: ${result.filled} BTC`);
            this.logger.log(`   Average Price: $${result.avg_price.toFixed(2)}`);
            this.logger.log(`   Slippage: ${result.slippage_pct.toFixed(4)}%`);
            
            let totalCostOrRevenue = 0;
            if (request.side === 'buy') {
                totalCostOrRevenue = result.filled * result.avg_price;
                this.logger.log(`   Total Cost: $${totalCostOrRevenue.toFixed(2)}`);
            } else {
                totalCostOrRevenue = result.filled * result.avg_price;
                this.logger.log(`   Total Revenue: $${totalCostOrRevenue.toFixed(2)}`);
            }
            
            if (result.details && result.details.length > 0) {
                this.logger.log(`   Fill Details:`);
                result.details.forEach((fill, idx) => {
                    this.logger.log(`      Level ${idx + 1}: ${fill.quantity} BTC @ $${fill.price.toFixed(2)}`);
                });
            }

            // Store order history
            const now = new Date();
            const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
            const time = now.toTimeString().split(' ')[0]; // HH:MM:SS

            try {
                await this.orderHistoryService.storeOrder({
                    id: `order:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`,
                    ip: clientIP,
                    side: request.side,
                    amount: request.amount,
                    filled: result.filled,
                    avg_price: result.avg_price,
                    slippage_pct: result.slippage_pct,
                    status: result.status,
                    total_cost_or_revenue: totalCostOrRevenue,
                    timestamp: now.getTime(),
                    date,
                    time,
                });
                this.logger.debug(`Order history stored for IP: ${clientIP}`);
            } catch (historyError) {
                this.logger.warn(`Failed to store order history: ${(historyError as Error).message}`);
                // Don't throw - order was executed successfully, history is just for tracking
            }

            // Handle partial fills or rejections
            if (result.status === 'partial') {
                this.logger.warn(
                    `⚠️  PARTIAL FILL: only ${result.filled} BTC filled out of ${request.amount} BTC requested`,
                );
            } else if (result.status === 'rejected') {
                throw new HttpException(
                    ERROR_MESSAGES.INSUFFICIENT_LIQUIDITY,
                    HttpStatus.BAD_REQUEST,
                );
            }

            return result;
        } catch (error) {
            // Handle known errors
            if (error instanceof HttpException) {
                throw error;
            }

            // Handle unexpected errors
            const err = error as Error;
            this.logger.error(`❌ Market order simulation failed: ${err.message}`);
            throw new HttpException(
                'Internal server error',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Extract client IP address from request
     * Handles proxies and various header formats
     */
    private getClientIP(req: Request): string {
        // Check for IP from proxies first
        const forwarded = req.headers['x-forwarded-for'];
        if (typeof forwarded === 'string') {
            return forwarded.split(',')[0].trim();
        }
        if (Array.isArray(forwarded)) {
            return forwarded[0].trim();
        }

        // Check other proxy headers
        const clientIP = req.headers['x-client-ip'] as string;
        if (clientIP) return clientIP;

        const realIP = req.headers['x-real-ip'] as string;
        if (realIP) return realIP;

        // Fallback to socket address
        const socketAddress = req.socket?.remoteAddress || '127.0.0.1';
        
        // Convert IPv6 localhost to IPv4
        if (socketAddress === '::1' || socketAddress === '::ffff:127.0.0.1') {
            return '127.0.0.1';
        }

        return socketAddress;
    }
}

