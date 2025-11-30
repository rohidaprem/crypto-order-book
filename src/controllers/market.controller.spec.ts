/**
 * Created By: Prem
 * Created At: 2025-11-30
 * Last Modified At: 2025-11-30
 *
 * Description:
 * Unit tests for MarketController.
 * Tests endpoint validation, error handling, and integration with services.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { MarketController } from './market.controller';
import { RedisService } from '../services/redis.service';
import { OrderHistoryService } from '../services/order-history.service';
import { OrderBook } from '../types';

describe('MarketController', () => {
    let controller: MarketController;
    let redisService: RedisService;

    const mockOrderBook: OrderBook = {
        bids: [
            [100000, 2.0],
            [99900, 3.0],
        ],
        asks: [
            [100100, 1.5],
            [100200, 2.5],
        ],
        timestamp: Date.now(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [MarketController],
            providers: [
                {
                    provide: RedisService,
                    useValue: {
                        getFullOrderBook: jest.fn(),
                    },
                },
                {
                    provide: OrderHistoryService,
                    useValue: {
                        storeOrder: jest.fn(),
                    },
                },
            ],
        }).compile();

        controller = module.get<MarketController>(MarketController);
        redisService = module.get<RedisService>(RedisService);
    });

    // Silence expected error logs from the controller during tests
    beforeAll(() => {
        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    });

    afterAll(() => {
        (Logger.prototype.error as jest.Mock).mockRestore?.();
    });

    // Mock Express Request used by controller to extract client IP
    const mockReq = {
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
    } as any;

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('simulateMarketOrder - Buy Orders', () => {
        it('should execute a market buy order successfully', async () => {
            jest.spyOn(redisService, 'getFullOrderBook').mockResolvedValue(mockOrderBook);

            const result = await controller.simulateMarketOrder({
                side: 'buy',
                amount: 1.0,
            }, mockReq);

            expect(result.status).toBe('filled');
            expect(result.filled).toBe(1.0);
            expect(result.avg_price).toBeGreaterThanOrEqual(100100);
            expect(result.slippage_pct).toBeGreaterThanOrEqual(0);
        });

        it('should handle partial fills for large buy orders', async () => {
            const smallOrderBook: OrderBook = {
                bids: [[100000, 1.0]],
                asks: [[100100, 0.5]],
                timestamp: Date.now(),
            };
            jest.spyOn(redisService, 'getFullOrderBook').mockResolvedValue(smallOrderBook);

            const result = await controller.simulateMarketOrder({
                side: 'buy',
                amount: 2.0,
            }, mockReq);

            expect(result.status).toBe('partial');
            expect(result.filled).toBeLessThan(2.0);
        });
    });

    describe('simulateMarketOrder - Sell Orders', () => {
        it('should execute a market sell order successfully', async () => {
            jest.spyOn(redisService, 'getFullOrderBook').mockResolvedValue(mockOrderBook);

            const result = await controller.simulateMarketOrder({
                side: 'sell',
                amount: 1.5,
            }, mockReq);

            expect(result.status).toBe('filled');
            expect(result.filled).toBe(1.5);
            expect(result.avg_price).toBeLessThanOrEqual(100000);
            expect(result.slippage_pct).toBeLessThanOrEqual(0);
        });

        it('should handle partial fills for large sell orders', async () => {
            const smallOrderBook: OrderBook = {
                bids: [[100000, 0.8]],
                asks: [[100100, 1.0]],
                timestamp: Date.now(),
            };
            jest.spyOn(redisService, 'getFullOrderBook').mockResolvedValue(smallOrderBook);

            const result = await controller.simulateMarketOrder({
                side: 'sell',
                amount: 2.0,
            }, mockReq);

            expect(result.status).toBe('partial');
            expect(result.filled).toBeLessThan(2.0);
        });
    });

    describe('Error Handling', () => {
        it('should throw error when order book is not available', async () => {
            jest.spyOn(redisService, 'getFullOrderBook').mockResolvedValue({
                bids: [],
                asks: [],
                timestamp: Date.now(),
            });

            await expect(
                controller.simulateMarketOrder({
                    side: 'buy',
                    amount: 1.0,
                }, mockReq)
            ).rejects.toThrow(HttpException);
        });

        it('should throw error for insufficient liquidity', async () => {
            const emptyOrderBook: OrderBook = {
                bids: [],
                asks: [],
                timestamp: Date.now(),
            };
            jest.spyOn(redisService, 'getFullOrderBook').mockResolvedValue(emptyOrderBook);

            await expect(
                controller.simulateMarketOrder({
                    side: 'buy',
                    amount: 1.0,
                }, mockReq)
            ).rejects.toThrow(HttpException);
        });

        it('should handle Redis errors gracefully', async () => {
            jest.spyOn(redisService, 'getFullOrderBook').mockRejectedValue(
                new Error('Redis connection failed')
            );

            await expect(
                controller.simulateMarketOrder({
                    side: 'buy',
                    amount: 1.0,
                }, mockReq)
            ).rejects.toThrow(HttpException);
        });
    });

    describe('Validation', () => {
        it('should handle minimum order size', async () => {
            jest.spyOn(redisService, 'getFullOrderBook').mockResolvedValue(mockOrderBook);

            const result = await controller.simulateMarketOrder({
                side: 'buy',
                amount: 0.0001,
            }, mockReq);

            expect(result.filled).toBe(0.0001);
        });

        it('should calculate slippage for orders at multiple price levels', async () => {
            const multiLevelBook: OrderBook = {
                bids: [
                    [100000, 0.1],
                    [99900, 0.1],
                    [99800, 0.1],
                ],
                asks: [
                    [100100, 0.1],
                    [100200, 0.1],
                    [100300, 0.1],
                ],
                timestamp: Date.now(),
            };
            jest.spyOn(redisService, 'getFullOrderBook').mockResolvedValue(multiLevelBook);

            const result = await controller.simulateMarketOrder({
                side: 'buy',
                amount: 0.3,
            }, mockReq);

            expect(result.status).toBe('filled');
            expect(result.details?.length).toBe(3);
            expect(result.slippage_pct).toBeGreaterThan(0);
        });
    });
});
