import { describe, expectTypeOf, it } from 'vitest';
import StoryblokClient from '.';
import type { ISbResponse } from './interfaces';

// Regression guard for DX-472: the write methods resolve to the `ISbResponse`
// envelope (`{ data, status, statusText, headers }`), not the body payload
// `ISbResponseData`. The created resource lives at `response.data.*`.
describe('write method return types', () => {
  const client = new StoryblokClient({ oauthToken: 'token' });

  it('post/put/patch/delete resolve to ISbResponse', () => {
    expectTypeOf(client.post).returns.resolves.toEqualTypeOf<ISbResponse>();
    expectTypeOf(client.put).returns.resolves.toEqualTypeOf<ISbResponse>();
    expectTypeOf(client.patch).returns.resolves.toEqualTypeOf<ISbResponse>();
    expectTypeOf(client.delete).returns.resolves.toEqualTypeOf<ISbResponse>();
  });
});
