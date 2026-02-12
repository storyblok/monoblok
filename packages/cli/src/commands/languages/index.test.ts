import chalk from 'chalk';
import { languagesCommand } from '.';
import { session } from '../../session';
import { CommandError, konsola } from '../../utils';
import { fetchLanguages, saveLanguagesToFile } from './actions';
import { colorPalette } from '../../constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loggedOutSessionState } from '../../../test/setup';
import { join, relative } from 'pathe';
import { resolveCommandPath } from '../../utils/filesystem';

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

vi.mock('../../utils/konsola');

const preconditions = {
  loggedOut() {
    vi.mocked(session().initializeSession).mockImplementation(async () => {
      session().state = loggedOutSessionState();
    });
  },
};

describe('languagesCommand', () => {
  describe('pull', () => {
    beforeEach(() => {
      vi.resetAllMocks();
      vi.clearAllMocks();
      // Reset the option values
      (languagesCommand as any)._optionValues = {};
      for (const command of languagesCommand.commands) {
        (command as any)._optionValues = {};
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

        vi.mocked(fetchLanguages).mockResolvedValue(mockResponse);
        await languagesCommand.parseAsync(['node', 'test', 'pull', '--space', '12345']);
        expect(fetchLanguages).toHaveBeenCalledWith('12345');
        expect(saveLanguagesToFile).toHaveBeenCalledWith('12345', mockResponse, expect.objectContaining({}));
        const expectedPath = relative(process.cwd(), join(resolveCommandPath('languages', '12345'), 'languages.12345.json'));
        expect(konsola.ok).toHaveBeenCalledWith(`Languages schema downloaded successfully at ${chalk.hex(colorPalette.PRIMARY)(expectedPath)}`, true);
      });

      it('should throw an error if the user is not logged in', async () => {
        preconditions.loggedOut();
        const mockError = new CommandError(`You are currently not logged in. Please run storyblok login to authenticate, or storyblok signup to sign up.`);
        await languagesCommand.parseAsync(['node', 'test', 'pull', '--space', '12345']);
        expect(konsola.error).toHaveBeenCalledWith(mockError.message, null, {
          header: true,
        });
      });

      it('should throw an error if the space is not provided', async () => {
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

        vi.mocked(fetchLanguages).mockResolvedValue(mockResponse);
        await languagesCommand.parseAsync(['node', 'test', 'pull', '--space', '12345', '--path', '/tmp']);
        expect(fetchLanguages).toHaveBeenCalledWith('12345');
        expect(saveLanguagesToFile).toHaveBeenCalledWith('12345', mockResponse, expect.objectContaining({
          path: '/tmp',
        }));
        const expectedPath = join(resolveCommandPath('languages', '12345', '/tmp'), 'languages.12345.json');
        expect(konsola.ok).toHaveBeenCalledWith(`Languages schema downloaded successfully at ${chalk.hex(colorPalette.PRIMARY)(expectedPath)}`, true);
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

        vi.mocked(fetchLanguages).mockResolvedValue(mockResponse);
        await languagesCommand.parseAsync(['node', 'test', 'pull', '--space', '12345', '--filename', 'custom-languages']);
        expect(fetchLanguages).toHaveBeenCalledWith('12345');
        expect(saveLanguagesToFile).toHaveBeenCalledWith('12345', mockResponse, expect.objectContaining({
          filename: 'custom-languages',
        }));
        const expectedPath = relative(process.cwd(), join(resolveCommandPath('languages', '12345'), 'custom-languages.12345.json'));
        expect(konsola.ok).toHaveBeenCalledWith(`Languages schema downloaded successfully at ${chalk.hex(colorPalette.PRIMARY)(expectedPath)}`, true);
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

        vi.mocked(fetchLanguages).mockResolvedValue(mockResponse);
        await languagesCommand.parseAsync(['node', 'test', 'pull', '--space', '12345', '--suffix', 'custom-suffix']);
        expect(fetchLanguages).toHaveBeenCalledWith('12345');
        expect(saveLanguagesToFile).toHaveBeenCalledWith('12345', mockResponse, expect.objectContaining({
          suffix: 'custom-suffix',
        }));
        const expectedPath = relative(process.cwd(), join(resolveCommandPath('languages', '12345'), 'languages.custom-suffix.json'));
        expect(konsola.ok).toHaveBeenCalledWith(`Languages schema downloaded successfully at ${chalk.hex(colorPalette.PRIMARY)(expectedPath)}`, true);
      });
    });
  });
});
