/**
* Created By: Prem
* Created At: 2025-11-30
* Last Modified At: 2025-11-30
*
* Description:
* Zod validation schemas for API input validation.
* Ensures type safety and provides clear error messages.
*/

import { z } from 'zod';
import { MARKET_ORDER_CONFIG } from '../constants';

/**
 * Market order request validation schema
 */
export const MarketOrderRequestSchema = z.object({
    side: z.enum(['buy', 'sell'], {
        errorMap: () => ({ message: 'Side must be either "buy" or "sell"' }),
    }),
    amount: z
        .number({
            required_error: 'Amount is required',
            invalid_type_error: 'Amount must be a number',
        })
        .positive('Amount must be positive')
        .min(
            MARKET_ORDER_CONFIG.MIN_ORDER_SIZE,
            `Amount must be at least ${MARKET_ORDER_CONFIG.MIN_ORDER_SIZE} BTC`,
        )
        .max(
            MARKET_ORDER_CONFIG.MAX_ORDER_SIZE,
            `Amount cannot exceed ${MARKET_ORDER_CONFIG.MAX_ORDER_SIZE} BTC`,
        ),
});

export type MarketOrderRequestDto = z.infer<typeof MarketOrderRequestSchema>;

