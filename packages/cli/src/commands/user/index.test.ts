import chalk from 'chalk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userCommand } from './';
import { getUser } from './actions';
import { konsola } from '../../utils';
import { session } from '../../session';
import { loggedOutSessionState } from '../../../test/setup';

vi.mock('./actions', () => ({
  getUser: vi.fn(),
}));

vi.mock('../../creds', () => ({
  isAuthorized: vi.fn(),
}));

vi.mock('../../utils/konsola');

const preconditions = {
  loggedOut() {
    vi.mocked(session().initializeSession).mockImplementation(async () => {
      session().state = loggedOutSessionState();
    });
  },
};

describe('userCommand', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  it('should show the user information', async () => {
    const mockResponse = {
      id: 1,
      friendly_name: 'John Doe',
      email: 'john.doe@storyblok.com',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };
    vi.mocked(getUser).mockResolvedValue(mockResponse);
    await userCommand.parseAsync(['node', 'test']);

    expect(getUser).toHaveBeenCalledWith('valid-token', 'eu');
    expect(konsola.ok).toHaveBeenCalledWith(
      `Hi ${chalk.bold('John Doe')}, you are currently logged in with ${chalk.hex('#45bfb9')(mockResponse.email)} on ${chalk.bold('eu')} region`,
      true,
    );
  });

  it('should show an error if the user is not logged in', async () => {
    preconditions.loggedOut();

    await userCommand.parseAsync(['node', 'test']);

    expect(konsola.error).toHaveBeenCalledWith('You are currently not logged in. Please run storyblok login to authenticate, or storyblok signup to sign up.', null, {
      header: true,
    });
  });

  it('should show an error if the user information cannot be fetched', async () => {
    const mockError = new Error('Network error');

    vi.mocked(getUser).mockRejectedValue(mockError);

    await userCommand.parseAsync(['node', 'test']);

    expect(konsola.error).toHaveBeenCalledWith(mockError.message, null, {
      header: true,
    });
  });
});
