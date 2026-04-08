import type { Scenario } from '../helpers/seed';
import { heroBlock } from '../../src/schema/components/hero';
import { pageBlock } from '../../src/schema/components/page';

export const simpleHeroScenario: Scenario = {
  stories: () => [
    {
      name: 'Home',
      slug: 'home',
      content: {
        component: pageBlock.name,
        seo_title: 'Simple Hero Test',
        seo_description: 'E2E test scenario: simple hero page.',
        blocks: [
          {
            component: heroBlock.name,
            eyebrow: 'Test Eyebrow',
            headline: 'Test Hero Headline',
            image: { fieldtype: 'asset', id: null, filename: '', alt: null },
          },
        ],
      },
    },
  ],
};
