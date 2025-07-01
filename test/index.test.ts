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

  // String tests for getRegion
  it('should return correct region for valid numeric strings', () => {
    expect(getRegion('1')).toBe(EU_CODE)
    expect(getRegion('1000000')).toBe(US_CODE)
    expect(getRegion('2000000')).toBe(CA_CODE)
    expect(getRegion('3000000')).toBe(AP_CODE)
  })

  it('should return undefined for invalid numeric strings', () => {
    expect(getRegion('asfdasd')).toBe(undefined)
    expect(getRegion('abc123')).toBe(undefined)
    expect(getRegion('invalid')).toBe(undefined)
    expect(getRegion('')).toBe(undefined)
    expect(getRegion('12.34')).toBe(undefined)
    expect(getRegion('-123')).toBe(undefined)
  })

  it('should handle BigInt space IDs as strings', () => {
    expect(getRegion(bigIntSpaceIds.eu.toString())).toBe(EU_CODE)
    expect(getRegion(bigIntSpaceIds.us.toString())).toBe(US_CODE)
    expect(getRegion(bigIntSpaceIds.ca.toString())).toBe(CA_CODE)
    expect(getRegion(bigIntSpaceIds.ap.toString())).toBe(AP_CODE)
    expect(getRegion(bigIntSpaceIds.cn.toString())).toBe(CN_CODE)
  })

  it('should handle whitespace in string inputs', () => {
    expect(getRegion('  1000000  ')).toBe(US_CODE)
    expect(getRegion('\t2000000\n')).toBe(CA_CODE)
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

  // String tests for isSpaceIdWithinRange
  it('should return true for valid numeric strings', () => {
    expect(isSpaceIdWithinRange('1212434')).toBe(true)
    expect(isSpaceIdWithinRange('1000000')).toBe(true)
    expect(isSpaceIdWithinRange('0')).toBe(true)
    expect(isSpaceIdWithinRange('999999')).toBe(true)
  })

  it('should return false for invalid numeric strings', () => {
    expect(isSpaceIdWithinRange('asfdasd')).toBe(false)
    expect(isSpaceIdWithinRange('abc123')).toBe(false)
    expect(isSpaceIdWithinRange('123abc')).toBe(false)
    expect(isSpaceIdWithinRange('12.34')).toBe(false)
    expect(isSpaceIdWithinRange('-123')).toBe(false)
    expect(isSpaceIdWithinRange('')).toBe(false)
    expect(isSpaceIdWithinRange('   ')).toBe(false)
  })

  it('should return false for space IDs outside valid ranges', () => {
    expect(isSpaceIdWithinRange('6000000')).toBe(false)
    expect(isSpaceIdWithinRange('-1')).toBe(false)
  })

  it('should return true for BigInt space IDs as strings', () => {
    expect(isSpaceIdWithinRange(bigIntSpaceIds.eu.toString())).toBe(true)
    expect(isSpaceIdWithinRange(bigIntSpaceIds.us.toString())).toBe(true)
    expect(isSpaceIdWithinRange(bigIntSpaceIds.ca.toString())).toBe(true)
    expect(isSpaceIdWithinRange(bigIntSpaceIds.ap.toString())).toBe(true)
    expect(isSpaceIdWithinRange(bigIntSpaceIds.cn.toString())).toBe(true)
  })

  it('should handle whitespace in string inputs', () => {
    expect(isSpaceIdWithinRange('  1000000  ')).toBe(true)
    expect(isSpaceIdWithinRange('\t2000000\n')).toBe(true)
    expect(isSpaceIdWithinRange('  invalid  ')).toBe(false)
  })

  it('should return false for very large numbers as strings', () => {
    expect(isSpaceIdWithinRange('9007199254740992')).toBe(false) // Beyond safe integer
    expect(isSpaceIdWithinRange('99999999999999999999')).toBe(false)
  })
})
