import { fileURLToPath } from 'node:url';
import { dirname } from 'pathe';
import type { NormalizedPackageJson } from 'read-package-up';
import { readPackageUp } from 'read-package-up';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for metadata
const result = await readPackageUp({
  cwd: __dirname,
});

const packageJson: NormalizedPackageJson = result
  ? result.packageJson
  : ({
      name: 'storyblok',
      description: 'Storyblok CLI',
      version: '0.0.0',
    } as NormalizedPackageJson);

if (!result) {
  console.debug('Metadata not found');
}

/**
 * Get the package.json metadata
 *
 * @export
 * @return {NormalizedPackageJson}
 */
export function getPackageJson(): NormalizedPackageJson {
  return packageJson;
}

export { packageJson as pkg };
