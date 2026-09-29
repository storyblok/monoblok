import type { CacheProvider } from "./cache";

/** Version state for published-content invalidation. See ADR-0018. */
export interface VersionWatermarks {
  /**
   * Highest `cv` seen in a response body. `undefined` means unknown or invalidated, so
   * requests go out without a `cv` and the origin redirects them to the current one.
   */
  knownCv?: number;
  /** Highest `space.version` seen from `/cdn/spaces/me`. Never sent as a `cv`. */
  knownSpaceVersion?: number;
  /**
   * Highest `cv` ever seen. Survives invalidation, which resets `knownCv`, so stale edge
   * reads are still recognized right after it.
   */
  highestCv?: number;
  /** Bumped by `flushCache()` so responses in flight across it are discarded. */
  generation?: number;
}

/**
 * The watermarks live in the provider, not on the client, so every client and process
 * sharing the provider shares them.
 */
export const versionsKey = (tokenId: string) => `sb:versions:v1:${tokenId}`;

/**
 * Matches the edge's maximum content lifetime. The record is only rewritten when a version
 * moves, so without publishes it expires and every tagged entry is refetched once.
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
 * Merges observed versions monotonically: a lower value is a stale edge read and never
 * moves a watermark backwards. `highestCv` is derived from every `cv` the record has held.
 */
export const mergeVersions = (
  current: VersionWatermarks | undefined,
  incoming: VersionWatermarks,
): VersionWatermarks => ({
  knownCv: advance(current?.knownCv, incoming.knownCv),
  knownSpaceVersion: advance(current?.knownSpaceVersion, incoming.knownSpaceVersion),
  highestCv: advance(advance(current?.highestCv, current?.knownCv), incoming.knownCv),
  generation: advance(current?.generation, incoming.generation),
});

export const haveVersionsChanged = (
  current: VersionWatermarks | undefined,
  next: VersionWatermarks,
) =>
  current === undefined ||
  current.knownCv !== next.knownCv ||
  current.knownSpaceVersion !== next.knownSpaceVersion ||
  current.highestCv !== next.highestCv ||
  current.generation !== next.generation;

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
