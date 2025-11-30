/**
 * Created By: Prem
 * Created At: 2025-11-30
 * Last Modified At: 2025-11-30
 *
 * Description:
 * Custom Zod validation pipe for NestJS.
 * Validates request payloads against Zod schemas and returns
 * clear error messages on validation failure.
 */

import { PipeTransform, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

export class ZodValidationPipe implements PipeTransform {
    constructor(private schema: ZodSchema) { }

    transform(value: unknown, metadata: ArgumentMetadata) {
        try {
            const parsedValue = this.schema.parse(value);
            return parsedValue;
        } catch (error) {
            if (error instanceof ZodError) {
                // Format Zod errors into readable messages
                const messages = error.errors.map((err) => {
                    const path = err.path.join('.');
                    return `${path}: ${err.message}`;
                });

                throw new BadRequestException({
                    message: 'Validation failed',
                    errors: messages,
                });
            }
            throw new BadRequestException('Validation failed');
        }
    }
}



