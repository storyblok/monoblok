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
      { type: 'heading', attrs: { level: 4, textAlign: 'right' }, content: [text('Feature Heading', [{ type: 'highlight', attrs: { color: '#aaa' } }, linkMark('/feature', { target: '_blank' })])] },
      { type: 'paragraph', attrs: { textAlign: 'center' }, content: [text('Intro', [{ type: 'bold' }, { type: 'styled', attrs: { class: 'lead' } }])] },
      { type: 'image', attrs: { id: 44, src: 'https://foo', alt: 'center', title: 'T', source: 'Z', copyright: null, meta_data: null } },
      { type: 'bullet_list', content: [{ type: 'list_item', content: [{ type: 'paragraph', content: [text('B')] }] }] },
      { type: 'blok', attrs: { id: 'blocky', body: [{ _uid: 'xyz', component: 'link', text: 'deep' }] } },
    ],
    expected: '<h4 style="text-align: right;"><a href="/feature" target="_blank"><mark style="background-color: #aaa;">Feature Heading</mark></a></h4><p style="text-align: center;"><span class="lead"><strong>Intro</strong></span></p><img id="44" src="https://foo" alt="center" title="T"><ul><li><p>B</p></li></ul>',
  },
];
