import { component$ } from '@builder.io/qwik';
import { type DocumentHead, routeLoader$ } from '@builder.io/qwik-city';

import { StoryblokComponent } from '~/components/storyblok/storyblok-component';
import { createStoryblokClient } from '~/lib/storyblok';
import type { Story } from '~/schema/schema';

export const useHomepageStory = routeLoader$<Story | null>(async ({ status }) => {
  const client = createStoryblokClient();
  const result = await client.stories.get('home', {
    query: { version: 'draft' },
  });

  if (result.error || !result.data?.story) {
    status(404);
    return null;
  }

  return result.data.story;
});

export default component$(() => {
  const story = useHomepageStory();

  if (!story.value) {
    return (
      <main class="flex min-h-screen items-center justify-center">
        <p class="text-gray-500">
          Homepage story not found. Run
          <code>pnpm seed</code>
          {' '}
          to create it.
        </p>
      </main>
    );
  }

  return (
    <main>
      <StoryblokComponent blok={story.value.content} />
    </main>
  );
});

export const head: DocumentHead = ({ resolveValue }) => {
  const story = resolveValue(useHomepageStory);

  if (!story) {
    return { title: 'Home' };
  }

  const content = story.content.component === 'page' ? story.content : null;

  return {
    title: content?.seo_title ?? story.name,
    meta: content?.seo_description
      ? [{ name: 'description', content: content.seo_description }]
      : [],
  };
};
