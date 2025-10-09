import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { FileSystemError, handleFileSystemError } from './utils';
import { getStoryblokGlobalPath, readFile, saveToFile } from './utils/filesystem';
import type { StoryblokCredentials } from './types';
import { type RegionCode, regionCodes } from './constants';

function isRegionCode(value: unknown): value is RegionCode {
  return regionCodes.includes(value as RegionCode);
}

function toRegionCode(value: unknown) {
  if (!value) {
    return undefined;
  }

  if (!isRegionCode(value)) {
    throw new Error(`Invalid region "${value}", allowed regions: ${regionCodes.join(', ')}`);
  }

  return value;
}

function getEnvCredentials(): Partial<StoryblokCredentials> {
  return {
    login: process.env.STORYBLOK_LOGIN || process.env.TRAVIS_STORYBLOK_LOGIN,
    password: process.env.STORYBLOK_TOKEN || process.env.TRAVIS_STORYBLOK_TOKEN,
    region: toRegionCode(process.env.STORYBLOK_REGION || process.env.TRAVIS_STORYBLOK_REGION),
    baseUrl: process.env.STORYBLOK_BASE_URL || process.env.TRAVIS_STORYBLOK_BASE_URL,
  };
}

const getConfigCredentials = async (filePath: string): Promise<Partial<StoryblokCredentials> | null> => {
  try {
    await access(filePath);
    const content = await readFile(filePath);
    const parsedContent = JSON.parse(content);

    // Return null if the parsed content is an empty object
    if (Object.keys(parsedContent).length === 0) {
      return null;
    }

    return Object.values(parsedContent)[0] as Partial<StoryblokCredentials>;
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

function isLoggedIn(credentials: Partial<StoryblokCredentials> | null) {
  return Boolean(credentials && credentials.login && credentials.password && credentials.region);
}

export function isEnvLogin() {
  return isLoggedIn(getEnvCredentials());
}

export const getCredentials = async (filePath = join(getStoryblokGlobalPath(), 'credentials.json')): Promise<StoryblokCredentials | null> => {
  const credentialsEnv = getEnvCredentials();
  const credentialsConfig = await getConfigCredentials(filePath);
  const credentials = {
    login: credentialsEnv.login || credentialsConfig?.login,
    password: credentialsEnv.password || credentialsConfig?.password,
    region: toRegionCode(credentialsEnv.region || credentialsConfig?.region),
    baseUrl: credentialsEnv.baseUrl || credentialsConfig?.baseUrl,
  };
  if (!credentials.login || !credentials.password || !isRegionCode(credentials.region)) {
    return null;
  }

  return credentials as StoryblokCredentials;
};

export const addCredentials = async ({
  filePath = join(getStoryblokGlobalPath(), 'credentials.json'),
  machineName,
  login,
  password,
  region,
}: Record<string, string>) => {
  const credentials = {
    ...await getConfigCredentials(filePath),
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
