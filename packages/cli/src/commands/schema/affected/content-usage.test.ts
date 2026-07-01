import { describe, expect, it } from 'vitest';

import { collectComponentUsage } from './content-usage';

describe('collectComponentUsage', () => {
  it('should count top-level and nested blok usage of impacted components', () => {
    const content = {
      _uid: 'root',
      component: 'page',
      body: [
        { _uid: 'a', component: 'hero', title: 'One' },
        { _uid: 'b', component: 'hero', title: 'Two' },
        { _uid: 'c', component: 'teaser' },
      ],
    };

    const usage = collectComponentUsage(content, new Map([['hero', new Set<string>()]]));

    expect(usage.get('hero')?.count).toBe(2);
    expect(usage.has('teaser')).toBe(false);
    expect(usage.has('page')).toBe(false);
  });

  it('should count impacted-field presence per component', () => {
    const content = {
      component: 'hero',
      body: [
        { _uid: 'a', component: 'card', subtitle: 'x' },
        { _uid: 'b', component: 'card' },
      ],
    };

    const usage = collectComponentUsage(content, new Map([['card', new Set(['subtitle'])]]));

    expect(usage.get('card')?.count).toBe(2);
    expect(usage.get('card')?.fields.get('subtitle')).toBe(1);
  });

  it('should find bloks embedded in richtext field values', () => {
    const content = {
      component: 'page',
      text: {
        type: 'doc',
        content: [
          {
            type: 'blok',
            attrs: { body: [{ _uid: 'a', component: 'hero', title: 'Hi' }] },
          },
        ],
      },
    };

    const usage = collectComponentUsage(content, new Map([['hero', new Set(['title'])]]));

    expect(usage.get('hero')?.count).toBe(1);
    expect(usage.get('hero')?.fields.get('title')).toBe(1);
  });

  it('should return an empty map when nothing impacted is used', () => {
    const content = { component: 'page', body: [{ component: 'teaser' }] };

    const usage = collectComponentUsage(content, new Map([['hero', new Set<string>()]]));

    expect(usage.size).toBe(0);
  });
});
