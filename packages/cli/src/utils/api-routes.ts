import type { RegionCode } from '../constants';
import { managementApiRegions } from '../constants';

const API_VERSION = 'v1';

export const getStoryblokUrl = (region: RegionCode = 'eu') => {
  return `https://${managementApiRegions[region]}/${API_VERSION}`;
};
