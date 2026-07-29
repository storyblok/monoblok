import { access } from 'node:fs/promises';
import { join } from 'pathe';
import { FileSystemError, handleFileSystemError } from './utils';
import { getStoryblokGlobalPath, readFile, saveToFile } from './utils/filesystem';
import type { StoryblokCredentials } from './types';

export const getCredentials = async (filePath = join(getStoryblokGlobalPath(), 'credentials.json')): Promise<StoryblokCredentials | null> => {
  try {
    await access(filePath);
    const content = await readFile(filePath);
    const parsedContent = JSON.parse(content);

    // Return null if the parsed content is an empty object
    if (Object.keys(parsedContent).length === 0) {
      return null;
    }

    return parsedContent;
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist, create it with empty credentials
      await saveToFile(filePath, JSON.stringify({}, null, 2), { mode: 0o600 });
      return null;
    }
    handleFileSystemError('read', error as NodeJS.ErrnoException);
    return null;
  }
};

export const addCredentials = async ({
  filePath = join(getStoryblokGlobalPath(), 'credentials.json'),
  machineName,
  login,
  password,
  region,
}: Record<string, string>) => {
  const credentials = {
    ...await getCredentials(filePath),
    [machineName]: {
      login,
      password,
      region,
    },
  };

  try {
    await saveToFile(filePath, JSON.stringify(credentials, null, 2), { mode: 0o600 });
  }
  catch (error) {
    throw new FileSystemError('invalid_argument', 'write', error as NodeJS.ErrnoException, `Error adding/updating entry for machine ${machineName} in credentials.json file`);
  }
};

export const removeAllCredentials = async (filepath: string = getStoryblokGlobalPath()) => {
  const filePath = join(filepath, 'credentials.json');
  await saveToFile(filePath, JSON.stringify({}, null, 2), { mode: 0o600 });
};

// Removes the PAT machine entries while preserving the `oauth` section (provisioned
// client credentials and any OAuth sessions). Logging out of a PAT session must not
// wipe the OAuth client provisioned via `oauth setup`.
export const removePatCredentials = async (filepath: string = getStoryblokGlobalPath()) => {
  const filePath = join(filepath, 'credentials.json');
  const credentials = await getCredentials(filePath) as Record<string, unknown> | null;
  const oauth = credentials?.oauth;
  const remaining = oauth ? { oauth } : {};
  await saveToFile(filePath, JSON.stringify(remaining, null, 2), { mode: 0o600 });
};
