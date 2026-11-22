import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { apiError } from './api-error';

export type IdempotentResponse<T> = {
  statusCode: number;
  body: T;
};

type IdempotencyInput = {
  actorId: string;
  operation: string;
  requestKey: string;
  fingerprintValue: unknown;
};

@Injectable()
export class IdempotencyService {
  async execute<T>(
    client: PoolClient,
    input: IdempotencyInput,
    operation: () => Promise<IdempotentResponse<T>>,
  ): Promise<IdempotentResponse<T>> {
    const fingerprint = createHash('sha256')
      .update(stableJson(input.fingerprintValue))
      .digest('hex');
    const claimed = await client.query(
      `INSERT INTO idempotency_records
         (actor_id, operation, request_key, request_fingerprint,
          response_status, response_body, created_at)
       VALUES ($1, $2, $3, $4, 0, '{}'::jsonb, now())
       ON CONFLICT (actor_id, operation, request_key) DO NOTHING
       RETURNING actor_id`,
      [input.actorId, input.operation, input.requestKey, fingerprint],
    );

    if (claimed.rowCount === 0) {
      const existing = await client.query<{
        request_fingerprint: string;
        response_status: number;
        response_body: T;
      }>(
        `SELECT request_fingerprint, response_status, response_body
         FROM idempotency_records
         WHERE actor_id = $1 AND operation = $2 AND request_key = $3
         FOR UPDATE`,
        [input.actorId, input.operation, input.requestKey],
      );
      const record = existing.rows[0];
      if (!record) {
        throw new Error('Idempotency record disappeared after a conflicting insert');
      }
      if (record.request_fingerprint !== fingerprint) {
        throw apiError(
          HttpStatus.CONFLICT,
          'IDEMPOTENCY_KEY_REUSED',
          'This Idempotency-Key was already used with a different request.',
        );
      }
      if (record.response_status < 200 || record.response_status >= 300) {
        throw new Error('A committed idempotency record has no successful response');
      }
      return { statusCode: record.response_status, body: record.response_body };
    }

    const response = await operation();
    await client.query(
      `UPDATE idempotency_records
       SET response_status = $4, response_body = $5::jsonb
       WHERE actor_id = $1 AND operation = $2 AND request_key = $3`,
      [
        input.actorId,
        input.operation,
        input.requestKey,
        response.statusCode,
        JSON.stringify(response.body),
      ],
    );
    return response;
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}
