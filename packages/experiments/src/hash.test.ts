import { describe, expect, it } from 'vitest';
import { hashToBucket } from './hash';

describe('hashToBucket', () => {
  it('is deterministic for the same input', () => {
    expect(hashToBucket('visitor-1:123')).toBe(hashToBucket('visitor-1:123'));
  });

  it('always returns a bucket in 0..99', () => {
    for (let i = 0; i < 1000; i++) {
      const bucket = hashToBucket(`visitor-${i}:123`);
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThanOrEqual(99);
      expect(Number.isInteger(bucket)).toBe(true);
    }
  });

  it('spreads inputs across the range (no single hot bucket)', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      seen.add(hashToBucket(`visitor-${i}:123`));
    }
    // A healthy spread should touch most of the 100 buckets.
    expect(seen.size).toBeGreaterThan(80);
  });
});
