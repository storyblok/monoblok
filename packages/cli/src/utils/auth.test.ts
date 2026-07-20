import { describe, expect, it, vi } from 'vitest';
import type { SessionState } from '../session';
import { requireAuthentication, sessionCredential } from './auth';

vi.mock('./error', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./error')>();
  return { ...actual, handleError: vi.fn() };
});

describe('requireAuthentication', () => {
  it('should accept a PAT session', () => {
    const state: SessionState = { isLoggedIn: true, password: 'pat-token', region: 'eu', authType: 'pat' };
    expect(requireAuthentication(state)).toBe(true);
  });

  it('should accept an OAuth session (no password, has access token)', () => {
    const state: SessionState = { isLoggedIn: true, region: 'eu', authType: 'oauth', oauthAccessToken: 'oat-token' };
    expect(requireAuthentication(state)).toBe(true);
  });

  it('should reject when not logged in', () => {
    expect(requireAuthentication({ isLoggedIn: false })).toBe(false);
  });

  it('should reject an OAuth session without an access token', () => {
    expect(requireAuthentication({ isLoggedIn: true, region: 'eu', authType: 'oauth' })).toBe(false);
  });

  it('should reject a session without a region', () => {
    expect(requireAuthentication({ isLoggedIn: true, password: 'pat-token' })).toBe(false);
  });
});

describe('sessionCredential', () => {
  it('should return an oauthToken credential for OAuth sessions', () => {
    const state: SessionState = { isLoggedIn: true, region: 'eu', authType: 'oauth', oauthAccessToken: 'oat-token' };
    expect(sessionCredential(state)).toEqual({ oauthToken: 'oat-token' });
  });

  it('should return a personalAccessToken credential for PAT sessions', () => {
    const state: SessionState = { isLoggedIn: true, region: 'eu', authType: 'pat', password: 'pat-token' };
    expect(sessionCredential(state)).toEqual({ personalAccessToken: 'pat-token' });
  });

  it('should return undefined when no credential is present', () => {
    expect(sessionCredential({ isLoggedIn: false })).toBeUndefined();
  });
});
