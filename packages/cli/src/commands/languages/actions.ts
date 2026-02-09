import { join } from 'node:path';
import { handleAPIError, handleFileSystemError } from '../../utils';
import { resolvePath, saveToFile } from '../../utils/filesystem';
import type { PullLanguagesOptions } from './constants';
import { DEFAULT_LANGUAGES_FILENAME } from './constants';
import type { SpaceInternationalization } from '../../types';
import { fetchSpace } from '../spaces';

export const fetchLanguages = async (spaceId: string): Promise<SpaceInternationalization | undefined> => {
  try {
    const space = await fetchSpace(spaceId);
    if (space?.default_lang_name !== undefined && space?.languages?.length) {
      return {
        default_lang_name: space?.default_lang_name,
        languages: space?.languages,
      };
    }
  }
  catch (error) {
    handleAPIError('pull_languages', error);
  }
};

export const saveLanguagesToFile = async (space: string, internationalizationOptions: SpaceInternationalization, options: PullLanguagesOptions) => {
  try {
    const { filename = DEFAULT_LANGUAGES_FILENAME, suffix, path } = options;
    const data = JSON.stringify(internationalizationOptions, null, 2);
    const name = suffix ? `${filename}.${suffix}.json` : `${filename}.json`;
    const resolvedPath = resolvePath(path, `languages/${space}/`);
    const filePath = join(resolvedPath, name);

    await saveToFile(filePath, data);
  }
  catch (error) {
    handleFileSystemError('write', error as Error);
  }
};
