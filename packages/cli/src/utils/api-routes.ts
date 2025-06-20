import type { RegionCode } from '../constants';
import { regionsDomain } from '../constants';

const API_VERSION = 'v1';

export const getStoryblokUrl = (region: RegionCode = 'eu') => {
  return `https://${regionsDomain[region]}/${API_VERSION}`;
};
