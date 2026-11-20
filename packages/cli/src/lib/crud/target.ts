import { CrudError } from "./errors";
import type { Noun, ResourceRecord } from "./types";

const ALL_DIGITS = /^\d+$/;

/** The ID an all-digit target names, if it names one; it may still be a name. */
export function targetId(target: string): number | undefined {
  return ALL_DIGITS.test(target) ? Number(target) : undefined;
}

/**
 * Several records share a name: an error listing their IDs, never a guess.
 * The API keeps names unique, but records from before it did, or from a race,
 * can share one.
 */
export function ambiguousName(
  matches: readonly ResourceRecord[],
  { nameField, noun }: { nameField: string; noun: Noun },
): CrudError {
  const ids = matches.map((record) => record.id).join(", ");
  return new CrudError(
    `${matches.length} ${noun.plural} share the ${nameField}. Target one by ID: ${ids}.`,
  );
}

/**
 * The record a `<target>` argument names: an all-digit target is an ID first,
 * anything else (or an ID that matches nothing) a name. `undefined` when the
 * space has none; several records sharing the name is an error.
 */
export function findByTarget<T extends ResourceRecord>(
  target: string,
  records: readonly T[],
  { nameField, noun }: { nameField?: string; noun: Noun },
): T | undefined {
  const id = targetId(target);
  const byId = id === undefined ? undefined : records.find((record) => record.id === id);
  if (byId || !nameField) {
    return byId;
  }
  const byName = records.filter((record) => record[nameField] === target);
  if (byName.length > 1) {
    throw ambiguousName(byName, { nameField, noun });
  }
  return byName[0];
}

/**
 * Like {@link findByTarget}, failing when the space has no such record.
 * Errors never repeat the target: it may be a misplaced secret.
 */
export function resolveTarget<T extends ResourceRecord>(
  target: string,
  records: readonly T[],
  resource: { nameField?: string; noun: Noun },
): T {
  const record = findByTarget(target, records, resource);
  if (record) {
    return record;
  }
  throw targetNotFound(resource);
}

export function targetNotFound({ nameField, noun }: { nameField?: string; noun: Noun }): CrudError {
  return new CrudError(
    nameField
      ? `No ${noun.singular} matches the given ID or ${nameField}.`
      : `No ${noun.singular} matches the given ID.`,
  );
}
