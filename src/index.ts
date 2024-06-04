export type Region = 'eu' | 'us' | 'cn' | 'ap' | 'ca'
type Protocol = 'http' | 'https'
export type RegionRanges = Record<Region, [number, number]>

export const EU_API_DOMAIN = 'api.storyblok.com'
export const US_API_DOMAIN = 'api-us.storyblok.com'
export const CN_API_DOMAIN = 'app.storyblokchina.cn'
export const AP_API_DOMAIN = 'api-ap.storyblok.com'
export const CA_API_DOMAIN = 'api-ca.storyblok.com'

export const EU_MANAGEMENT_API_DOMAIN = 'mapi.storyblok.com'
export const US_MANAGEMENT_API_DOMAIN = 'api-us.storyblok.com'
export const CN_MANAGEMENT_API_DOMAIN = 'app.storyblokchina.cn'
export const AP_MANAGEMENT_API_DOMAIN = 'api-ap.storyblok.com'
export const CA_MANAGEMENT_API_DOMAIN = 'api-ca.storyblok.com'

export const EU_CODE = 'eu'
export const US_CODE = 'us'
export const CN_CODE = 'cn'
export const AP_CODE = 'ap'
export const CA_CODE = 'ca'

export const EU_NAME = 'Europe'
export const US_NAME = 'United States'
export const CN_NAME = 'China'
export const AP_NAME = 'Australia'
export const CA_NAME = 'Canada'

export type RegionalData = {
  [code in Region]: {
    name: string
    apiDomain: string
    managementApiDomain: string
  }
}

export const REGIONAL_DATA: RegionalData = {
  [EU_CODE]: {
    name: EU_NAME,
    apiDomain: EU_API_DOMAIN,
    managementApiDomain: EU_MANAGEMENT_API_DOMAIN,
  },
  [US_CODE]: {
    name: US_NAME,
    apiDomain: US_API_DOMAIN,
    managementApiDomain: US_MANAGEMENT_API_DOMAIN,
  },
  [CN_CODE]: {
    name: CN_NAME,
    apiDomain: CN_API_DOMAIN,
    managementApiDomain: CN_MANAGEMENT_API_DOMAIN,
  },
  [AP_CODE]: {
    name: AP_NAME,
    apiDomain: AP_API_DOMAIN,
    managementApiDomain: AP_MANAGEMENT_API_DOMAIN,
  },
  [CA_CODE]: {
    name: CA_NAME,
    apiDomain: CA_API_DOMAIN,
    managementApiDomain: CA_MANAGEMENT_API_DOMAIN,
  },
}

export function getRegionName(region: Region) {
  return REGIONAL_DATA[region]?.name || EU_NAME
}

export const ALL_REGION_RANGES: RegionRanges = {
  [EU_CODE]: [0, 1_000_000],
  [CN_CODE]: [0, 1_000_000], // CN and EU uses the same range
  [US_CODE]: [1_000_000, 2_000_000],
  [CA_CODE]: [2_000_000, 3_000_000],
  [AP_CODE]: [3_000_000, 4_000_000],
}

export const ALL_REGIONS: Region[] = Object.keys(ALL_REGION_RANGES) as Region[]

export function getRegion(spaceId: number) {
  const region = Object.entries(ALL_REGION_RANGES).find(
    ([, range]) => spaceId >= range[0] && spaceId < range[1],
  )

  return region ? (region[0] as Region) : undefined
}

export function getRegionBaseUrl(region: Region, protocol: Protocol = 'https') {
  return `${protocol}://${getRegionDomain(region)}`
}

export function getManagementBaseUrl(
  region: Region,
  protocol: Protocol = 'https',
) {
  return `${protocol}://${getManagementDomain(region)}`
}

export function isRegion(data: unknown): data is Region {
  return ALL_REGIONS.includes(data as Region)
}

export function isSpaceIdWithinRange(spaceId: unknown): spaceId is number {
  if (!Number.isInteger(spaceId)) {
    return false
  }

  const spaceIdAsNumber = Number(spaceId)

  return spaceIdAsNumber >= 0 && getRegion(spaceIdAsNumber) !== undefined
}

function getRegionDomain(region: Region): string {
  return REGIONAL_DATA[region]?.apiDomain || EU_API_DOMAIN
}

function getManagementDomain(region: Region): string {
  return REGIONAL_DATA[region]?.managementApiDomain || EU_MANAGEMENT_API_DOMAIN
}
