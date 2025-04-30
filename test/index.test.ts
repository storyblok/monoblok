/* eslint-disable unicorn/numeric-separators-style */

import { expect, it, describe } from 'vitest'
import {
  EU_NAME,
  US_NAME,
  CN_NAME,
  AP_NAME,
  CA_NAME,
  EU_CODE,
  US_CODE,
  CN_CODE,
  AP_CODE,
  CA_CODE,
  getRegion,
  isRegion,
  getRegionName,
  Region,
  isSpaceIdWithinRange,
  EU_API_DOMAIN,
  getRegionBaseUrl,
  US_API_DOMAIN,
  CN_API_DOMAIN,
  CA_API_DOMAIN,
  AP_API_DOMAIN,
} from '../src'

const bigIntSpaceIds = {
  byoc: 1519763484273,
  eu: 282994740194929,
  us: 564469716905585,
  ca: 845944693616241,
  cn: 1408894647037553,
  ap: 1127419670326897,
}

describe('getRegion', () => {
  it('should return `eu` region', () => {
    expect(getRegion(1)).toBe(EU_CODE)
  })

  it('should return `us` region', () => {
    expect(getRegion(1_000_000)).toBe(US_CODE)
  })

  it('should return `ca` region', () => {
    expect(getRegion(2_000_000)).toBe(CA_CODE)
  })

  it('should return `ap` region', () => {
    expect(getRegion(3_000_000)).toBe(AP_CODE)
  })

  it('should return `undefined`', () => {
    expect(getRegion(6_000_000)).toBe(undefined)
  })

  it('should return `eu` region when pass 53 bit id', () => {
    expect(getRegion(bigIntSpaceIds.eu)).toBe(EU_CODE)
  })

  it('should return `ca` region when pass 53 bit id', () => {
    expect(getRegion(bigIntSpaceIds.ca)).toBe(CA_CODE)
  })

  it('should return `us` region when pass 53 bit id', () => {
    expect(getRegion(bigIntSpaceIds.us)).toBe(US_CODE)
  })

  it('should return `ap` region when pass 53 bit id', () => {
    expect(getRegion(bigIntSpaceIds.ap)).toBe(AP_CODE)
  })

  it('should return `cn` region when pass 53 bit id', () => {
    expect(getRegion(bigIntSpaceIds.cn)).toBe(CN_CODE)
  })

  it('should return `eu` when pass 0 space id', () => {
    expect(getRegion(0)).toBe(EU_CODE)
  })

  it('should return undefined when pass negative space id', () => {
    expect(getRegion(-1)).toBe(undefined)
  })

  it('should return undefined when pass floating numbers as space id', () => {
    expect(getRegion(1.5)).toBe(undefined)
  })

  it('should return undefined when pass floating numbers as space id', () => {
    expect(getRegion(1e35)).toBe(undefined)
  })
})

describe('getRegionBaseUrl https', () => {
  const httpsProtocol = 'https'
  it('should return `eu url` region', () => {
    expect(getRegionBaseUrl(EU_CODE)).toBe(
      `${httpsProtocol}://${EU_API_DOMAIN}`,
    )
    expect(getRegionBaseUrl(EU_CODE, 'https')).toBe(
      `${httpsProtocol}://${EU_API_DOMAIN}`,
    )
  })

  it('should return `us url` region', () => {
    expect(getRegionBaseUrl(US_CODE)).toBe(
      `${httpsProtocol}://${US_API_DOMAIN}`,
    )
  })

  it('should return `cn url` region', () => {
    expect(getRegionBaseUrl(CN_CODE)).toBe(
      `${httpsProtocol}://${CN_API_DOMAIN}`,
    )
  })

  it('should return `ca url` region', () => {
    expect(getRegionBaseUrl(CA_CODE)).toBe(
      `${httpsProtocol}://${CA_API_DOMAIN}`,
    )
  })

  it('should return `ap url` region', () => {
    expect(getRegionBaseUrl(AP_CODE)).toBe(
      `${httpsProtocol}://${AP_API_DOMAIN}`,
    )
  })
})

describe('getRegionBaseUrl http', () => {
  const httpProtocol = 'http'
  it('should return `eu url` region', () => {
    expect(getRegionBaseUrl(EU_CODE, httpProtocol)).toBe(
      `${httpProtocol}://${EU_API_DOMAIN}`,
    )
  })

  it('should return `us url` region', () => {
    expect(getRegionBaseUrl(US_CODE, httpProtocol)).toBe(
      `${httpProtocol}://${US_API_DOMAIN}`,
    )
  })

  it('should return `cn url` region', () => {
    expect(getRegionBaseUrl(CN_CODE, httpProtocol)).toBe(
      `${httpProtocol}://${CN_API_DOMAIN}`,
    )
  })

  it('should return `ca url` region', () => {
    expect(getRegionBaseUrl(CA_CODE, httpProtocol)).toBe(
      `${httpProtocol}://${CA_API_DOMAIN}`,
    )
  })

  it('should return `ap url` region', () => {
    expect(getRegionBaseUrl(AP_CODE, httpProtocol)).toBe(
      `${httpProtocol}://${AP_API_DOMAIN}`,
    )
  })
})

describe('isRegion', () => {
  it('can be "eu"', () => {
    expect(isRegion(EU_CODE)).toEqual(true)
  })
  it('can be "us"', () => {
    expect(isRegion(US_CODE)).toEqual(true)
  })
  it('can be "ca"', () => {
    expect(isRegion(CA_CODE)).toEqual(true)
  })
  it('can be "cn"', () => {
    expect(isRegion(CN_CODE)).toEqual(true)
  })
  it('can be "ap"', () => {
    expect(isRegion(AP_CODE)).toEqual(true)
  })
  it('cannot be anything else', () => {
    expect(isRegion('de')).toEqual(false)
    expect(isRegion('abc')).toEqual(false)
    expect(isRegion(1)).toEqual(false)
    expect(isRegion([])).toEqual(false)
  })
})

describe('getRegionName', () => {
  it('should return "Europe"', () => {
    expect(getRegionName(EU_CODE)).toBe(EU_NAME)
  })
  it('should return "United States"', () => {
    expect(getRegionName(US_CODE)).toBe(US_NAME)
  })
  it('should return "China"', () => {
    expect(getRegionName(CN_CODE)).toBe(CN_NAME)
  })
  it('should return "Australia"', () => {
    expect(getRegionName(AP_CODE)).toBe(AP_NAME)
  })
  it('should return "Canada"', () => {
    expect(getRegionName(CA_CODE)).toBe(CA_NAME)
  })
  it('should return "Europe" for unknown region', () => {
    expect(getRegionName('de' as Region)).toBe(EU_NAME)
  })
})

describe('isSpaceIdWithinRange', () => {
  it('should be valid', () => {
    expect(isSpaceIdWithinRange(1_000_000)).toEqual(true)
  })
  it('cannot be negative', () => {
    expect(isSpaceIdWithinRange(-1)).toEqual(false)
  })
  it('should not surpass the max range', () => {
    expect(isSpaceIdWithinRange(4_000_000)).toEqual(false)
  })
  it('cannot be anything else', () => {
    expect(isSpaceIdWithinRange('de')).toEqual(false)
    expect(isSpaceIdWithinRange('abc')).toEqual(false)
    expect(isSpaceIdWithinRange([])).toEqual(false)
    expect(isSpaceIdWithinRange({})).toEqual(false)
    expect(isSpaceIdWithinRange(Symbol)).toEqual(false)
    expect(isSpaceIdWithinRange(true)).toEqual(false)
  })
})
