import { describe, expect, it } from 'vitest';
import * as rsc from '../rsc';

// Regression test for DX-498 / #697: the `./rsc` entry declared the bridge
// functions in its type definitions but did not re-export them at runtime,
// causing `TypeError: useStoryblokBridge is not a function` in client
// components importing from `@storyblok/react/rsc`.
describe('rsc entry runtime exports', () => {
  it.each(['useStoryblokBridge', 'loadStoryblokBridge', 'registerStoryblokBridge'] as const)(
    'exports %s as a function',
    (name) => {
      expect(typeof rsc[name]).toBe('function');
    },
  );
});
