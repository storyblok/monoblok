#!/usr/bin/env tsx

import { createClient } from '@hey-api/openapi-ts';
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'pathe';
import { fileURLToPath } from 'node:url';
import { glob } from 'glob';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..');
const SPEC_DIR = resolve(repoRoot, '.openapi-cache/capi');

/**
 * After @hey-api/openapi-ts generates per-resource client/ and core/ directories
 * (which are byte-for-byte identical across all resources), consolidate them into
 * a single src/generated/shared/ directory and rewrite per-resource imports to
 * point there. This eliminates ~5x duplication in the dist/ output.
 */
function deduplicateSharedCode(generatedDir: string, resourceNames: string[]) {
  if (resourceNames.length === 0) {
    return;
  }

  const sharedDir = resolve(generatedDir, 'shared');
  const firstResource = resourceNames[0];

  // Copy client/ and core/ from the first resource into shared/
  for (const subdir of ['client', 'core']) {
    cpSync(resolve(generatedDir, firstResource, subdir), resolve(sharedDir, subdir), { recursive: true });
  }

  // For every resource: delete its client/ and core/ and rewrite imports
  for (const resource of resourceNames) {
    const resourceDir = resolve(generatedDir, resource);

    // Remove duplicate client/ and core/
    for (const subdir of ['client', 'core']) {
      rmSync(resolve(resourceDir, subdir), { recursive: true, force: true });
    }

    // Rewrite imports in client.gen.ts and sdk.gen.ts:
    //   from './client'  →  from '../shared/client'
    for (const fileName of ['client.gen.ts', 'sdk.gen.ts']) {
      const filePath = resolve(resourceDir, fileName);
      const original = readFileSync(filePath, 'utf8');
      if (!original.includes('from \'./client\'')) {
        throw new Error(
          `Expected "from './client'" in ${filePath} but it was not found. `
          + `The generator may have changed its import style — update deduplicateSharedCode accordingly.`,
        );
      }
      const rewritten = original.split('from \'./client\'').join('from \'../shared/client\'');
      writeFileSync(filePath, rewritten, 'utf8');
    }
  }
}

async function main() {
  if (!existsSync(SPEC_DIR)) {
    throw new Error(
      `OpenAPI cache not found at ${SPEC_DIR}. Run \`pnpm fetch:specs\` from the repo root first.`,
    );
  }

  rmSync(resolve(__dirname, '../src/generated'), { recursive: true, force: true });

  const yamlFiles = await glob('*.yaml', { cwd: SPEC_DIR });

  if (yamlFiles.length === 0) {
    console.log(`No YAML files found in ${SPEC_DIR}`);
    return;
  }

  const resourceNames: string[] = [];

  for (const yamlFile of yamlFiles) {
    const resourcePath = resolve(SPEC_DIR, yamlFile);
    const resourceName = basename(yamlFile, '.yaml');
    resourceNames.push(resourceName);

    await createClient({
      input: resourcePath,
      output: resolve(__dirname, `../src/generated/${resourceName}`),
      plugins: [
        '@hey-api/typescript',
        '@hey-api/client-ky',
        {
          name: '@hey-api/sdk',
        },
      ],
    });

    console.log(`Generated SDK for ${resourceName}`);
  }

  console.log(`Generated ${yamlFiles.length} SDKs: ${yamlFiles.map(f => basename(f, '.yaml')).join(', ')}`);

  // Deduplicate shared client/ and core/ boilerplate
  deduplicateSharedCode(resolve(__dirname, '../src/generated'), resourceNames);
  console.log('Deduplicated shared client/core into src/generated/shared/');
}

main().catch((error) => {
  console.error('Generation failed:', error);
  process.exit(1);
});
