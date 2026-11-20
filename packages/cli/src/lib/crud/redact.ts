// Keeps secret field values, such as a webhook's signing secret, out of what a
// run prints and writes to disk. Every parsed option lands in the log context
// and the report meta, both serialized with `JSON.stringify`, before a
// command's action runs, so the payload flags are parsed into values whose
// `toJSON` redacts.

import { isRecord } from "../../utils/object";

export const REDACTED = "[redacted]";

/**
 * Shorter secrets are not scrubbed from error text: replacing every
 * occurrence of a one- or two-letter value garbles the message and gives the
 * value away through the gaps.
 */
const MIN_SCRUBBED_LENGTH = 8;

/**
 * The field names a payload flag is checked against. Only `known` names are
 * logged, as anything else may be a misplaced secret; only `visible` fields
 * have their values logged.
 */
export type FieldNames = {
  readonly known: readonly string[];
  readonly visible: readonly string[];
};

/**
 * A payload flag value as commander stores it: its string form is what the
 * command reads, `toJSON` what the log and report files get. Data only, no
 * closures: config resolution `structuredClone`s every option.
 */
export class RedactedOption {
  constructor(
    readonly raw: string,
    readonly kind: "set" | "data" | "field",
    readonly fields: FieldNames,
  ) {}

  toJSON(): unknown {
    switch (this.kind) {
      case "set":
        return redactAssignment(this.raw, this.fields);
      case "data":
        return redactJson(this.raw, this.fields);
      case "field":
        return this.fields.known.includes(this.raw) ? this.raw : REDACTED;
    }
  }

  toString(): string {
    return this.raw;
  }
}

function redactAssignment(raw: string, fields: FieldNames): string {
  const separator = raw.indexOf("=");
  const field = raw.slice(0, Math.max(separator, 0));
  if (!fields.known.includes(field)) {
    return REDACTED;
  }
  return fields.visible.includes(field) ? raw : `${field}=${REDACTED}`;
}

function redactJson(raw: string, fields: FieldNames): unknown {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return REDACTED;
  }
  if (!isRecord(data) || Object.keys(data).some((key) => !fields.known.includes(key))) {
    return REDACTED;
  }
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      fields.visible.includes(key) ? value : REDACTED,
    ]),
  );
}

/** A `--set` value, logged only for a known field that is not secret. */
export function redactedSet(raw: string, fields: FieldNames): RedactedOption {
  return new RedactedOption(raw, "set", fields);
}

/** A `--data` value, logged only when every key is a known field, with secret values redacted. */
export function redactedData(raw: string, fields: FieldNames): RedactedOption {
  return new RedactedOption(raw, "data", fields);
}

/** An `--unset` value, logged only when it is a known field. */
export function redactedField(raw: string, fields: FieldNames): RedactedOption {
  return new RedactedOption(raw, "field", fields);
}

/**
 * A record as it leaves the CLI: each secret field replaced by a read-only
 * `has_<field>` flag. The secret key is dropped rather than marked: `list`
 * output is valid input, and a marker such as `null` would clear the secret of
 * every record piped back to `update`. The flag is dropped on the way back
 * in, as any field the API does not accept.
 */
export function stripSecrets<T extends Record<string, unknown>>(
  record: T,
  secretFields: readonly (keyof T & string)[],
): T & Record<`has_${string}`, boolean> {
  const stripped = { ...record };
  const flags: Record<`has_${string}`, boolean> = {};
  for (const field of secretFields) {
    const value = record[field];
    flags[`has_${field}`] = typeof value === "string" && value !== "";
    delete stripped[field];
  }
  return Object.assign(stripped, flags);
}

/**
 * Remembers the secret values a run has seen, from input lines, flags and the
 * records it writes, and replaces them wherever they turn up in an error.
 */
export class SecretScrubber {
  private readonly values = new Set<string>();

  constructor(private readonly secretFields: readonly string[]) {}

  collect(record: Record<string, unknown> | undefined): void {
    for (const field of this.secretFields) {
      const value = record?.[field];
      if (typeof value === "string" && value.length >= MIN_SCRUBBED_LENGTH) {
        this.values.add(value);
      }
    }
  }

  scrubText(text: string): string {
    let scrubbed = text;
    for (const value of this.values) {
      scrubbed = scrubbed.split(value).join(REDACTED);
    }
    return scrubbed;
  }

  /** A deep copy of `value` with every seen secret replaced in its strings. */
  scrubValue<T>(value: T): T {
    return JSON.parse(JSON.stringify(value), (_key, item: unknown) =>
      typeof item === "string" ? this.scrubText(item) : item,
    );
  }
}
