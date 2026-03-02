/* eslint-disable no-console */
import { Mark } from '@tiptap/core';
import type {
  StoryblokRichTextOptions,
} from '@storyblok/js';
import {
  apiPlugin,
  loadStoryblokBridge,
  renderRichText,
  storyblokInit,
  useStoryblokBridge,
} from '@storyblok/js';
import richTextFixture from '../../src/fixtures/richTextObject.json';

declare global {
  interface Window {
    initWithBridge: any;
    initWithoutBridge: any;
    loadStoryblokBridgeScript: any;
    renderRichText: any;
  }
}

window.initWithBridge = async () => {
  const { storyblokApi } = storyblokInit({
    accessToken: 'OurklwV5XsDJTIE1NJaD2wtt',
    use: [apiPlugin],
  });

  const { data } = await storyblokApi!.get('cdn/stories/js', {
    version: 'draft',
  });

  useStoryblokBridge(data.story.id, (newStory) => {
    console.log('-- PLAYGROUND --');
    console.log(newStory);
  });
};

window.initWithoutBridge = () => {
  storyblokInit({
    accessToken: 'OurklwV5XsDJTIE1NJaD2wtt',
    bridge: false,
  });

  // Used to test no log/warn/errors are printed
  useStoryblokBridge(1, () => {});
};

window.loadStoryblokBridgeScript = () => {
  loadStoryblokBridge();
};

const CustomLink = Mark.create({
  name: 'link',
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, string> }) {
    return ['button', { href: HTMLAttributes.href, target: HTMLAttributes.target }, 0];
  },
});

window.renderRichText = () => {
  const options: StoryblokRichTextOptions = {
    tiptapExtensions: {
      link: CustomLink,
    },
  };
  const html = renderRichText(richTextFixture as any, options);

  const richTextContainer = document.getElementById(
    'rich-text-container',
  ) as any;

  richTextContainer.innerHTML = html;
};
