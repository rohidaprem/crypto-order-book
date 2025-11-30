/**
 * Created By: Prem
 * Created At: 2025-11-30
 * Last Modified At: 2025-11-30
 *
 * Description:
 * Status controller for system information and metrics.
 * Provides endpoints for application status, version, and configuration.
 */

import { Controller, Get } from '@nestjs/common';
import Config from '../config';

@Controller('status')
export class StatusController {
    /**
    * GET /api/status - Get application status and version
    * 
    * Returns basic application information without sensitive data.
    * Useful for monitoring, debugging, and client verification.
    */
    @Get()
    getStatus() {
        return {
            application: 'Crypto Order Book Simulator',
            version: '1.0.0',
            environment: Config.app.env,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            node: process.version,
            platform: process.platform,
            architecture: process.arch,
        };
    }

    /**
    * GET /api/status/config - Get public configuration
    * 
    * Returns non-sensitive configuration information.
    * Excludes API keys, passwords, and other secrets.
    */
    @Get('config')
    getConfig() {
        return {
            exchange: {
                name: Config.exchange.name,
                symbol: Config.exchange.symbol,
                depthLevels: Config.exchange.depthLevels,
                updateInterval: Config.exchange.updateIntervalMs,
            },
            websocket: {
                path: Config.websocket.path,
                maxConnections: Config.websocket.maxConnections,
                topLevels: Config.websocket.topLevelsToPublish,
            },
            rateLimit: {
                ttl: Config.rateLimit.ttl,
                limit: Config.rateLimit.limit,
            },
            marketOrder: {
                minOrderSize: Config.marketOrder.minOrderSize,
                maxOrderSize: Config.marketOrder.maxOrderSize,
            },
        };
    }

    /**
    * GET /api/status/endpoints - List available API endpoints
    * 
    * Returns a list of all available REST API endpoints.
    */
    @Get('endpoints')
    getEndpoints() {
        return {
            rest: [
                {
                    method: 'POST',
                    path: '/api/market',
                    description: 'Simulate market order execution',
                },
                {
                    method: 'GET',
                    path: '/api/health',
                    description: 'Comprehensive health check',
                },
                {
                    method: 'GET',
                    path: '/api/health/redis',
                    description: 'Check Redis connectivity',
                },
                {
                    method: 'GET',
                    path: '/api/health/exchange',
                    description: 'Check exchange connectivity',
                },
                {
                    method: 'GET',
                    path: '/api/health/orderbook',
                    description: 'Check order book updater status',
                },
                {
                    method: 'GET',
                    path: '/api/status',
                    description: 'Get application status',
                },
                {
                    method: 'GET',
                    path: '/api/status/config',
                    description: 'Get public configuration',
                },
                {
                    method: 'GET',
                    path: '/api/status/endpoints',
                    description: 'List available endpoints',
                },
            ],
            websocket: [
                {
                    path: '/ws/depth',
                    description: 'Real-time order book depth updates',
                    events: ['depth'],
                },
            ],
        };
    }
}

