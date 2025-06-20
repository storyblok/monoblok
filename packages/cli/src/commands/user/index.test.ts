import { userCommand } from './';
import { getUser } from './actions';
import { konsola } from '../../utils';
import { session } from '../../session';
import chalk from 'chalk';

vi.mock('./actions', () => ({
  getUser: vi.fn(),
}));

vi.mock('../../creds', () => ({
  isAuthorized: vi.fn(),
}));

// Mocking the session module
vi.mock('../../session', () => {
  let _cache;
  const session = () => {
    if (!_cache) {
      _cache = {
        state: {
          isLoggedIn: false,
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

vi.mock('../../utils/konsola');

describe('userCommand', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  it('should show the user information', async () => {
    const mockResponse = {
      user: {
        friendly_name: 'John Doe',
        email: 'john.doe@storyblok.com',
      },
    };
    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };
    vi.mocked(getUser).mockResolvedValue(mockResponse);
    await userCommand.parseAsync(['node', 'test']);

    expect(getUser).toHaveBeenCalledWith('valid-token', 'eu');
    expect(konsola.ok).toHaveBeenCalledWith(
      `Hi ${chalk.bold('John Doe')}, you are currently logged in with ${chalk.hex('#45bfb9')(mockResponse.user.email)} on ${chalk.bold('eu')} region`,
      true,
    );
  });

  it('should show an error if the user is not logged in', async () => {
    session().state = {
      isLoggedIn: false,
    };
    await userCommand.parseAsync(['node', 'test']);

    expect(konsola.error).toHaveBeenCalledWith('You are currently not logged in. Please run storyblok login to authenticate, or storyblok signup to sign up.', null, {
      header: true,
    });
  });

  it('should show an error if the user information cannot be fetched', async () => {
    session().state = {
      isLoggedIn: true,
      password: 'valid-token',
      region: 'eu',
    };

    const mockError = new Error('Network error');

    vi.mocked(getUser).mockRejectedValue(mockError);

    await userCommand.parseAsync(['node', 'test']);

    expect(konsola.error).toHaveBeenCalledWith(mockError.message, null, {
      header: true,
    });
  });
});
