import { join } from "pathe";
import { FileSystemError } from "./utils";
import { readCredentialsFile, updateCredentialsFile } from "./credentials-file";
import { getStoryblokGlobalPath } from "./utils/filesystem";
import type { StoryblokCredentials } from "./types";

/**
 * Reads the credentials file: one entry per machine name. OAuth sessions live in their own
 * file (see `oauthPath`). Returns null when nothing is stored yet.
 */
export const getCredentials = async (
  filePath = join(getStoryblokGlobalPath(), "credentials.json"),
): Promise<Record<string, StoryblokCredentials> | null> => {
  const credentials = await readCredentialsFile<Record<string, StoryblokCredentials>>(filePath);
  return Object.keys(credentials).length === 0 ? null : credentials;
};

export const addCredentials = async ({
  filePath = join(getStoryblokGlobalPath(), "credentials.json"),
  machineName,
  login,
  password,
  region,
}: Record<string, string>) => {
  try {
    await updateCredentialsFile(
      (credentials) => ({
        ...credentials,
        [machineName]: { login, password, region },
      }),
      filePath,
    );
  } catch (error) {
    throw new FileSystemError(
      "invalid_argument",
      "write",
      error as NodeJS.ErrnoException,
      `Error adding/updating entry for machine ${machineName} in credentials.json file`,
    );
  }
};

// Clears the PAT machine entries. OAuth sessions live in their own file, so logging out of
// a PAT session no longer has to preserve anything here.
export const removeAllCredentials = async (filepath: string = getStoryblokGlobalPath()) => {
  await updateCredentialsFile(() => ({}), join(filepath, "credentials.json"));
};
