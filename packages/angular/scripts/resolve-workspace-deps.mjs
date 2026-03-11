/**
 * Resolve workspace:* dependencies in dist/package.json
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const distPkgPath = resolve(__dirname, '../dist/package.json');
const packagesDir = resolve(__dirname, '../../');

const distPkg = JSON.parse(readFileSync(distPkgPath, 'utf8'));

/**
 * Build workspace package map
 */
const workspaceVersions = {};

for (const dir of readdirSync(packagesDir)) {
  const pkgPath = resolve(packagesDir, dir, 'package.json');
  if (!existsSync(pkgPath)) continue;

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  workspaceVersions[pkg.name] = pkg.version;
}

/**
 * Dependency sections to check
 */
const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

for (const section of sections) {
  const deps = distPkg[section];
  if (!deps) continue;

  for (const [name, version] of Object.entries(deps)) {
    if (typeof version !== 'string' || !version.startsWith('workspace:')) continue;

    const resolved = workspaceVersions[name];

    if (!resolved) {
      console.warn(`⚠ Could not resolve ${name}`);
      continue;
    }

    deps[name] = `^${resolved}`;
    console.log(`Resolved ${name} → ^${resolved}`);
  }
}

writeFileSync(distPkgPath, JSON.stringify(distPkg, null, 2) + '\n');

console.log('Workspace dependencies resolved.');
