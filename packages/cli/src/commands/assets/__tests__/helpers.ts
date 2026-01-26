import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { vol } from 'memfs';
import { DEFAULT_SPACE, getID } from '../../__tests__/helpers';
import { getAssetBinaryFilename, getAssetFilename, getFolderFilename } from '../utils';

/**
 * MockAsset interface - unified interface for asset mocking in tests.
 */
export interface MockAsset {
  id: number;
  filename: string;
  short_filename?: string;
  asset_folder_id?: number;
  is_private?: boolean;
  alt?: string;
  title?: string;
  copyright?: string;
  source?: string;
  meta_data?: Record<string, unknown>;
}

/**
 * MockAssetFolder interface for asset folder mocking in tests.
 */
export interface MockAssetFolder {
  id: number;
  uuid: string;
  name: string;
  parent_id: number | null;
  parent_uuid: string | null;
}

/**
 * Creates a mock asset with default values.
 * Uses the global getID for unique IDs.
 */
export const makeMockAsset = (overrides: Partial<MockAsset> = {}, space = DEFAULT_SPACE): MockAsset => {
  const assetId = overrides.id ?? getID();
  const shortFilename = overrides.short_filename || `asset-${assetId}.png`;
  return {
    id: assetId,
    filename: overrides.filename || `https://a.storyblok.com/f/${space}/500x500/${shortFilename}`,
    short_filename: shortFilename,
    asset_folder_id: undefined,
    ...overrides,
  };
};

/**
 * Creates a mock asset folder with default values.
 * Uses the global getID for unique IDs.
 */
export const makeMockFolder = (overrides: Partial<MockAssetFolder> = {}): MockAssetFolder => {
  const folderId = overrides.id ?? getID();
  return {
    id: folderId,
    uuid: randomUUID(),
    name: overrides.name || `Folder-${folderId}`,
    parent_id: null,
    parent_uuid: null,
    ...overrides,
  };
};

/**
 * Checks if an asset file exists in the virtual file system.
 */
export const assetFileExists = (asset: MockAsset) => {
  // Type assertion needed because getAssetBinaryFilename expects short_filename but it handles undefined safely
  const binaryFilename = getAssetBinaryFilename(asset as Parameters<typeof getAssetBinaryFilename>[0]);
  const metadataFilename = getAssetFilename(asset as Parameters<typeof getAssetFilename>[0]);
  const binary = Object.entries(vol.toJSON())
    .find(([filename]) => filename.endsWith(binaryFilename))?.[1];
  const metadata = Object.entries(vol.toJSON())
    .find(([filename]) => filename.endsWith(metadataFilename))?.[1];
  return Boolean(binary && metadata);
};

/**
 * Checks if a folder file exists in the virtual file system.
 */
export const folderFileExists = (folder: MockAssetFolder) => {
  return Object.keys(vol.toJSON()).some(filename => filename.endsWith(`folders/${getFolderFilename(folder)}`));
};

/**
 * Creates a minimal valid PNG buffer for testing.
 */
export const makePngBuffer = (width: number, height: number) => {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.from([0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52]);
  const dimensions = Buffer.alloc(8);
  dimensions.writeUInt32BE(width, 0);
  dimensions.writeUInt32BE(height, 4);
  return Buffer.concat([signature, ihdr, dimensions]);
};
