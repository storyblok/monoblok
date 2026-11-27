import type { CacheProvider } from "./cache";

/**
 * How long the known `cv` is sent before a published read goes out without it, so the origin
 * redirects it to the current one. Without this check a publish stays invisible until a poll,
 * a draft read, or `flushCache()`. See ADR-0035.
 */
export const CV_REFRESH_WINDOW_MS = 60_000;

/**
 * When the known `cv` was last learned or checked, kept apart from the version watermarks so
 * a check never rewrites them. It expires with the window, so a missing entry reads as due.
 */
export const cvCheckedKey = (tokenId: string) => `sb:cv-checked:v1:${tokenId}`;

/**
 * Wall-clock milliseconds, comparable with the check times other processes write. Not
 * `Date.now()`: Next.js Cache Components rejects reading it before a request while prerendering.
 */
export const readCvClock = () => performance.timeOrigin + performance.now();

/**
 * A time more than a window ahead comes from a clock running ahead, which must not suppress
 * checks. A slightly earlier clock than the one that wrote it still sees the window as running.
 */
export const isCvCheckDue = (checkedAt: number | undefined, now: number) =>
  checkedAt === undefined ||
  checkedAt - now > CV_REFRESH_WINDOW_MS ||
  now - checkedAt >= CV_REFRESH_WINDOW_MS;

/**
 * The last check time this process knows, per provider and key. It answers most reads without
 * a provider round trip, and it keeps concurrent reads, which would all read the shared entry
 * before any writes it, from all claiming the check.
 */
const localCheckTimes = new WeakMap<CacheProvider, Map<string, number>>();

const localCheckTimesOf = (provider: CacheProvider) => {
  let times = localCheckTimes.get(provider);
  if (!times) {
    times = new Map();
    localCheckTimes.set(provider, times);
  }
  return times;
};

/** Records a check or a learned `cv` locally and in the provider, never failing the read. */
export const recordCvChecked = async (provider: CacheProvider, key: string, checkedAt: number) => {
  localCheckTimesOf(provider).set(key, checkedAt);
  await provider.set(key, { value: checkedAt, ttlMs: CV_REFRESH_WINDOW_MS }).catch(() => undefined);
};

/**
 * Claims the check of the known `cv` when its window has elapsed, by the local time first and
 * then by the provider's. Only the first caller per window gets a claim; releasing it lets the
 * next read claim it instead. The claimant records the check once its response arrived.
 */
export const claimCvCheck = async (
  provider: CacheProvider,
  key: string,
  now: number,
): Promise<{ claimedAt: number; release: () => void } | undefined> => {
  const times = localCheckTimesOf(provider);
  if (!isCvCheckDue(times.get(key), now)) {
    return undefined;
  }
  times.set(key, now);
  const release = () => {
    if (times.get(key) === now) {
      times.delete(key);
    }
  };

  const shared = await provider.get<number>(key).catch(() => undefined);
  if (!isCvCheckDue(shared?.value, now)) {
    release();
    if (shared?.value !== undefined && !times.has(key)) {
      times.set(key, shared.value);
    }
    return undefined;
  }
  return { claimedAt: now, release };
};
