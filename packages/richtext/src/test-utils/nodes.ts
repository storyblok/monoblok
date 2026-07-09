import { text } from './helpers';
import type { SbRichTextNode } from '../static';
import type { HtmlFixture } from './types';

export const nodeFixtures: HtmlFixture[] = [
  {
    title: 'paragraph',
    input: { type: 'paragraph', attrs: { textAlign: null }, content: [text('Hello')] },
    expected: '<p>Hello</p>',
  },
  {
    title: 'empty paragraph',
    input: { type: 'paragraph', attrs: { textAlign: null }, content: [] },
    expected: '<p></p>',
  },
  {
    title: 'doc',
    input: { type: 'doc', content: [] },
    expected: '',
  },
  {
    title: 'text node only',
    input: text('Just text'),
    expected: 'Just text',
  },
  {
    title: 'blockquote',
    input: { type: 'blockquote', content: [{ type: 'paragraph', attrs: { textAlign: null }, content: [text('Quote')] }] },
    expected: '<blockquote><p>Quote</p></blockquote>',
  },
  {
    title: 'bullet list',
    input: { type: 'bullet_list', content: [{ type: 'list_item', content: [{ type: 'paragraph', attrs: { textAlign: null }, content: [text('List')] }] }] },
    expected: '<ul><li><p>List</p></li></ul>',
  },
  {
    title: 'ordered list',
    input: { type: 'ordered_list', attrs: { order: 5 }, content: [{ type: 'list_item', content: [{ type: 'paragraph', attrs: { textAlign: null }, content: [text('Ordered')] }] }] },
    expected: '<ol start="5"><li><p>Ordered</p></li></ol>',
  },
  {
    title: 'code block',
    input: { type: 'code_block', attrs: { class: 'js' }, content: [text('const x = 1;')] },
    expected: '<pre><code class="js">const x = 1;</code></pre>',
  },
  {
    title: 'hard break',
    input: { type: 'hard_break' },
    expected: '<br>',
  },
  {
    title: 'horizontal rule',
    input: { type: 'horizontal_rule' },
    expected: '<hr>',
  },
  {
    title: 'image',
    input: {
      type: 'image',
      attrs: {
        id: 1,
        src: 'https://example.com/image.jpg',
        alt: 'Image',
        title: 'Title',
        source: null,
        copyright: null,
        meta_data: null,
      },
    },
    expected: '<img id="1" src="https://example.com/image.jpg" alt="Image" title="Title">',
  },
  {
    title: 'renders array of nodes',
    input: [
      { type: 'paragraph', attrs: { textAlign: null }, content: [text('First')] },
      { type: 'paragraph', attrs: { textAlign: null }, content: [text('Second')] },
    ],
    expected: '<p>First</p><p>Second</p>',
  },
  {
    title: 'renders nested doc nodes',
    input: {
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { textAlign: null }, content: [text('Outer')] },
        // doc nested inside content — runtime edge case the renderer handles
        { type: 'doc', content: [{ type: 'paragraph', content: [text('Inner')] }] } as unknown as SbRichTextNode,
      ],
    },
    expected: '<p>Outer</p><p>Inner</p>',
  },
  {
    title: 'emoji',
    input: {
      type: 'emoji',
      attrs: { fallbackImage: 'https://cdn.example.com/rocket.png', name: 'rocket', emoji: '🚀' },
    },
    expected:
          '<img draggable="false" loading="lazy" src="https://cdn.example.com/rocket.png" data-name="rocket" data-emoji="🚀" style="width: 1.25em; height: 1.25em; vertical-align: text-top;">',
  },
  // need to add heading and with heading alignment
];
const textAlignments: ('center' | 'left' | 'right' | 'justify' | null)[] = ['center', 'left', 'right', 'justify'];
const possibleHeadings: (1 | 2 | 3 | 4 | 5 | 6)[] = [1, 2, 3, 4, 5, 6];
const textNodeFixtures: HtmlFixture[] = textAlignments.map(align => ({
  title: `text node with ${align} alignment`,
  input: {
    type: 'paragraph',
    attrs: { textAlign: align },
    content: [text('Aligned text')],
  },
  expected: `<p style="text-align: ${align};">Aligned text</p>`,
}));

const headingFixtures: HtmlFixture[] = possibleHeadings.map((level) => {
  const align = textAlignments[Math.floor(Math.random() * textAlignments.length)];
  return {
    title: `heading level ${level}`,
    input: {
      type: 'heading',
      attrs: { level, textAlign: align },
      content: [text(`Heading ${level}`)],
    },
    expected: `<h${level} style="text-align: ${align};">Heading ${level}</h${level}>`,
  };
});

const imageFixtures: HtmlFixture[] = [
  {
    title: 'renders image with attributes',
    input: {
      type: 'image',
      attrs: {
        id: 1,
        src: 'https://example.com/image.jpg',
        alt: 'Image',
        title: 'Title',
        source: null,
        copyright: null,
        meta_data: null,
      },
    },
    expected: '<img id="1" src="https://example.com/image.jpg" alt="Image" title="Title">',
  },
  {
    title: 'filters out meta_data, source, and copyright from output',
    input: {
      type: 'image',
      attrs: {
        id: 2,
        src: 'https://example.com/photo.png',
        alt: 'Photo',
        title: 'Photo Title',
        source: 'Camera',
        copyright: '© 2024',
        meta_data: {
          alt: 'Photo',
          title: 'Photo Title',
          source: 'Camera',
          copyright: '© 2024',
        },
      },
    },
    expected: '<img id="2" src="https://example.com/photo.png" alt="Photo" title="Photo Title">',
  },
];

export const allNodeFixtures = [...nodeFixtures, ...textNodeFixtures, ...headingFixtures, ...imageFixtures];
