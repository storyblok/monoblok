import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logoutCommand } from './';
import { session } from '../../session';
import { removeAllCredentials } from '../../creds';
import { loggedOutSessionState } from '../../../test/setup';

vi.mock('../../creds', () => ({
  getCredentials: vi.fn(),
  addCredentials: vi.fn(),
  removeCredentials: vi.fn(),
  removeAllCredentials: vi.fn(),
}));

const preconditions = {
  loggedOut() {
    vi.mocked(session().initializeSession).mockImplementation(async () => {
      session().state = loggedOutSessionState();
    });
  },
};

describe('logoutCommand', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  it('should log out the user if has previously login', async () => {
    await logoutCommand.parseAsync(['node', 'test']);
    expect(removeAllCredentials).toHaveBeenCalled();
  });

  it('should not log out the user if has not previously login', async () => {
    preconditions.loggedOut();
    await logoutCommand.parseAsync(['node', 'test']);
    expect(removeAllCredentials).not.toHaveBeenCalled();
  });
});
