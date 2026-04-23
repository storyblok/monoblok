/**
 * Reads the WordPress JSON dump and emits one TypeScript file per story / asset.
 *
 * Outputs (idempotent — wholesale-overwrites generated files; persistent IDs/UUIDs come from the registry):
 *   .storyblok/migration/wordpress/generated/stories/<post_type>/<slug>.ts
 *   .storyblok/migration/wordpress/generated/assets/<basename>.ts
 *   .storyblok/migration/wordpress/generated/refs.ts
 *   .storyblok/.registry.json
 */
import 'dotenv/config';

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { urlToAssetField, urlToLink, type AssetFieldValue, type MultilinkFieldValue } from '@storyblok/migrations';

import { mapBlocks, safeBlockName } from './_block-mapper.js';
import { Registry } from './_registry.js';
import { parseBlocks } from './_wp-blocks.js';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..', '..', '..', '..');
const dumpDir = process.env.WP_DUMP_DIR
  ? resolve(projectRoot, process.env.WP_DUMP_DIR)
  : resolve(projectRoot, '..', 'wordpress', 'data', 'latest');
const jsonDir = join(dumpDir, 'json');
const registryPath = resolve(projectRoot, '.storyblok', '.registry.json');
const migrationRoot = resolve(projectRoot, '.storyblok', 'migration', 'wordpress');
const generatedDir = resolve(migrationRoot, 'generated');

if (!existsSync(jsonDir)) {
  console.error(`No JSON dump at ${jsonDir}.`);
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
interface WpAttachment {
  ID: number;
  guid?: string;
  mime?: string;
  alt?: string;
  focal_x?: number | null;
  focal_y?: number | null;
  file_path?: string;
}

function readJson<T>(name: string): T | null {
  const p = join(jsonDir, `${name}.json`);
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : null;
}

const posts: WpPost[] = [];
for (const file of readdirSync(jsonDir).filter(f => f.endsWith('.json'))) {
  if (['attachments.json', 'terms.json', 'users.json'].includes(file)) {
    continue;
  }
  posts.push(...(readJson<WpPost[]>(file.replace('.json', '')) ?? []));
}
const attachments = readJson<WpAttachment[]>('attachments') ?? [];
const postById = new Map(posts.map(p => [p.ID, p]));

const registry = Registry.load(registryPath);
const postKey = (p: WpPost) => `wp:${p.post_type}:${p.ID}`;
const folderKey = (p: WpPost) => `wp-folder:${p.post_type}:${p.ID}`;
const assetKey = (a: WpAttachment) => `wp:attachment:${a.ID}`;
const childCounts = new Map<number, number>();

for (const p of posts) {
  if (p.post_parent && postById.has(p.post_parent)) {
    childCounts.set(p.post_parent, (childCounts.get(p.post_parent) ?? 0) + 1);
  }
}

const needsFolder = (p: WpPost): boolean => (childCounts.get(p.ID) ?? 0) > 0;

// Pass 1: mint everything so cross-refs always resolve in pass 2.
for (const p of posts) {
  registry.mintStory(postKey(p));
  if (needsFolder(p)) {
    registry.mintStory(folderKey(p));
  }
}
for (const a of attachments) {
  registry.mintAsset(assetKey(a));
}

function camelize(s: string): string {
  const p = s.replace(/(?:^|[_-])(\w)/g, (_, c: string) => c.toUpperCase());
  const lower = p.charAt(0).toLowerCase() + p.slice(1);
  return /^[A-Z_$]/i.test(lower) ? lower : `_${lower}`;
}

function safeBase(s: string, fallback: string): string {
  const cleaned = (s || '').replace(/[^\w-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned || fallback;
}

function safePathBase(s: string, fallback: string): string {
  return safeBase(s.replace(/\//g, '__'), fallback);
}

function modulePath(fromDir: string, toFileWithoutExt: string): string {
  const path = relative(fromDir, toFileWithoutExt).replace(/\\/g, '/');
  return path.startsWith('.') ? path : `./${path}`;
}

function basenameFromGuid(guid: string | undefined, id: number): string {
  if (!guid) {
    return `att-${id}`;
  }
  const clean = guid.split('?')[0] ?? '';
  const filename = clean.split('/').filter(Boolean).at(-1) ?? `att-${id}`;
  const stem = filename.replace(/\.[a-z0-9]+$/i, '');
  return safeBase(stem, `att-${id}`);
}

const storiesDir = resolve(generatedDir, 'stories');
const assetsDir = resolve(generatedDir, 'assets');
rmSync(generatedDir, { recursive: true, force: true });
mkdirSync(storiesDir, { recursive: true });
mkdirSync(assetsDir, { recursive: true });

interface AssetEntry {
  shortKey: string;
  varName: string;
  fileBase: string;
  wpId: number;
  id: number;
  uuid: string;
  filename: string;
  alt: string;
  contentType: string;
  filePath?: string;
}

const assetEntries: AssetEntry[] = [];
const assetEntryByWpId = new Map<number, AssetEntry>();
const assetEntryByUrl = new Map<string, AssetEntry>();
const usedAssetBases = new Set<string>();
for (const a of attachments) {
  const ids = registry.getAsset(assetKey(a))!;
  let fileBase = basenameFromGuid(a.guid, a.ID);
  while (usedAssetBases.has(fileBase)) {
    fileBase = `${fileBase}-${a.ID}`;
  }
  usedAssetBases.add(fileBase);
  const varName = `${camelize(fileBase)}Asset`;
  const filename = a.guid ?? '';
  const alt = a.alt ?? '';
  assetEntries.push({
    shortKey: fileBase,
    varName,
    fileBase,
    wpId: a.ID,
    id: ids.id,
    uuid: ids.uuid,
    filename,
    alt,
    contentType: a.mime ?? 'application/octet-stream',
    filePath: a.file_path,
  });
  const assetEntry = assetEntries.at(-1)!;
  assetEntryByWpId.set(a.ID, assetEntry);
  for (const key of assetLookupKeys(a)) {
    assetEntryByUrl.set(key, assetEntry);
  }

  const assetObj = {
    id: ids.id,
    uuid: ids.uuid,
    filename,
    title: alt,
    focus_x: a.focal_x ?? null,
    focus_y: a.focal_y ?? null,
  };
  writeFileSync(join(assetsDir, `${fileBase}.ts`), `// generated by generate-stories.ts — DO NOT EDIT
import { defineAsset } from '@storyblok/schema';

export const ${varName} = defineAsset(${JSON.stringify(assetObj, null, 2)});
`);
}

function stripSizeSuffix(name: string): string {
  return name.replace(/-\d+x\d+(?=\.[a-z0-9]+(?:$|\?))/i, '');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeAssetLookupKey(value: string): string {
  const clean = decodeURIComponent(value).split(/[?#]/)[0] ?? '';
  return stripSizeSuffix(clean).replace(/^https?:\/\/[^/]+\/wp-content\/uploads\//i, '').replace(/^.*\/wp-content\/uploads\//i, '');
}

function safeNamePart(name: string): string {
  return name.replace(/[^\w-]/g, '_').replace(/-+/g, '_').replace(/^_+|_+$/g, '') || 'field';
}

function objectComponentName(ownerName: string, fieldName: string): string {
  return safeNamePart(`${ownerName}_${fieldName}`);
}

function assetLookupKeys(a: WpAttachment): string[] {
  const keys = new Set<string>();
  if (a.file_path) {
    keys.add(normalizeAssetLookupKey(a.file_path));
  }
  if (a.guid) {
    keys.add(normalizeAssetLookupKey(a.guid));
  }
  return [...keys].filter(Boolean);
}

function storyblokAssetField(entry: AssetEntry): AssetFieldValue {
  const name = entry.filePath?.split('/').pop() ?? entry.filename.split('/').pop() ?? entry.fileBase;
  return {
    ...urlToAssetField(entry.filename, {
      alt: entry.alt,
      name,
      title: entry.alt,
      source: '',
      copyright: '',
      focus: '',
      meta_data: {
        alt: entry.alt,
        title: entry.alt,
        source: '',
        copyright: '',
      },
      is_external_url: false,
    }),
    id: entry.id,
  };
}

function assetForBlockAttr(_key: string, value: unknown, wpAttachmentId?: number): AssetFieldValue | null {
  if (typeof value !== 'string' || !/^https?:\/\//.test(value)) {
    return null;
  }
  const byWpId = wpAttachmentId ? assetEntryByWpId.get(wpAttachmentId) : undefined;
  const byUrl = assetEntryByUrl.get(normalizeAssetLookupKey(value));
  const entry = byWpId ?? byUrl;
  if (!entry) {
    return null;
  }
  return storyblokAssetField(entry);
}

function mapObjectFieldValue(parentComponent: string, fieldName: string, value: unknown): unknown {
  if (!isPlainObject(value)) {
    return value;
  }

  const component = objectComponentName(parentComponent, fieldName);
  const content: Record<string, unknown> = { component };
  for (const [key, childValue] of Object.entries(value)) {
    if (childValue === undefined || childValue === null) {
      continue;
    }
    content[key] = mapStoryValue(component, key, childValue);
  }
  return [content];
}

function isStoryblokFieldValue(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  if ('fieldtype' in value) return true;
  if (value.type === 'doc' && Array.isArray(value.content)) return true;
  return false;
}

function mapStoryValue(parentComponent: string, fieldName: string, value: unknown): unknown {
  if (isPlainObject(value) && !isStoryblokFieldValue(value)) {
    return mapObjectFieldValue(parentComponent, fieldName, value);
  }
  if (Array.isArray(value)) {
    return value.map(item => (isPlainObject(item) && !isStoryblokFieldValue(item) ? mapObjectFieldValue(parentComponent, fieldName, item) : item));
  }
  return value;
}

function mapBlokContent(componentName: string, blok: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...blok };
  for (const [key, value] of Object.entries(blok)) {
    if (key === 'component' || value === undefined || value === null) {
      continue;
    }
    out[key] = mapStoryValue(componentName, key, value);
  }
  if (Array.isArray(blok.body)) {
    out.body = blok.body.map(item => (isPlainObject(item) ? mapBlokContent(String(item.component ?? componentName), item) : item));
  }
  return out;
}

interface StoryEntry {
  shortKey: string;
  varName: string;
  id: number;
  uuid: string;
  slug: string;
  full_slug: string;
}

const storyEntries: StoryEntry[] = [];
const usedStoryBases = new Set<string>();

function slugForPost(p: WpPost): string {
  return safeBase(p.post_name, `post-${p.ID}`);
}

function ancestorsFor(p: WpPost): WpPost[] {
  const ancestors: WpPost[] = [];
  const seen = new Set<number>();
  let current: WpPost | undefined = p;

  while (current) {
    if (seen.has(current.ID)) {
      console.warn(`Cycle detected in WordPress post_parent chain at post ${current.ID}; truncating ancestry.`);
      break;
    }
    seen.add(current.ID);
    ancestors.unshift(current);
    current = current.post_parent ? postById.get(current.post_parent) : undefined;
  }

  return ancestors;
}

function fullSlugForPost(p: WpPost): string {
  return ancestorsFor(p).map(slugForPost).join('/');
}

const storyBySlug = new Map<string, { uuid: string; full_slug: string }>();
for (const p of posts) {
  const fullSlug = fullSlugForPost(p);
  const ids = registry.getStory(postKey(p))!;
  storyBySlug.set(fullSlug, { uuid: ids.uuid, full_slug: fullSlug });
}

function normalizeWpLink(href: string): string {
  return href
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/^\/+|\/+$/g, '');
}

function linkForValue(value: string): MultilinkFieldValue | null {
  if (!/^(\/|#|mailto:|https?:\/\/)/.test(value)) {
    return null;
  }
  const normalized = normalizeWpLink(value);
  const match = storyBySlug.get(normalized);
  if (match) {
    return {
      id: match.uuid,
      url: '',
      linktype: 'story',
      fieldtype: 'multilink',
      cached_url: match.full_slug,
    };
  }
  return urlToLink(value);
}

function parentFolderIdsForPost(p: WpPost): { id: number; uuid: string } | undefined {
  const parent = p.post_parent ? postById.get(p.post_parent) : undefined;
  return parent && needsFolder(parent) ? registry.getStory(folderKey(parent)) : undefined;
}

function reserveStoryFileBase(base: string, id: number): string {
  let fileBase = safePathBase(base, `story-${id}`);
  while (usedStoryBases.has(fileBase)) {
    fileBase = `${fileBase}-${id}`;
  }
  usedStoryBases.add(fileBase);
  return fileBase;
}

function writeFolderStory(p: WpPost): void {
  const ids = registry.getStory(folderKey(p))!;
  const typeDir = join(storiesDir, p.post_type);
  mkdirSync(typeDir, { recursive: true });
  const slug = slugForPost(p);
  const full_slug = fullSlugForPost(p);
  const fileBase = reserveStoryFileBase(`${full_slug}__folder`, ids.id);
  const varName = `${camelize(fileBase)}FolderStory`;
  const parentIds = parentFolderIdsForPost(p);
  const story: Record<string, unknown> = {
    id: ids.id,
    uuid: ids.uuid,
    name: p.post_title || slug,
    slug,
    full_slug,
    is_folder: true,
    ...(parentIds ? { parent_id: parentIds.id } : {}),
  };
  storyEntries.push({ shortKey: folderKey(p), varName, id: ids.id, uuid: ids.uuid, slug, full_slug });

  writeFileSync(join(typeDir, `${fileBase}.ts`), `// generated by generate-stories.ts — DO NOT EDIT
import { defineFolderStory } from '@storyblok/schema';

export const ${varName} = defineFolderStory(${JSON.stringify(story, null, 2)});
`);
}

function writeContentStory(p: WpPost): void {
  const ids = registry.getStory(postKey(p))!;
  const typeDir = join(storiesDir, p.post_type);
  mkdirSync(typeDir, { recursive: true });
  const hasFolder = needsFolder(p);
  const wpFullSlug = fullSlugForPost(p);
  const slug = hasFolder ? 'index' : slugForPost(p);
  const full_slug = hasFolder ? `${wpFullSlug}/index` : wpFullSlug;
  const fileBase = reserveStoryFileBase(full_slug, ids.id);
  const varName = `${camelize(fileBase)}Story`;
  storyEntries.push({ shortKey: postKey(p), varName, id: ids.id, uuid: ids.uuid, slug, full_slug });

  const wpBlocks = parseBlocks(p.post_content || '');
  const body = mapBlocks(wpBlocks, { assetForBlockAttr, linkForValue });
  const mappedBody = body.map(blok => mapBlokContent(String(blok.component), blok));

  const componentVar = `${camelize(safeBlockName(p.post_type))}Component`;
  const componentImportPath = modulePath(typeDir, resolve(projectRoot, 'src', 'schema', 'components', safeBlockName(p.post_type)));
  const parentIds = hasFolder ? registry.getStory(folderKey(p)) : parentFolderIdsForPost(p);

  const content: Record<string, unknown> = {
    ...Object.fromEntries(Object.entries(p.meta ?? {}).map(([key, value]) => [key, mapStoryValue(safeBlockName(p.post_type), key, value)])),
    body: mappedBody,
  };
  if (p.featured_image_id) {
    const entry = assetEntryByWpId.get(p.featured_image_id);
    if (entry) {
      content.featured_image = storyblokAssetField(entry);
    }
  }
  const story: Record<string, unknown> = {
    id: ids.id,
    uuid: ids.uuid,
    name: p.post_title,
    slug,
    full_slug,
    published_at: p.post_date,
    ...(parentIds ? { parent_id: parentIds.id } : {}),
    ...(hasFolder ? { is_startpage: true } : {}),
    content,
  };

  writeFileSync(join(typeDir, `${fileBase}.ts`), `// generated by generate-stories.ts — DO NOT EDIT
import { defineStory } from '@storyblok/schema';

import { ${componentVar} } from '${componentImportPath}';

export const ${varName} = defineStory(${componentVar}, ${JSON.stringify(story, null, 2)});
`);
}

for (const p of posts) {
  if (needsFolder(p)) {
    writeFolderStory(p);
  }
  writeContentStory(p);
}

const refsObj = {
  stories: Object.fromEntries(storyEntries.map(e => [e.shortKey, { id: e.id, uuid: e.uuid, slug: e.slug, full_slug: e.full_slug }])),
  assets: Object.fromEntries(assetEntries.map(e => [e.shortKey, { id: e.id, uuid: e.uuid, filename: e.filename, alt: e.alt }])),
};
writeFileSync(resolve(generatedDir, 'refs.ts'), `// generated by generate-stories.ts — DO NOT EDIT
// Cross-reference lookup table populated from the registry.

export const refs = ${JSON.stringify(refsObj, null, 2)} as const;
`);

registry.save();

// Stash asset metadata so build-seed.ts can copy binaries without rewalking the dump.
writeFileSync(resolve(migrationRoot, 'asset-binaries.json'), JSON.stringify({
  uploadsDir: dumpDir,
  entries: assetEntries.map(e => ({
    fileBase: e.fileBase,
    wpId: e.wpId,
    uuid: e.uuid,
    contentType: e.contentType,
    filePath: e.filePath,
    alt: e.alt,
    id: e.id,
  })),
}, null, 2));

console.info(`Generated:`);
console.info(`  Stories:  ${storyEntries.length}`);
console.info(`  Assets:   ${assetEntries.length}`);
console.info(`  Registry: ${registryPath}`);
