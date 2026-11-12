/**
 * Content in a release is stored apart from the story and the story endpoints
 * never show it, so a migration cannot reach it. Deploying the release then
 * replaces the story's draft wholesale, discarding the migration silently. A run
 * is refused while any release is pending unless the caller opts in.
 */

/** The fields of a Management API release the check reads. */
export type ReleaseForMigration = {
  id: number;
  name: string;
  released: boolean;
};

export type PendingReleasesCheck<TRelease extends ReleaseForMigration> = {
  proceed: boolean;
  /** Releases the run cannot see into; when proceeding anyway, what it will miss. */
  pending: TRelease[];
};

export function checkPendingReleases<TRelease extends ReleaseForMigration>(
  releases: readonly TRelease[],
  options: { allowPendingReleases?: boolean } = {},
): PendingReleasesCheck<TRelease> {
  const pending = releases.filter((release) => !release.released);
  return { proceed: pending.length === 0 || options.allowPendingReleases === true, pending };
}
