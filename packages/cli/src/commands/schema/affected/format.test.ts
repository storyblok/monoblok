import { describe, expect, it } from 'vitest';

import type { AffectedReport } from './actions';
import { formatSummary, pluralize } from './format';

describe('pluralize', () => {
  it('should use the singular noun for a count of one', () => {
    expect(pluralize(1, 'story', 'stories')).toBe('1 story');
    expect(pluralize(1, 'component')).toBe('1 component');
  });

  it('should use the plural noun for counts other than one', () => {
    expect(pluralize(0, 'story', 'stories')).toBe('0 stories');
    expect(pluralize(3, 'story', 'stories')).toBe('3 stories');
    expect(pluralize(2, 'component')).toBe('2 components');
  });
});

describe('formatSummary', () => {
  it('should pluralize story and component counts based on their value', () => {
    const report: AffectedReport = {
      space: '123',
      components: [
        {
          component: 'hero',
          action: 'update',
          usedStories: 1,
          brokenStories: 1,
          fields: [{ field: 'badge', kind: 'required_added', used: 1, broken: 1 }],
        },
        {
          component: 'cta',
          action: 'removed',
          usedStories: 3,
          brokenStories: 3,
          fields: [],
        },
      ],
      stories: [],
      totals: { usedStories: 4, brokenStories: 4, brokenComponents: 2 },
    };

    const lines = formatSummary(report);

    expect(lines).toContain('hero (changed): 1 story affected, 1 would break');
    expect(lines).toContain('  - badge (required_added): present in 1 story, 1 would break');
    expect(lines).toContain('cta (removed): 3 stories affected, 3 would break');
    expect(lines).toContain('Totals: 4 stories affected across 2 components; 4 would break.');
  });
});
