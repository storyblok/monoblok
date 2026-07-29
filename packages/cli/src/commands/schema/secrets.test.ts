import { describe, expect, it } from 'vitest';

import {
  createSecretNameMatcher,
  DEFAULT_SECRET_NAMES,
  hasSecretOption,
  hasSecretPlaceholder,
  hydrateSecretValues,
  isSecretPlaceholder,
  markLocalSecretsForDiff,
  markRemoteSecretsForDiff,
  maskSecretsToPlaceholder,
  redactSecretValues,
  SECRET_MARKER,
  secretEnvOf,
  type SecretResolution,
} from './secrets';

/** Builds a sentinel-string placeholder like `secret()` / `secret('ENV')`. */
const ph = (env?: string) => (env === undefined ? SECRET_MARKER : `${SECRET_MARKER}:${env}`);

describe('isSecretPlaceholder / secretEnvOf', () => {
  it('should detect the sentinel string and parse its env', () => {
    expect(isSecretPlaceholder(ph())).toBe(true);
    expect(isSecretPlaceholder(ph('X'))).toBe(true);
    expect(isSecretPlaceholder('accessKey')).toBe(false);
    expect(isSecretPlaceholder(null)).toBe(false);
    expect(isSecretPlaceholder({ [SECRET_MARKER]: true })).toBe(false);

    expect(secretEnvOf(ph())).toBeUndefined();
    expect(secretEnvOf(ph('SHOPWARE_KEY'))).toBe('SHOPWARE_KEY');
  });
});

describe('createSecretNameMatcher', () => {
  it('should match case-insensitively', () => {
    const matches = createSecretNameMatcher(['clientSecret', 'token']);
    expect(matches('clientSecret')).toBe(true);
    expect(matches('CLIENTSECRET')).toBe(true);
    expect(matches('baseUrl')).toBe(false);
  });

  it('should ship sensible defaults', () => {
    const matches = createSecretNameMatcher(DEFAULT_SECRET_NAMES);
    expect(matches('clientSecret')).toBe(true);
    expect(matches('apiToken')).toBe(true);
    expect(matches('password')).toBe(true);
  });
});

describe('redactSecretValues', () => {
  const isSecretName = createSecretNameMatcher(['clientSecret', 'clientId']);
  const make = () => ph();

  it('should redact the `value` of option pairs by name (Shopware form)', () => {
    const input = {
      type: 'custom',
      field_type: 'shopware-integration',
      options: [
        { _uid: 'a', name: 'baseUrl', value: 'https://shop.example' },
        { _uid: 'b', name: 'clientId', value: 'SWIACMHZRUTCVEPWSGLQRVJXZW' },
        { _uid: 'c', name: 'clientSecret', value: 'WXpZbzltM1kx' },
      ],
    };
    const out = redactSecretValues(input, isSecretName, make) as Record<string, any>;

    expect(out.options[0].value).toBe('https://shop.example');
    expect(out.options[1].value).toBe(ph());
    expect(out.options[2]).toEqual({ _uid: 'c', name: 'clientSecret', value: ph() });
    expect(out.field_type).toBe('shopware-integration');
    expect(input.options[2].value).toBe('WXpZbzltM1kx'); // source untouched
  });

  it('should not treat a top-level key as a secret (only option pairs)', () => {
    const out = redactSecretValues({ clientSecret: 'not-an-option' }, isSecretName, make) as Record<string, any>;
    expect(out.clientSecret).toBe('not-an-option');
  });
});

describe('hasSecretOption', () => {
  const isSecretName = createSecretNameMatcher(['clientSecret']);

  it('should find a secret option nested in a component schema', () => {
    const schema = { products: { type: 'custom', options: [{ name: 'clientSecret', value: 'x' }] } };
    expect(hasSecretOption(schema, isSecretName)).toBe(true);
  });

  it('should return false when no option name is a secret', () => {
    const schema = { products: { options: [{ name: 'baseUrl', value: 'x' }] } };
    expect(hasSecretOption(schema, isSecretName)).toBe(false);
  });
});

describe('markLocalSecretsForDiff / markRemoteSecretsForDiff', () => {
  const local = { options: [{ name: 'clientSecret', value: ph('SW_SECRET') }, { name: 'apiKey', value: ph() }] };

  it('should drop preserve-remote secrets and env-managed secrets whose var is unset', () => {
    const localOut = markLocalSecretsForDiff(local, {}) as any;
    const remote = { options: [{ name: 'clientSecret', value: 'real' }, { name: 'apiKey', value: 'real2' }] };
    const remoteOut = markRemoteSecretsForDiff(remote, local, {}) as any;

    // Both the preserve secret (apiKey) and the env secret with unset var are dropped on both sides.
    expect('value' in localOut.options[0]).toBe(false);
    expect('value' in localOut.options[1]).toBe(false);
    expect('value' in remoteOut.options[0]).toBe(false);
    expect('value' in remoteOut.options[1]).toBe(false);
  });

  it('should produce equal tokens when the env value matches the remote value', () => {
    const env = { SW_SECRET: 'same-value' };
    const localOut = markLocalSecretsForDiff(local, env) as any;
    const remote = { options: [{ name: 'clientSecret', value: 'same-value' }, { name: 'apiKey', value: 'x' }] };
    const remoteOut = markRemoteSecretsForDiff(remote, local, env) as any;

    expect(localOut.options[0].value).toBe(remoteOut.options[0].value);
  });

  it('should produce different, non-revealing tokens when the env value differs from remote', () => {
    const env = { SW_SECRET: 'rotated-value' };
    const localOut = markLocalSecretsForDiff(local, env) as any;
    const remote = { options: [{ name: 'clientSecret', value: 'old-value' }, { name: 'apiKey', value: 'x' }] };
    const remoteOut = markRemoteSecretsForDiff(remote, local, env) as any;

    expect(localOut.options[0].value).not.toBe(remoteOut.options[0].value);
    // The raw secret values never appear in the tokens.
    expect(localOut.options[0].value).not.toContain('rotated-value');
    expect(remoteOut.options[0].value).not.toContain('old-value');
  });
});

describe('maskSecretsToPlaceholder', () => {
  it('should mask a real remote value to the local placeholder string', () => {
    const local = { options: [{ name: 'clientSecret', value: ph('SW') }] };
    const remote = { options: [{ name: 'clientSecret', value: 'real-live-secret' }] };
    const out = maskSecretsToPlaceholder(remote, local) as any;
    expect(out.options[0].value).toBe(ph('SW'));
  });
});

describe('hydrateSecretValues', () => {
  it('should preserve the remote value when no env is given', () => {
    const resolutions: SecretResolution[] = [];
    const out = hydrateSecretValues(
      { options: [{ name: 'clientSecret', value: ph() }] },
      { options: [{ name: 'clientSecret', value: 'remote-secret' }] },
      {},
      resolutions,
    ) as any;

    expect(out.options[0].value).toBe('remote-secret');
    expect(resolutions).toEqual([{ key: 'clientSecret', source: 'remote' }]);
  });

  it('should read from the environment when the placeholder names a set variable', () => {
    const resolutions: SecretResolution[] = [];
    const out = hydrateSecretValues(
      { options: [{ name: 'clientSecret', value: ph('SW_KEY') }] },
      { options: [{ name: 'clientSecret', value: 'remote-secret' }] },
      { SW_KEY: 'from-env' },
      resolutions,
    ) as any;

    expect(out.options[0].value).toBe('from-env');
    expect(resolutions).toEqual([{ key: 'clientSecret', source: 'env', env: 'SW_KEY' }]);
  });

  it('should hydrate option-pair secrets by name even when remote options are reordered', () => {
    const localSchema = { options: [{ name: 'clientId', value: ph() }, { name: 'clientSecret', value: ph() }] };
    const remoteSchema = { options: [{ name: 'clientSecret', value: 'the-secret' }, { name: 'clientId', value: 'the-id' }] };

    const out = hydrateSecretValues(localSchema, remoteSchema, {}, []) as any;

    expect(out.options[0]).toEqual({ name: 'clientId', value: 'the-id' });
    expect(out.options[1]).toEqual({ name: 'clientSecret', value: 'the-secret' });
  });

  it('should drop the key and record missing when no source exists (e.g. on create)', () => {
    const resolutions: SecretResolution[] = [];
    const out = hydrateSecretValues(
      { options: [{ name: 'clientSecret', value: ph('SW_KEY') }] },
      undefined,
      {},
      resolutions,
    ) as any;

    expect('value' in out.options[0]).toBe(false);
    expect(resolutions).toEqual([{ key: 'clientSecret', source: 'missing', env: 'SW_KEY' }]);
  });

  it('should never leave a placeholder in the output', () => {
    const out = hydrateSecretValues(
      { options: [{ name: 'clientSecret', value: ph() }] },
      { options: [{ name: 'clientSecret', value: 'real' }] },
      {},
      [],
    );
    expect(hasSecretPlaceholder(out)).toBe(false);
  });
});
