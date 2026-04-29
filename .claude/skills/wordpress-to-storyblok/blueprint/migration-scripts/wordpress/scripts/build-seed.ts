/**
 * Imports schema from src/schema/** plus temporary story/asset modules from
 * .storyblok/migration/wordpress/generated/** and writes the JSON files the
 * storyblok CLI expects under .storyblok/<type>/wordpress/.
 *
 * Idempotent: wipes regenerable output directories at the top, but **preserves** the CLI-owned
 * `manifest.jsonl` files (the local→remote ID map). Re-runs produce byte-identical output for
 * the same dump + same registry.
 */
import 'dotenv/config';

import { execFile } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..', '..', '..', '..');
const SOURCE = 'wordpress';
const sbDir = resolve(projectRoot, '.storyblok');
const migrationRoot = resolve(sbDir, 'migration', SOURCE);
const generatedDir = resolve(migrationRoot, 'generated');

const execFileP = promisify(execFile);

function walkTs(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name.startsWith('_')) {
      continue;
    }
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...walkTs(full));
    }
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

async function importAll<T = unknown>(files: string[]): Promise<T[]> {
  const out: T[] = [];
  for (const file of files) {
    const mod = await import(pathToFileURL(file).href);
    for (const v of Object.values(mod)) {
      if (v && typeof v === 'object') {
        out.push(v as T);
      }
    }
  }
  return out;
}

/** Wipes a directory but keeps the CLI's `manifest.jsonl` if present. */
function wipeKeepManifest(dir: string) {
  if (!existsSync(dir)) {
    return;
  }
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'manifest.jsonl') {
      continue;
    }
    rmSync(join(dir, e.name), { recursive: true, force: true });
  }
}

const componentsOutDir = join(sbDir, 'components', SOURCE);
const storiesOutDir = join(sbDir, 'stories', SOURCE);
const assetsOutDir = join(sbDir, 'assets', SOURCE);
const datasourcesOutDir = join(sbDir, 'datasources', SOURCE);

wipeKeepManifest(componentsOutDir);
wipeKeepManifest(storiesOutDir);
wipeKeepManifest(assetsOutDir);
wipeKeepManifest(datasourcesOutDir);
mkdirSync(componentsOutDir, { recursive: true });
mkdirSync(storiesOutDir, { recursive: true });
mkdirSync(assetsOutDir, { recursive: true });
mkdirSync(datasourcesOutDir, { recursive: true });

// 1) Components — one aggregated `components.json` (matches qwik playground convention).
const componentFiles = walkTs(resolve(projectRoot, 'src', 'schema', 'components'));
const components = await importAll(componentFiles);
writeFileSync(join(componentsOutDir, 'components.json'), `${JSON.stringify(components, null, 2)}\n`);

// 2) Datasources — one aggregated `datasources.json`.
const datasourceFiles = walkTs(resolve(projectRoot, 'src', 'schema', 'datasources'));
const datasources = await importAll(datasourceFiles);
writeFileSync(join(datasourcesOutDir, 'datasources.json'), `${JSON.stringify(datasources, null, 2)}\n`);

// 3) Stories — one file per story; filename suffix is the UUID (CLI parses it via split('_').at(-1)).
const storyFiles = walkTs(resolve(generatedDir, 'stories'));
const stories = await importAll<{ slug: string; uuid: string }>(storyFiles);
for (const story of stories) {
  writeFileSync(join(storiesOutDir, `${story.slug}_${story.uuid}.json`), `${JSON.stringify(story, null, 2)}\n`);
}

// 4) Assets — JSON sidecar + binary copy.
const assetFiles = walkTs(resolve(generatedDir, 'assets'));
const assets = await importAll<{ uuid: string; id: number; filename: string; title: string }>(assetFiles);

interface BinMeta {
  uploadsDir: string;
  entries: Array<{ fileBase: string; uuid: string; contentType: string; filePath?: string; alt?: string; id: number }>;
}
const binMetaPath = resolve(migrationRoot, 'asset-binaries.json');
const binMeta = existsSync(binMetaPath) ? (JSON.parse(readFileSync(binMetaPath, 'utf8')) as BinMeta) : null;

async function ensureUploads(uploadsDir: string): Promise<string | null> {
  // dump.sh archives `wp-content/uploads`, so the tarball's internal root is `wp-content/uploads/`.
  const candidates = [join(uploadsDir, 'wp-content', 'uploads'), join(uploadsDir, 'uploads')];
  for (const c of candidates) {
    if (existsSync(c)) {
      return c;
    }
  }
  const tarball = join(uploadsDir, 'uploads.tar.gz');
  if (!existsSync(tarball)) {
    return null;
  }
  console.info(`Extracting ${tarball}...`);
  await execFileP('tar', ['-xzf', tarball, '-C', uploadsDir]);
  for (const c of candidates) {
    if (existsSync(c)) {
      return c;
    }
  }
  return null;
}

const extractedUploads = binMeta ? await ensureUploads(binMeta.uploadsDir) : null;
const missingAssetBinaries: string[] = [];

for (const asset of assets) {
  const meta = binMeta?.entries.find(e => e.uuid === asset.uuid);
  const stem = `${meta?.fileBase ?? 'asset'}_${asset.uuid}`;
  const sidecar = {
    id: asset.id,
    alt: meta?.alt ?? asset.title ?? '',
    asset_folder_id: null,
    content_type: meta?.contentType ?? 'application/octet-stream',
    is_private: false,
    short_filename: meta?.filePath?.split('/').pop() ?? meta?.fileBase ?? '',
    title: asset.title ?? '',
  };
  writeFileSync(join(assetsOutDir, `${stem}.json`), `${JSON.stringify(sidecar, null, 2)}\n`);
  if (!meta?.filePath) {
    continue;
  }
  if (!extractedUploads) {
    missingAssetBinaries.push(`uploads root missing for ${meta.filePath}`);
    continue;
  }
  const srcBin = join(extractedUploads, meta.filePath);
  if (existsSync(srcBin)) {
    copyFileSync(srcBin, join(assetsOutDir, `${stem}${extname(srcBin)}`));
  }
  else {
    missingAssetBinaries.push(srcBin);
  }
}

if (missingAssetBinaries.length > 0) {
  console.error('Missing WordPress upload binaries for generated assets:');
  for (const missing of missingAssetBinaries) {
    console.error(`  ${missing}`);
  }
  console.error(`Restore uploads to ${binMeta?.uploadsDir}/uploads or ${binMeta?.uploadsDir}/wp-content/uploads, then rerun pnpm wp:build.`);
  process.exit(1);
}

// 5) source-manifest.json — generator-side bookkeeping, distinct from the CLI's manifest.jsonl.
writeFileSync(resolve(sbDir, 'source-manifest.json'), `${JSON.stringify({
  built_at: new Date().toISOString(),
  source: SOURCE,
  counts: {
    components: components.length,
    datasources: datasources.length,
    stories: stories.length,
    assets: assets.length,
  },
}, null, 2)}\n`);

console.info(`Built into .storyblok/<type>/${SOURCE}/:`);
console.info(`  components:  ${components.length}`);
console.info(`  datasources: ${datasources.length}`);
console.info(`  stories:     ${stories.length}`);
console.info(`  assets:      ${assets.length}`);
