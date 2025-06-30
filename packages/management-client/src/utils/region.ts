export const regionCodes = ['eu', 'us', 'cn', 'ca', 'ap'] as const;
export type RegionCode = typeof regionCodes[number];

export const regions: Record<Uppercase<RegionCode>, RegionCode> = {
  EU: 'eu',
  US: 'us',
  CN: 'cn',
  CA: 'ca',
  AP: 'ap',
} as const;

export const managementApiRegions: Record<RegionCode, string> = {
  eu: 'mapi.storyblok.com',
  us: 'mapi-us.storyblok.com',
  cn: 'mapi.storyblokchina.cn',
  ca: 'mapi-ca.storyblok.com',
  ap: 'mapi-ap.storyblok.com',
} as const;

export const regionNames: Record<RegionCode, string> = {
  eu: 'Europe',
  us: 'United States',
  cn: 'China',
  ca: 'Canada',
  ap: 'Australia',
} as const;

const API_VERSION = 'v1';

export const getManagementApiUrl = (region: RegionCode = 'eu') => {
  return `https://${managementApiRegions[region]}/${API_VERSION}`;
};
