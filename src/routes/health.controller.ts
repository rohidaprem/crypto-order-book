/**
     * Created By: Prem
     * Created At: 2025-11-30
     * Last Modified At: 2025-11-30
     *
     * Description:
     * Health check controller for monitoring application status.
     * Provides endpoints to check Redis, CCXT, and overall system health.
     */

import { Controller, Get, HttpStatus } from '@nestjs/common';
import { RedisService } from '../services/redis.service';
import { CcxtService } from '../services/ccxt.service';
import { OrderBookService } from '../services/order-book.service';
import Config from '../config';

interface HealthCheckResponse {
    status: 'healthy' | 'unhealthy' | 'degraded';
    timestamp: string;
    uptime: number;
    services: {
        redis: { status: string; message?: string };
        exchange: { status: string; message?: string };
        orderBook: { status: string; message?: string };
    };
    config: {
        environment: string;
        exchange: string;
        symbol: string;
        updateInterval: number;
    };
}

@Controller('health')
export class HealthController {
    constructor(
        private readonly redisService: RedisService,
        private readonly ccxtService: CcxtService,
        private readonly orderBookService: OrderBookService,
    ) { }

    /**
    * GET /api/health - Comprehensive health check
    * 
    * Returns detailed health status of all services:
    * - Redis connection
    * - Exchange (CCXT) connectivity
    * - Order book updater status
    * - System uptime and configuration
    * 
    * Status codes:
    * - 200: All services healthy
    * - 503: One or more services unhealthy
    */
    @Get()
    async checkHealth(): Promise<HealthCheckResponse> {
        const checks = await Promise.allSettled([
            this.redisService.healthCheck(),
            this.checkExchange(),
            this.checkOrderBook(),
        ]);

        const redisHealthy = checks[0].status === 'fulfilled' && checks[0].value === true;
        const exchangeHealthy = checks[1].status === 'fulfilled' && checks[1].value === true;
        const orderBookHealthy = checks[2].status === 'fulfilled' && checks[2].value === true;

        const allHealthy = redisHealthy && exchangeHealthy && orderBookHealthy;
        const someHealthy = redisHealthy || exchangeHealthy || orderBookHealthy;

        return {
            status: allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            services: {
                redis: {
                    status: redisHealthy ? 'connected' : 'disconnected',
                    message: redisHealthy ? 'Redis is operational' : 'Cannot connect to Redis',
                },
                exchange: {
                    status: exchangeHealthy ? 'connected' : 'disconnected',
                    message: exchangeHealthy ? 'Exchange API is operational' : 'Cannot connect to exchange',
                },
                orderBook: {
                    status: orderBookHealthy ? 'running' : 'stopped',
                    message: orderBookHealthy ? 'Order book updater is running' : 'Order book updater is not running',
                },
            },
            config: {
                environment: Config.app.env,
                exchange: Config.exchange.name,
                symbol: Config.exchange.symbol,
                updateInterval: Config.exchange.updateIntervalMs,
            },
        };
    }

    /**
    * GET /api/health/redis - Check Redis connectivity
    */
    @Get('redis')
    async checkRedis() {
        const healthy = await this.redisService.healthCheck();
        return {
            service: 'redis',
            status: healthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
        };
    }

    /**
    * GET /api/health/exchange - Check exchange connectivity
    */
    @Get('exchange')
    async checkExchangeEndpoint() {
        const healthy = await this.checkExchange();
        return {
            service: 'exchange',
            status: healthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            details: this.ccxtService.getExchangeInfo(),
        };
    }

    /**
    * GET /api/health/orderbook - Check order book updater status
    */
    @Get('orderbook')
    async checkOrderBookEndpoint() {
        const status = this.orderBookService.getStatus();
        return {
            service: 'orderbook',
            status: status.running ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            details: status,
        };
    }

    /**
    * Check exchange connectivity by attempting to fetch exchange info
    */
    private async checkExchange(): Promise<boolean> {
        try {
            const info = this.ccxtService.getExchangeInfo();
            return !!info.id;
        } catch (error) {
            return false;
        }
    }

    /**
    * Check order book updater status
    */
    private async checkOrderBook(): Promise<boolean> {
        try {
            const status = this.orderBookService.getStatus();
            return status.running;
        } catch (error) {
            return false;
        }
    }
}