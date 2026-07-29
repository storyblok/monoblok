# Types Generate Command

The `types generate` command generates TypeScript type definitions (`.d.ts` files) for your
Storyblok component schemas. This helps you maintain type safety when working with your Storyblok
content.

> [!WARNING] The default (legacy) generator is deprecated: it ignores field `required` flags,
> `bloks` field whitelists, and the nestable versus root distinction. Use `--future-schema` instead,
> which derives types from the space schema via `@storyblok/schema`.

> [!WARNING] Before generating types with the legacy generator, first pull your components using the
> `components pull` command. Make sure to use the same flags (`--separate-files`, `--suffix`) that
> you used when pulling components to ensure the types are generated correctly. `--future-schema`
> fetches components itself and needs no prior pull.

## Basic Usage

```bash
storyblok types generate --space <spaceId>
```

## Options

| Option                          | Description                                                                                                                                                                            | Default                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `--future-schema`               | Generate types derived from the space schema instead of the deprecated legacy generator. Not compatible with `--strict`, `--suffix`, `--custom-fields-parser`, or `--compiler-options` | `false`                                                    |
| `--field-plugins <path>`        | Path to a module exporting your `defineFieldPlugin` declarations, used to type `custom` fields. Requires `--future-schema`                                                             | `.storyblok/schema/schema.ts`                              |
| `--sf, --separate-files`        | Generate separate type definition files for each component                                                                                                                             | `false`                                                    |
| `--strict`                      | Enable strict mode with no loose typing                                                                                                                                                | `false`                                                    |
| `--filename <name>`             | Base file name for the generated type files. The legacy generator ignores it under `--separate-files`; `--future-schema` uses it to name the main file                                 | `storyblok`, or `storyblok-schema` under `--future-schema` |
| `--type-prefix <prefix>`        | Prefix to be prepended to all generated component type names                                                                                                                           | -                                                          |
| `--type-suffix <suffix>`        | Suffix to be appended to all generated component type names                                                                                                                            | -                                                          |
| `--suffix <suffix>`             | Suffix for component names, used to select the pulled component files the legacy generator reads                                                                                       | -                                                          |
| `--custom-fields-parser <path>` | Path to the parser file for Custom Field Types                                                                                                                                         | -                                                          |
| `--compiler-options <options>`  | Path to the compiler options from json-schema-to-typescript                                                                                                                            | -                                                          |
| `--space <spaceId>`             | (Required) The ID of your Storyblok space                                                                                                                                              | -                                                          |
| `--path <path>`                 | Path to the directory containing your component files                                                                                                                                  | `.storyblok/components`                                    |

## Examples

Generate types for all components:

```bash
storyblok types generate --space 12345
```

Generate types with strict mode:

```bash
storyblok types generate --space 12345 --strict
```

Generate types with a custom prefix:

```bash
storyblok types generate --space 12345 --type-prefix Storyblok
```

Generate separate type files for each component:

```bash
storyblok types generate --space 12345 --separate-files
```

## File Structure

Both generators write under `.storyblok/types/`, where the `{spaceId}` folder corresponds to the ID
of your Storyblok space. Use `--path` to write somewhere other than `.storyblok`.

### Legacy generator

The legacy generator generates two files:

1. A `storyblok.d.ts` file with base Storyblok types (like `StoryblokAsset`, `StoryblokRichTextDoc`,
   etc.)
2. A `storyblok-components.d.ts` file for each space inside the `.storyblok/types/{spaceId}/`
   directory with your component types

When running:

```bash
storyblok types generate --space 295018
```

The following structure will be created:

```
.storyblok/
└── types/
    ├── storyblok.d.ts            # Base Storyblok types
    └── 295018/
        └── storyblok-components.d.ts        # Your component types
```

### `--future-schema`

`--future-schema` generates a single `storyblok-schema.d.ts` file per space, which exports `Blocks`,
`Schema`, `FieldPlugins`, `Block<TName>`, `AnyBlock`, `Story`, and `StoryMapi`. It writes no
base-types file, because the base types come from `@storyblok/schema` at compile time.

When running:

```bash
storyblok types generate --space 295018 --future-schema
```

The following structure will be created:

```
.storyblok/
└── types/
    └── 295018/
        └── storyblok-schema.d.ts        # Your block definitions and the derived surface
```

With `--separate-files`, each block definition moves into its own file under `blocks/`, and the main
file imports them:

```
.storyblok/
└── types/
    └── 295018/
        ├── blocks/
        │   ├── hero.d.ts
        │   └── teaser-list.d.ts
        └── storyblok-schema.d.ts        # Imports the block files, exports the surface
```

## Notes

- The command requires you to be logged in to Storyblok
- The space ID is required
- The generated types are based on your component schemas in Storyblok
- When using `--strict`, the generated types will be more precise but may require more explicit type
  handling in your code
- Custom field types can be handled by providing a parser file with `--custom-fields-parser`
- Files generated with `--future-schema` import from `@storyblok/schema`, so install it as a dev
  dependency: `npm i -D @storyblok/schema`. It is a types-only import and never reaches your bundle
- Under `--future-schema`, custom fields resolve through `defineFieldPlugin` declarations. Point
  `--field-plugins` at the module that exports them, or place it at the default
  `.storyblok/schema/schema.ts`. Custom fields with no matching declaration fall back to an untyped
  value and the command warns which `field_type`s were unmapped
