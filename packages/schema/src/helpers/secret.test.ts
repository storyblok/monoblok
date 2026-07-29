import { describe, expect, it } from 'vitest';

import { isSecretPlaceholder, secret, SECRET_MARKER } from './secret';

describe('secret', () => {
  it('should create a preserve-remote placeholder string with no env', () => {
    expect(secret()).toBe(SECRET_MARKER);
  });

  it('should encode the env variable name when given', () => {
    expect(secret('SHOPWARE_ACCESS_KEY')).toBe(`${SECRET_MARKER}:SHOPWARE_ACCESS_KEY`);
  });

  it('should return a string so it fits a plugin option value', () => {
    expect(typeof secret()).toBe('string');
    expect(typeof secret('X')).toBe('string');
  });
});

describe('isSecretPlaceholder', () => {
  it('should recognize placeholders produced by secret()', () => {
    expect(isSecretPlaceholder(secret())).toBe(true);
    expect(isSecretPlaceholder(secret('TOKEN'))).toBe(true);
  });

  it('should recognize a structurally-equal placeholder from another package instance', () => {
    // The CLI matches on the marker string, so a bare sentinel must be accepted.
    expect(isSecretPlaceholder(SECRET_MARKER)).toBe(true);
    expect(isSecretPlaceholder(`${SECRET_MARKER}:MY_ENV`)).toBe(true);
  });

  it('should reject non-placeholder values', () => {
    expect(isSecretPlaceholder('accessKey')).toBe(false);
    expect(isSecretPlaceholder('')).toBe(false);
    expect(isSecretPlaceholder(null)).toBe(false);
    expect(isSecretPlaceholder(undefined)).toBe(false);
    expect(isSecretPlaceholder({ [SECRET_MARKER]: true })).toBe(false);
    expect(isSecretPlaceholder(`prefixed ${SECRET_MARKER}`)).toBe(false);
  });
});
