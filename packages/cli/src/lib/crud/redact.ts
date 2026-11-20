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
 * A payload flag value as commander stores it: its string form is what the
 * command reads, `toJSON` what the log and report files get. Only values of
 * `visibleFields` are logged, so a secret under a mistyped field name stays
 * out too. Data only, no closures: config resolution `structuredClone`s every
 * option.
 */
export class RedactedOption {
  constructor(
    readonly raw: string,
    readonly kind: "set" | "data" | "field",
    readonly visibleFields: readonly string[],
  ) {}

  toJSON(): unknown {
    switch (this.kind) {
      case "set":
        return redactAssignment(this.raw, this.visibleFields);
      case "data":
        return redactJson(this.raw, this.visibleFields);
      case "field":
        return this.visibleFields.includes(this.raw) ? this.raw : REDACTED;
    }
  }

  toString(): string {
    return this.raw;
  }
}

function redactAssignment(raw: string, visibleFields: readonly string[]): string {
  const separator = raw.indexOf("=");
  if (separator <= 0) {
    return REDACTED;
  }
  const field = raw.slice(0, separator);
  return visibleFields.includes(field) ? raw : `${field}=${REDACTED}`;
}

function redactJson(raw: string, visibleFields: readonly string[]): unknown {
  try {
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data)) {
      return REDACTED;
    }
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        visibleFields.includes(key) ? value : REDACTED,
      ]),
    );
  } catch {
    return REDACTED;
  }
}

/** A `--set` value, logged only for a known field that is not secret. */
export function redactedSet(raw: string, visibleFields: readonly string[]): RedactedOption {
  return new RedactedOption(raw, "set", visibleFields);
}

/** A `--data` value, logged with every field redacted that is unknown or secret. */
export function redactedData(raw: string, visibleFields: readonly string[]): RedactedOption {
  return new RedactedOption(raw, "data", visibleFields);
}

/** A `--unset` value, logged only when it is one of `fields`: anything else may be a value. */
export function redactedField(raw: string, fields: readonly string[]): RedactedOption {
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
