import filenamify from "filenamify";
import { basename, extname } from "pathe";

/**
 * Remote data such as a slug can contain path separators that would escape the
 * target directory. Replacing separators is enough to keep the result a single
 * path segment; anything else is a legal file name character and must be
 * preserved, or the file no longer round-trips to the entity it came from.
 */
export const toPathSegment = (value: string): string => value.replace(/[/\\]+/g, "-");

/** Replaces characters that are not allowed in file names with `_`. */
export const sanitizeFilename = (filename: string): string =>
  filenamify(filename, { replacement: "_" });

const withSuffix = (name: string, suffix?: string): string =>
  suffix ? `${name}.${suffix}.json` : `${name}.json`;

/** `{slug}_{uuid}.json`, as written by `storyblok stories pull`. */
export const getStoryFilename = (story: { slug: string; uuid: string }): string =>
  `${toPathSegment(story.slug)}_${toPathSegment(story.uuid)}.json`;

export type AssetFilenameSource = {
  id: number;
  short_filename?: string | null;
  filename?: string | null;
};

/**
 * Splits an asset's file name into a sanitized name and its extension. Uses
 * `short_filename` if available, otherwise the basename of `filename`.
 */
export const getAssetNameAndExt = (asset: AssetFilenameSource): { name: string; ext: string } => {
  const filename = asset.short_filename || (asset.filename ? basename(asset.filename) : undefined);
  if (!filename) {
    throw new Error(`Filename for asset with id ${asset.id} could not be determined!`);
  }

  const ext = extname(filename);
  const name = sanitizeFilename(filename.replace(ext, ""));
  return { name, ext };
};

/** `{name}_{id}.json`, as written by `storyblok assets pull`. */
export const getAssetFilename = (asset: AssetFilenameSource): string => {
  const { name } = getAssetNameAndExt(asset);
  return `${name}_${asset.id}.json`;
};

/**
 * `{name}.json` (or `{name}.{suffix}.json`), as written by
 * `storyblok components pull --separate-files`.
 */
export const getComponentFilename = (
  component: { name?: string | null },
  suffix?: string,
): string => withSuffix(sanitizeFilename(component.name || ""), suffix);

/**
 * `{name}.json` (or `{name}.{suffix}.json`), as written by
 * `storyblok datasources pull --separate-files`.
 */
export const getDatasourceFilename = (
  datasource: { name?: string | null },
  suffix?: string,
): string => withSuffix(sanitizeFilename(datasource.name || ""), suffix);
