export type Region = 'eu' | 'us' | 'cn' | 'ap' | 'ca'

export type RegionRanges = Record<Region, [number, number]>

export const EU_API_URL = 'https://api.storyblok.com'
export const US_API_URL = 'https://api-us.storyblok.com'
export const CN_API_URL = 'https://app.storyblokchina.cn'
export const AP_API_URL = 'https://api-ap.storyblok.com'
export const CA_API_URL = 'https://api-ca.storyblok.com'

export const ALL_REGION_RANGES: RegionRanges = {
  eu: [0, 1_000_000],
  cn: [0, 1_000_000], // CN and EU uses the same range
  us: [1_000_000, 2_000_000],
  ca: [2_000_000, 3_000_000],
  ap: [3_000_000, 4_000_000],
}

export const ALL_REGIONS: Region[] = Object.keys(ALL_REGION_RANGES) as Region[]

export function getRegion(spaceId: number) {
  const region = Object.entries(ALL_REGION_RANGES).find(
    ([, range]) => spaceId >= range[0] && spaceId < range[1],
  )

  return region ? (region[0] as Region) : 'eu'
}

export function getRegionUrl(region: Region) {
  switch (region) {
    case 'us': {
      return US_API_URL
    }
    case 'cn': {
      return CN_API_URL
    }
    case 'ap': {
      return AP_API_URL
    }
    case 'ca': {
      return CA_API_URL
    }
    default: {
      return EU_API_URL
    }
  }
}

export function isRegion(data: unknown): data is Region {
  return ALL_REGIONS.includes(data as Region)
}
