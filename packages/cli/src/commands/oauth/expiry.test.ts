import { describe, expect, it } from 'vitest';
import { isExpiringSoon } from './expiry';

describe('isExpiringSoon', () => {
  const now = Date.parse('2026-07-20T00:00:00.000Z');

  it('should be true when already expired', () => {
    expect(isExpiringSoon('2026-07-19T23:59:00.000Z', 120_000, now)).toBe(true);
  });

  it('should be true within the skew window', () => {
    expect(isExpiringSoon('2026-07-20T00:01:00.000Z', 120_000, now)).toBe(true);
  });

  it('should be false when comfortably valid', () => {
    expect(isExpiringSoon('2026-07-20T00:10:00.000Z', 120_000, now)).toBe(false);
  });

  it('should be true when no expiry is known', () => {
    expect(isExpiringSoon(undefined, 120_000, now)).toBe(true);
  });
});
