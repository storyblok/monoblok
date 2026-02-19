import { describe, expect, test } from 'vitest'
import { isInEditor } from '../src/utils/isInEditor'

describe('isInEditor', () => {
  test('returns false when required Storyblok params are missing', () => {
    const url = new URL('https://example.com')

    expect(isInEditor(url)).toBe(false)
  })

  test('returns true when all required Storyblok params are present', () => {
    const url = new URL(
      'https://example.com?' +
        '_storyblok=1&' +
        '_storyblok_c=1&' +
        '_storyblok_tk[space_id]=123'
    )

    expect(isInEditor(url)).toBe(true)
  })

  test('returns false when spaceId option does not match', () => {
    const url = new URL(
      'https://example.com?' +
        '_storyblok=1&' +
        '_storyblok_c=1&' +
        '_storyblok_tk[space_id]=123'
    )

    expect(isInEditor(url, { spaceId: '999' })).toBe(false)
  })

  test('returns true when spaceId option matches', () => {
    const url = new URL(
      'https://example.com?' +
        '_storyblok=1&' +
        '_storyblok_c=1&' +
        '_storyblok_tk[space_id]=123'
    )

    expect(isInEditor(url, { spaceId: '123' })).toBe(true)
  })
})
