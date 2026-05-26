import { describe, expect, it } from 'vitest';
import { htmlToStoryblokRichtext } from './html-parser';
import { renderRichText } from './render-richtext';
import { mapToAttribute } from './extensions/utils';
import { doc } from './test-utils/helpers';
import { linkFixtures, markFixtures, nodeFixtures, tableFixtures } from './test-utils';

describe('hTML → Richtext (strict): Input handling', () => {
  it('returns doc with empty paragraph for empty string', () => {
    const document = htmlToStoryblokRichtext('');
    expect(document).toMatchObject(doc({ type: 'paragraph' }));
  });

  it('returns doc with empty paragraph for whitespace-only input', () => {
    const document = htmlToStoryblokRichtext('   \n\t  ');
    expect(document).toMatchObject(doc({ type: 'paragraph' }));
  });
});

describe('hTML → Richtext (strict): nodes', () => {
  nodeFixtures.forEach(({ title, expected }) => {
    it(title, () => {
      const document = htmlToStoryblokRichtext(expected);
      const html = renderRichText(document);
      // tipta generateJSON sometimes wraps content in a <p> as part of parse html, so we should allow for both cases in our test assertion
      const htmlWithoutP = html.replace(/^<p>([\s\S]*)<\/p>$/, '$1');
      expect(html === expected || htmlWithoutP === expected).toBe(true);
    });
  });
});

describe('hTML → Richtext (strict): marks', () => {
  markFixtures.forEach(({ title, expected }) => {
    it(title, () => {
      const document = htmlToStoryblokRichtext(expected);
      const html = renderRichText(document);
      // tipta generateJSON sometimes wraps content in a <p> as part of parse html, so we should allow for both cases in our test assertion
      const htmlWithoutP = html.replace(/^<p>([\s\S]*)<\/p>$/, '$1');
      expect(html === expected || htmlWithoutP === expected).toBe(true);
    });
  });
});

describe('hTML → Richtext (strict): Links', () => {
  linkFixtures.forEach(({ title, expected }) => {
    it(title, () => {
      const document = htmlToStoryblokRichtext(expected);
      const html = renderRichText(document);
      // tipta generateJSON sometimes wraps content in a <p> as part of parse html, so we should allow for both cases in our test assertion
      const htmlWithoutP = html.replace(/^<p>([\s\S]*)<\/p>$/, '$1');
      expect(html === expected || htmlWithoutP === expected).toBe(true);
    });
  });
});
describe('hTML → Richtext (strict): Table', () => {
  tableFixtures.forEach(({ title, expected }) => {
    it(title, () => {
      const document = htmlToStoryblokRichtext(expected);
      const html = renderRichText(document);
      // tipta generateJSON sometimes wraps content in a <p> as part of parse html, so we should allow for both cases in our test assertion
      const htmlWithoutP = html.replace(/^<p>([\s\S]*)<\/p>$/, '$1');
      expect(html === expected || htmlWithoutP === expected).toBe(true);
    });
  });
});

describe('hTML → Richtext (strict): Custom parsers', () => {
  it('parses emoji with custom extension', () => {
    const html = '<div data-type="emoji" data-test="rocket" data-emoji="🚀"><img src="https://cdn.example.com/rocket.png" alt="🚀"></div>';
    const result = htmlToStoryblokRichtext(html, {
      parsers: {
        emoji: {
          parseHTML: () => [{ tag: 'div[data-type="emoji"]' }],
          attributeParsers: {
            name: mapToAttribute(['data-test', 'data-name']),
            emoji: mapToAttribute('data-emoji'),
            fallbackImage: (el) => {
              const img = el.querySelector('img');
              return img ? img.getAttribute('src')! : null;
            },
          },
        },
      },
    });
    expect(result).toEqual(doc({
      type: 'paragraph',
      attrs: { textAlign: null },
      content: [{
        type: 'emoji',
        attrs: {
          name: 'rocket',
          emoji: '🚀',
          fallbackImage: 'https://cdn.example.com/rocket.png',
        },
      }],
    }));
  });

  it('parses code block with custom language extraction', () => {
    const html = '<pre><code class="language-typescript">const greeting: string = "Hello";</code></pre>';
    const result = htmlToStoryblokRichtext(html, {
      parsers: {
        code_block: {
          attributeParsers: {
            class: (el) => {
              const codeEl = el.querySelector('code');
              const className = codeEl?.getAttribute('class') || '';
              const match = className.match(/(?:language|lang)-(\w+)/);
              return match ? match[1] : null;
            },
          },
        },
      },
    });
    expect(result).toEqual(doc({
      type: 'code_block',
      attrs: { class: 'typescript' },
      content: [{ type: 'text', text: 'const greeting: string = "Hello";' }],
    }));
  });

  it('parses image with custom meta_data extraction', () => {
    const html = `<img 
      src="https://a.storyblok.com/f/12345/800x600/image.jpg" 
      alt="A beautiful landscape" 
      title="Mountain View"
      data-source="Unsplash"
      data-copyright="© 2024 Photographer Name"
    >`;
    const result = htmlToStoryblokRichtext(html, {
      parsers: {
        image: {
          attributeParsers: {
            source: mapToAttribute('data-source'),
            copyright: mapToAttribute('data-copyright'),
            meta_data: el => ({
              alt: mapToAttribute('alt')(el),
              title: el.getAttribute('title'),
              source: el.getAttribute('data-source'),
              copyright: el.getAttribute('data-copyright'),
            }),
          },
        },
      },
    });
    expect(result).toEqual(doc({
      type: 'image',
      attrs: {
        id: null,
        src: 'https://a.storyblok.com/f/12345/800x600/image.jpg',
        alt: 'A beautiful landscape',
        title: 'Mountain View',
        source: 'Unsplash',
        copyright: '© 2024 Photographer Name',
        meta_data: {
          alt: 'A beautiful landscape',
          title: 'Mountain View',
          source: 'Unsplash',
          copyright: '© 2024 Photographer Name',
        },
      },
    }));
  });
});
