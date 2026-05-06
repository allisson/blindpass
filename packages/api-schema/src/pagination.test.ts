import { describe, it, expect } from 'vitest';
import { PaginationQuerySchema } from './pagination.js';

const uuid = '123e4567-e89b-12d3-a456-426614174000';

describe('PaginationQuerySchema', () => {
  it('accepts valid cursor and limit', () => {
    expect(PaginationQuerySchema.safeParse({ cursor: uuid, limit: 50 }).success).toBe(true);
  });

  it('applies default limit of 20 when omitted', () => {
    const result = PaginationQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(20);
  });

  it('cursor is optional', () => {
    const result = PaginationQuerySchema.safeParse({ limit: 10 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cursor).toBeUndefined();
  });

  it('coerces string limit to number', () => {
    const result = PaginationQuerySchema.safeParse({ limit: '15' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(15);
  });

  it('rejects limit below 1', () => {
    expect(PaginationQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
  });

  it('rejects limit above 100', () => {
    expect(PaginationQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('rejects limit of exactly 100', () => {
    expect(PaginationQuerySchema.safeParse({ limit: 100 }).success).toBe(true);
  });

  it('rejects non-uuid cursor', () => {
    expect(PaginationQuerySchema.safeParse({ cursor: 'not-a-uuid' }).success).toBe(false);
  });

  it('rejects non-integer limit', () => {
    expect(PaginationQuerySchema.safeParse({ limit: 1.5 }).success).toBe(false);
  });
});
