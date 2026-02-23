import { describe, expect, it } from 'vitest';
import React from 'react';
import { BlockTypes, ComponentBlok, richTextResolver } from '@storyblok/js';

describe('richtext', () => {
  describe('renderComponent via tiptapExtensions', () => {
    // Minimal mock component
    const MockComponent = (props: { blok: { component: string } }) =>
      React.createElement('div', { 'data-component': props.blok.component });

    function createResolver() {
      return richTextResolver<React.ReactElement>({
        renderFn: React.createElement,
        textFn: (text: string) => React.createElement(React.Fragment, {
          key: Math.random().toString(36).substring(2, 15),
        }, text),
        keyedResolvers: true,
        tiptapExtensions: {
          blok: ComponentBlok.configure({
            renderComponent: (blok, id?: string) =>
              React.createElement(MockComponent, { blok: blok as { component: string }, key: id }),
          }),
        },
      });
    }

    it('should render blok nodes via renderComponent', () => {
      const doc = {
        type: 'doc',
        content: [{
          type: BlockTypes.COMPONENT,
          attrs: {
            id: 'test-id',
            body: [{
              _uid: 'test',
              component: 'test-component',
            }],
          },
        }],
      };
      const { render } = createResolver();
      const result = render(doc as any) as any;
      expect(Array.isArray(result)).toBe(true);
      // The blok node renders an array of elements
      const blokElements = result[0];
      expect(Array.isArray(blokElements)).toBe(true);
      expect(blokElements[0].props.blok.component).toBe('test-component');
    });

    it('should return empty array for empty body', () => {
      const doc = {
        type: 'doc',
        content: [{
          type: BlockTypes.COMPONENT,
          attrs: {
            id: 'test-id',
            body: [],
          },
        }],
      };
      const { render } = createResolver();
      const result = render(doc as any) as any;
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toEqual([]);
    });

    it('should render multiple blok components from body array', () => {
      const doc = {
        type: 'doc',
        content: [{
          type: BlockTypes.COMPONENT,
          attrs: {
            id: 'test-id',
            body: [
              { _uid: 'test1', component: 'test-component-1' },
              { _uid: 'test2', component: 'test-component-2' },
            ],
          },
        }],
      };
      const { render } = createResolver();
      const result = render(doc as any) as any;
      const blokElements = result[0];
      expect(blokElements).toHaveLength(2);
      expect(blokElements[0].props.blok.component).toBe('test-component-1');
      expect(blokElements[1].props.blok.component).toBe('test-component-2');
    });

    it('should return empty array when body is undefined', () => {
      const doc = {
        type: 'doc',
        content: [{
          type: BlockTypes.COMPONENT,
          attrs: { id: 'no-body' },
        }],
      };
      const { render } = createResolver();
      const result = render(doc as any) as any;
      expect(result[0]).toEqual([]);
    });

    it('should render blok mixed with paragraphs', () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Before blok' }],
          },
          {
            type: BlockTypes.COMPONENT,
            attrs: {
              id: 'mid-id',
              body: [{ _uid: 'b1', component: 'banner' }],
            },
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'After blok' }],
          },
        ],
      };
      const { render } = createResolver();
      const result = render(doc as any) as any;
      // result is an array of [paragraph, blok-array, paragraph]
      expect(result).toHaveLength(3);
      expect(result[0].type).toBe('p');
      // Second element is the blok array
      expect(Array.isArray(result[1])).toBe(true);
      expect(result[1]).toHaveLength(1);
      expect(result[1][0].props.blok.component).toBe('banner');
      expect(result[2].type).toBe('p');
    });
  });
});
