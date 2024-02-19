import { expect, it, describe } from 'vitest'
import {
  AP_API_URL,
  CA_API_URL,
  CN_API_URL,
  EU_API_URL,
  US_API_URL,
  getRegion,
  getRegionUrl,
  isRegion,
} from '../src'

describe('getRegion', () => {
  it('should return `eu` region', () => {
    expect(getRegion(1)).toBe('eu')
    expect(getRegion(6_000_000)).toBe('eu')
  })

  it('should return `us` region', () => {
    expect(getRegion(1_000_000)).toBe('us')
  })

  it('should return `ca` region', () => {
    expect(getRegion(2_000_000)).toBe('ca')
  })

  it('should return `ap` region', () => {
    expect(getRegion(3_000_000)).toBe('ap')
  })
})

describe('getRegionUrl', () => {
  it('should return `eu url` region', () => {
    expect(getRegionUrl('eu')).toBe(EU_API_URL)
  })

  it('should return `us url` region', () => {
    expect(getRegionUrl('us')).toBe(US_API_URL)
  })

  it('should return `cn url` region', () => {
    expect(getRegionUrl('cn')).toBe(CN_API_URL)
  })

  it('should return `ca url` region', () => {
    expect(getRegionUrl('ca')).toBe(CA_API_URL)
  })

  it('should return `ap url` region', () => {
    expect(getRegionUrl('ap')).toBe(AP_API_URL)
  })
})

describe('isRegion', () => {
  it('can be "eu"', () => {
    expect(isRegion('eu')).toEqual(true)
  })
  it('can be "us"', () => {
    expect(isRegion('us')).toEqual(true)
  })
  it('can be "ca"', () => {
    expect(isRegion('ca')).toEqual(true)
  })
  it('can be "cn"', () => {
    expect(isRegion('cn')).toEqual(true)
  })
  it('can be "ap"', () => {
    expect(isRegion('ap')).toEqual(true)
  })
  it('cannot be anything else', () => {
    expect(isRegion('de')).toEqual(false)
    expect(isRegion('abc')).toEqual(false)
    expect(isRegion(1)).toEqual(false)
    expect(isRegion([])).toEqual(false)
  })
})
