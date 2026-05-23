import { linkMark, table, tableCell, tableHeader, tableRow, text } from './helpers';
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
export const customRendererFixture: Record<string, HtmlFixture> = {
  node_and_mark: {
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
    expected: '<h2 data-type="custom-heading" data-level="2">Custom Rich Text Test</h2><p>This is a <b data-type="custom-bold">bold text</b> with a <span style="color: rgb(27, 74, 230);">blue color</span> and a link to <a href="/richtext" target="_self" rel="noopener" title="Navigate to richtext page">some <em>Italic</em> link</a>.</p>',
  },
  recursive:
  {
    title: 'renders custom node overrides with recursive StoryblokRichText or renderRichtext in custom renderers',
    input: [{
      type: 'heading',
      attrs: { level: 1, textAlign: null },
      content: [text('Title', [{ type: 'bold' }])],
    }, {
      type: 'paragraph',
      attrs: { textAlign: 'center' },
      content: [text('Hello Storyblok', [{ type: 'bold' }])],
    }],
    expected: '<h1 data-type="custom-heading"><b data-type="custom-bold">Title</b></h1><p style="text-align: center;"><b data-type="custom-bold">Hello Storyblok</b></p>',
  },
  code_block:
  {
    title: 'allows custom code_block renderer to control attribute placement',
    input: {
      type: 'code_block',
      attrs: { class: 'typescript' },
      content: [text('const x: number = 1;')],
    },
    expected: '<pre class="language-typescript"><code data-lang="typescript">const x: number = 1;</code></pre>',
  },
  table:
  {
    title: 'allows custom table renderer',
    input: table([
      tableRow([tableHeader('Name'), tableHeader('Age'), tableHeader('Location')]),
      tableRow([tableCell('John', { colspan: 2 }, [{ type: 'bold' }]), tableCell('25'), tableCell('New York')]),
    ]),
    expected: '<table class="custom-table"> <thead> <tr><th><p>Name</p></th><th><p>Age</p></th><th><p>Location</p></th></tr> </thead> <tbody> <tr><td colspan="2"><p><b data-type="custom-bold">John</b></p></td><td><p>25</p></td><td><p>New York</p></td></tr> </tbody> </table>',
  },
};
