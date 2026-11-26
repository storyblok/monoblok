import type { CacheProvider } from "./cache";

/**
 * How long the known `cv` is sent before a published read goes out without it, so the origin
 * redirects it to the current one. The edge serves a held `cv` for up to a week, so without
 * this check a publish stays invisible until a poll, a draft read, or `flushCache()`.
 * See ADR-0035.
 */
export const CV_REFRESH_WINDOW_MS = 60_000;

/**
 * When the known `cv` was last learned or checked, kept apart from the version watermarks so
 * a claim never rewrites them. It expires with the window, so a missing entry reads as due.
 */
export const cvCheckedKey = (tokenId: string) => `sb:cv-checked:v1:${tokenId}`;

/**
 * A time more than a window ahead comes from a clock running ahead, which must not suppress
 * checks. A slightly earlier clock than the one that wrote it still sees the window as running.
 */
export const isCvCheckDue = (checkedAt: number | undefined, now: number) =>
  checkedAt === undefined ||
  checkedAt - now > CV_REFRESH_WINDOW_MS ||
  now - checkedAt >= CV_REFRESH_WINDOW_MS;

/**
 * Checks claimed in this process, per provider and token. The shared entry alone can't stop
 * concurrent requests from all claiming the check: each reads it before any writes it.
 */
const claimedChecks = new WeakMap<CacheProvider, Map<string, number>>();

/**
 * Claims the check of the known `cv` when its window has elapsed. Only the first caller per
 * window gets a claim; releasing it lets the next read claim it instead.
 */
export const claimCvCheck = (
  provider: CacheProvider,
  key: string,
  sharedCheckedAt: number | undefined,
  now: number,
): { claimedAt: number; release: () => void } | undefined => {
  let claims = claimedChecks.get(provider);
  if (!claims) {
    claims = new Map();
    claimedChecks.set(provider, claims);
  }
  const localCheckedAt = claims.get(key);
  if (!isCvCheckDue(sharedCheckedAt, now) || !isCvCheckDue(localCheckedAt, now)) {
    return undefined;
  }
  claims.set(key, now);
  return {
    claimedAt: now,
    release: () => {
      if (claims.get(key) === now) {
        claims.delete(key);
      }
    },
  };
};
