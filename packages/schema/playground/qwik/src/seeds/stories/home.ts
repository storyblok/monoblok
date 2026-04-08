import { createStoryHelpers } from '@storyblok/schema/mapi';
import type { Asset } from '@storyblok/management-api-client';
import { pageBlock } from '../../schema/components/page';
import { heroBlock } from '../../schema/components/hero';
import { introBlock } from '../../schema/components/intro';
import { mediaBlock } from '../../schema/components/media';
import { teaserBlock } from '../../schema/components/teaser';
import { teaserListBlock } from '../../schema/components/teaser-list';
import type { StoryblokTypes } from '../../schema/types';

const { defineStoryCreate } = createStoryHelpers().withTypes<StoryblokTypes>();

export function createHomeStory(mediaAsset: Asset) {
  return defineStoryCreate(pageBlock, {
    name: 'Home',
    slug: 'home',
    content: {
      seo_title: 'Welcome — Storyblok + Qwik Demo',
      seo_description: 'A demo site built with Storyblok, @storyblok/schema, and Qwik.',
      blocks: [
        {
          component: heroBlock.name,
          eyebrow: 'Built with Storyblok',
          headline: 'Code-driven content, fully typed.',
          image: null,
        },
        {
          component: introBlock.name,
          eyebrow: 'How it works',
          headline: 'Schema-first Storyblok development',
          body: `Define your components in TypeScript using \`@storyblok/schema\`, push them to Storyblok with the Management API, and fetch content with full type safety using \`@storyblok/api-client\`.`,
        },
        {
          component: mediaBlock.name,
          image: {
            id: mediaAsset.id,
            fieldtype: 'asset',
            filename: mediaAsset.filename,
            alt: mediaAsset.alt ?? 'Home image',
          },
          caption: 'The monoblok monorepo — schema-first Storyblok development.',
          text: `### Why schema-first?\n\nDefining your Storyblok components in TypeScript means your content model and your application code stay in sync. Rename a field in your schema and the compiler tells you every place that needs updating.\n\nNo more runtime surprises — just confidence from editor to production.`,
        },
        {
          component: teaserListBlock.name,
          headline: 'Explore the features',
          items: [
            {
              component: teaserBlock.name,
              title: 'Type-safe schema',
              description: 'Define reusable fields and components in TypeScript. Types flow from schema to fetch calls.',
              image: null,
              link: null,
            },
            {
              component: teaserBlock.name,
              title: 'Management API client',
              description: 'Push components and stories to Storyblok programmatically using @storyblok/management-api-client.',
              image: null,
              link: null,
            },
            {
              component: teaserBlock.name,
              title: 'Content Delivery API client',
              description: 'Fetch stories with a typed client that understands your schema\'s discriminated unions.',
              image: null,
              link: null,
            },
          ],
        },
      ],
    },
  });
}
