import type React from 'react';
import type {
  StoryblokRichTextNode,
  StoryblokRichTextResolvers,
} from '@storyblok/js';

export interface StoryblokRichTextProps {
  doc: StoryblokRichTextNode<React.ReactElement>;
  resolvers?: StoryblokRichTextResolvers<React.ReactElement>;
}

export interface BlokData<T extends string = string> {
  component: T;
  _uid: string;
  [k: string]: unknown;
}

// Re-export commonly used types from @storyblok/js
export type {
  StoryblokRichTextNode,
  StoryblokRichTextResolvers,
} from '@storyblok/js';
