/* eslint-disable unicorn/numeric-separators-style */

import { expect, it, describe } from 'vitest'
import { validateSpaceId } from '../src/utils'

const bigIntSpaceIds = {
  byoc: 1519763484273,
  eu: 282994740194929,
  us: 564469716905585,
  ca: 845944693616241,
  cn: 1690369623748209,
  ap: 1127419670326897,
}

describe('validateSpaceId', () => {
  it('should convert valid numeric string to number', () => {
    expect(validateSpaceId('1212434')).toBe(1212434)
    expect(validateSpaceId('1000000')).toBe(1000000)
    expect(validateSpaceId('0')).toBe(0)
    expect(validateSpaceId('999999')).toBe(999999)
  })

  it('should return number as-is when input is already a number', () => {
    expect(validateSpaceId(1212434)).toBe(1212434)
    expect(validateSpaceId(0)).toBe(0)
    expect(validateSpaceId(999999)).toBe(999999)
  })

  it('should return handle zeroes and negative', () => {
    expect(validateSpaceId(0)).toBe(0)
    expect(validateSpaceId(+0)).toBe(0)
    expect(validateSpaceId(-0)).toBe(-0)
    expect(validateSpaceId('0')).toBe(0)
    expect(validateSpaceId('+0')).toBe(undefined)
    expect(validateSpaceId('-0')).toBe(undefined)
    expect(validateSpaceId(-123)).toBe(undefined)
    expect(validateSpaceId(Number.NEGATIVE_INFINITY)).toBe(undefined)
  })

  it('should return undefined for invalid numeric strings', () => {
    expect(validateSpaceId('asfdasd')).toBe(undefined)
    expect(validateSpaceId('abc123')).toBe(undefined)
    expect(validateSpaceId('123abc')).toBe(undefined)
    expect(validateSpaceId('12.34')).toBe(undefined)
    expect(validateSpaceId('12.0')).toBe(undefined)
    expect(validateSpaceId('-123')).toBe(undefined)
    expect(validateSpaceId('+123')).toBe(undefined)
  })

  it('should return undefined for empty or whitespace strings', () => {
    expect(validateSpaceId('')).toBe(undefined)
    expect(validateSpaceId('   ')).toBe(undefined)
    expect(validateSpaceId('\t')).toBe(undefined)
    expect(validateSpaceId('\n')).toBe(undefined)
  })

  it('should handle strings with leading/trailing whitespace', () => {
    expect(validateSpaceId('  1212434  ')).toBe(1212434)
    expect(validateSpaceId('\t1000000\n')).toBe(1000000)
  })

  it('should return undefined for very large numbers that exceed safe integer range', () => {
    expect(validateSpaceId('9007199254740992')).toBe(undefined) // Number.MAX_SAFE_INTEGER + 1
    expect(validateSpaceId('99999999999999999999')).toBe(undefined)
  })

  it('should handle edge cases', () => {
    expect(validateSpaceId('000123')).toBe(123) // Leading zeros
    expect(validateSpaceId('9007199254740991')).toBe(9007199254740991) // Number.MAX_SAFE_INTEGER
  })

  it('should return undefined for non-string/non-number types', () => {
    expect(validateSpaceId([])).toBe(undefined)
    expect(validateSpaceId({})).toBe(undefined)
    expect(validateSpaceId(undefined)).toBe(undefined)
    expect(validateSpaceId(true)).toBe(undefined)
    expect(validateSpaceId(Symbol('test'))).toBe(undefined)
    expect(validateSpaceId(Number.NaN)).toBe(undefined)
  })

  it('should handle BigInt space IDs as strings correctly', () => {
    expect(validateSpaceId(bigIntSpaceIds.eu.toString())).toBe(
      bigIntSpaceIds.eu,
    )
    expect(validateSpaceId(bigIntSpaceIds.us.toString())).toBe(
      bigIntSpaceIds.us,
    )
    expect(validateSpaceId(bigIntSpaceIds.ca.toString())).toBe(
      bigIntSpaceIds.ca,
    )
    expect(validateSpaceId(bigIntSpaceIds.ap.toString())).toBe(
      bigIntSpaceIds.ap,
    )
    expect(validateSpaceId(bigIntSpaceIds.cn.toString())).toBe(
      bigIntSpaceIds.cn,
    )
  })
})
