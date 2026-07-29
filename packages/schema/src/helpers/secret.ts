/**
 * Marker prefix of a redacted secret placeholder. A placeholder is a plain
 * string so it fits string-typed plugin option values (`options: [{ name, value }]`,
 * where `value` is a `string`). The Storyblok CLI recognizes this exact prefix
 * structurally, so a placeholder produced by any installed version of
 * `@storyblok/schema` round-trips through `schema push` — keep the literal stable.
 *
 * - `secret()` produces exactly `SECRET_MARKER`.
 * - `secret('ENV')` produces `` `${SECRET_MARKER}:ENV` ``.
 */
export const SECRET_MARKER = '__storyblokSecret__' as const;

/** A redacted secret placeholder: a sentinel string, optionally carrying an env var name. */
export type SecretPlaceholder = string;

/**
 * Marks a plugin option value as a secret so it is never written to the
 * versioned schema. `schema init` emits this in place of sensitive values;
 * `schema push` excludes it from diffing and, right before writing to the
 * Management API, substitutes the real value — from `process.env[env]` when an
 * `env` name is given and set, otherwise from the value already stored in the
 * space (so an existing secret is preserved, never cleared).
 *
 * Returns a sentinel string, so it slots into a plugin option's string `value`.
 *
 * @param env Optional environment variable to source the value from on push.
 *
 * @example
 * // Preserve whatever the space already has (secret never leaves Storyblok):
 * defineField('shopware', { type: 'custom', options: [{ name: 'accessKey', value: secret() }] });
 *
 * @example
 * // Manage the value from an environment variable (e.g. in CI):
 * defineField('shopware', { type: 'custom', options: [{ name: 'accessKey', value: secret('SHOPWARE_ACCESS_KEY') }] });
 */
export function secret(env?: string): SecretPlaceholder {
  return env === undefined ? SECRET_MARKER : `${SECRET_MARKER}:${env}`;
}

/** Returns true if `value` is a {@link SecretPlaceholder} produced by {@link secret}. */
export function isSecretPlaceholder(value: unknown): value is SecretPlaceholder {
  return typeof value === 'string'
    && (value === SECRET_MARKER || value.startsWith(`${SECRET_MARKER}:`));
}
