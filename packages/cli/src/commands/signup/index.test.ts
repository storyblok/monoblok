import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signupCommand } from './';

// Mock dependencies
vi.mock('./actions', () => ({
  buildSignupUrl: vi.fn(() => 'https://app.storyblok.com/#/signup'),
  openSignupInBrowser: vi.fn(),
}));

vi.mock('../../session', () => ({
  session: () => ({
    state: {
      isLoggedIn: false,
      envLogin: false,
    },
    initializeSession: vi.fn(),
  }),
}));

vi.mock('../../utils', async () => {
  const actualUtils = await vi.importActual('../../utils');
  return {
    ...actualUtils,
    konsola: {
      ok: vi.fn(),
      title: vi.fn(),
      info: vi.fn(),
      br: vi.fn(),
      error: vi.fn(),
    },
    handleError: vi.fn(),
  };
});

describe('signupCommand', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(signupCommand).toBeDefined();
  });

  it('should have correct command name and description', () => {
    expect(signupCommand.name()).toBe('signup');
    expect(signupCommand.description()).toBe('Sign up for Storyblok');
  });

  it('should not have any options', () => {
    expect(signupCommand.options).toHaveLength(0);
  });
});
