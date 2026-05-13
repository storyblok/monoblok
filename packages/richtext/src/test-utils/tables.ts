import { linkMark, table, tableCell, tableHeader, tableRow, text } from './helpers';
import type { HtmlFixture } from './types';

export const tableFixtures: HtmlFixture[] = [
  {
    title: 'table with header and body',
    input: table([
      tableRow([tableHeader('H1'), tableHeader('H2')]),
      tableRow([tableCell('C1'), tableCell('C2')]),
    ]),
    expected:
      '<table><thead><tr><th><p>H1</p></th><th><p>H2</p></th></tr></thead><tbody><tr><td><p>C1</p></td><td><p>C2</p></td></tr></tbody></table>',
  },
  {
    title: 'renders basic table with tbody',
    input: table([tableRow([tableCell('A'), tableCell('B')])]),
    expected: '<table><tbody><tr><td><p>A</p></td><td><p>B</p></td></tr></tbody></table>',
  },
  {
    title: 'renders colspan and rowspan',
    input: table([tableRow([tableCell('Merged', { colspan: 2, rowspan: 2 })])]),
    expected: '<table><tbody><tr><td colspan="2" rowspan="2"><p>Merged</p></td></tr></tbody></table>',
  },
  {
    title: 'renders colwidth and backgroundColor',
    input: table([
      tableRow([
        tableCell('Styled', { colwidth: [100], backgroundColor: '#cfc' }),
        tableCell('Normal'),
      ]),
    ]),
    expected:
      '<table><tbody><tr><td style="width: 100px; background-color: #cfc;"><p>Styled</p></td><td><p>Normal</p></td></tr></tbody></table>',
  },
  {
    title: 'combines multiple styles on a cell',
    input: table([
      tableRow([
        tableCell('cell', { backgroundColor: '#cfc' }),
        tableCell('cell2', { colwidth: [200], colspan: 2, backgroundColor: '#cfc' }),
        tableCell('cell3', { colwidth: [300] }),
      ]),
    ]),
    expected:
      '<table><tbody><tr><td style="background-color: #cfc;"><p>cell</p></td><td colspan="2" style="width: 200px; background-color: #cfc;"><p>cell2</p></td><td style="width: 300px;"><p>cell3</p></td></tr></tbody></table>',
  },
  {
    title: 'renders complex table',
    input: {
      type: 'table',
      content: [
        tableRow([
          { type: 'tableHeader', attrs: { colspan: 1, rowspan: 1, colwidth: [100] }, content: [{ type: 'paragraph', content: [text('THead')] }] },
        ]),
        tableRow([
          {
            type: 'tableCell',
            attrs: { colspan: 1, rowspan: 1, backgroundColor: '#cfc' },
            content: [
              { type: 'paragraph', content: [text('cell', [{ type: 'superscript' }, linkMark('/c')])] },
              { type: 'emoji', attrs: { emoji: '✈️', name: 'plane', fallbackImage: 'https://cdn/foo.png' } },
            ],
          },
        ]),
      ],
    },
    expected:
      '<table><thead><tr><th style="width: 100px;"><p>THead</p></th></tr></thead><tbody><tr><td style="background-color: #cfc;"><p><a href="/c"><sup>cell</sup></a></p><img draggable="false" loading="lazy" data-emoji="✈️" data-name="plane" src="https://cdn/foo.png" style="width: 1.25em; height: 1.25em; vertical-align: text-top;"></td></tr></tbody></table>',
  },
];
