import { describe, expect, it } from 'vitest';
import { customRendererFixture, integrationFixtures, linkFixtures, markFixtures, nodeFixtures, tableFixtures } from '@storyblok/richtext/test-utils';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import StoryblokRichText from '../src/components/StoryblokRichText.astro';
import Heading from './richtext/Heading.astro';
import Bold from './richtext/Bold.astro';
import CustomLink from './richtext/CustomLink.astro';
import CodeBlock from './richtext/CodeBlock.astro';
import CustomTable from './richtext/CustomTable.astro';
// Removes source file and location attributes that Astro adds for hydration
const clean = (result: string) => result.replace(/ data-astro-source-file="[^"]*"/g, '').replace(/ data-astro-source-loc="[^"]*"/g, '');

describe('storyblok Richtext', async () => {
  describe('input handling', async () => {
    it('returns empty string for null input', async () => {
      const container = await AstroContainer.create();
      const result = await container.renderToString(StoryblokRichText, {
        props: {
          document: null,
        },
      });
      expect(clean(result)).toBe('');
    });
    it('returns empty string for undefined input', async () => {
      const container = await AstroContainer.create();
      const result = await container.renderToString(StoryblokRichText, {
        props: {
          document: undefined,
        },
      });
      expect(result).toBe('');
    });
    it('returns empty string for empty array', async () => {
      const container = await AstroContainer.create();
      const result = await container.renderToString(StoryblokRichText, {
        props: {
          document: [],
        },
      });
      expect(result).toBe('');
    });
  });
  describe('nodes', async () => {
    nodeFixtures.forEach(({ title, input, expected }) => {
      it(title, async () => {
        const container = await AstroContainer.create();
        const result = await container.renderToString(StoryblokRichText, {
          props: {
            document: input,
          },
        });
        expect(clean(result)).toBe(expected);
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
        expect(clean(result)).toBe(expected);
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
        expect(clean(result)).toBe(expected);
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
        expect(clean(result)).toBe(expected);
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
        expect(clean(result)).toBe(expected);
      });
    });
  });
  describe('custom renderers', async () => {
    const node_and_mark = customRendererFixture.node_and_mark;
    it(node_and_mark.title, async () => {
      const container = await AstroContainer.create();
      const result = await container.renderToString(StoryblokRichText, {
        props: {
          document: node_and_mark.input,
          components: {
            heading: Heading,
            bold: Bold,
            link: CustomLink,
          },
        },
      });
      expect(clean(result)).toBe(node_and_mark.expected);
    });
    const recursive = customRendererFixture.recursive;
    it(recursive.title, async () => {
      const container = await AstroContainer.create();

      const result = await container.renderToString(StoryblokRichText, {
        props: {
          document: recursive.input,
          components: {
            heading: Heading,
            bold: Bold,
          },
        },
      });
      expect(clean(result)).toBe(recursive.expected);
    });
    const code_block = customRendererFixture.code_block;
    it(code_block.title, async () => {
      const container = await AstroContainer.create();

      const result = await container.renderToString(StoryblokRichText, {
        props: {
          document: code_block.input,
          components: {
            code_block: CodeBlock,
          },
        },
      });
      expect(clean(result)).toBe(code_block.expected);
    });
    const table = customRendererFixture.table;
    it(table.title, async () => {
      const container = await AstroContainer.create();
      const result = await container.renderToString(StoryblokRichText, {
        props: {
          document: table.input,
          components: {
            table: CustomTable,
            bold: Bold,
          },
        },
      });
      expect(clean(result)).toBe(table.expected);
    });
  });
});
