import { isRecord } from './utils';

/**
 * Secret handling for the `schema` command. Sensitive field-config values (e.g.
 * an integration `accessKey`) must never be written to the versioned schema, and
 * must never be cleared on the remote space by a push that carries a redacted
 * local value.
 *
 * The mechanism is a placeholder object marked with {@link SECRET_MARKER},
 * produced by `@storyblok/schema`'s `secret()` helper. This module owns the CLI
 * side: introducing placeholders on `init` (redaction), excluding them from
 * diffing, and substituting the real value on `push` (hydration).
 *
 * Detection is structural (by the marker string), not by object identity, so a
 * placeholder produced by any installed version of `@storyblok/schema` is
 * recognized — the value reaching the CLI comes from the user's project, not
 * from this package.
 */

/** Must match `SECRET_MARKER` exported by `@storyblok/schema`. */
export const SECRET_MARKER = '__storyblokSecret';

export interface SecretPlaceholder {
  [SECRET_MARKER]: true;
  /** Environment variable the real value is read from on push, when present. */
  env?: string;
}

/** Returns true if `value` is a secret placeholder produced by `secret()`. */
export function isSecretPlaceholder(value: unknown): value is SecretPlaceholder {
  return isRecord(value) && value[SECRET_MARKER] === true;
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

/**
 * Deep-copies `value`, dropping every key whose value in `reference` (at the
 * same path) is a secret placeholder. Symmetric by design: pass the local schema
 * as `reference` for both the local copy (secret keys drop out) and the remote
 * copy (the same keys drop out), so a redacted secret produces no diff. Also used
 * to redact a remote snapshot for the changeset. Neither argument is mutated.
 */
export function stripSecretKeys(value: unknown, reference: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item, i) => stripSecretKeys(item, referenceFor(item, i, reference)));
  }
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      const ref = isRecord(reference) ? reference[key] : undefined;
      if (isSecretPlaceholder(ref)) { continue; }
      out[key] = stripSecretKeys(val, ref);
    }
    return out;
  }
  return value;
}

/**
 * Deep-copies `value`, replacing each value whose counterpart in `reference` (at
 * the same path) is a secret placeholder with a copy of that placeholder. Unlike
 * {@link stripSecretKeys} (which drops the key), this keeps the key present as a
 * placeholder — used for the changeset's remote snapshot so a real secret is
 * never written to disk, yet `schema rollback` can still recognize the field as
 * secret and hydrate it from the live space. Neither argument is mutated.
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
        ? { ...ref }
        : maskSecretsToPlaceholder(val, ref);
    }
    return out;
  }
  return value;
}

/** How a single secret placeholder was resolved during {@link hydrateSecretValues}. */
export interface SecretResolution {
  /** The config key that held the placeholder (for user-facing messages). */
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
    for (const [key, val] of Object.entries(value)) {
      const remoteVal = isRecord(remote) ? remote[key] : undefined;
      if (isSecretPlaceholder(val)) {
        const envName = val.env;
        const envVal = envName ? env[envName] : undefined;
        if (envName && envVal !== undefined && envVal !== '') {
          out[key] = envVal;
          resolutions.push({ key, source: 'env', env: envName });
        }
        else if (remoteVal !== undefined) {
          out[key] = remoteVal;
          resolutions.push({ key, source: 'remote' });
        }
        else {
          // No source: drop the key so a placeholder never reaches the API.
          resolutions.push({ key, source: 'missing', ...(envName && { env: envName }) });
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
