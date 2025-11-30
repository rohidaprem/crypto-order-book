/**
 * Created By: Prem
 * Created At: 2025-11-30
 * Last Modified At: 2025-11-30
 *
 * Description:
 * Application bootstrap entry point.
 * Initializes NestJS application with global configuration,
 * API prefix, CORS, and WebSocket support.
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import Config from './config';

async function bootstrap() {
    const logger = new Logger('Bootstrap');

    // Create NestJS application instance
    const app = await NestFactory.create(AppModule, {
        logger: Config.logging.debug ? ['log', 'error', 'warn', 'debug'] : ['log', 'error', 'warn'],
    });

    // Enable CORS for cross-origin requests
    app.enableCors({
        origin: Config.app.corsOrigin,
        credentials: Config.app.corsCredentials,
    });

    // Set global API prefix (all routes will be prefixed with /api)
    app.setGlobalPrefix(Config.app.apiPrefix);

    // Start listening on configured port
    await app.listen(Config.app.port);

    logger.log(`
 ╔═══════════════════════════════════════════════════════════╗
 ║ ║
 ║ Crypto Order Book Simulator ║
 ║ Version: 1.0.0 ║
 ║ Environment: ${Config.app.env.padEnd(44)}║
 ║ ║
 ║ HTTP Server: http://localhost:${Config.app.port} ║
 ║ API Prefix: /${Config.app.apiPrefix} ║
 ║ WebSocket: ws://localhost:${Config.app.port}${Config.websocket.path.padEnd(14)}║
 ║ ║
 ║ Endpoints: ║
 ║ - POST /${Config.app.apiPrefix}/market (Market order simulation) ║
 ║ - WS ${Config.websocket.path} (Real-time order book) ║
 ║ ║
 ║ Configuration: ║
 ║ - Exchange: ${Config.exchange.name} (${Config.exchange.symbol}) ║
 ║ - Update Interval: ${Config.exchange.updateIntervalMs}ms ║
 ║ - Rate Limit: ${Config.rateLimit.limit} req/${Config.rateLimit.ttl / 1000}s ║
 ║ - Max Connections: ${Config.websocket.maxConnections} ║
 ║ ║
 ╚═══════════════════════════════════════════════════════════╝
 `);

    logger.log('Application is ready to accept connections');
}

// Start the application
bootstrap().catch((error) => {
    console.error('Failed to start application:', error);
    process.exit(1);
});

