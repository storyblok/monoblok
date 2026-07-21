import { describe, expect, it } from 'vitest';
import { assertSpaceAllowed } from './space-guard';

describe('assertSpaceAllowed', () => {
  it('should pass when the space is in the grant', () => {
    expect(() => assertSpaceAllowed(123, [{ id: 123 }])).not.toThrow();
  });

  it('should throw when the space is outside the grant', () => {
    expect(() => assertSpaceAllowed(999, [{ id: 123 }])).toThrow(/not covered by your OAuth login/);
  });

  it('should pass when the grant has no space restriction', () => {
    expect(() => assertSpaceAllowed(999, [])).not.toThrow();
    expect(() => assertSpaceAllowed(999, undefined)).not.toThrow();
  });

  it('should pass when no space is targeted', () => {
    expect(() => assertSpaceAllowed(undefined, [{ id: 123 }])).not.toThrow();
  });
});
