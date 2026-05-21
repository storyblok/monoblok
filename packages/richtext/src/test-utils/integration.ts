import { linkMark, text } from './helpers';
import type { HtmlFixture } from './types';

export const integrationFixtures: HtmlFixture[] = [
  {
    title: 'combines alignment with marks',
    input: {
      type: 'paragraph',
      attrs: { textAlign: 'center' },
      content: [text('Centered text with ', [linkMark('/url')]), text('link', [linkMark('/url')])],
    },
    expected: '<p style="text-align: center;"><a href="/url">Centered text with link</a></p>',
  },
  {
    title: 'renders empty paragraph with alignment',
    input: {
      type: 'paragraph',
      attrs: { textAlign: 'center' },
      content: [],
    },
    expected: '<p style="text-align: center;"></p>',
  },
  {
    title: 'kitchen sink document',
    input: [
      { type: 'heading', attrs: { level: 4, textAlign: 'right' }, content: [text('Feature Heading', [{ type: 'highlight', attrs: { color: 'rgb(204, 255, 204)' } }, linkMark('/feature', { target: '_blank' })])] },
      { type: 'paragraph', attrs: { textAlign: 'center' }, content: [text('Intro', [{ type: 'bold' }, { type: 'styled', attrs: { class: 'lead' } }])] },
      { type: 'image', attrs: { id: 44, src: 'https://foo', alt: 'center', title: 'T', source: 'Z', copyright: null, meta_data: null } },
      { type: 'bullet_list', content: [{ type: 'list_item', content: [{ type: 'paragraph', content: [text('B')] }] }] },
    ],
    expected: '<h4 style="text-align: right;"><a href="/feature" target="_blank"><mark style="background-color: rgb(204, 255, 204);">Feature Heading</mark></a></h4><p style="text-align: center;"><span class="lead"><strong>Intro</strong></span></p><img id="44" src="https://foo" alt="center" title="T"><ul><li><p>B</p></li></ul>',
  },
];

const testLinkMark = linkMark('/richtext', { linktype: 'story', target: '_self', custom: { rel: 'noopener', title: 'Navigate to richtext page' } });
export const customRendererFixture: HtmlFixture = {
  title: 'renders custom node and mark overrides',
  input: {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: {
          level: 2,
          textAlign: null,
        },
        content: [
          {
            text: 'Custom Rich Text Test',
            type: 'text',
          },
        ],
      },
      {
        type: 'paragraph',
        attrs: {
          textAlign: null,
        },
        content: [
          text('This is a '),
          text('bold text', [{ type: 'bold' }]),
          text(' with a '),
          text('blue color', [{
            type: 'textStyle',
            attrs: {
              color: 'rgb(27, 74, 230)',
            },
          }]),
          text(' and a link to '),
          text('some ', [testLinkMark]),
          text('Italic', [testLinkMark, { type: 'italic' }]),
          text(' link', [testLinkMark]),
          text('.'),

        ],
      },
    ],
  },
  expected: '<p data-type="custom-heading" data-level="2">Custom Rich Text Test</p><p>This is a <b data-type="custom-bold">bold text</b> with a <span style="color: rgb(27, 74, 230);">blue color</span> and a link to <a data-type="custom-link" href="/richtext" target="_blank">some <em>Italic</em> link</a>.</p>',
};
