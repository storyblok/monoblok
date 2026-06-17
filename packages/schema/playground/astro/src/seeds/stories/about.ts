import { createStoryHelpers } from '@storyblok/schema';
import type { Asset } from '@storyblok/management-api-client';
import { pageBlock } from '../../schema/blocks/page';
import { heroBlock } from '../../schema/blocks/hero';
import { introBlock } from '../../schema/blocks/intro';
import { mediaBlock } from '../../schema/blocks/media';
import type { Schema } from '../../schema/schema';

const { defineStoryCreate } = createStoryHelpers().withTypes<Schema>();

export function createAboutStory(mediaAsset: Asset) {
  return defineStoryCreate(pageBlock, {
    name: 'About',
    slug: 'about',
    content: {
      seo_title: 'About — Storyblok + Astro Demo',
      seo_description: 'Learn about this Storyblok + Astro demo project.',
      blocks: [
        {
          component: heroBlock.name,
          eyebrow: 'About this project',
          headline: 'A monorepo playground for Storyblok packages.',
          image: null,
        },
        {
          component: mediaBlock.name,
          image: {
            id: mediaAsset.id,
            fieldtype: 'asset',
            filename: mediaAsset.filename,
            alt: mediaAsset.alt ?? 'About image',
          },
          caption: 'The monoblok monorepo — a playground for Storyblok open-source packages.',
          text: `### What is monoblok?\n\nmonoblok is the official monorepo for Storyblok open-source packages. It hosts the Management API client, the Content Delivery API client, the schema utilities, and framework integrations — all developed and tested together.\n\nContributions are welcome. Open an issue or a pull request on GitHub to get started.`,
        },
        {
          component: introBlock.name,
          eyebrow: 'The stack',
          headline: 'Astro + Storyblok + TypeScript',
          body: `This playground lives inside the **monoblok** monorepo — the official home for Storyblok open-source packages. It demonstrates how to build a fully type-safe Storyblok-powered site using \`@storyblok/schema\`, \`@storyblok/api-client\`, and \`@storyblok/management-api-client\`.`,
        },
      ],
    },
  });
}
