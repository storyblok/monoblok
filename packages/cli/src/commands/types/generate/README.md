# Types Generate Command

The `types generate` command generates TypeScript type definitions (`.d.ts` files) for your Storyblok component schemas. This helps you maintain type safety when working with your Storyblok content.

> [!WARNING]
> Before generating types, first pull your components using the `components pull` command. Make sure to use the same flags (`--separate-files`, `--suffix`) that you used when pulling components to ensure the types are generated correctly.

## Basic Usage

```bash
storyblok types generate --space <spaceId>
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--sf, --separate-files` | Generate separate type definition files for each component | `false` |
| `--strict` | Enable strict mode with no loose typing | `false` |
| `--type-prefix <prefix>` | Prefix to be prepended to all generated component type names | - |
| `--suffix <suffix>` | Suffix for component names | - |
| `--custom-fields-parser <path>` | Path to the parser file for Custom Field Types | - |
| `--compiler-options <options>` | Path to the compiler options from json-schema-to-typescript | - |
| `--space <spaceId>` | (Required) The ID of your Storyblok space | - |
| `--path <path>` | Path to the directory containing your component files | `.storyblok/components` |

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

The command will generate two files:
1. A `storyblok.d.ts` file with base Storyblok types (like `StoryblokAsset`, `StoryblokRichtext`, etc.)
2. A `storyblok-components.d.ts` file for each space inside the `.storyblok/types/{spaceId}/` directory with your component types

### Example Structure

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
        └── storyblok.d.ts        # Your component types
```

> **Note:**
> The `{spaceId}` folder corresponds to the ID of your Storyblok space.
> The generated files are always placed under `.storyblok/types/` and `.storyblok/types/{spaceId}/`.

## Notes

- The command requires you to be logged in to Storyblok
- The space ID is required
- The generated types are based on your component schemas in Storyblok
- When using `--strict`, the generated types will be more precise but may require more explicit type handling in your code
- Custom field types can be handled by providing a parser file with `--custom-fields-parser`
