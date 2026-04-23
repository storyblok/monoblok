/**
 * Reads the WordPress JSON dump and emits the Storyblok schema that fits it.
 *
 * Outputs (idempotent — wholesale-overwrites generated files):
 *   src/schema/components/<post_type>.ts        — root components
 *   src/schema/components/blocks/<block>.ts     — nestable components, one per discovered block
 *   src/schema/components/blocks/richtext.ts    — virtual nestable for collapsed prose runs
 *   src/schema/datasources/<taxonomy>.ts        — one per discovered taxonomy
 *   src/schema/schema.ts                        — aggregator
 */
import 'dotenv/config';

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { effectiveBlockName, extractInnerHtmlFields, isProseBlock, safeBlockName, type ExtractedField } from './_block-mapper.js';
import { parseBlocks, walkBlocks } from './_wp-blocks.js';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..', '..', '..', '..');
const dumpDir = process.env.WP_DUMP_DIR
  ? resolve(projectRoot, process.env.WP_DUMP_DIR)
  : resolve(projectRoot, '..', 'wordpress', 'data', 'latest');
const jsonDir = join(dumpDir, 'json');

if (!existsSync(jsonDir)) {
  console.error(`No JSON dump at ${jsonDir}.`);
  console.error('Set WP_DUMP_DIR in .env to point at a directory containing json/posts.json etc.');
  process.exit(1);
}

interface WpPost {
  ID: number;
  post_title: string;
  post_name: string;
  post_type: string;
  post_status: string;
  post_date: string;
  post_parent: number;
  post_author: number;
  post_content: string;
  featured_image_id?: number | null;
  meta?: Record<string, unknown>;
  terms?: Record<string, number[]>;
}
interface WpTerm { term_id: number; name: string; slug: string; parent_id?: number }

function readJson<T>(name: string): T | null {
  const p = join(jsonDir, `${name}.json`);
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : null;
}

const postsByType = new Map<string, WpPost[]>();
for (const file of readdirSync(jsonDir).filter(f => f.endsWith('.json'))) {
  if (['attachments.json', 'terms.json', 'users.json'].includes(file)) {
    continue;
  }
  const items = readJson<WpPost[]>(file.replace('.json', '')) ?? [];
  for (const item of items) {
    const list = postsByType.get(item.post_type) ?? [];
    list.push(item);
    postsByType.set(item.post_type, list);
  }
}

const terms = readJson<Record<string, WpTerm[]>>('terms') ?? {};

interface PostTypeInfo {
  fields: Map<string, FieldInfo>;
  topBlockNames: Set<string>;
}
interface BlockInfo {
  fields: Map<string, FieldInfo>;
  innerBlockNames: Set<string>;
}

const postTypeInfo = new Map<string, PostTypeInfo>();
const blockInfo = new Map<string, BlockInfo>();

interface FieldInfo {
  primitiveShapes: Set<string>;
  objectSamples: Record<string, unknown>[];
}

function createFieldInfo(): FieldInfo {
  return { primitiveShapes: new Set(), objectSamples: [] };
}

function shapeOf(v: unknown): string {
  if (v === null || v === undefined) {
    return 'null';
  }
  if (Array.isArray(v)) {
    return 'array';
  }
  if (typeof v === 'object') {
    return 'object';
  }
  if (typeof v === 'boolean') {
    return 'boolean';
  }
  if (typeof v === 'number') {
    return 'number';
  }
  if (typeof v === 'string') {
    if (/^https?:\/\//.test(v)) {
      if (/\.(jpe?g|png|gif|svg|webp|avif|pdf|mp4|webm|ogg|mp3|wav)(\?|#|$)/i.test(v)) {
        return 'url';
      }
      return 'link';
    }
    if (/^(\/|#|mailto:|tel:)/.test(v)) {
      return 'link';
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
      return 'datetime';
    }
    if (v.length > 200) {
      return 'longtext';
    }
    return 'string';
  }
  return typeof v;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function safeNamePart(name: string): string {
  return name.replace(/\W+/g, '_').replace(/^_+|_+$/g, '') || 'field';
}

function componentNameFor(ownerName: string, fieldName: string): string {
  return safeNamePart(`${ownerName}_${fieldName}`);
}

function getFieldInfo(fields: Map<string, FieldInfo>, key: string): FieldInfo {
  const existing = fields.get(key);
  if (existing) {
    return existing;
  }
  const created = createFieldInfo();
  fields.set(key, created);
  return created;
}

function recordFieldValue(fields: Map<string, FieldInfo>, key: string, value: unknown): void {
  if (value === undefined || value === null) {
    return;
  }
  const info = getFieldInfo(fields, key);
  if (isPlainObject(value)) {
    info.objectSamples.push(value);
    return;
  }
  info.primitiveShapes.add(shapeOf(value));
}

for (const [type, list] of postsByType) {
  const pt: PostTypeInfo = { fields: new Map(), topBlockNames: new Set() };
  postTypeInfo.set(type, pt);
  for (const post of list) {
    for (const [k, v] of Object.entries(post.meta ?? {})) {
      recordFieldValue(pt.fields, k, v);
    }
    if (post.featured_image_id) {
      getFieldInfo(pt.fields, 'featured_image').primitiveShapes.add('url');
    }
    if (!post.post_content) {
      continue;
    }
    const blocks = parseBlocks(post.post_content);
    for (const b of blocks) {
      if (isProseBlock(b)) {
        pt.topBlockNames.add('richtext');
      }
      else if (b.blockName) {
        pt.topBlockNames.add(effectiveBlockName(b));
      }
    }
    for (const b of walkBlocks(blocks)) {
      if (!b.blockName || isProseBlock(b)) {
        continue;
      }
      const name = effectiveBlockName(b);
      const bi = blockInfo.get(name) ?? { fields: new Map(), innerBlockNames: new Set() };
      blockInfo.set(name, bi);
      for (const [k, v] of Object.entries(b.attrs ?? {})) {
        if (k === 'id' || k === 'className' || k === 'style' || k === 'layout') {
          continue;
        }
        recordFieldValue(bi.fields, k, v);
      }
      for (const [k, raw] of Object.entries(extractInnerHtmlFields(b))) {
        const v = typeof raw === 'object' && raw !== null ? (raw as ExtractedField).value : raw;
        recordFieldValue(bi.fields, k, v);
      }
      for (const inner of b.innerBlocks) {
        if (!inner.blockName) {
          continue;
        }
        if (isProseBlock(inner)) {
          bi.innerBlockNames.add('richtext');
        }
        else {
          bi.innerBlockNames.add(effectiveBlockName(inner));
        }
      }
    }
  }
}

function camelize(s: string): string {
  const p = s.replace(/(?:^|[_-])(\w)/g, (_, c: string) => c.toUpperCase());
  return p.charAt(0).toLowerCase() + p.slice(1);
}

function fieldExpr(shapes: Set<string>): string {
  if (shapes.has('url')) {
    return `defineField({ type: 'asset', filetypes: ['images'] })`;
  }
  if (shapes.has('link')) {
    return `defineField({ type: 'multilink' })`;
  }
  if (shapes.has('datetime')) {
    return `defineField({ type: 'datetime' })`;
  }
  if (shapes.has('number')) {
    return `defineField({ type: 'number' })`;
  }
  if (shapes.has('boolean')) {
    return `defineField({ type: 'boolean' })`;
  }
  if (shapes.has('longtext')) {
    return `defineField({ type: 'textarea' })`;
  }
  return `defineField({ type: 'text' })`;
}

function writeComponentFile(
  fileBase: string,
  varName: string,
  componentName: string,
  props: string[],
  outputDir: string,
  options: { isRoot: boolean; isNestable: boolean },
): void {
  writeFileSync(join(outputDir, `${fileBase}.ts`), `// generated by discover-schema.ts — DO NOT EDIT
import { defineComponent, defineField, defineProp } from '@storyblok/schema';

export const ${varName} = defineComponent({
  name: '${componentName}',
  is_root: ${options.isRoot},
  is_nestable: ${options.isNestable},
  schema: {
${props.join('\n')}
  },
});
`);
}

function emitObjectComponent(
  ownerName: string,
  fieldName: string,
  samples: Record<string, unknown>[],
  emitted: Map<string, Emitted>,
  output: Emitted[],
  outputDir: string,
): Emitted {
  const componentName = componentNameFor(ownerName, fieldName);
  const existing = emitted.get(componentName);
  if (existing) {
    return existing;
  }

  const fileBase = componentName;
  const varName = `${camelize(fileBase)}Component`;
  const nestedFields = new Map<string, FieldInfo>();
  for (const sample of samples) {
    for (const [k, v] of Object.entries(sample)) {
      recordFieldValue(nestedFields, k, v);
    }
  }

  const props: string[] = [];
  let pos = 0;
  for (const [k, info] of nestedFields) {
    if (info.objectSamples.length > 0) {
      const nested = emitObjectComponent(componentName, k, info.objectSamples, emitted, output, outputDir);
      props.push(`    ${JSON.stringify(k)}: defineProp(defineField({ type: 'bloks', component_whitelist: [${JSON.stringify(nested.fileBase)}] }), { pos: ${pos++} }),`);
      continue;
    }
    props.push(`    ${JSON.stringify(k)}: defineProp(${fieldExpr(info.primitiveShapes)}, { pos: ${pos++} }),`);
  }

  const emittedEntry = { fileBase, varName };
  emitted.set(componentName, emittedEntry);
  writeComponentFile(fileBase, varName, componentName, props, outputDir, { isRoot: false, isNestable: true });
  output.push(emittedEntry);
  return emittedEntry;
}

function whitelistOf(names: Set<string>): string {
  return [...names].sort().map(n => JSON.stringify(n)).join(', ');
}

interface Emitted { fileBase: string; varName: string }

const componentsDir = resolve(projectRoot, 'src', 'schema', 'components');
const blocksDir = join(componentsDir, 'blocks');
const datasourcesDir = resolve(projectRoot, 'src', 'schema', 'datasources');
const blockComponents: Emitted[] = [];
const emittedNestables = new Map<string, Emitted>();

rmSync(componentsDir, { recursive: true, force: true });
rmSync(datasourcesDir, { recursive: true, force: true });
mkdirSync(blocksDir, { recursive: true });
mkdirSync(datasourcesDir, { recursive: true });

for (const [name, bi] of blockInfo) {
  const fileBase = name;
  const varName = `${camelize(name)}Component`;
  blockComponents.push({ fileBase, varName });

  const hasImageAsset = [...bi.fields.values()].some(f => f.primitiveShapes.has('url'));
  const props: string[] = [];
  let pos = 0;
  for (const [k, info] of bi.fields) {
    if (k === 'alt' && hasImageAsset) {
      continue;
    }
    if (info.objectSamples.length > 0) {
      const nested = emitObjectComponent(name, k, info.objectSamples, emittedNestables, blockComponents, blocksDir);
      props.push(`    ${JSON.stringify(k)}: defineProp(defineField({ type: 'bloks', component_whitelist: [${JSON.stringify(nested.fileBase)}] }), { pos: ${pos++} }),`);
      continue;
    }
    props.push(`    ${JSON.stringify(k)}: defineProp(${fieldExpr(info.primitiveShapes)}, { pos: ${pos++} }),`);
  }
  if (bi.innerBlockNames.size > 0) {
    props.push(`    body: defineProp(defineField({ type: 'bloks', component_whitelist: [${whitelistOf(bi.innerBlockNames)}] }), { pos: ${pos++} }),`);
  }
  writeComponentFile(fileBase, varName, name, props, blocksDir, { isRoot: false, isNestable: true });
}

// Always emit the virtual `richtext` nestable
blockComponents.push({ fileBase: 'richtext', varName: 'richtextComponent' });
writeFileSync(join(blocksDir, 'richtext.ts'), `// generated by discover-schema.ts — DO NOT EDIT
import { defineComponent, defineField, defineProp } from '@storyblok/schema';

export const richtextComponent = defineComponent({
  name: 'richtext',
  is_root: false,
  is_nestable: true,
  schema: {
    body: defineProp(defineField({ type: 'richtext' }), { pos: 0 }),
  },
});
`);

const postTypeComponents: Emitted[] = [];

for (const [type, info] of postTypeInfo) {
  const fileBase = safeBlockName(type);
  const varName = `${camelize(fileBase)}Component`;
  postTypeComponents.push({ fileBase, varName });

  const props: string[] = [];
  let pos = 0;
  for (const [k, fieldInfo] of info.fields) {
    if (fieldInfo.objectSamples.length > 0) {
      const nested = emitObjectComponent(fileBase, k, fieldInfo.objectSamples, emittedNestables, blockComponents, blocksDir);
      props.push(`    ${JSON.stringify(k)}: defineProp(defineField({ type: 'bloks', component_whitelist: [${JSON.stringify(nested.fileBase)}] }), { pos: ${pos++} }),`);
      continue;
    }
    props.push(`    ${JSON.stringify(k)}: defineProp(${fieldExpr(fieldInfo.primitiveShapes)}, { pos: ${pos++} }),`);
  }
  // Always include a body field, even if no top-level blocks were found (admins can still add bloks).
  const wl = info.topBlockNames.size > 0 ? whitelistOf(info.topBlockNames) : whitelistOf(new Set(['richtext']));
  props.push(`    body: defineProp(defineField({ type: 'bloks', component_whitelist: [${wl}] }), { pos: ${pos++} }),`);

  writeComponentFile(fileBase, varName, type, props, componentsDir, { isRoot: true, isNestable: false });
}

const datasources: Emitted[] = [];
for (const tax of Object.keys(terms)) {
  const fileBase = tax.replace(/\W/g, '_');
  const varName = `${camelize(fileBase)}Datasource`;
  datasources.push({ fileBase, varName });

  const termList = terms[tax];
  const entryLines = termList.map(t =>
    `    defineDatasourceEntry({ name: '${t.name.replace(/'/g, "\\'")}', value: '${t.slug.replace(/'/g, "\\'")}' }),`,
  ).join('\n');

  writeFileSync(join(datasourcesDir, `${fileBase}.ts`), `// generated by discover-schema.ts — DO NOT EDIT
import { defineDatasource, defineDatasourceEntry } from '@storyblok/schema';

export const ${varName} = {
  ...defineDatasource({
    name: '${tax}',
    slug: '${fileBase}',
  }),
  entries: [
${entryLines}
  ],
};
`);
}

// schema.ts aggregator
const schemaImports = [
  ...postTypeComponents.map(({ fileBase, varName }) => `import { ${varName} } from './components/${fileBase}';`),
  ...blockComponents.map(({ fileBase, varName }) => `import { ${varName} } from './components/blocks/${fileBase}';`),
  ...datasources.map(({ fileBase, varName }) => `import { ${varName} } from './datasources/${fileBase}';`),
].join('\n');

const componentsList = [...postTypeComponents, ...blockComponents].map(({ varName }) => `    ${varName},`).join('\n');
const datasourcesList = datasources.map(({ varName }) => `    ${varName},`).join('\n');

writeFileSync(resolve(projectRoot, 'src', 'schema', 'schema.ts'), `// generated by discover-schema.ts — DO NOT EDIT
${schemaImports}

export const schema = {
  components: {
${componentsList}
  },
  componentFolders: {},
  datasources: {
${datasourcesList}
  },
};
`);

console.info(`Discovered:`);
console.info(`  Post types:   ${postTypeComponents.length} (${postTypeComponents.map(c => c.fileBase).join(', ')})`);
console.info(`  Blocks:       ${blockComponents.length} (incl. virtual 'richtext')`);
console.info(`  Datasources:  ${datasources.length}`);
console.info(`Wrote: src/schema/{components,components/blocks,datasources}/*.ts and schema.ts`);
