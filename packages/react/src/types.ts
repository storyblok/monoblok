import type React from 'react';
import type {
  StoryblokRichTextNode,
  StoryblokRichTextResolvers,
} from '@storyblok/js';

export interface StoryblokRichTextProps {
  doc: StoryblokRichTextNode<React.ReactNode>;
  resolvers?: StoryblokRichTextResolvers<React.ReactNode>;
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
