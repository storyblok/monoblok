# Types Generate Command

The `types generate` command generates TypeScript type definitions for your Storyblok component schemas. This helps you maintain type safety when working with your Storyblok content.

> [!WARNING]
> **The default (legacy) generator is deprecated.** It ignores field `required` flags, so every field type comes out looser than it actually is. It ignores `bloks` field `component_group_whitelist`s, so nested block types are not narrowed to the blocks a field actually allows. It ignores the nestable versus root distinction, so root-only and block-only components type the same way. It also requires a prior `components pull` with matching flags (`--separate-files`, `--suffix`), an extra step that can silently drift from what is actually in the space. Use `--future-schema` instead.

## `--future-schema` (recommended)

```bash
storyblok types generate --space <spaceId> --future-schema
```

Fetches the space's components directly from the Management API, no `components pull` needed, and generates types derived from the same model `@storyblok/schema` uses, so optionality, block narrowing, and custom field types are all correct.

Writes `.storyblok/types/<spaceId>/storyblok-schema.d.ts`, exporting:

| Export | Purpose |
|---|---|
| `Block<'hero'>` | The content type for one block, what you type components with |
| `AnyBlock` | Any block, for dispatcher components |
| `Schema` | For `createApiClient(…).withTypes<Schema>()` |
| `Blocks` | Union of block definition types (plumbing for the helpers above) |
| `Story`, `StoryMapi` | Story types narrowed to your root blocks |
| `<Name>BlockDefinition` | One definition type per block |

```ts
import type { Block, Schema } from './.storyblok/types/295018/storyblok-schema';

interface Props { block: Block<'hero'> }

const client = createApiClient({ accessToken }).withTypes<Schema>();
```

The generated file imports from `@storyblok/schema`, so install it as a dev dependency: `npm i -D @storyblok/schema`. It is a types-only import, so it never ships in your application bundle.

The generated file is generated code. Exclude it from your linter and formatter the same way you would exclude any other codegen output, for example by adding `.storyblok/types/` to your `.eslintignore` or lint tool's ignore patterns, rather than editing the file by hand.

### Custom field types

Custom fields need their `field_type` bound to a validator with `defineFieldPlugin` so the generator knows what value type to emit for them. The CLI looks for a field-plugins module at `.storyblok/schema/schema.ts` by convention (the path `schema init` writes to), or at an explicit `--field-plugins <path>` override. The module must export one of two shapes:

- a `schema` export, the result of `defineSchema`, whose `fieldPlugins` record is used, or
- a bare `fieldPlugins` export, a record of `defineFieldPlugin` results keyed by name.

An explicit `--field-plugins` path that does not exist, or that exists but exports neither a `schema` nor a `fieldPlugins` shape, is an error. The convention path degrades silently instead: if `.storyblok/schema/schema.ts` does not exist, or if it exists but exports neither shape, for example because of a typo in the export name, generation continues without custom field types and prints no warning about the module itself, since most spaces have none. Check the export name if you placed a field-plugins module at the convention path and its types are not showing up. `custom` fields whose `field_type` has no matching plugin fall back to an untyped value and are reported as a warning after generation, listing every unmapped `field_type`.

### Supported options

`--future-schema` honours `--space`, `--filename`, `--separate-files`, `--type-prefix`, `--type-suffix`, and `--field-plugins`. Prefix and suffix apply to every exported type name, not just block names, so `--type-prefix Sb` turns `Block` into `SbBlock`, `Schema` into `SbSchema`, and so on, along with every reference to those names inside the file.

`--strict`, `--custom-fields-parser`, and `--compiler-options` are legacy-only and error when combined with `--future-schema`: there is no `json-schema-to-typescript` compiler involved, optionality comes from the schema's own `required` flags, and custom fields are typed with `defineFieldPlugin` instead of a parser file.

## Legacy generator (deprecated)

### Basic usage

```bash
storyblok types generate --space <spaceId>
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--sf, --separate-files` | Generate separate type definition files for each component | `false` |
| `--strict` | Enable strict mode with no loose typing | `false` |
| `--filename <name>` | File name for the generated type files | `storyblok` |
| `--type-prefix <prefix>` | Prefix to be prepended to all generated component type names | - |
| `--suffix <suffix>` | Suffix for component names | - |
| `--custom-fields-parser <path>` | Path to the parser file for Custom Field Types | - |
| `--compiler-options <options>` | Path to the compiler options from json-schema-to-typescript | - |
| `--space <spaceId>` | (Required) The ID of your Storyblok space | - |
| `--path <path>` | Path to the directory containing your component files | `.storyblok/components` |

### Examples

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

### File structure

The command will generate two files: a `storyblok.d.ts` file with base Storyblok types (like `StoryblokAsset`, `StoryblokRichtext`, etc.) and a `storyblok-components.d.ts` file for each space inside the `.storyblok/types/{spaceId}/` directory with your component types.

#### Example structure

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

> **Note:**
> The `{spaceId}` folder corresponds to the ID of your Storyblok space. The generated files are always placed under `.storyblok/types/` and `.storyblok/types/{spaceId}/`.

### Notes

- The command requires you to be logged in to Storyblok.
- The space ID is required.
- The generated types are based on your component schemas in Storyblok.
- When using `--strict`, the generated types will be more precise but may require more explicit type handling in your code.
- Custom field types can be handled by providing a parser file with `--custom-fields-parser`.
