import React from 'react';
import StoryblokComponent from './core/storyblok-component';
import { createComponentResolver, createRichTextHook } from './core/richtext-hoc';
import type { StoryblokRichTextNode } from '@storyblok/js';

export const componentResolver = createComponentResolver(StoryblokComponent, {
  isServerContext: false,
});

export const useStoryblokRichText = createRichTextHook(StoryblokComponent, {
  isServerContext: false,
});
