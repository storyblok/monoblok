import { mkdir, rmdir, stat, utimes } from "node:fs/promises";
import { join, parse } from "pathe";
import { CommandError } from "./utils";
import { getStoryblokGlobalPath, readFile, writeFileAtomic } from "./utils/filesystem";

// `credentials.json` holds the PAT entries and the OAuth sessions of every region, and
// every mutation rewrites it whole. Concurrent CLI processes must therefore serialize:
// an interleaved write would drop the other's entry, and dropping a rotated refresh
// token logs the user out for good, because the previous one is already revoked.
const LOCK_STALE_MS = 30_000;
const LOCK_TOUCH_INTERVAL_MS = LOCK_STALE_MS / 3;
const LOCK_RETRY_INTERVAL_MS = 50;
// Comfortably longer than a token request, so a slow refresh in another process makes
// this one wait rather than fail.
const LOCK_ACQUIRE_TIMEOUT_MS = 90_000;

export const credentialsPath = (): string => join(getStoryblokGlobalPath(), "credentials.json");

const lockPath = (filePath: string): string => `${filePath}.lock`;

const isStale = async (path: string): Promise<boolean> => {
  try {
    const { mtimeMs } = await stat(path);
    return Date.now() - mtimeMs > LOCK_STALE_MS;
  } catch {
    // Gone already; treat it as free rather than stale.
    return false;
  }
};

const acquireLock = async (filePath: string): Promise<() => Promise<void>> => {
  const path = lockPath(filePath);
  await mkdir(parse(filePath).dir, { recursive: true });

  const deadline = Date.now() + LOCK_ACQUIRE_TIMEOUT_MS;
  for (;;) {
    try {
      // `mkdir` is atomic on every supported platform: whoever creates the directory
      // holds the lock.
      await mkdir(path);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
      // A process killed mid-write leaves the lock behind; its mtime stops being
      // refreshed, which is what makes it collectable.
      if (await isStale(path)) {
        await rmdir(path).catch(() => {});
        continue;
      }
      if (Date.now() > deadline) {
        throw new CommandError(
          "Timed out waiting for another Storyblok CLI process to finish updating credentials.json.",
        );
      }
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_INTERVAL_MS));
    }
  }

  // Keep the lock fresh while it is held, so a long operation is never mistaken for a
  // crashed one.
  const touch = setInterval(() => {
    const now = new Date();
    void utimes(path, now, now).catch(() => {});
  }, LOCK_TOUCH_INTERVAL_MS);
  touch.unref?.();

  return async () => {
    clearInterval(touch);
    await rmdir(path).catch(() => {});
  };
};

export type CredentialsFile = Record<string, unknown>;

/**
 * Reads the credentials file. Returns an empty object when it does not exist yet or
 * cannot be parsed, so a corrupt file never crashes an unrelated command.
 */
export const readCredentialsFile = async <T extends CredentialsFile = CredentialsFile>(
  filePath: string = credentialsPath(),
): Promise<T> => {
  try {
    return JSON.parse(await readFile(filePath));
  } catch {
    return {} as T;
  }
};

/**
 * Runs `mutate` while holding the credentials-file lock. Use it to span a read and its
 * write across an operation another process must not interleave with, such as
 * exchanging a single-use refresh token.
 */
export const withCredentialsLock = async <T>(
  mutate: () => Promise<T>,
  filePath: string = credentialsPath(),
): Promise<T> => {
  const release = await acquireLock(filePath);
  try {
    return await mutate();
  } finally {
    await release();
  }
};

/**
 * Read-modify-write of the credentials file under the lock, replacing it atomically.
 */
export const updateCredentialsFile = async (
  mutate: (credentials: CredentialsFile) => CredentialsFile,
  filePath: string = credentialsPath(),
): Promise<void> =>
  withCredentialsLock(async () => {
    await writeCredentialsFile(mutate(await readCredentialsFile(filePath)), filePath);
  }, filePath);

// Only safe while the lock is held; callers outside this module use
// `updateCredentialsFile`.
export const writeCredentialsFile = async (
  credentials: CredentialsFile,
  filePath: string = credentialsPath(),
): Promise<void> => {
  await writeFileAtomic(filePath, JSON.stringify(credentials, null, 2), { mode: 0o600 });
};
