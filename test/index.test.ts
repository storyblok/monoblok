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
  EU_API_URL,
  US_API_URL,
  CN_API_URL,
  AP_API_URL,
  CA_API_URL,
  getRegion,
  getRegionUrl,
  isRegion,
  getRegionName,
  Region,
  isSpaceIdWithinRange,
} from '../src'

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
})

describe('getRegionUrl', () => {
  it('should return `eu url` region', () => {
    expect(getRegionUrl(EU_CODE)).toBe(EU_API_URL)
  })

  it('should return `us url` region', () => {
    expect(getRegionUrl(US_CODE)).toBe(US_API_URL)
  })

  it('should return `cn url` region', () => {
    expect(getRegionUrl(CN_CODE)).toBe(CN_API_URL)
  })

  it('should return `ca url` region', () => {
    expect(getRegionUrl(CA_CODE)).toBe(CA_API_URL)
  })

  it('should return `ap url` region', () => {
    expect(getRegionUrl(AP_CODE)).toBe(AP_API_URL)
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
