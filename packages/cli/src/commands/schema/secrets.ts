import { createHash, randomBytes } from 'node:crypto';

import { isRecord } from './utils';

/**
 * Secret handling for the `schema` command. Sensitive plugin option values (e.g.
 * an integration `clientSecret`) must never be written to the versioned schema,
 * and must never be cleared on the space by a push that carries a redacted local
 * value.
 *
 * The mechanism is a placeholder produced by `@storyblok/schema`'s `secret()`
 * helper. It is a sentinel **string** (not an object) so it slots into a plugin
 * option's string `value`. This module owns the CLI side: introducing
 * placeholders on `init` (redaction), representing them in the diff, and
 * substituting the real value on `push` (hydration).
 *
 * Detection is structural (by the marker prefix), so a placeholder produced by
 * any installed version of `@storyblok/schema` is recognized — the value
 * reaching the CLI comes from the user's project, not from this package.
 */

/** Must match `SECRET_MARKER` exported by `@storyblok/schema`. */
export const SECRET_MARKER = '__storyblokSecret__';

/** A redacted secret placeholder: `SECRET_MARKER`, optionally `` `${SECRET_MARKER}:ENV` ``. */
export type SecretPlaceholder = string;

/** Returns true if `value` is a secret placeholder produced by `secret()`. */
export function isSecretPlaceholder(value: unknown): value is SecretPlaceholder {
  return typeof value === 'string'
    && (value === SECRET_MARKER || value.startsWith(`${SECRET_MARKER}:`));
}

/** Returns the env var name a placeholder is bound to, or `undefined` for a preserve-remote secret. */
export function secretEnvOf(placeholder: string): string | undefined {
  const prefix = `${SECRET_MARKER}:`;
  return placeholder.startsWith(prefix) ? placeholder.slice(prefix.length) : undefined;
}

/**
 * Storyblok plugin option `name`s that `schema init` redacts by default.
 * Sensitive plugin data lives in an `options: [{ name, value }]` array (e.g. the
 * Shopware integration keeps its credentials there), so a secret is identified
 * by the option's `name`, not by a top-level config key. Matching is
 * case-insensitive. Extend via `--secret-names`; disable via `--no-redact-secrets`.
 */
export const DEFAULT_SECRET_NAMES: readonly string[] = [
  'accessKey',
  'apiKey',
  'apiToken',
  'token',
  'secret',
  'clientSecret',
  'password',
  'privateKey',
];

/** Builds a case-insensitive matcher from a list of secret option names. */
export function createSecretNameMatcher(names: Iterable<string>): (name: string) => boolean {
  const set = new Set([...names].map(name => name.toLowerCase()));
  return (name: string) => set.has(name.toLowerCase());
}

/**
 * Storyblok stores plugin options as `{ name, value }` pairs inside an
 * `options: [...]` array (e.g. the Shopware integration keeps `clientSecret`
 * under `value`, discriminated by the sibling `name`). A secret is identified by
 * the entry's `name`. Returns the matching `name` when `record` is such a pair,
 * otherwise `undefined`.
 */
function secretOptionName(record: Record<string, unknown>, isSecretName: (name: string) => boolean): string | undefined {
  return typeof record.name === 'string' && 'value' in record && isSecretName(record.name)
    ? record.name
    : undefined;
}

/**
 * Finds the counterpart of an array element in `reference`. Option pairs carry a
 * stable `name`, so elements with a string `name` are matched by name (robust to
 * reordering); everything else falls back to positional index.
 */
function referenceFor(item: unknown, index: number, reference: unknown): unknown {
  if (!Array.isArray(reference)) { return undefined; }
  if (isRecord(item) && typeof item.name === 'string') {
    const byName = reference.find(entry => isRecord(entry) && entry.name === item.name);
    if (byName !== undefined) { return byName; }
  }
  return reference[index];
}

/**
 * Deep-copies `value`, replacing the `value` of every Storyblok option pair
 * `{ name, value }` whose `name` matches `isSecretName` with
 * `makePlaceholder(name)` (the `name`/`_uid` are kept). Used by `init` before
 * writing to disk. The replaced value is not recursed into; the source is never
 * mutated.
 *
 * The caller must scope this to custom plugin field configs (`type: 'custom'`):
 * the built-in `option`/`options` select fields use the same `{ name, value }`
 * shape for their choices, and those must never be redacted.
 */
export function redactSecretValues(
  value: unknown,
  isSecretName: (name: string) => boolean,
  makePlaceholder: (name: string) => unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(item => redactSecretValues(item, isSecretName, makePlaceholder));
  }
  if (isRecord(value)) {
    const optionName = secretOptionName(value, isSecretName);
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = optionName && key === 'value'
        ? makePlaceholder(optionName)
        : redactSecretValues(val, isSecretName, makePlaceholder);
    }
    return out;
  }
  return value;
}

// Per-process salt so a secret's diff fingerprint reveals nothing and cannot be
// correlated across runs; equality within a single diff (local vs remote) still
// holds because both sides use the same salt.
const FINGERPRINT_SALT = randomBytes(16);

/** Short, non-reversible fingerprint of a value, for change detection in diffs without revealing it. */
function fingerprint(value: unknown): string {
  return createHash('sha256').update(FINGERPRINT_SALT).update(String(value)).digest('hex').slice(0, 10);
}

/** A stable, non-revealing diff token for an env-managed secret. Equal tokens ⇒ equal values. */
function secretDiffToken(envName: string, fp: string): string {
  return `<secret env:${envName} #${fp}>`;
}

/**
 * Deep-copies the **local** schema for diffing: an env-managed secret
 * (`secret('ENV')` with the variable set and non-empty) becomes a non-revealing
 * fingerprint token of the env value, so rotating it shows as a diff; a
 * preserve-remote secret (`secret()`, or its env var unset) is dropped so it
 * never diffs. The source is never mutated.
 */
export function markLocalSecretsForDiff(value: unknown, env: Record<string, string | undefined> = process.env): unknown {
  if (Array.isArray(value)) {
    return value.map(item => markLocalSecretsForDiff(item, env));
  }
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (isSecretPlaceholder(val)) {
        const envName = secretEnvOf(val);
        const envVal = envName ? env[envName] : undefined;
        if (envName && envVal !== undefined && envVal !== '') {
          out[key] = secretDiffToken(envName, fingerprint(envVal));
        }
        // else preserve-remote: drop so it never diffs.
        continue;
      }
      out[key] = markLocalSecretsForDiff(val, env);
    }
    return out;
  }
  return value;
}

/**
 * Deep-copies the **remote** schema for diffing, using the local schema as the
 * reference for which values are secret. Symmetric with
 * {@link markLocalSecretsForDiff}: an env-managed secret becomes a fingerprint
 * token of the **remote** value; a preserve-remote secret is dropped. The
 * arguments are never mutated.
 */
export function markRemoteSecretsForDiff(
  value: unknown,
  referenceLocal: unknown,
  env: Record<string, string | undefined> = process.env,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item, i) => markRemoteSecretsForDiff(item, referenceFor(item, i, referenceLocal), env));
  }
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const ref = isRecord(referenceLocal) ? referenceLocal[key] : undefined;
      if (isSecretPlaceholder(ref)) {
        const envName = secretEnvOf(ref);
        const envVal = envName ? env[envName] : undefined;
        if (envName && envVal !== undefined && envVal !== '') {
          out[key] = secretDiffToken(envName, fingerprint(val));
        }
        // else preserve-remote: drop so it never diffs.
        continue;
      }
      out[key] = markRemoteSecretsForDiff(val, ref, env);
    }
    return out;
  }
  return value;
}

/**
 * Deep-copies `value`, replacing each value whose counterpart in `reference` (at
 * the same path) is a secret placeholder with that placeholder string. Keeps the
 * key present (unlike a plain strip) — used for the changeset's remote snapshot
 * so a real secret is never written to disk, yet `schema rollback` can still
 * recognize the field as secret and hydrate it from the live space. Neither
 * argument is mutated.
 */
export function maskSecretsToPlaceholder(value: unknown, reference: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item, i) => maskSecretsToPlaceholder(item, referenceFor(item, i, reference)));
  }
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const ref = isRecord(reference) ? reference[key] : undefined;
      out[key] = isSecretPlaceholder(ref)
        ? ref
        : maskSecretsToPlaceholder(val, ref);
    }
    return out;
  }
  return value;
}

/** How a single secret placeholder was resolved during {@link hydrateSecretValues}. */
export interface SecretResolution {
  /** The secret's option name (or object key) for user-facing messages. */
  key: string;
  /** `env`: read from `process.env`; `remote`: kept from the space; `missing`: no source. */
  source: 'env' | 'remote' | 'missing';
  /** The environment variable consulted, when the placeholder specified one. */
  env?: string;
}

/**
 * Deep-copies `value`, replacing each secret placeholder with its resolved real
 * value so nothing marked secret ever reaches the Management API as a
 * placeholder. Resolution order per placeholder:
 *
 * 1. `process.env[env]` when the placeholder names an env var that is set and
 *    non-empty (managed/rotatable secret, e.g. in CI);
 * 2. otherwise the value already stored in the space at the same path (the
 *    existing secret is preserved rather than cleared);
 * 3. otherwise the key is omitted entirely and recorded as `missing` — on a
 *    freshly created component there is no remote value to preserve.
 *
 * Each resolution is appended to `resolutions` so the caller can warn about
 * `missing` ones. `remote` is the corresponding remote subtree (may be
 * undefined, e.g. on create). Neither argument is mutated.
 */
export function hydrateSecretValues(
  value: unknown,
  remote: unknown,
  env: Record<string, string | undefined>,
  resolutions: SecretResolution[],
): unknown {
  if (Array.isArray(value)) {
    return value.map((item, i) => hydrateSecretValues(item, referenceFor(item, i, remote), env, resolutions));
  }
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    // Report an option secret by its `name` rather than the `value` key it sits under.
    const label = typeof value.name === 'string' ? value.name : undefined;
    for (const [key, val] of Object.entries(value)) {
      const remoteVal = isRecord(remote) ? remote[key] : undefined;
      if (isSecretPlaceholder(val)) {
        const reportKey = key === 'value' && label ? label : key;
        const envName = secretEnvOf(val);
        const envVal = envName ? env[envName] : undefined;
        if (envName && envVal !== undefined && envVal !== '') {
          out[key] = envVal;
          resolutions.push({ key: reportKey, source: 'env', env: envName });
        }
        else if (remoteVal !== undefined) {
          out[key] = remoteVal;
          resolutions.push({ key: reportKey, source: 'remote' });
        }
        else {
          // No source: drop the key so a placeholder never reaches the API.
          resolutions.push({ key: reportKey, source: 'missing', ...(envName && { env: envName }) });
        }
        continue;
      }
      out[key] = hydrateSecretValues(val, remoteVal, env, resolutions);
    }
    return out;
  }
  return value;
}

/** Returns true if any secret placeholder exists anywhere within `value`. */
export function hasSecretPlaceholder(value: unknown): boolean {
  if (isSecretPlaceholder(value)) { return true; }
  if (Array.isArray(value)) { return value.some(hasSecretPlaceholder); }
  if (isRecord(value)) { return Object.values(value).some(hasSecretPlaceholder); }
  return false;
}

/**
 * Returns true if any Storyblok option pair anywhere within `value` has a `name`
 * matching `isSecretName`. Used to decide whether an `init`-generated file needs
 * a `secret` import.
 */
export function hasSecretOption(value: unknown, isSecretName: (name: string) => boolean): boolean {
  if (Array.isArray(value)) { return value.some(item => hasSecretOption(item, isSecretName)); }
  if (isRecord(value)) {
    if (secretOptionName(value, isSecretName)) { return true; }
    return Object.values(value).some(val => hasSecretOption(val, isSecretName));
  }
  return false;
}
