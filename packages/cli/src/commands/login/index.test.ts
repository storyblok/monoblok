import { describe, expect, it, vi } from 'vitest';
import { loginWithEmailAndPassword, loginWithOtp, loginWithToken } from './actions';
import { loginCommand } from './';
import { konsola } from '../../utils';
import { input, password, select } from '@inquirer/prompts';
import { regions } from '../../constants';
import chalk from 'chalk';
import { session } from '../../session'; // Import as module to mock properly

vi.mock('./actions', () => ({
  loginWithEmailAndPassword: vi.fn(),
  loginWithOtp: vi.fn(),
  loginWithToken: vi.fn(),
}));

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

vi.mock('../../utils', async () => {
  const actualUtils = await vi.importActual('../../utils');
  return {
    ...actualUtils,
    konsola: {
      ok: vi.fn(),
      title: vi.fn(),
      br: vi.fn(),
      error: vi.fn(),
    },
    isVitestRunning: true,
    handleError: (error: Error, header = false) => {
      konsola.error(error, header);
      // Optionally, prevent process.exit during tests
    },
  };
});

vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
  password: vi.fn(),
  select: vi.fn(),
}));

describe('loginCommand', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  describe('default interactive login', () => {
    it('should prompt the user for login strategy when no token is provided', async () => {
      await loginCommand.parseAsync(['node', 'test']);

      expect(select).toHaveBeenCalledWith(expect.objectContaining({
        message: 'How would you like to login?',
      }));
    });

    describe('login-with-email strategy', () => {
      beforeEach(() => {
        vi.resetAllMocks();
      });
      it('should prompt the user for email and password when login-with-email is selected', async () => {
        vi.mocked(select)
          .mockResolvedValueOnce('login-with-email') // For login strategy
          .mockResolvedValueOnce('eu'); // For region

        vi.mocked(input)
          .mockResolvedValueOnce('user@example.com') // For email
          .mockResolvedValueOnce('123456'); // For OTP code

        vi.mocked(password).mockResolvedValueOnce('test-password');

        await loginCommand.parseAsync(['node', 'test']);

        expect(input).toHaveBeenCalledWith(expect.objectContaining({
          message: 'Please enter your email address:',
        }));

        expect(password).toHaveBeenCalledWith(expect.objectContaining({
          message: 'Please enter your password:',
        }));

        expect(select).toHaveBeenCalledWith(expect.objectContaining({
          message: 'Please select the region you would like to work in:',
        }));
      });

      it('should login with email and password if provided using login-with-email strategy', async () => {
        vi.mocked(select)
          .mockResolvedValueOnce('login-with-email') // For login strategy
          .mockResolvedValueOnce('eu'); // For region

        vi.mocked(input)
          .mockResolvedValueOnce('user@example.com') // For email
          .mockResolvedValueOnce('123456'); // For OTP code

        vi.mocked(password).mockResolvedValueOnce('test-password');

        vi.mocked(loginWithEmailAndPassword).mockResolvedValueOnce({ otp_required: true });
        vi.mocked(loginWithOtp).mockResolvedValueOnce({ access_token: 'test-token' });

        await loginCommand.parseAsync(['node', 'test']);

        expect(loginWithEmailAndPassword).toHaveBeenCalledWith('user@example.com', 'test-password', 'eu');

        expect(loginWithOtp).toHaveBeenCalledWith('user@example.com', 'test-password', '123456', 'eu');
      });

      it('should throw an error for invalid email and password', async () => {
        vi.mocked(select).mockResolvedValueOnce('login-with-email');
        vi.mocked(input).mockResolvedValueOnce('eu');

        const mockError = new Error('Error logging in with email and password');
        loginWithEmailAndPassword.mockRejectedValueOnce(mockError);

        await loginCommand.parseAsync(['node', 'test']);

        expect(konsola.error).toHaveBeenCalledWith(mockError, false);
      });
    });

    describe('login-with-token strategy', () => {
      it('should prompt the user for token when login-with-token is selected', async () => {
        select.mockResolvedValueOnce('login-with-token');
        password.mockResolvedValueOnce('test-token');

        await loginCommand.parseAsync(['node', 'test']);

        expect(password).toHaveBeenCalledWith(expect.objectContaining({
          message: 'Please enter your token:',
        }));
      });

      it('should login with token if token is provided using login-with-token strategy', async () => {
        vi.mocked(select).mockResolvedValueOnce('login-with-token');
        vi.mocked(password).mockResolvedValueOnce('test-token');
        const mockUser = { email: 'user@example.com' };
        vi.mocked(loginWithToken).mockResolvedValue({ user: mockUser });

        await loginCommand.parseAsync(['node', 'test', '--region', 'eu']);

        expect(password).toHaveBeenCalledWith(expect.objectContaining({
          message: 'Please enter your token:',
        }));
        // Verify that loginWithToken was called with the correct arguments
        expect(loginWithToken).toHaveBeenCalledWith('test-token', 'eu');

        // Verify that updateSession was called with the correct arguments
        expect(session().updateSession).toHaveBeenCalledWith(mockUser.email, 'test-token', 'eu');
      });
    });
  });

  describe('--token', () => {
    it('should login with a valid token', async () => {
      const mockToken = 'test-token';
      const mockUser = { email: 'test@example.com', friendly_name: 'Test User' };
      vi.mocked(loginWithToken).mockResolvedValue({ user: mockUser });

      await loginCommand.parseAsync(['node', 'test', '--token', mockToken, '--region', 'eu']);

      expect(loginWithToken).toHaveBeenCalledWith(mockToken, 'eu');

      expect(konsola.ok).toHaveBeenCalledWith('Successfully logged in to region Europe (eu). Welcome Test User.', true);
    });

    it('should login with a valid token in another region --region', async () => {
      const mockToken = 'test-token';
      const mockUser = { email: 'test@example.com', friendly_name: 'Test User' };
      vi.mocked(loginWithToken).mockResolvedValue({ user: mockUser });

      await loginCommand.parseAsync(['node', 'test', '--token', mockToken, '--region', 'us']);

      expect(loginWithToken).toHaveBeenCalledWith(mockToken, 'us');

      expect(konsola.ok).toHaveBeenCalledWith('Successfully logged in to region United States (us). Welcome Test User.', true);
    });

    it('should throw an error for an invalid token', async () => {
      const mockError = new Error(`The token provided ${chalk.bold('inva*********')} is invalid: ${chalk.bold('401 Unauthorized')}

      Please make sure you are using the correct token and try again.`);

      vi.mocked(loginWithToken).mockRejectedValue(mockError);

      await loginCommand.parseAsync(['node', 'test', '--token', 'invalid-token']);

      // expect(handleError).toHaveBeenCalledWith(mockError, true)
      expect(konsola.error).toHaveBeenCalledWith(mockError, false);
    });
  });

  describe('--region', () => {
    it('should handle invalid region error with correct message', async () => {
      await loginCommand.parseAsync(['node', 'test', '--region', 'invalid-region']);

      expect(konsola.error).toHaveBeenCalledWith(expect.any(Error), false);

      // Access the error argument
      const errorArg = vi.mocked(konsola.error).mock.calls[0][0];

      // Build the expected error message
      const expectedMessage = `The provided region: invalid-region is not valid. Please use one of the following values: ${Object.values(regions).join(' | ')}`;

      expect(errorArg.message).toBe(expectedMessage);
    });
  });
});
