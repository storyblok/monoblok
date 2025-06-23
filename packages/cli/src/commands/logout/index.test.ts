import { logoutCommand } from './';
import { session } from '../../session';

import { removeAllCredentials } from '../../creds';

vi.mock('../../creds', () => ({
  getCredentials: vi.fn(),
  addCredentials: vi.fn(),
  removeCredentials: vi.fn(),
  removeAllCredentials: vi.fn(),
}));

// Mocking the session module
vi.mock('../../session', () => {
  let _cache: Record<string, any> | null = null;
  const session = () => {
    if (!_cache) {
      _cache = {
        state: {
          isLoggedIn: true,
          password: 'valid-token',
          region: 'eu',
        },
        updateSession: vi.fn(),
        persistCredentials: vi.fn(),
        initializeSession: vi.fn(),
      };
    }
    return _cache;
  };

  return {
    session,
  };
});

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
