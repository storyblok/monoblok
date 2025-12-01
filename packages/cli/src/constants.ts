// Please do not change the casing of the commands, it's used for the CLI commands definition
export const commands = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  SIGNUP: 'signup',
  USER: 'user',
  COMPONENTS: 'components',
  LANGUAGES: 'languages',
  MIGRATIONS: 'migrations',
  TYPES: 'types',
  DATASOURCES: 'datasources',
  CREATE: 'create',
  LOGS: 'logs',
  REPORTS: 'reports',
  STORIES: 'stories',
} as const;

export const colorPalette = {
  PRIMARY: '#8d60ff',
  LOGIN: '#dad4ff',
  LOGOUT: '#6d6d6d',
  SIGNUP: '#b6ff6d',
  USER: '#71d300',
  COMPONENTS: '#a185ff',
  LANGUAGES: '#f5c003',
  MIGRATIONS: '#8CE2FF',
  TYPES: '#3178C6',
  CREATE: '#ffb3ba',
  GROUPS: '#4ade80',
  TAGS: '#fbbf24',
  PRESETS: '#a855f7',
  DATASOURCES: '#4ade80',
  LOGS: '#4ade80',
  REPORTS: '#4ade80',
  STORIES: '#a185ff',
} as const;

export interface ReadonlyArray<T> {
  includes: (searchElement: any, fromIndex?: number) => searchElement is T;
}
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
  us: 'api-us.storyblok.com',
  cn: 'app.storyblokchina.cn',
  ca: 'api-ca.storyblok.com',
  ap: 'api-ap.storyblok.com',
} as const;

export const appDomains: Record<RegionCode, string> = {
  eu: 'app.storyblok.com',
  us: 'app-us.storyblok.com',
  cn: 'app.storyblokchina.cn',
  ca: 'app-ca.storyblok.com',
  ap: 'app-ap.storyblok.com',
} as const;

export const regionNames: Record<RegionCode, string> = {
  eu: 'Europe',
  us: 'United States',
  cn: 'China',
  ca: 'Canada',
  ap: 'Australia',
} as const;

export const DEFAULT_AGENT = {
  SB_Agent: 'SB-CLI',
  SB_Agent_Version: process.env.npm_package_version || '4.x',
} as const;

export interface SpaceOptions {
  spaceId: string;
}

export const directories = {
  logs: 'logs',
  reports: 'reports',
  stories: 'stories',
  components: 'components',
  datasources: 'datasources',
} as const;
