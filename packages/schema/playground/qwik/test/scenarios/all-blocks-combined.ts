import type { Scenario } from '../helpers/seed';
import { pageBlock } from '../../src/schema/components/page';
import { heroBlock } from '../../src/schema/components/hero';
import { introBlock } from '../../src/schema/components/intro';
import { mediaBlock } from '../../src/schema/components/media';
import { teaserListBlock } from '../../src/schema/components/teaser-list';
import { teaserBlock } from '../../src/schema/components/teaser';

export const allBlocksScenario: Scenario = {
  needsAssets: true,
  stories: ({ mediaImage }) => [
    {
      name: 'Home',
      slug: 'home',
      content: {
        component: pageBlock.name,
        seo_title: 'All Blocks Test',
        seo_description: 'E2E test scenario: all block types combined.',
        blocks: [
          {
            component: heroBlock.name,
            eyebrow: 'All Blocks',
            headline: 'All Blocks Combined Headline',
            image: null,
          },
          {
            component: introBlock.name,
            eyebrow: 'Intro Section',
            headline: 'Intro Headline',
            body: `This is some intro body content.`,
          },
          {
            component: mediaBlock.name,
            image: {
              id: mediaImage.id,
              fieldtype: 'asset',
              filename: mediaImage.filename,
              alt: mediaImage.alt ?? 'Test media image',
            },
            caption: 'Test image caption',
            text: `### Media heading\n\nMedia text with **strong** content.`,
          },
          {
            component: teaserListBlock.name,
            headline: 'Teaser Section',
            items: [
              {
                component: teaserBlock.name,
                title: 'Combined Teaser One',
                description: 'First teaser in combined scenario.',
                image: null,
                link: null,
              },
              {
                component: teaserBlock.name,
                title: 'Combined Teaser Two',
                description: 'Second teaser in combined scenario.',
                image: null,
                link: null,
              },
            ],
          },
        ],
      },
    },
  ],
};
