import { describe, expectTypeOf, it } from 'vitest';
import type { MultilinkFieldValue } from './generated/types/field';

const shared = {
  fieldtype: 'multilink',
  id: '',
  url: '',
  cached_url: '',
} as const;

describe('MultilinkFieldValue', () => {
  it('narrows variant properties by linktype', () => {
    const assertNarrowing = (link: MultilinkFieldValue) => {
      if (link.linktype === 'story') {
        // Nullable: the editor stores `anchor: null` once an existing anchor is cleared.
        expectTypeOf(link.anchor).toEqualTypeOf<string | null | undefined>();
        expectTypeOf(link.rel).toEqualTypeOf<string | undefined>();
        // Storyfront permits arbitrary string-valued custom attributes.
        expectTypeOf(link.email).toEqualTypeOf<string | null>();
      }
      else if (link.linktype === 'email') {
        expectTypeOf(link.email).toEqualTypeOf<string | undefined>();
        // @ts-expect-error Anchors are only declared by the story variant.
        void link.anchor;
      }
      else if (link.linktype === 'asset') {
        expectTypeOf(link.linktype).toEqualTypeOf<'asset'>();
      }
    };

    expectTypeOf(assertNarrowing).parameter(0).toEqualTypeOf<MultilinkFieldValue>();
  });

  it('accepts string custom attributes on story and URL links', () => {
    const story = {
      ...shared,
      linktype: 'story',
      anchor: 'features',
      analyticsLabel: 'hero-cta',
    } satisfies MultilinkFieldValue;
    const url = {
      ...shared,
      linktype: 'url',
      rel: 'noopener',
      dataTrackingId: 'external-cta',
    } satisfies MultilinkFieldValue;

    expectTypeOf(story.linktype).toEqualTypeOf<'story'>();
    expectTypeOf(url.linktype).toEqualTypeOf<'url'>();
  });

  it('rejects a nullable target', () => {
    // @ts-expect-error Storyfront only writes '_self' or '_blank', never null.
    const _invalidTarget: MultilinkFieldValue = { ...shared, linktype: 'asset', target: null };

    void _invalidTarget;
  });

  it('accepts a story anchor cleared to null', () => {
    const cleared = { ...shared, linktype: 'story', anchor: null } satisfies MultilinkFieldValue;

    expectTypeOf(cleared.anchor).toEqualTypeOf<null>();
  });
});
