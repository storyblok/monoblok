import { validateSpaceId } from './utils'

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

export const REGION_BIT_IDENTIFIERS: Record<number, Region> = {
  0b0_0000: EU_CODE, // BYOC spaces uses same code as Europe
  0b0_0001: EU_CODE,
  0b0_0010: US_CODE,
  0b0_0011: CA_CODE,
  0b0_0100: AP_CODE,
  0b0_0101: CN_CODE,
} as const

export const ALL_REGIONS: Region[] = Object.keys(ALL_REGION_RANGES) as Region[]

/**
 * handles the spaceId for the new space_ids
 * @method isSpaceIdOver49Bits
 * @param {Number} spaceId
 * @returns {Boolean}
 * @description
 * * Checks if the spaceId is a BigInt spaceId
 * * The spaceId is a max 53-bit number that is divided into two parts:
 * 1. The first 5 bits represent the region (e.g., EU, US, CN, AP, CA).
 * 2. The remaining 48 bits represent the space ID.
 * For the new space_ids we are stating with 49 bits and the max bits is 53.
 * @example
 * ```ts
 * isSpaceIdOver49Bits(12345678901234567890) // true
 * isSpaceIdOver49Bits(1234567890) // false
 * ```
 */
const isSpaceIdOver49Bits = (spaceId: number): boolean => {
  return spaceId >= Math.pow(2, 48)
}

/**
 * return the region based on the first 5 bits of the space id
 * @method getRegionByBitInterval
 * @param {Number} spaceId
 * @returns {Region | undefined}
 * @description
 * Get the region based on first 5 bits of the space id
 * @example
 * ```ts
 * getRegionByBitInterval(282994740194929) // 'eu'
 * getRegionByBitInterval(564469716905585) // 'us'
 * getRegionByBitInterval(12345678901234567890) // 'cn'
 * getRegionByBitInterval(1127419670326897) // 'ap'
 * getRegionByBitInterval(845944693616241) // 'ca'
 * ```
 */
function getRegionByBitInterval(spaceId: number): Region | undefined {
  const regionBits = (BigInt(spaceId) >> 48n) & 0b1_1111n
  return REGION_BIT_IDENTIFIERS[Number(regionBits)]
}

/**
 * return the region codes based on the space id
 * @method getRegion
 * @param {Number | string} spaceId
 * @returns {Region | undefined}
 * @description
 * Get the region based on the space id range. Accepts both numbers and numeric strings.
 * @example
 * ```ts
 * getRegion(12345678901234567890) // 'eu'
 * getRegion("1234567890") // 'us'
 * getRegion("12345678901234567890") // 'cn'
 * getRegion("asfdasd") // undefined
 * ```
 */
export function getRegion(spaceId: number | string): Region | undefined {
  const validatedSpaceId = validateSpaceId(spaceId)

  if (
    validatedSpaceId === undefined ||
    Boolean(BigInt(validatedSpaceId) & ~((1n << 53n) - 1n))
  ) {
    return undefined
  }

  if (!isSpaceIdOver49Bits(validatedSpaceId)) {
    return ALL_REGIONS.find(
      (region) =>
        validatedSpaceId >= ALL_REGION_RANGES[region][0] &&
        validatedSpaceId < ALL_REGION_RANGES[region][1],
    )
  }

  return getRegionByBitInterval(validatedSpaceId)
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
  const validatedSpaceId = validateSpaceId(spaceId)

  if (validatedSpaceId === undefined) {
    return false
  }

  return validatedSpaceId >= 0 && getRegion(validatedSpaceId) !== undefined
}

function getRegionDomain(region: Region): string {
  return REGIONAL_DATA[region]?.apiDomain || EU_API_DOMAIN
}

function getManagementDomain(region: Region): string {
  return REGIONAL_DATA[region]?.managementApiDomain || EU_MANAGEMENT_API_DOMAIN
}

// Re-export utils for external use
export { validateSpaceId } from './utils'
