/**
 * Created By: Prem
 * Created At: 2025-11-30
 * Last Modified At: 2025-11-30
 *
 * Description:
 * Root application module that wires together all services,
 * controllers, and gateways. Configures dependency injection
 * and module imports. Includes rate limiting via Throttler.
 */

import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import Config from './config';
import { RedisService } from './services/redis.service';
import { CcxtService } from './services/ccxt.service';
import { OrderBookService } from './services/order-book.service';
import { OrderHistoryService } from './services/order-history.service';
import { DepthGateway } from './gateways/depth.gateway';
import { MarketController, HealthController, StatusController } from './routes';
import { OrderHistoryController } from './controllers/order-history.controller';

@Module({
    imports: [
        // Rate limiting configuration from environment
        ThrottlerModule.forRoot([{
            ttl: Config.rateLimit.ttl,
            limit: Config.rateLimit.limit,
        }]),
    ],
    controllers: [
        MarketController,
        HealthController,
        StatusController,
        OrderHistoryController,
    ],
    providers: [
        RedisService,
        CcxtService,
        OrderBookService,
        OrderHistoryService,
        DepthGateway,
        // Apply rate limiting globally
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
    ],
})
export class AppModule { }