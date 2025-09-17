import fs from 'node:fs';
import { basename } from 'node:path';
import { lookup } from 'mime-types';
import { imageSize } from 'image-size';
import type { Buffer } from 'Buffer';

export interface LocalAssetData {
  buffer: Buffer | FormData;
  filename?: string;
  mimetype?: string;
  size: string;
}

export async function readAssetFromPath(path: string): Promise<LocalAssetData> {
  try {
    const fileBuffer = fs.readFileSync(path);
    const buffer = await Promise.resolve(fileBuffer);
    // Get image dimensions
    let size;
    try {
      const dimensions = imageSize(buffer);

      if (dimensions.width && dimensions.height) {
        size
  = `${dimensions.width}X${dimensions.height}`;
      }
    }
    // eslint-disable-next-line  unused-imports/no-unused-vars
    catch (_error) {
      // Not an image or couldn't determine size
      console.warn(`Could not determine size for 
  ${path}`);
    }
    // For form-data upload, we might need to return an object with filename and buffer
    return {
      buffer,
      filename: basename(path),
      mimetype: lookup(path) || undefined,
      size: size || '0X0',
    };
  }
  catch (error) {
    console.error(`Error reading asset from path ${path}:`, error);
    throw error;
  }
}

export const formatAssetFilename = (asset: LocalAssetData) => {
  // For FormData (multipart/form-data) - return the asset data to be used later
  return {
    blob: new Blob([asset.buffer as BlobPart], { type: asset.mimetype || 'application/octet-stream' }),
    filename: asset.filename || 'untitled',
  };
};
