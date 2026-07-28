import { describe, expect, it } from 'vitest';

import storyblokEditable from './editable';

describe('storyblokEditable', () => {
  it('returns attributes for valid _editable string', () => {
    const block = {
      _editable:
                '<!--#storyblok#{"name":"page","space":"147897","uid":"abc-123","id":"999"}-->',
    };

    const result = storyblokEditable(block);

    expect(result).toEqual({
      'data-blok-c': JSON.stringify({
        name: 'page',
        space: '147897',
        uid: 'abc-123',
        id: '999',
      }),
      'data-blok-uid': '999-abc-123',
    });
  });

  it('returns empty object when block is undefined', () => {
    expect(storyblokEditable(undefined)).toEqual({});
  });

  it('returns empty object when _editable is missing', () => {
    expect(storyblokEditable({})).toEqual({});
  });

  it('returns empty object for invalid JSON', () => {
    const block = {
      _editable: '<!--#storyblok#INVALID_JSON-->',
    };

    expect(storyblokEditable(block)).toEqual({});
  });

  it('returns empty object if wrapper is incorrect', () => {
    const block = {
      _editable: '{"id":"1","uid":"abc"}',
    };

    expect(storyblokEditable(block)).toEqual({});
  });

  it('accepts a blok type that does not declare _editable', () => {
    // A user-defined blok interface typically has component and _uid but no _editable.
    // The previous parameter type `{ _editable?: string }` is a weak type (all props
    // optional). TypeScript's weak-type check (ts(2559)) rejects any argument whose
    // type shares zero property names with the parameter type — exactly the case here.
    // Widening the parameter to `unknown` removes the constraint entirely.
    interface FeatureBlok {
      headline?: string;
      component: 'feature';
      _uid: string;
    }

    const blok: FeatureBlok = { component: 'feature', _uid: 'test-uid' };

    // Must compile without @ts-expect-error.
    const result = storyblokEditable(blok);

    expect(result).toEqual({});
  });
});
