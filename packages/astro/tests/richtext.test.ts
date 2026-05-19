import { describe, expect, it } from 'vitest';
import { integrationFixtures, linkFixtures, linkMark, markFixtures, nodeFixtures, tableFixtures, text } from '@storyblok/richtext/test-utils';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import StoryblokRichText from '../src/components/StoryblokRichText.astro';
import type { SbRichTextDoc } from '../src/index';
import Heading from './richtext/Heading.astro';
import Bold from './richtext/Bold.astro';
import CustomLink from './richtext/CustomLink.astro';

describe('storyblokRichText.astro', () => {
  describe('nodes', async () => {
    nodeFixtures.forEach(({ title, input, expected }) => {
      it(title, async () => {
        const container = await AstroContainer.create();
        const result = await container.renderToString(StoryblokRichText, {
          props: {
            document: input,
          },
        });
        expect(result).toBe(expected);
      });
    });
  });
  describe('tables', async () => {
    tableFixtures.forEach(({ title, input, expected }) => {
      it(title, async () => {
        const container = await AstroContainer.create();

        const result = await container.renderToString(StoryblokRichText, {
          props: {
            document: input,
          },
        });
        expect(result).toBe(expected);
      });
    });
  });
  describe('marks', async () => {
    markFixtures.forEach(({ title, input, expected }) => {
      it(title, async () => {
        const container = await AstroContainer.create();

        const result = await container.renderToString(StoryblokRichText, {
          props: {
            document: input,
          },
        });
        expect(result).toBe(expected);
      });
    });
  });

  describe('links', async () => {
    linkFixtures.forEach(({ title, input, expected }) => {
      it(title, async () => {
        const container = await AstroContainer.create();

        const result = await container.renderToString(StoryblokRichText, {
          props: {
            document: input,
          },
        });
        expect(result).toBe(expected);
      });
    });
  });
  describe('integration', async () => {
    integrationFixtures.forEach(({ title, input, expected }) => {
      it(title, async () => {
        const container = await AstroContainer.create();

        const result = await container.renderToString(StoryblokRichText, {
          props: {
            document: input,
          },
        });
        expect(result).toBe(expected);
      });
    });
  });
  describe('custom components', async () => {
    it('renders custom components from the components map', async () => {
      const document: SbRichTextDoc = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 2, textAlign: 'center' },
            content: [{ type: 'text', text: 'Hello World', marks: [{ type: 'bold' }] }],
          },
          text('This is an internal story', [linkMark('/page', { linktype: 'story', anchor: 'intro' })]),
        ],
      };

      const container = await AstroContainer.create();

      const result = await container.renderToString(StoryblokRichText, {
        props: {
          document,
          components: {
            heading: Heading,
            bold: Bold,
            link: CustomLink,
          },
        },
      });
      // This removes the source file and location attributes that Astro adds for hydration, since they would make the snapshot brittle. The presence of these attributes is tested in Astro's own tests, so we don't need to test them here.
      const clean = result.replace(/ data-astro-source-file="[^"]*"/g, '').replace(/ data-astro-source-loc="[^"]*"/g, '');

      expect(clean).toBe(`<p data-type="custom-heading" data-level="2"><b data-type="custom-bold">Hello World</b></p><a data-type="custom-link" href="/page#intro" target="_self">This is an internal story</a>`);
    });
  });
});
