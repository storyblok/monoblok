import { describe, expect, it } from 'vitest';

import {
  createSecretNameMatcher,
  DEFAULT_SECRET_NAMES,
  hasSecretOption,
  hasSecretPlaceholder,
  hydrateSecretValues,
  isSecretPlaceholder,
  redactSecretValues,
  SECRET_MARKER,
  type SecretResolution,
  stripSecretKeys,
} from './secrets';

const placeholder = (env?: string) =>
  (env === undefined ? { [SECRET_MARKER]: true } : { [SECRET_MARKER]: true, env });

describe('isSecretPlaceholder', () => {
  it('should detect the marker structurally', () => {
    expect(isSecretPlaceholder(placeholder())).toBe(true);
    expect(isSecretPlaceholder(placeholder('X'))).toBe(true);
    expect(isSecretPlaceholder({ accessKey: 'real' })).toBe(false);
    expect(isSecretPlaceholder(null)).toBe(false);
  });
});

describe('createSecretNameMatcher', () => {
  it('should match case-insensitively', () => {
    const matches = createSecretNameMatcher(['clientSecret', 'token']);
    expect(matches('clientSecret')).toBe(true);
    expect(matches('CLIENTSECRET')).toBe(true);
    expect(matches('Token')).toBe(true);
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
  const make = (name: string) => placeholder(name === 'never' ? 'X' : undefined);

  it('should redact the `value` of option pairs by name (Shopware integration form)', () => {
    // Mirrors a real Storyblok custom field: secrets live in `options`, keyed by
    // the entry `name`; `field_type` is a developer-chosen plugin name and is
    // never used to identify secrets.
    const input = {
      type: 'custom',
      field_type: 'shopware-integration',
      datasource: 'shopware',
      required: true,
      options: [
        { _uid: 'a', name: 'baseUrl', value: 'https://shop.example' },
        { _uid: 'b', name: 'clientId', value: 'SWIACMHZRUTCVEPWSGLQRVJXZW' },
        { _uid: 'c', name: 'clientSecret', value: 'WXpZbzltM1kx' },
        { _uid: 'd', name: 'limit', value: '1' },
      ],
    };
    const out = redactSecretValues(input, isSecretName, make) as Record<string, any>;

    expect(out.options[0].value).toBe('https://shop.example');
    expect(out.options[1].value).toEqual(placeholder());
    expect(out.options[2].value).toEqual(placeholder());
    expect(out.options[3].value).toBe('1');
    // `name`/`_uid` and other keys are preserved.
    expect(out.options[2]).toEqual({ _uid: 'c', name: 'clientSecret', value: placeholder() });
    expect(out.field_type).toBe('shopware-integration');
    // Source untouched.
    expect(input.options[2].value).toBe('WXpZbzltM1kx');
  });

  it('should not touch option pairs whose name is not a secret', () => {
    const input = { options: [{ name: 'baseUrl', value: 'https://x' }] };
    const out = redactSecretValues(input, isSecretName, make) as Record<string, any>;
    expect(out.options[0].value).toBe('https://x');
  });

  it('should not treat a top-level key as a secret (only option pairs)', () => {
    // `clientSecret` as a bare key is NOT redacted — secrets only ever live in options.
    const input = { clientSecret: 'not-an-option-pair' };
    const out = redactSecretValues(input, isSecretName, make) as Record<string, any>;
    expect(out.clientSecret).toBe('not-an-option-pair');
  });
});

describe('hasSecretOption', () => {
  const isSecretName = createSecretNameMatcher(['clientSecret']);

  it('should find a secret option nested in a component schema', () => {
    const schema = {
      products: { type: 'custom', options: [{ name: 'clientSecret', value: 'x' }] },
    };
    expect(hasSecretOption(schema, isSecretName)).toBe(true);
  });

  it('should return false when no option name is a secret', () => {
    const schema = { title: { type: 'text' }, products: { options: [{ name: 'baseUrl', value: 'x' }] } };
    expect(hasSecretOption(schema, isSecretName)).toBe(false);
  });
});

describe('stripSecretKeys', () => {
  it('should drop keys that are placeholders in the reference, from both sides', () => {
    const local = { type: 'custom', accessKey: placeholder(), label: 'a' };
    const remote = { type: 'custom', accessKey: 'real-secret', label: 'a' };

    const localStripped = stripSecretKeys(local, local) as Record<string, unknown>;
    const remoteStripped = stripSecretKeys(remote, local) as Record<string, unknown>;

    expect('accessKey' in localStripped).toBe(false);
    expect('accessKey' in remoteStripped).toBe(false);
    expect(localStripped).toEqual(remoteStripped);
  });

  it('should not mutate its inputs', () => {
    const local = { accessKey: placeholder() };
    const remote = { accessKey: 'real' };
    stripSecretKeys(remote, local);
    expect(remote.accessKey).toBe('real');
    expect(local.accessKey).toEqual(placeholder());
  });

  it('should leave non-secret keys intact when reference lacks a placeholder', () => {
    const remote = { accessKey: 'real', label: 'x' };
    const local = { label: 'x' };
    const out = stripSecretKeys(remote, local) as Record<string, unknown>;
    expect(out).toEqual({ accessKey: 'real', label: 'x' });
  });
});

describe('hydrateSecretValues', () => {
  it('should preserve the remote value when no env is given', () => {
    const resolutions: SecretResolution[] = [];
    const out = hydrateSecretValues(
      { accessKey: placeholder() },
      { accessKey: 'remote-secret' },
      {},
      resolutions,
    ) as Record<string, unknown>;

    expect(out.accessKey).toBe('remote-secret');
    expect(resolutions).toEqual([{ key: 'accessKey', source: 'remote' }]);
  });

  it('should read from the environment when the placeholder names a set variable', () => {
    const resolutions: SecretResolution[] = [];
    const out = hydrateSecretValues(
      { accessKey: placeholder('SHOPWARE_KEY') },
      { accessKey: 'remote-secret' },
      { SHOPWARE_KEY: 'from-env' },
      resolutions,
    ) as Record<string, unknown>;

    expect(out.accessKey).toBe('from-env');
    expect(resolutions).toEqual([{ key: 'accessKey', source: 'env', env: 'SHOPWARE_KEY' }]);
  });

  it('should fall back to remote when the named env var is empty or unset', () => {
    const resolutions: SecretResolution[] = [];
    const out = hydrateSecretValues(
      { accessKey: placeholder('SHOPWARE_KEY') },
      { accessKey: 'remote-secret' },
      { SHOPWARE_KEY: '' },
      resolutions,
    ) as Record<string, unknown>;

    expect(out.accessKey).toBe('remote-secret');
    expect(resolutions).toEqual([{ key: 'accessKey', source: 'remote' }]);
  });

  it('should drop the key and record missing when no source exists (e.g. on create)', () => {
    const resolutions: SecretResolution[] = [];
    const out = hydrateSecretValues(
      { accessKey: placeholder('SHOPWARE_KEY'), label: 'keep' },
      undefined,
      {},
      resolutions,
    ) as Record<string, unknown>;

    expect('accessKey' in out).toBe(false);
    expect(out.label).toBe('keep');
    expect(resolutions).toEqual([{ key: 'accessKey', source: 'missing', env: 'SHOPWARE_KEY' }]);
  });

  it('should hydrate option-pair secrets by name even when remote options are reordered', () => {
    // Local (from the generated file) and remote (live) option arrays can be in
    // different orders; matching by `name` must still pull the right value.
    const local = {
      options: [
        { name: 'clientId', value: placeholder() },
        { name: 'clientSecret', value: placeholder() },
      ],
    };
    const remote = {
      options: [
        { name: 'clientSecret', value: 'the-secret' },
        { name: 'clientId', value: 'the-id' },
      ],
    };

    const out = hydrateSecretValues(local, remote, {}, []) as any;

    expect(out.options[0]).toEqual({ name: 'clientId', value: 'the-id' });
    expect(out.options[1]).toEqual({ name: 'clientSecret', value: 'the-secret' });
  });

  it('should never leave a placeholder in the output', () => {
    const out = hydrateSecretValues(
      { schema: { field: { accessKey: placeholder() } } },
      { schema: { field: { accessKey: 'real' } } },
      {},
      [],
    );
    expect(hasSecretPlaceholder(out)).toBe(false);
  });
});

describe('hasSecretPlaceholder', () => {
  it('should find placeholders nested anywhere', () => {
    expect(hasSecretPlaceholder({ a: { b: [placeholder()] } })).toBe(true);
    expect(hasSecretPlaceholder({ a: { b: ['plain'] } })).toBe(false);
  });
});
