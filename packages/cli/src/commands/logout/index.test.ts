import { logoutCommand } from './';
import { session } from '../../session';

import { removeAllCredentials } from '../../creds';

vi.mock('../../creds', () => ({
  getCredentials: vi.fn(),
  addCredentials: vi.fn(),
  removeCredentials: vi.fn(),
  removeAllCredentials: vi.fn(),
}));

describe('logoutCommand', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  it('should log out the user if has previously login', async () => {
    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };
    await logoutCommand.parseAsync(['node', 'test']);
    expect(removeAllCredentials).toHaveBeenCalled();
  });

  it('should not log out the user if has not previously login', async () => {
    session().state = {
      isLoggedIn: false,
    };
    await logoutCommand.parseAsync(['node', 'test']);
    expect(removeAllCredentials).not.toHaveBeenCalled();
  });
});
