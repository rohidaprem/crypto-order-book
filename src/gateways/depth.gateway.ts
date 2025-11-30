/**
 * Created By: Prem
 * Created At: 2025-11-30
 * Last Modified At: 2025-11-30
 *
 * Description:
 * WebSocket gateway for real-time order book depth updates.
 * Implements /ws/depth endpoint with snapshot on connect and
 * delta updates via Redis pub/sub. Supports up to 100 concurrent clients.
 */

import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../services/redis.service';
import { WEBSOCKET_CONFIG } from '../constants';
import { OrderBook, WSMessageType } from '../types';

@WebSocketGateway({
    path: WEBSOCKET_CONFIG.PATH,
    cors: WEBSOCKET_CONFIG.CORS,
    maxHttpBufferSize: 1e6, // 1MB
    pingInterval: WEBSOCKET_CONFIG.PING_INTERVAL,
    pingTimeout: WEBSOCKET_CONFIG.PING_TIMEOUT,
})
export class DepthGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;

    private readonly logger = new Logger(DepthGateway.name);
    private connectedClients = 0;
    private isSubscribed = false;

    constructor(private readonly redisService: RedisService) { }

    /**
    * Initialize WebSocket gateway
    * 
    * Subscribe to Redis pub/sub channel for order book updates.
    * When updates are received, broadcast to all connected clients.
    */
    afterInit() {
        this.logger.log('WebSocket gateway initialized');

        // Subscribe to Redis pub/sub channel
        // This callback is triggered whenever order book is updated
        this.redisService.subscribeToUpdates((orderBook: OrderBook) => {
            this.broadcastUpdate(orderBook);
        });

        this.isSubscribed = true;
        this.logger.log('Subscribed to order book updates');
    }

    /**
    * Handle new client connection
    * 
    * Flow:
    * 1. Check connection limit (max 100 clients)
    * 2. Fetch current order book snapshot from Redis
    * 3. Send snapshot immediately to client
    * 4. Client will receive subsequent delta updates via broadcast
    * 
    * This ensures clients always have the latest state on connect,
    * and then receive real-time updates as they happen.
    */
    async handleConnection(@ConnectedSocket() client: Socket) {
        this.connectedClients++;

        this.logger.log(
            `Client connected: ${client.id} (total: ${this.connectedClients})`,
        );

        // Enforce connection limit
        if (this.connectedClients > WEBSOCKET_CONFIG.MAX_CONNECTIONS) {
            this.logger.warn(
                `Connection limit exceeded (${WEBSOCKET_CONFIG.MAX_CONNECTIONS}), disconnecting ${client.id}`,
            );

            client.emit('error', {
                type: WSMessageType.ERROR,
                data: { message: 'Maximum connections exceeded' },
            });

            client.disconnect(true);
            return;
        }

        try {
            // Fetch current order book snapshot from Redis
            // This gives the client the current state immediately
            const orderBook = await this.redisService.getOrderBook(10);

            // Send snapshot to newly connected client
            client.emit('depth', {
                type: WSMessageType.SNAPSHOT,
                data: orderBook,
            });

            this.logger.debug(`Sent snapshot to client ${client.id}`);
        } catch (error) {
            const err = error as Error;
            this.logger.error(
                `Failed to send snapshot to ${client.id}: ${err.message}`,
            );

            client.emit('error', {
                type: WSMessageType.ERROR,
                data: { message: 'Failed to fetch order book' },
            });
        }
    }

    /**
    * Handle client disconnection
    */
    handleDisconnect(@ConnectedSocket() client: Socket) {
        this.connectedClients--;
        this.logger.log(
            `Client disconnected: ${client.id} (total: ${this.connectedClients})`,
        );
    }

    /**
    * Broadcast order book update to all connected clients
    * 
    * Called by Redis pub/sub callback when order book is updated.
    * Sends delta update (not full snapshot) to reduce bandwidth.
    * 
    * Why deltas instead of snapshots?
    * - Reduces bandwidth usage (only send changes)
    * - Improves performance for clients (less parsing)
    * - Standard practice in financial data streaming
    * 
    * @param orderBook - Updated order book snapshot
    */
    private broadcastUpdate(orderBook: OrderBook): void {
        if (this.connectedClients === 0) {
            // No clients connected, skip broadcast
            return;
        }

        try {
            // Broadcast to all connected clients
            // Using 'depth' event for consistency
            this.server.emit('depth', {
                type: WSMessageType.DELTA,
                data: {
                    bids: orderBook.bids,
                    asks: orderBook.asks,
                    timestamp: orderBook.timestamp,
                },
            });

            this.logger.debug(
                `Broadcasted update to ${this.connectedClients} clients`,
            );
        } catch (error) {
            const err = error as Error;
            this.logger.error(`Failed to broadcast update: ${err.message}`);
        }
    }

    /**
    * Get current gateway status
    */
    getStatus(): { connectedClients: number; isSubscribed: boolean } {
        return {
            connectedClients: this.connectedClients,
            isSubscribed: this.isSubscribed,
        };
    }
}