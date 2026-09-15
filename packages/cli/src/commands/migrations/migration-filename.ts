import { createHash } from "node:crypto";
import { sanitizeFilename } from "../../utils/filesystem";

/**
 * Migration files are named `<component>[.<suffix>].js`. A component name is
 * unconstrained remote data, so it is sanitized before it becomes a file name.
 * Sanitizing is many-to-one — `hero:v2`, `hero/v2` and `hero?v2` all collapse to
 * `hero_v2` — so a name the sanitizer altered carries a digest of the original
 * to keep distinct components on distinct file names.
 *
 * Names are compared in NFC because the sanitizer emits NFD while the API
 * returns NFC, and macOS stores either.
 */
const DIGEST_LENGTH = 6;

const prefixCache = new Map<string, string>();

/**
 * The file name a component's migrations live under, without the `.js`
 * extension or an optional suffix. Empty when the component name cannot be
 * mapped to a file name at all.
 */
export const getMigrationComponentPrefix = (componentName: string): string => {
  const cached = prefixCache.get(componentName);
  if (cached !== undefined) {
    return cached;
  }

  const normalizedName = componentName.normalize("NFC");
  const sanitized = sanitizeFilename(normalizedName).normalize("NFC");
  const digest = createHash("sha256").update(normalizedName).digest("hex").slice(0, DIGEST_LENGTH);
  const prefix = !sanitized || sanitized === normalizedName ? sanitized : `${sanitized}-${digest}`;

  prefixCache.set(componentName, prefix);
  return prefix;
};

export const buildMigrationFilename = (componentName: string, suffix?: string): string => {
  const prefix = getMigrationComponentPrefix(componentName);
  return suffix ? `${prefix}.${suffix}.js` : `${prefix}.js`;
};

export const migrationFilenameMatchesPrefix = (filename: string, prefix: string): boolean => {
  if (!prefix) {
    return false;
  }

  const normalizedFilename = filename.normalize("NFC");
  return (
    normalizedFilename === `${prefix}.js` ||
    (normalizedFilename.startsWith(`${prefix}.`) && normalizedFilename.endsWith(".js"))
  );
};

export const migrationTargetsComponent = (filename: string, componentName: unknown): boolean =>
  typeof componentName === "string" &&
  migrationFilenameMatchesPrefix(filename, getMigrationComponentPrefix(componentName));
