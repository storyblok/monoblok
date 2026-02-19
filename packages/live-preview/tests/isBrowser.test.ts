import { expect, test, beforeEach, afterEach } from 'vitest'
import { isBrowser } from '../src/utils/isBrowser'

let originalWindow: typeof globalThis.window | undefined

beforeEach(() => {
  originalWindow = globalThis.window
})

afterEach(() => {
  if (originalWindow === undefined) {
    // @ts-expect-error – intentional cleanup
    delete globalThis.window
  } else {
    globalThis.window = originalWindow
  }
})

test('returns true when window is defined', () => {
  globalThis.window = {} as any
  expect(isBrowser()).toBe(true)
})

test('returns false when window is undefined', () => {
  // @ts-expect-error – intentional environment simulation
  delete globalThis.window
  expect(isBrowser()).toBe(false)
})
