import type { ISbStoriesParams } from '@storyblok/react/ssr';
import { getStoryblokApi } from '@/lib/storyblok';

export default async function RichtextPage() {

  const { data } = await fetchData();

  return (
    <div className="container mx-auto px-4 py-8 prose prose-lg dark:prose-invert max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Rich Text Example</h1>
      <p className="text-gray-600 dark:text-gray-400">
        Story loaded:
        {' '}
        {data.story?.name || 'No story found'}
      </p>
    </div>
  );
}

async function fetchData() {
  const sbParams: ISbStoriesParams = { version: 'draft' };
  const storyblokApi = getStoryblokApi();

  if (typeof storyblokApi === 'function') {
    const api = storyblokApi();
    return api.get(`cdn/stories/react/richtext`, sbParams);
  }

  return storyblokApi.get(`cdn/stories/react/richtext`, sbParams);
}
