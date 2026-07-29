import { isRecord } from '../utils/is-record';

/**
 * Property key that brands a value as a redacted secret placeholder. Chosen to be
 * unlikely to collide with a real field-config key. The Storyblok CLI recognizes
 * this exact string structurally (not by object identity), so a placeholder
 * produced by *any* installed version of `@storyblok/schema` round-trips through
 * `schema push` — keep the literal stable across releases.
 */
export const SECRET_MARKER = '__storyblokSecret' as const;

/**
 * Placeholder that stands in for a sensitive field-config value (e.g. an
 * integration `accessKey`) in a versioned schema. It carries no secret itself —
 * only, optionally, the name of the environment variable the real value should
 * be read from at push time.
 */
export interface SecretPlaceholder {
  readonly [SECRET_MARKER]: true;
  /** Environment variable the CLI reads the real value from on `schema push`. */
  readonly env?: string;
}

/**
 * Marks a field-config value as a secret so it is never written to the versioned
 * schema. `schema init` emits this in place of sensitive values; `schema push`
 * excludes it from diffing and, right before writing to the Management API,
 * substitutes the real value — from `process.env[env]` when an `env` name is
 * given and set, otherwise from the value already stored in the space (so an
 * existing secret is preserved, never cleared).
 *
 * @param env Optional environment variable to source the value from on push.
 *
 * @example
 * // Preserve whatever the space already has (secret never leaves Storyblok):
 * defineField('shopware', { type: 'custom', accessKey: secret() });
 *
 * @example
 * // Manage the value from an environment variable (e.g. in CI):
 * defineField('shopware', { type: 'custom', accessKey: secret('SHOPWARE_ACCESS_KEY') });
 */
export function secret(env?: string): SecretPlaceholder {
  return env === undefined
    ? { [SECRET_MARKER]: true }
    : { [SECRET_MARKER]: true, env };
}

/** Returns true if `value` is a {@link SecretPlaceholder} produced by {@link secret}. */
export function isSecretPlaceholder(value: unknown): value is SecretPlaceholder {
  return isRecord(value) && value[SECRET_MARKER] === true;
}
