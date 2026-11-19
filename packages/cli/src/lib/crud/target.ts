import { CrudError } from "./errors";
import type { Noun, ResourceRecord } from "./types";

const ALL_DIGITS = /^\d+$/;

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
 * Finds the record a `<target>` argument names: an all-digit target is an ID
 * first, anything else (or an ID that matches nothing) a name. Errors never
 * repeat the target: a value misplaced on the command line can be a secret.
 */
export function resolveTarget<T extends ResourceRecord>(
  target: string,
  records: readonly T[],
  { nameField, noun }: { nameField?: string; noun: Noun },
): T {
  if (ALL_DIGITS.test(target)) {
    const byId = records.find((record) => record.id === Number(target));
    if (byId) {
      return byId;
    }
  }
  if (!nameField) {
    throw new CrudError(`No ${noun.singular} matches the given ID.`);
  }
  const byName = records.filter((record) => record[nameField] === target);
  if (byName.length === 0) {
    throw new CrudError(`No ${noun.singular} matches the given ID or ${nameField}.`);
  }
  if (byName.length > 1) {
    throw ambiguousName(byName, { nameField, noun });
  }
  return byName[0];
}
