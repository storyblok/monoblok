export const regionCodes = ['eu', 'us', 'cn', 'ca', 'ap'] as const;
export type RegionCode = typeof regionCodes[number];

export const regions: Record<Uppercase<RegionCode>, RegionCode> = {
  EU: 'eu',
  US: 'us',
  CN: 'cn',
  CA: 'ca',
  AP: 'ap',
} as const;

export const regionsDomain: Record<RegionCode, string> = {
  eu: 'api.storyblok.com',
  us: 'api-us.storyblok.com',
  cn: 'app.storyblokchina.cn',
  ca: 'api-ca.storyblok.com',
  ap: 'api-ap.storyblok.com',
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

export const getCapiUrl = (region: RegionCode = 'eu') => {
  return `https://${regionsDomain[region]}/v2/cdn`;
};

export const getMapiUrl = (region: RegionCode = 'eu') => {
  return `https://${regionsDomain[region]}/v1`;
};




