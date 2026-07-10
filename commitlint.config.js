import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Commit scopes derived from the folders under `packages/`, so the list stays
// in sync automatically as packages are added or removed.
const packagesDir = join(dirname(fileURLToPath(import.meta.url)), 'packages');
const packageScopes = readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

// Scopes for changes that don't belong to a single package (root config,
// tooling, CI, docs, agent skills, automated releases). These are intentionally
// NOT packages, so such commits bump no package version.
const metaScopes = ['release', 'repo', 'deps', 'ci', 'docs', 'tools', 'agents'];

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-max-line-length': [2, 'always', 200],
    // A scope is mandatory. Nx attributes an *unscoped* commit that touches
    // non-project files (e.g. `.agents/`, root config) to EVERY package, which
    // bumps the version of packages that had no actual change. Requiring a
    // scope prevents that accidental workspace-wide fan-out.
    'scope-empty': [2, 'never'],
    // Comma-separated scopes are allowed, e.g. `feat(cli,mapi-client): ...`.
    'scope-enum': [2, 'always', [...packageScopes, ...metaScopes]],
  },
};
