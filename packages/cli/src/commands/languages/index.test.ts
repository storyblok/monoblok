import chalk from 'chalk';
import { languagesCommand } from '.';
import { session } from '../../session';
import { CommandError, konsola } from '../../utils';
import { fetchLanguages, saveLanguagesToFile } from './actions';
import { colorPalette } from '../../constants';

vi.mock('./actions', () => ({
  fetchLanguages: vi.fn(),
  saveLanguagesToFile: vi.fn(),
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

vi.mock('../../utils/konsola');

describe('languagesCommand', () => {
  describe('pull', () => {
    beforeEach(() => {
      vi.resetAllMocks();
      vi.clearAllMocks();
      // Reset the option values
      languagesCommand._optionValues = {};
      for (const command of languagesCommand.commands) {
        command._optionValues = {};
      }
    });
    describe('default mode', () => {
      it('should prompt the user if operation was sucessfull', async () => {
        const mockResponse = {
          default_lang_name: 'en',
          languages: [
            {
              code: 'ca',
              name: 'Catalan',
            },
            {
              code: 'fr',
              name: 'French',
            },
          ],
        };
        session().state = {
          isLoggedIn: true,
          password: 'valid-token',
          region: 'eu',
        };

        vi.mocked(fetchLanguages).mockResolvedValue(mockResponse);
        await languagesCommand.parseAsync(['node', 'test', 'pull', '--space', '12345']);
        expect(fetchLanguages).toHaveBeenCalledWith('12345', 'valid-token', 'eu');
        expect(saveLanguagesToFile).toHaveBeenCalledWith('12345', mockResponse, {
          path: undefined,
        });
        expect(konsola.ok).toHaveBeenCalledWith(`Languages schema downloaded successfully at ${chalk.hex(colorPalette.PRIMARY)(`.storyblok/languages/12345/languages.json`)}`, true);
      });

      it('should throw an error if the user is not logged in', async () => {
        session().state = {
          isLoggedIn: false,
        };
        const mockError = new CommandError(`You are currently not logged in. Please run storyblok login to authenticate, or storyblok signup to sign up.`);
        await languagesCommand.parseAsync(['node', 'test', 'pull', '--space', '12345']);
        expect(konsola.error).toHaveBeenCalledWith(mockError.message, null, {
          header: true,
        });
      });

      it('should throw an error if the space is not provided', async () => {
        session().state = {
          isLoggedIn: true,
          password: 'valid-token',
          region: 'eu',
        };

        const mockError = new CommandError(`Please provide the space as argument --space YOUR_SPACE_ID.`);
        try {
          await languagesCommand.parseAsync(['node', 'test', 'pull']);
        }
        catch (error) {
          console.log('TEST languages', error);
        }
        expect(konsola.error).toHaveBeenCalledWith(mockError.message, null, {
          header: true,
        });
      });

      it('should prompt a warning the user if no languages are found', async () => {
        const mockResponse = {
          default_lang_name: 'en',
          languages: [],
        };
        session().state = {
          isLoggedIn: true,
          password: 'valid-token',
          region: 'eu',
        };

        vi.mocked(fetchLanguages).mockResolvedValue(mockResponse);

        await languagesCommand.parseAsync(['node', 'test', 'pull', '--space', '24568']);
        expect(konsola.warn).toHaveBeenCalledWith(`No languages found in the space 24568`, true);
      });
    });

    describe('--path option', () => {
      it('should save the file at the provided path', async () => {
        const mockResponse = {
          default_lang_name: 'en',
          languages: [
            {
              code: 'ca',
              name: 'Catalan',
            },
            {
              code: 'fr',
              name: 'French',
            },
          ],
        };
        session().state = {
          isLoggedIn: true,
          password: 'valid-token',
          region: 'eu',
        };

        vi.mocked(fetchLanguages).mockResolvedValue(mockResponse);
        await languagesCommand.parseAsync(['node', 'test', 'pull', '--space', '12345', '--path', '/tmp']);
        expect(fetchLanguages).toHaveBeenCalledWith('12345', 'valid-token', 'eu');
        expect(saveLanguagesToFile).toHaveBeenCalledWith('12345', mockResponse, {
          path: '/tmp',
        });
        expect(konsola.ok).toHaveBeenCalledWith(`Languages schema downloaded successfully at ${chalk.hex(colorPalette.PRIMARY)(`/tmp/languages.json`)}`, true);
      });
    });

    describe('--filename option', () => {
      it('should save the file with the provided filename', async () => {
        const mockResponse = {
          default_lang_name: 'en',
          languages: [
            {
              code: 'ca',
              name: 'Catalan',
            },
            {
              code: 'fr',
              name: 'French',
            },
          ],
        };
        session().state = {
          isLoggedIn: true,
          password: 'valid-token',
          region: 'eu',
        };

        vi.mocked(fetchLanguages).mockResolvedValue(mockResponse);
        await languagesCommand.parseAsync(['node', 'test', 'pull', '--space', '12345', '--filename', 'custom-languages']);
        expect(fetchLanguages).toHaveBeenCalledWith('12345', 'valid-token', 'eu');
        expect(saveLanguagesToFile).toHaveBeenCalledWith('12345', mockResponse, {
          filename: 'custom-languages',
          path: undefined,
        });
        expect(konsola.ok).toHaveBeenCalledWith(`Languages schema downloaded successfully at ${chalk.hex(colorPalette.PRIMARY)(`.storyblok/languages/12345/custom-languages.json`)}`, true);
      });
    });

    describe('--suffix option', () => {
      it('should save the file with the provided suffix', async () => {
        const mockResponse = {
          default_lang_name: 'en',
          languages: [
            {
              code: 'ca',
              name: 'Catalan',
            },
            {
              code: 'fr',
              name: 'French',
            },
          ],
        };
        session().state = {
          isLoggedIn: true,
          password: 'valid-token',
          region: 'eu',
        };

        vi.mocked(fetchLanguages).mockResolvedValue(mockResponse);
        await languagesCommand.parseAsync(['node', 'test', 'pull', '--space', '12345', '--suffix', 'custom-suffix']);
        expect(fetchLanguages).toHaveBeenCalledWith('12345', 'valid-token', 'eu');
        expect(saveLanguagesToFile).toHaveBeenCalledWith('12345', mockResponse, {
          suffix: 'custom-suffix',
          path: undefined,
        });
        expect(konsola.ok).toHaveBeenCalledWith(`Languages schema downloaded successfully at ${chalk.hex(colorPalette.PRIMARY)(`.storyblok/languages/12345/languages.custom-suffix.json`)}`, true);
      });
    });
  });
});
