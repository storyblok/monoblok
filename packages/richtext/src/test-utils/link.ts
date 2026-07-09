import { linkMark, text } from './helpers';
import type { HtmlFixture } from './types';

export const linkFixtures: HtmlFixture[] = [
  {
    title: 'external link',
    input: text('Click', [linkMark('https://example.com', { target: '_blank' })]),
    expected: '<a href="https://example.com" target="_blank">Click</a>',
  },
  {
    title: 'internal story link',
    input: text('Page', [linkMark('/about', { linktype: 'story' })]),
    expected: '<a href="/about">Page</a>',
  },
  {
    title: 'story link with anchor',
    input: text('Section', [linkMark('/page', { linktype: 'story', anchor: 'intro' })]),
    expected: '<a href="/page#intro">Section</a>',
  },
  {
    title: 'email link',
    input: text('Email', [linkMark('test@example.com', { linktype: 'email' })]),
    expected: '<a href="mailto:test@example.com">Email</a>',
  },
  {
    title: 'asset link',
    input: text('Download', [linkMark('https://assets.example.com/file.pdf', { linktype: 'asset' })]),
    expected: '<a href="https://assets.example.com/file.pdf">Download</a>',
  },
  {
    title: 'merged links',
    input: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textAlign: null },
          content: [
            text('Hello ', [linkMark('/url')]),
            text('World', [linkMark('/url')]),
          ],
        },
      ],
    },
    expected: '<p><a href="/url">Hello World</a></p>',
  },
  {
    title: 'merge groups when link with same custom attributes',
    input: {
      type: 'doc',
      content: [{
        type: 'paragraph',
        attrs: { textAlign: null },
        content: [
          text('Hello ', [linkMark('/a', { custom: { title: 'google' } })]),
          text('Storyblok', [linkMark('/a', { custom: { title: 'google' } })]),
        ],
      }],
    },
    expected: '<p><a href="/a" title="google">Hello Storyblok</a></p>',
  },
  {
    title: 'preserves inner marks when merging',
    input: {
      type: 'doc',
      content: [{
        type: 'paragraph',
        attrs: { textAlign: null },
        content: [
          text('normal ', [linkMark('/url')]),
          text('bold', [{ type: 'bold' }, linkMark('/url')]),
          text(' text', [linkMark('/url')]),
        ],
      }],
    },
    expected: '<p><a href="/url">normal <strong>bold</strong> text</a></p>',
  },
  {
    title: 'handles multiple inner marks',
    input: {
      type: 'doc',
      content: [{
        type: 'paragraph',
        attrs: { textAlign: null },
        content: [
          text('start ', [linkMark('/url')]),
          text('bold', [{ type: 'bold' }, linkMark('/url')]),
          text(' and ', [linkMark('/url')]),
          text('italic', [{ type: 'italic' }, linkMark('/url')]),
          text(' end', [linkMark('/url')]),
        ],
      }],
    },
    expected: '<p><a href="/url">start <strong>bold</strong> and <em>italic</em> end</a></p>',
  },
  {
    title: 'breaks group on non-text node',
    input: {
      type: 'doc',
      content: [{
        type: 'paragraph',
        attrs: { textAlign: null },
        content: [
          text('Before ', [linkMark('/x')]),
          { type: 'hard_break' },
          text('After', [linkMark('/x')]),
        ],
      }],
    },
    expected: '<p><a href="/x">Before </a><br><a href="/x">After</a></p>',
  },
  {
    title: 'breaks group when link attributes differ',
    input: {
      type: 'doc',
      content: [{
        type: 'paragraph',
        attrs: { textAlign: null },
        content: [
          text('A', [linkMark('/a')]),
          text('B', [linkMark('/a', { target: '_blank' })]),
        ],
      }],
    },
    expected: '<p><a href="/a">A</a><a href="/a" target="_blank">B</a></p>',
  },
  {
    title: 'separates groups when link with different custom attributes',
    input: {
      type: 'doc',
      content: [{
        type: 'paragraph',
        attrs: { textAlign: null },
        content: [
          text('A', [linkMark('/a', { custom: { title: 'google' } })]),
          text('B', [linkMark('/a', { custom: { title: 'new' } })]),
        ],
      }],
    },
    expected: '<p><a href="/a" title="google">A</a><a href="/a" title="new">B</a></p>',
  },
];
