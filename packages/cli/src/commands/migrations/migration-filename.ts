import { sanitizeFilename } from "../../utils/filesystem";

/**
 * Migration files are named `<component>[.<suffix>].js`. A component name is
 * unconstrained remote data, so it is sanitized before it becomes a file name.
 * That mapping is lossy, so matching a file back to a component has to apply
 * the same mapping instead of comparing against the raw name.
 */
export const buildMigrationFilename = (componentName: string, suffix?: string): string => {
  const segment = sanitizeFilename(componentName);
  return suffix ? `${segment}.${suffix}.js` : `${segment}.js`;
};

/**
 * The component segment of a migration file name, i.e. everything before the
 * optional suffix. Normalized so a name written as NFD on disk still compares
 * equal to the NFC form the API returns.
 */
export const getMigrationComponentSegment = (filename: string): string =>
  filename.replace(/\.js$/, "").split(".")[0].normalize("NFC");

export const migrationTargetsComponent = (segment: string, componentName: unknown): boolean =>
  typeof componentName === "string" &&
  segment === getMigrationComponentSegment(buildMigrationFilename(componentName));
