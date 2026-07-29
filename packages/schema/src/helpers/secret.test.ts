import { describe, expect, it } from 'vitest';

import { isSecretPlaceholder, secret, SECRET_MARKER } from './secret';

describe('secret', () => {
  it('should create a preserve-remote placeholder with no env', () => {
    expect(secret()).toEqual({ [SECRET_MARKER]: true });
  });

  it('should create an env-backed placeholder when a variable name is given', () => {
    expect(secret('SHOPWARE_ACCESS_KEY')).toEqual({
      [SECRET_MARKER]: true,
      env: 'SHOPWARE_ACCESS_KEY',
    });
  });

  it('should not carry an env key when none is provided', () => {
    expect('env' in secret()).toBe(false);
  });
});

describe('isSecretPlaceholder', () => {
  it('should recognize placeholders produced by secret()', () => {
    expect(isSecretPlaceholder(secret())).toBe(true);
    expect(isSecretPlaceholder(secret('TOKEN'))).toBe(true);
  });

  it('should recognize a structurally-equal placeholder from another package instance', () => {
    // The CLI matches on the marker string, not object identity, so a plain
    // object with the marker must be accepted.
    expect(isSecretPlaceholder({ [SECRET_MARKER]: true })).toBe(true);
  });

  it('should reject non-placeholder values', () => {
    expect(isSecretPlaceholder('accessKey')).toBe(false);
    expect(isSecretPlaceholder(null)).toBe(false);
    expect(isSecretPlaceholder(undefined)).toBe(false);
    expect(isSecretPlaceholder({ [SECRET_MARKER]: false })).toBe(false);
    expect(isSecretPlaceholder({ accessKey: 'real' })).toBe(false);
    expect(isSecretPlaceholder([SECRET_MARKER])).toBe(false);
  });
});
