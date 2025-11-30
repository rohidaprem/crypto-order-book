/**
 * Order History Controller
 * 
 * Provides APIs for retrieving order history with various grouping options:
 * 1. GET /api/orders/history - All orders grouped by IP and date
 * 2. GET /api/orders/history/ip/{ip} - Orders for specific IP (optionally filtered by date)
 * 3. GET /api/orders/history/date/{date} - Orders for specific date (grouped by IP)
 * 
 * Sample curl tests:
 * 
 * # Get all orders grouped by IP and date
 * curl http://localhost:3000/api/orders/history
 * 
 * # Get orders for specific IP
 * curl http://localhost:3000/api/orders/history/ip/192.168.1.1
 * 
 * # Get orders for specific IP on specific date
 * curl http://localhost:3000/api/orders/history/ip/192.168.1.1?date=2025-11-30
 * 
 * # Get orders for specific date
 * curl http://localhost:3000/api/orders/history/date/2025-11-30
 */

import {
  Controller,
  Get,
  Param,
  Query,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { OrderHistoryService } from '../services/order-history.service';

@Controller('orders')
export class OrderHistoryController {
  private readonly logger = new Logger(OrderHistoryController.name);

  constructor(private readonly orderHistoryService: OrderHistoryService) {}

  /**
   * GET /api/orders/history
   * Retrieve all orders grouped by IP address and date
   * 
   * Returns:
   * {
   *   total_orders: number,
   *   total_btc_traded: number,
   *   total_cost_or_revenue: number,
   *   grouped_by_ip: [
   *     {
   *       ip: string,
   *       order_count: number,
   *       total_btc_traded: number,
   *       total_cost_or_revenue: number,
   *       orders: [...]
   *     }
   *   ],
   *   grouped_by_date: [
   *     {
   *       date: string,
   *       order_count: number,
   *       total_btc_traded: number,
   *       total_cost_or_revenue: number,
   *       orders: [...]
   *     }
   *   ]
   * }
   */
  @Get('history')
  async getAllOrdersHistory() {
    try {
      this.logger.log('Fetching all orders history grouped by IP and date');
      const result = await this.orderHistoryService.getAllOrdersGrouped();
      
      this.logger.log(
        `Retrieved history: ${result.total_orders} orders, ${result.total_btc_traded} BTC traded`
      );

      return result;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to fetch order history: ${err.message}`);
      throw new HttpException(
        'Failed to retrieve order history',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * GET /api/orders/history/ip/:ip
   * Retrieve orders for a specific IP address
   * 
   * Query Parameters:
   * - date (optional): Filter by specific date (YYYY-MM-DD format)
   * 
   * Returns:
   * {
   *   ip: string,
   *   order_count: number,
   *   total_btc_traded: number,
   *   total_cost_or_revenue: number,
   *   orders_by_date: {
   *     "2025-11-30": [...],
   *     "2025-11-29": [...]
   *   },
   *   all_orders: [...]
   * }
   */
  @Get('history/ip/:ip')
  async getOrdersByIP(
    @Param('ip') ip: string,
    @Query('date') date?: string
  ) {
    try {
      this.logger.log(`Fetching orders for IP: ${ip}${date ? ` (Date: ${date})` : ''}`);

      // Validate IP format (basic validation)
      if (!this.isValidIP(ip)) {
        throw new HttpException(
          'Invalid IP address format',
          HttpStatus.BAD_REQUEST
        );
      }

      // Validate date format if provided
      if (date && !this.isValidDate(date)) {
        throw new HttpException(
          'Invalid date format. Use YYYY-MM-DD',
          HttpStatus.BAD_REQUEST
        );
      }

      const result = await this.orderHistoryService.getOrdersByIP(ip, date);

      this.logger.log(
        `Retrieved ${result.order_count} orders for IP ${ip}`
      );

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const err = error as Error;
      this.logger.error(`Failed to fetch orders for IP ${ip}: ${err.message}`);
      throw new HttpException(
        'Failed to retrieve orders for IP',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * GET /api/orders/history/date/:date
   * Retrieve orders for a specific date
   * 
   * Path Parameters:
   * - date: Date in YYYY-MM-DD format
   * 
   * Returns:
   * {
   *   date: string,
   *   order_count: number,
   *   total_btc_traded: number,
   *   total_cost_or_revenue: number,
   *   orders_by_ip: {
   *     "192.168.1.1": [...],
   *     "192.168.1.2": [...]
   *   },
   *   all_orders: [...]
   * }
   */
  @Get('history/date/:date')
  async getOrdersByDate(@Param('date') date: string) {
    try {
      this.logger.log(`Fetching orders for date: ${date}`);

      // Validate date format
      if (!this.isValidDate(date)) {
        throw new HttpException(
          'Invalid date format. Use YYYY-MM-DD',
          HttpStatus.BAD_REQUEST
        );
      }

      const result = await this.orderHistoryService.getOrdersByDate(date);

      this.logger.log(`Retrieved ${result.order_count} orders for date ${date}`);

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const err = error as Error;
      this.logger.error(`Failed to fetch orders for date ${date}: ${err.message}`);
      throw new HttpException(
        'Failed to retrieve orders for date',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Helper function to validate IP address format
   */
  private isValidIP(ip: string): boolean {
    // Simple IPv4 validation
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    // Also allow localhost
    if (ip === 'localhost' || ip === '127.0.0.1' || ip === '::1') {
      return true;
    }
    
    if (!ipv4Regex.test(ip)) {
      return false;
    }

    // Validate each octet is 0-255
    const octets = ip.split('.');
    return octets.every(octet => parseInt(octet, 10) <= 255);
  }

  /**
   * Helper function to validate date format (YYYY-MM-DD)
   */
  private isValidDate(date: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return false;
    }

    // Validate actual date
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    return (
      dateObj.getFullYear() === year &&
      dateObj.getMonth() === month - 1 &&
      dateObj.getDate() === day
    );
  }
}
