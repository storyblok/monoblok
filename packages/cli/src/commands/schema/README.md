# Schema Command

The `schema` command lets you manage a space's content model as versioned code. `storyblok schema init` bootstraps local TypeScript definitions from an existing space, `storyblok schema push` applies your local changes back to the space, and `storyblok schema rollback` reverts a previous push.

## Secret handling

Some custom field plugins, for example the Shopware integration, store credentials inside a field's `options` array as `{ name, value }` pairs. To keep those values out of your Git repository, `schema init` redacts them and `schema push` restores them at push time. A secret is identified only by the option `name`, never by the plugin's `field_type` (which the plugin developer chooses freely).

### Default secret names

By default, init redacts the `value` of any plugin option whose `name` matches one of the following, case-insensitively:

- `accessKey`
- `apiKey`
- `apiToken`
- `token`
- `secret`
- `clientSecret`
- `password`
- `privateKey`

### How init redacts

Each matching value is replaced with a `secret()` placeholder imported from `@storyblok/schema`, so the real value never reaches the generated file. Given a Shopware field, `storyblok schema init --space 12345` produces:

```ts
// .storyblok/schema/blocks/product.ts
import { defineBlock, defineField, secret } from '@storyblok/schema';

export const productBlock = defineBlock({
  name: 'product',
  fields: [
    defineField('products', {
      type: 'custom',
      field_type: 'shopware-integration',
      datasource: 'shopware',
      required: true,
      options: [
        { name: 'baseUrl', value: 'https://shop.example' },
        { name: 'clientId', value: secret() },
        { name: 'clientSecret', value: secret() },
      ],
    }),
  ],
});
```

You can commit this file safely: no credentials are stored in it.

### How push restores

`schema push` excludes secrets from the diff, so a redacted value never shows up as a change and never triggers a secret-only update. Just before the Management API call, each `secret()` is resolved in this order:

1. `process.env[ENV_VAR]` when the placeholder is written as `secret('ENV_VAR')` and that variable is set and non-empty. Use this to manage or rotate a secret from your environment or CI.
2. Otherwise, the value already stored on the space. The existing secret is preserved, never cleared.
3. Otherwise, the value is left empty and a warning is printed. This only happens when creating a brand-new component on a fresh space, where there is no stored value to preserve. Use `secret('ENV_VAR')` to provision it.

A placeholder never reaches the Management API. The same restore logic applies to `schema rollback`, and the changeset and local component JSON files written to disk store placeholders rather than real values.

A preserve-remote `secret()` is excluded from the diff entirely, so it never shows as a change on its own. An env-managed `secret('ENV_VAR')` participates in the diff: when the environment value differs from the value on the space, push reports an update and rotates the secret. The diff shows a non-revealing fingerprint, never the secret value itself.

To manage a value from the environment, point the placeholder at a variable name:

```ts
defineField('products', {
  type: 'custom',
  options: [
    { name: 'clientSecret', value: secret('SHOPWARE_CLIENT_SECRET') },
  ],
});
```

```bash
SHOPWARE_CLIENT_SECRET=whsec_live_xxx storyblok schema push .storyblok/schema/schema.ts --space 12345
```

### Custom secret names

Pass `--secret-names` to `schema init` to redact additional plugin option names on top of the defaults. The value is a comma-separated list and is added to, not a replacement for, the default set:

```bash
storyblok schema init --space 12345 --secret-names apiSecret,privateToken
```

To disable redaction entirely and write sensitive option values verbatim, pass `--no-redact-secrets`:

```bash
storyblok schema init --space 12345 --no-redact-secrets
```

### Secret options

| Option | Description | Default |
|--------|-------------|---------|
| `--secret-names <names>` | Comma-separated plugin option names to redact as `secret()`, added to the defaults | Default secret names above |
| `--no-redact-secrets` | Write sensitive option values verbatim instead of redacting them | Redaction enabled |

### End-to-end example

```bash
# 1. Bootstrap local definitions from the space. Secrets are redacted to secret().
storyblok schema init --space 12345

# 2. Commit the generated files. No credentials are stored in them.
git add .storyblok/schema && git commit -m "Add code-driven schema"

# 3. Push local changes. Redacted secrets are restored from the space,
#    so unrelated changes never clear an existing clientSecret.
storyblok schema push .storyblok/schema/schema.ts --space 12345

# 4. Optionally manage a secret from the environment during push.
SHOPWARE_CLIENT_SECRET=whsec_live_xxx storyblok schema push .storyblok/schema/schema.ts --space 12345
```
