import { text } from './helpers';
import type { HtmlFixture } from './types';

export const markFixtures: HtmlFixture[] = [
  {
    title: 'bold mark',
    input: text('Bold', [{ type: 'bold' }]),
    expected: '<strong>Bold</strong>',
  },
  {
    title: 'italic mark',
    input: text('Italic', [{ type: 'italic' }]),
    expected: '<em>Italic</em>',
  },
  {
    title: 'strike mark',
    input: text('Strike', [{ type: 'strike' }]),
    expected: '<s>Strike</s>',
  },
  {
    title: 'underline mark',
    input: text('Underline', [{ type: 'underline' }]),
    expected: '<u>Underline</u>',
  },
  {
    title: 'code mark',
    input: text('code', [{ type: 'code' }]),
    expected: '<code>code</code>',
  },
  {
    title: 'superscript mark',
    input: text('sup', [{ type: 'superscript' }]),
    expected: '<sup>sup</sup>',
  },
  {
    title: 'subscript mark',
    input: text('sub', [{ type: 'subscript' }]),
    expected: '<sub>sub</sub>',
  },
  {
    title: 'highlight mark',
    input: text('Highlight', [{ type: 'highlight' }]),
    expected: '<mark>Highlight</mark>', // highlight is typically rendered as <mark>
  },
  {
    title: 'anchor mark',
    input: text('Anchored', [{ type: 'anchor', attrs: { id: 'section-1' } }]),
    expected: '<span id="section-1">Anchored</span>',
  },
  {
    title: 'styled mark',
    input: text('Styled', [{ type: 'styled', attrs: { class: 'highlight' } }]),
    expected: '<span class="highlight">Styled</span>',
  },
  {
    title: 'textStyle mark w/ color',
    input: text('Red', [{ type: 'textStyle', attrs: { color: 'red', id: null, class: null } }]),
    expected: '<span style="color: red;">Red</span>',
  },
  {
    title: 'renders nested marks',
    input: text('Bold Italic', [{ type: 'bold' }, { type: 'italic' }]),
    expected: '<em><strong>Bold Italic</strong></em>',
  },
  {
    title: 'renders anchor mark as span with id',
    input: text('Section 1', [{ type: 'anchor', attrs: { id: 'section-1' } }]),
    expected: '<span id="section-1">Section 1</span>',
  },
];
