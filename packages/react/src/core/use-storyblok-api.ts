import type { StoryblokClient } from '@storyblok/js';
import { getStoryblokApiInstance } from './state';

export const useStoryblokApi = (): StoryblokClient => {
  const instance = getStoryblokApiInstance();
  if (!instance) {
    console.error(
      'You can\'t use getStoryblokApi if you\'re not loading apiPlugin.',
    );
  }

  return instance;
};

export { useStoryblokApi as getStoryblokApi };
