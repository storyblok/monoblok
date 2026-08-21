import type { CacheProvider } from "./cache";

/**
 * The two watermarks that drive cache invalidation for published content.
 *
 * Published content is an immutable snapshot addressed by its `cv`, so an entry is valid
 * exactly as long as the `cv` it was served under is still the one the client knows.
 *
 * - `knownCv` — the highest `cv` seen in a response body. `undefined` means "unknown or
 *   invalidated": requests then go out without a `cv` and the origin redirects them to
 *   the current one. There is deliberately no numeric sentinel, so `cv=0` can never
 *   reach the wire.
 * - `knownSpaceVersion` — the highest `space.version` seen from `/cdn/spaces/me`. A
 *   change signal only; never sent as a `cv` (a Minimum Cache TTL floors the `cv` into
 *   TTL-sized buckets while `space.version` keeps reporting the raw version).
 */
export interface VersionWatermarks {
  knownCv?: number;
  knownSpaceVersion?: number;
}

/**
 * The reserved cache key holding the watermarks for one access token.
 *
 * They live in the cache provider rather than on the client instance so that they share
 * fate with the entries they govern: every client and every process sharing a provider
 * shares the watermarks, which is what makes the publish signal work for per-request
 * clients talking to an external provider.
 */
export const versionsKey = (accessToken: string) => `sb:versions:v1:${accessToken}`;

/**
 * How long a watermark record is kept. Matches the edge's maximum content lifetime: an
 * expired record only costs one `cv`-less request that re-learns the current version.
 */
export const VERSIONS_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

const advance = (current: number | undefined, incoming: number | undefined) => {
  if (incoming === undefined) {
    return current;
  }
  if (current === undefined) {
    return incoming;
  }
  return Math.max(current, incoming);
};

/**
 * Merges freshly observed versions into the known ones, monotonically.
 *
 * A lower value is always evidence of a stale read — a `cv` from an edge node still
 * holding an older snapshot, or a `space.version` from a POP whose two-second cache has
 * not caught up — and never moves a watermark backwards.
 */
export const mergeVersions = (
  current: VersionWatermarks | undefined,
  incoming: VersionWatermarks,
): VersionWatermarks => ({
  knownCv: advance(current?.knownCv, incoming.knownCv),
  knownSpaceVersion: advance(current?.knownSpaceVersion, incoming.knownSpaceVersion),
});

export const haveVersionsChanged = (
  current: VersionWatermarks | undefined,
  next: VersionWatermarks,
) =>
  current === undefined ||
  current.knownCv !== next.knownCv ||
  current.knownSpaceVersion !== next.knownSpaceVersion;

export const readVersions = async (
  provider: CacheProvider,
  key: string,
): Promise<VersionWatermarks | undefined> => {
  const entry = await provider.get<VersionWatermarks>(key);
  return entry?.value;
};

export const writeVersions = async (
  provider: CacheProvider,
  key: string,
  versions: VersionWatermarks,
): Promise<void> => {
  await provider.set(key, { value: versions, ttlMs: VERSIONS_TTL_MS });
};
