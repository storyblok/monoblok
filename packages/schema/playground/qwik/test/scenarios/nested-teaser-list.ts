import type { Scenario } from '../helpers/seed';
import { pageBlock } from '../../src/schema/components/page';
import { heroBlock } from '../../src/schema/components/hero';
import { teaserListBlock } from '../../src/schema/components/teaser-list';
import { teaserBlock } from '../../src/schema/components/teaser';

export const nestedTeaserListScenario: Scenario = {
  stories: () => [
    {
      name: 'Home',
      slug: 'home',
      content: {
        component: pageBlock.name,
        seo_title: 'Nested Teaser List Test',
        seo_description: 'E2E test scenario: nested teaser list.',
        blocks: [
          {
            component: heroBlock.name,
            eyebrow: 'Teaser Test',
            headline: 'Teaser List Headline',
            image: { fieldtype: 'asset', id: null, filename: '', alt: null },
          },
          {
            component: teaserListBlock.name,
            headline: 'Our Features',
            items: [
              {
                component: teaserBlock.name,
                title: 'Teaser One',
                description: 'First teaser description.',
                image: { fieldtype: 'asset', id: null, filename: '', alt: null },
                link: { fieldtype: 'multilink', id: '', url: '', linktype: 'story', cached_url: '' },
              },
              {
                component: teaserBlock.name,
                title: 'Teaser Two',
                description: 'Second teaser description.',
                image: { fieldtype: 'asset', id: null, filename: '', alt: null },
                link: {
                  fieldtype: 'multilink',
                  id: '',
                  linktype: 'url',
                  url: 'https://www.storyblok.com',
                  cached_url: 'https://www.storyblok.com',
                },
              },
              {
                component: teaserBlock.name,
                title: 'Teaser Three',
                description: 'Third teaser description.',
                image: { fieldtype: 'asset', id: null, filename: '', alt: null },
                link: { fieldtype: 'multilink', id: '', url: '', linktype: 'story', cached_url: '' },
              },
            ],
          },
        ],
      },
    },
  ],
};
