import { describe, expect, it } from 'vitest';
import { generatePkce, generateState } from './pkce';

describe('generatePkce', () => {
  it('should produce a verifier within the RFC 7636 length range and matching charset', () => {
    const { verifier, challenge } = generatePkce();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(/^[\w\-.~]+$/);
    expect(challenge).toMatch(/^[\w\-]+$/);
    expect(challenge).not.toBe(verifier);
  });
});

describe('generateState', () => {
  it('should produce a non-empty url-safe string', () => {
    expect(generateState()).toMatch(/^[\w\-]+$/);
  });
});
