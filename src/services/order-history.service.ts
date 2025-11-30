/**
 * Order History Service
 * 
 * Manages storage and retrieval of order history with IP addresses and timestamps.
 * Stores orders in Redis with grouping by IP and date.
 * 
 * Data Structure:
 * - order:history:all -> Sorted set of all orders (by timestamp)
 * - order:history:ip:{ip} -> List of orders by IP address
 * - order:history:date:{YYYY-MM-DD} -> List of orders by date
 */

import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

export interface OrderHistoryRecord {
  id: string; // Unique order ID
  ip: string; // Client IP address
  side: 'buy' | 'sell'; // Order side
  amount: number; // Requested amount in BTC
  filled: number; // Filled amount in BTC
  avg_price: number; // Average execution price
  slippage_pct: number; // Slippage percentage
  status: 'filled' | 'partial' | 'rejected'; // Order status
  total_cost_or_revenue: number; // Total cost (buy) or revenue (sell)
  timestamp: number; // Unix timestamp in milliseconds
  date: string; // Date in YYYY-MM-DD format
  time: string; // Time in HH:MM:SS format
}

export interface OrderHistoryGroupedByIP {
  ip: string;
  order_count: number;
  total_btc_traded: number;
  total_cost_or_revenue: number;
  orders: OrderHistoryRecord[];
}

export interface OrderHistoryGroupedByDate {
  date: string;
  order_count: number;
  total_btc_traded: number;
  total_cost_or_revenue: number;
  orders: OrderHistoryRecord[];
}

export interface OrderHistorySummary {
  total_orders: number;
  total_btc_traded: number;
  total_cost_or_revenue: number;
  grouped_by_ip: OrderHistoryGroupedByIP[];
  grouped_by_date: OrderHistoryGroupedByDate[];
}

@Injectable()
export class OrderHistoryService {
  private readonly logger = new Logger(OrderHistoryService.name);
  private readonly ORDER_HISTORY_PREFIX = 'order:history';

  constructor(private readonly redisService: RedisService) {}

  /**
   * Store a new order in history
   */
  async storeOrder(record: OrderHistoryRecord): Promise<void> {
    try {
      const client = this.redisService.getClient();
      const pipeline = client.pipeline();

      // Create unique order ID if not provided
      if (!record.id) {
        record.id = `order:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
      }

      // Serialize the order record
      const orderJson = JSON.stringify(record);

      // Store in main order history (sorted by timestamp)
      pipeline.zadd(
        `${this.ORDER_HISTORY_PREFIX}:all`,
        record.timestamp,
        orderJson
      );

      // Store in IP-specific history
      pipeline.lpush(
        `${this.ORDER_HISTORY_PREFIX}:ip:${record.ip}`,
        orderJson
      );

      // Store in date-specific history
      pipeline.lpush(
        `${this.ORDER_HISTORY_PREFIX}:date:${record.date}`,
        orderJson
      );

      // Set expiration for data (30 days)
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      pipeline.expire(`${this.ORDER_HISTORY_PREFIX}:ip:${record.ip}`, 2592000); // 30 days in seconds
      pipeline.expire(`${this.ORDER_HISTORY_PREFIX}:date:${record.date}`, 2592000);

      await pipeline.exec();

      this.logger.debug(
        `Stored order: ${record.id} | IP: ${record.ip} | Date: ${record.date} | ${record.side.toUpperCase()} ${record.amount} BTC`
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to store order history: ${err.message}`);
      throw error;
    }
  }

  /**
   * Get all orders with grouping by IP and date
   */
  async getAllOrdersGrouped(): Promise<OrderHistorySummary> {
    try {
      const client = this.redisService.getClient();

      // Get all orders
      const allOrdersJson = await client.zrange(
        `${this.ORDER_HISTORY_PREFIX}:all`,
        0,
        -1
      );

      const allOrders: OrderHistoryRecord[] = allOrdersJson.map((json: string) =>
        JSON.parse(json)
      );

      // Group by IP
      const groupedByIP = new Map<string, OrderHistoryRecord[]>();
      const groupedByDate = new Map<string, OrderHistoryRecord[]>();

      for (const order of allOrders) {
        // Group by IP
        if (!groupedByIP.has(order.ip)) {
          groupedByIP.set(order.ip, []);
        }
        groupedByIP.get(order.ip)!.push(order);

        // Group by Date
        if (!groupedByDate.has(order.date)) {
          groupedByDate.set(order.date, []);
        }
        groupedByDate.get(order.date)!.push(order);
      }

      // Calculate summary statistics
      let totalOrders = 0;
      let totalBtcTraded = 0;
      let totalCostOrRevenue = 0;

      const byIPArray: OrderHistoryGroupedByIP[] = [];
      groupedByIP.forEach((orders, ip) => {
        const ipTotal = orders.reduce((sum, o) => sum + o.filled, 0);
        const ipCostRevenue = orders.reduce((sum, o) => sum + o.total_cost_or_revenue, 0);

        byIPArray.push({
          ip,
          order_count: orders.length,
          total_btc_traded: ipTotal,
          total_cost_or_revenue: ipCostRevenue,
          orders,
        });

        totalOrders += orders.length;
        totalBtcTraded += ipTotal;
        totalCostOrRevenue += ipCostRevenue;
      });

      const byDateArray: OrderHistoryGroupedByDate[] = [];
      groupedByDate.forEach((orders, date) => {
        const dateTotal = orders.reduce((sum, o) => sum + o.filled, 0);
        const dateCostRevenue = orders.reduce((sum, o) => sum + o.total_cost_or_revenue, 0);

        byDateArray.push({
          date,
          order_count: orders.length,
          total_btc_traded: dateTotal,
          total_cost_or_revenue: dateCostRevenue,
          orders,
        });
      });

      // Sort by date (newest first)
      byDateArray.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return {
        total_orders: totalOrders,
        total_btc_traded: totalBtcTraded,
        total_cost_or_revenue: totalCostOrRevenue,
        grouped_by_ip: byIPArray,
        grouped_by_date: byDateArray,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to retrieve grouped orders: ${err.message}`);
      throw error;
    }
  }

  /**
   * Get orders for a specific IP address
   * If date is provided, filter by date as well
   */
  async getOrdersByIP(
    ip: string,
    date?: string
  ): Promise<{
    ip: string;
    order_count: number;
    total_btc_traded: number;
    total_cost_or_revenue: number;
    orders_by_date: {
      [key: string]: OrderHistoryRecord[];
    };
    all_orders: OrderHistoryRecord[];
  }> {
    try {
      const client = this.redisService.getClient();

      // Get all orders for this IP
      const ordersJson = await client.lrange(
        `${this.ORDER_HISTORY_PREFIX}:ip:${ip}`,
        0,
        -1
      );

      let orders: OrderHistoryRecord[] = ordersJson.map((json: string) =>
        JSON.parse(json)
      );

      // Filter by date if provided
      if (date) {
        orders = orders.filter((o) => o.date === date);
      }

      // Group remaining orders by date
      const ordersByDate = new Map<string, OrderHistoryRecord[]>();
      for (const order of orders) {
        if (!ordersByDate.has(order.date)) {
          ordersByDate.set(order.date, []);
        }
        ordersByDate.get(order.date)!.push(order);
      }

      // Calculate totals
      const totalBtc = orders.reduce((sum, o) => sum + o.filled, 0);
      const totalCostRevenue = orders.reduce((sum, o) => sum + o.total_cost_or_revenue, 0);

      // Convert map to object
      const ordersByDateObj: { [key: string]: OrderHistoryRecord[] } = {};
      ordersByDate.forEach((orders, date) => {
        ordersByDateObj[date] = orders.sort((a, b) => b.timestamp - a.timestamp);
      });

      return {
        ip,
        order_count: orders.length,
        total_btc_traded: totalBtc,
        total_cost_or_revenue: totalCostRevenue,
        orders_by_date: ordersByDateObj,
        all_orders: orders.sort((a, b) => b.timestamp - a.timestamp),
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to retrieve orders for IP ${ip}: ${err.message}`);
      throw error;
    }
  }

  /**
   * Get orders for a specific date
   */
  async getOrdersByDate(date: string): Promise<{
    date: string;
    order_count: number;
    total_btc_traded: number;
    total_cost_or_revenue: number;
    orders_by_ip: {
      [key: string]: OrderHistoryRecord[];
    };
    all_orders: OrderHistoryRecord[];
  }> {
    try {
      const client = this.redisService.getClient();

      // Get all orders for this date
      const ordersJson = await client.lrange(
        `${this.ORDER_HISTORY_PREFIX}:date:${date}`,
        0,
        -1
      );

      const orders: OrderHistoryRecord[] = ordersJson.map((json: string) =>
        JSON.parse(json)
      );

      // Group by IP
      const ordersByIP = new Map<string, OrderHistoryRecord[]>();
      for (const order of orders) {
        if (!ordersByIP.has(order.ip)) {
          ordersByIP.set(order.ip, []);
        }
        ordersByIP.get(order.ip)!.push(order);
      }

      // Calculate totals
      const totalBtc = orders.reduce((sum, o) => sum + o.filled, 0);
      const totalCostRevenue = orders.reduce((sum, o) => sum + o.total_cost_or_revenue, 0);

      // Convert map to object
      const ordersByIPObj: { [key: string]: OrderHistoryRecord[] } = {};
      ordersByIP.forEach((orders, ip) => {
        ordersByIPObj[ip] = orders.sort((a, b) => b.timestamp - a.timestamp);
      });

      return {
        date,
        order_count: orders.length,
        total_btc_traded: totalBtc,
        total_cost_or_revenue: totalCostRevenue,
        orders_by_ip: ordersByIPObj,
        all_orders: orders.sort((a, b) => b.timestamp - a.timestamp),
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to retrieve orders for date ${date}: ${err.message}`);
      throw error;
    }
  }

  /**
   * Clear all order history (for testing/admin purposes)
   */
  async clearAllHistory(): Promise<void> {
    try {
      const client = this.redisService.getClient();
      const keys = await client.keys(`${this.ORDER_HISTORY_PREFIX}:*`);
      
      if (keys.length > 0) {
        await client.del(...keys);
        this.logger.log(`Cleared ${keys.length} order history keys`);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to clear order history: ${err.message}`);
      throw error;
    }
  }
}
