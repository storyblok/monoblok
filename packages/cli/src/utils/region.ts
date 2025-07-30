import type { Region } from '@storyblok/region-helper';
import { getRegion } from '@storyblok/region-helper';
import type { Command } from 'commander';
import { session } from '../session';

/**
 * Automatically determines the region code based on the space ID
 * @param spaceId - The Storyblok space ID
 * @returns The region code or undefined if it cannot be determined
 */
export function getRegionFromSpaceId(spaceId: string): string | undefined {
  try {
    const region = getRegion(spaceId);
    return region;
  }
  catch (error) {
    console.warn(`Failed to determine region from space ID: ${error}`);
    return undefined;
  }
}

/**
 * Resolves the region for a given space ID
 * @param thisCommand - The command instance
 * @returns void
 */
export const resolveRegion = async (thisCommand: Command): Promise<void> => {
  // Pre-action hook to handle automatic region detection
  const options = thisCommand.opts();
  const spaceId = options.space;

  // If space ID is provided but no region is set, try to auto-detect region
  if (spaceId) {
    const { state, initializeSession } = session();
    await initializeSession();

    const detectedRegion = getRegionFromSpaceId(spaceId);

    if (detectedRegion) {
      state.region = detectedRegion as Region;
    }
  }
};
