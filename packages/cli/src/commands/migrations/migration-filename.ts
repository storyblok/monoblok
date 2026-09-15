import { createHash } from "node:crypto";
import { sanitizeFilename } from "../../utils/filesystem";

/**
 * Migration files are named `<component>[.<suffix>].js`. A component name is
 * unconstrained remote data, so it is sanitized before it becomes a file name.
 *
 * Two things make that mapping ambiguous, and both are closed by appending a
 * digest of the original name:
 *
 * - Sanitizing is many-to-one: `hero:v2`, `hero/v2` and `hero?v2` all collapse
 *   to `hero_v2`.
 * - A dot separates the component from the optional suffix, so `my.component`
 *   is indistinguishable from component `my` with suffix `component`.
 *
 * Names are compared in NFC because the sanitizer emits NFD while the API
 * returns NFC, and macOS stores either.
 */
const DIGEST_LENGTH = 6;

const prefixCache = new Map<string, string>();

const normalize = (value: string): string => value.normalize("NFC");

const sanitize = (value: string): string => normalize(sanitizeFilename(value));

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

  const normalizedName = normalize(componentName);
  const sanitized = sanitize(normalizedName);
  const isUnambiguous = sanitized === normalizedName && !normalizedName.includes(".");
  const digest = createHash("sha256").update(normalizedName).digest("hex").slice(0, DIGEST_LENGTH);
  const prefix = !sanitized || isUnambiguous ? sanitized : `${sanitized}-${digest}`;

  prefixCache.set(componentName, prefix);
  return prefix;
};

/**
 * The file name CLI versions before the sanitizer wrote for a component, which
 * is the raw name. Only names the sanitizer alters have one: every other name
 * was already written the way it is written today. Empty when there is none.
 */
export const getLegacyMigrationComponentPrefix = (componentName: string): string => {
  const normalizedName = normalize(componentName);
  return sanitize(normalizedName) === normalizedName ? "" : normalizedName;
};

export const buildMigrationFilename = (componentName: string, suffix?: string): string => {
  const prefix = getMigrationComponentPrefix(componentName);
  return suffix ? `${prefix}.${suffix}.js` : `${prefix}.js`;
};

export const migrationFilenameMatchesPrefix = (filename: string, prefix: string): boolean => {
  if (!prefix) {
    return false;
  }

  const normalizedFilename = normalize(filename);
  return (
    normalizedFilename === `${prefix}.js` ||
    (normalizedFilename.startsWith(`${prefix}.`) && normalizedFilename.endsWith(".js"))
  );
};

/**
 * Whether a file was written under a name the sanitizer would not produce, i.e.
 * by a CLI version that wrote component names verbatim. Recognizable from the
 * file name alone, so it does not need the space's component list.
 */
export const isLegacyMigrationFilename = (filename: string): boolean => {
  const basename = normalize(filename).replace(/\.js$/, "");
  return basename !== sanitize(basename);
};

export const migrationTargetsComponent = (filename: string, componentName: unknown): boolean =>
  typeof componentName === "string" &&
  (migrationFilenameMatchesPrefix(filename, getMigrationComponentPrefix(componentName)) ||
    migrationFilenameMatchesPrefix(filename, getLegacyMigrationComponentPrefix(componentName)));
