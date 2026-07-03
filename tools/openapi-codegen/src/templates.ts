/**
 * Wrapper-template metadata. Templates live in `tools/openapi-codegen/templates/`
 * as static `.ts` files that wrap raw OpenAPI-derived types with generics
 * (`Block<TName, ...>`, `Story<TBlock, ...>`, etc.). Each template imports its
 * leaf symbols from `./_sources`, which the tool writes per consumer.
 *
 * This file tells the tool, for every public name the catalog exposes:
 *   - whether a wrapper template provides it (`templateFile`), and which one,
 *   - which other templates that template imports from (transitive),
 *   - which leaf symbols (by alias name) it expects in `_sources`.
 *
 * The names a template re-exports under (besides its main generic type) are
 * declared as `alsoProvides` so the catalog resolves them to the same template.
 */

export type WrapperFile = 'block' | 'field' | 'story' | 'mapi-story';

export interface TemplateMeta {
  /** Names this template exports (the main generic plus any pass-throughs). */
  provides: readonly string[];
  /** Other wrapper templates this one imports from. */
  templateDeps: readonly WrapperFile[];
  /** Leaf alias names this template imports from `./_sources`. */
  sourceLeaves: readonly string[];
}

export const TEMPLATES = {
  'block': {
    provides: ['Block', 'BlockFields', 'RootBlock', 'NestableBlock'],
    templateDeps: [],
    sourceLeaves: ['Component', 'Field'],
  },
  'field': {
    provides: ['BlockContent', 'BlockContentInput', 'BlocksFieldValue', 'FieldType', 'FieldValue', 'FieldValueInput', 'Field', 'AssetFieldValue', 'MultilinkFieldValue', 'PluginFieldValue', 'RichtextFieldValue', 'TableFieldValue'],
    templateDeps: ['block'],
    sourceLeaves: ['AssetFieldValue', 'BlockContentBase', 'BlockContentInputBase', 'Field', 'MultilinkFieldValue', 'PluginFieldValue', 'RichtextFieldValue', 'TableFieldValue'],
  },
  'story': {
    provides: ['Story'],
    templateDeps: ['block', 'field'],
    sourceLeaves: ['CapiStory'],
  },
  'mapi-story': {
    provides: ['MapiStory', 'StoryCreate', 'StoryUpdate'],
    templateDeps: ['block', 'field', 'story'],
    sourceLeaves: ['MapiStory', 'StoryCreate', 'StoryUpdate'],
  },
} as const satisfies Record<WrapperFile, TemplateMeta>;

const PROVIDES_INDEX: ReadonlyMap<string, WrapperFile> = new Map(
  Object.entries(TEMPLATES).flatMap(
    ([file, meta]) => meta.provides.map(name => [name, file as WrapperFile] as const),
  ),
);

export function templateFor(publicName: string): WrapperFile | undefined {
  return PROVIDES_INDEX.get(publicName);
}
