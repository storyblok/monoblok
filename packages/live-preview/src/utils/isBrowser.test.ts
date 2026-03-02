import { afterEach, beforeEach, expect, it } from 'vitest';
import { isBrowser } from './isBrowser';

let originalWindow: typeof globalThis.window | undefined;

beforeEach(() => {
  originalWindow = globalThis.window;
});

afterEach(() => {
  if (originalWindow === undefined) {
    // @ts-expect-error – intentional cleanup
    delete globalThis.window;
  }
  else {
    globalThis.window = originalWindow;
  }
});

it('returns true when window is defined', () => {
  globalThis.window = {} as any;
  expect(isBrowser()).toBe(true);
});

it('returns false when window is undefined', () => {
  // @ts-expect-error – intentional environment simulation
  delete globalThis.window;
  expect(isBrowser()).toBe(false);
});
