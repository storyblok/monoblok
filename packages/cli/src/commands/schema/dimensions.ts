import type { EntityDiff } from "./types";
import { isRecord } from "./utils";

/** The two values a datasource dimension is declared by. */
export type DimensionIdentity = { name: string; entry_value: string };

const IDENTITY_KEYS = ["entry_value", "name"] as const;

export function isDimensionIdentity(value: unknown): value is DimensionIdentity {
  return isRecord(value) && typeof value.name === "string" && typeof value.entry_value === "string";
}

/** The declarable dimensions of a `dimensions` value, in entry_value order. */
export function toDimensionList(value: unknown): DimensionIdentity[] {
  const dimensions = Array.isArray(value) ? value.filter(isDimensionIdentity) : [];
  return dimensions.sort(
    (a, b) => compareStrings(a.entry_value, b.entry_value) || compareStrings(a.name, b.name),
  );
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

type DimensionPairing<Local, Remote> = {
  pairs: Map<Local, Remote>;
  unmatchedRemote: Remote[];
};

/**
 * A matched dimension keeps its remote id, and with it the values editors
 * entered for that dimension. `entry_value` takes precedence over `name`
 * because the Content Delivery API `dimension` parameter filters by it.
 */
export function pairDimensions<Local extends DimensionIdentity, Remote extends DimensionIdentity>(
  local: readonly Local[],
  remote: readonly Remote[],
): DimensionPairing<Local, Remote> {
  const pairs = new Map<Local, Remote>();
  const unmatchedRemote = [...remote];

  for (const key of IDENTITY_KEYS) {
    for (const localDimension of local) {
      if (pairs.has(localDimension)) {
        continue;
      }
      const index = unmatchedRemote.findIndex((rd) => rd[key] === localDimension[key]);
      if (index !== -1) {
        pairs.set(localDimension, unmatchedRemote[index]);
        unmatchedRemote.splice(index, 1);
      }
    }
  }

  return { pairs, unmatchedRemote };
}

type DimensionConflict = {
  declared: DimensionIdentity;
  key: (typeof IDENTITY_KEYS)[number];
  /** The remote dimension that holds the declared value. */
  holder: DimensionIdentity;
};

/**
 * The Management API checks each dimension's `name` and `entry_value` against
 * the stored dimensions before it applies any other change of the same update.
 * A value another dimension still holds is therefore rejected, even when that
 * dimension is renamed or removed in the same update.
 */
function findDimensionConflicts(
  local: readonly DimensionIdentity[],
  remote: readonly DimensionIdentity[],
): DimensionConflict[] {
  const { pairs } = pairDimensions(local, remote);
  const conflicts: DimensionConflict[] = [];

  for (const declared of local) {
    const own = pairs.get(declared);
    for (const key of IDENTITY_KEYS) {
      const holder = remote.find((rd) => rd !== own && rd[key] === declared[key]);
      if (holder && own?.[key] !== declared[key]) {
        conflicts.push({ declared, key, holder });
      }
    }
  }

  return conflicts;
}

function describeDimension({ name, entry_value }: DimensionIdentity): string {
  return `'${name}' (entry_value '${entry_value}')`;
}

function formatDimensionConflicts(
  datasourceName: string,
  conflicts: readonly DimensionConflict[],
): string {
  const details = conflicts
    .map(
      ({ declared, key, holder }) =>
        `dimension ${describeDimension(declared)} uses the ${key} '${declared[key]}' ` +
        `still held by the existing dimension ${describeDimension(holder)}`,
    )
    .join("; ");
  return (
    `Datasource '${datasourceName}' cannot be updated in one step: ${details}. ` +
    `The Management API rejects a name or entry_value that another dimension holds before the update. ` +
    `Apply the change in two steps: first rename or remove the existing dimension, then make this change.`
  );
}

/** Dimensions an update removes, and with them the values entered for them. */
export function removedDimensionNames(diff: EntityDiff): string[] {
  const { unmatchedRemote } = pairDimensions(
    toDimensionList(diff.after?.dimensions),
    toDimensionList(diff.before?.dimensions),
  );
  return unmatchedRemote.map((dimension) => dimension.name);
}

/** Why the Management API would reject a datasource update, or `null` when it would not. */
export function describeDimensionConflicts(
  datasourceName: string,
  local: unknown,
  remote: unknown,
): string | null {
  const conflicts = findDimensionConflicts(toDimensionList(local), toDimensionList(remote));
  return conflicts.length > 0 ? formatDimensionConflicts(datasourceName, conflicts) : null;
}
