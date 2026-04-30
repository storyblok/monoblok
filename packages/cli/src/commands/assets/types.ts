import type {
  Asset,
  AssetCreate,
  AssetFolder,
  AssetFolderCreate,
  AssetFolderUpdate,
  AssetListQuery,
  AssetUpdate,
} from "../../types";

export type {
  Asset,
  AssetCreate,
  AssetFolder,
  AssetFolderCreate,
  AssetFolderUpdate,
  AssetListQuery,
  AssetUpdate,
};

/**
 * CLI extension of mapi-client's AssetCreate.
 * Adds an optional `id` field used for manifest-based local↔remote ID mapping.
 * The `id` identifies the local/source asset and is stripped before the
 * mapi-client create/upload call so it does not leak into the metadata update.
 */
export type AssetUpload = AssetCreate & { id?: number };

export type AssetMapped = Pick<
  Asset,
  "id" | "filename" | "alt" | "title" | "copyright" | "source" | "is_private" | "meta_data"
>;

/**
 * Maps local with remote asset ids and filenames.
 */
export type AssetMap = Map<number, { old: Asset | AssetMapped | AssetUpload; new: AssetMapped }>;

/**
 * Maps local with remote asset folder ids.
 */
export type AssetFolderMap = Map<number, number>;

/**
 * Maps local with remote story ids and UUIDs.
 */
export interface StoryMap extends Map<string | number, string | number> {
  get: ((key: number) => number | undefined) & ((key: string) => string | undefined);
  set: ((key: number, value: number) => this) & ((key: string, value: string) => this);
}
