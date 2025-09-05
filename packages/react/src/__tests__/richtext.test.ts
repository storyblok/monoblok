import { describe, expect, it } from 'vitest';
import { componentResolver } from '../richtext';
import { BlockTypes } from '@storyblok/js';
import type React from 'react';

describe('richtext', () => {
  describe('componentResolver', () => {
    it('should return an array with a React element', () => {
      const node = {
        type: BlockTypes.COMPONENT,
        content: [],
        attrs: {
          body: [{
            _uid: 'test',
            component: 'test-component',
          }],
        },
      };
      const result = componentResolver(node) as React.ReactElement[];
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result[0].props.blok.component).toBe('test-component');
    });

    it('should return an empty array if body is empty', () => {
      const node = {
        type: BlockTypes.COMPONENT,
        content: [],
        attrs: {
          body: [],
        },
      };
      const result = componentResolver(node);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should return an empty array if body is undefined', () => {
      const node = {
        type: BlockTypes.COMPONENT,
        content: [],
        attrs: {},
      };
      const result = componentResolver(node);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should return multiple React elements for multiple blocks', () => {
      const node = {
        type: BlockTypes.COMPONENT,
        content: [],
        attrs: {
          body: [
            {
              _uid: 'test1',
              component: 'test-component-1',
            },
            {
              _uid: 'test2',
              component: 'test-component-2',
            },
          ],
        },
      };
      const result = componentResolver(node) as React.ReactElement[];
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0].props.blok.component).toBe('test-component-1');
      expect(result[1].props.blok.component).toBe('test-component-2');
    });
  });
});
