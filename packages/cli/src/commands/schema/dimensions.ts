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
 * entered for that dimension. An identical dimension is matched first, so the
 * result does not depend on order when the space holds duplicates. After that,
 * `entry_value` takes precedence over `name` because the Content Delivery API
 * `dimension` parameter filters by it.
 */
export function pairDimensions<Local extends DimensionIdentity, Remote extends DimensionIdentity>(
  local: readonly Local[],
  remote: readonly Remote[],
): DimensionPairing<Local, Remote> {
  const pairs = new Map<Local, Remote>();
  const unmatchedRemote = [...remote];

  const matchers: ((rd: Remote, ld: Local) => boolean)[] = [
    (rd, ld) => isUnchanged(ld, rd),
    ...IDENTITY_KEYS.map((key) => (rd: Remote, ld: Local) => rd[key] === ld[key]),
  ];
  for (const matches of matchers) {
    for (const localDimension of local) {
      if (pairs.has(localDimension)) {
        continue;
      }
      const index = unmatchedRemote.findIndex((rd) => matches(rd, localDimension));
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

function isUnchanged(declared: DimensionIdentity, own: DimensionIdentity | undefined): boolean {
  return own?.name === declared.name && own.entry_value === declared.entry_value;
}

/**
 * The Management API checks both the `name` and the `entry_value` of every
 * dimension an update creates or changes against the stored dimensions, before
 * it applies any other change of the same update. A value another dimension
 * still holds is therefore rejected, even when that dimension is renamed or
 * removed in the same update, and even when the changed dimension keeps that
 * value.
 */
function findDimensionConflicts(
  local: readonly DimensionIdentity[],
  remote: readonly DimensionIdentity[],
): DimensionConflict[] {
  const { pairs } = pairDimensions(local, remote);
  const conflicts: DimensionConflict[] = [];

  for (const declared of local) {
    const own = pairs.get(declared);
    if (isUnchanged(declared, own)) {
      continue;
    }
    for (const key of IDENTITY_KEYS) {
      const holder = remote.find((rd) => rd !== own && rd[key] === declared[key]);
      if (holder) {
        conflicts.push({ declared, key, holder });
      }
    }
  }

  return conflicts;
}

type DimensionDuplicate = { key: (typeof IDENTITY_KEYS)[number]; value: string };

/**
 * The Management API does not check the dimensions of one request against each
 * other, so dimensions that share a value and are created or changed together
 * are stored as they are. Duplicates the space already holds, and that the
 * update leaves untouched, are not reported.
 */
function findDuplicateDimensions(
  local: readonly DimensionIdentity[],
  remote: readonly DimensionIdentity[],
): DimensionDuplicate[] {
  const { pairs } = pairDimensions(local, remote);
  const duplicates = new Map<string, DimensionDuplicate>();

  for (const declared of local) {
    if (isUnchanged(declared, pairs.get(declared))) {
      continue;
    }
    for (const key of IDENTITY_KEYS) {
      const value = declared[key];
      if (local.some((other) => other !== declared && other[key] === value)) {
        duplicates.set(`${key}:${value}`, { key, value });
      }
    }
  }

  return [...duplicates.values()];
}

function formatDuplicateDimensions(
  datasourceName: string,
  duplicates: readonly DimensionDuplicate[],
): string {
  const details = duplicates.map(({ key, value }) => `the ${key} '${value}'`).join(", ");
  return (
    `Datasource '${datasourceName}' declares more than one dimension with ${details}. ` +
    `Give each dimension a unique name and entry_value.`
  );
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
    `Apply the change in two steps: first change that value on the existing dimension or remove it, then make this change.`
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

/**
 * Duplicates a datasource create or update would store, or `null` when there
 * are none. Pass no `remote` for a create.
 */
export function describeDuplicateDimensions(
  datasourceName: string,
  local: unknown,
  remote?: unknown,
): string | null {
  const duplicates = findDuplicateDimensions(toDimensionList(local), toDimensionList(remote));
  return duplicates.length > 0 ? formatDuplicateDimensions(datasourceName, duplicates) : null;
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
