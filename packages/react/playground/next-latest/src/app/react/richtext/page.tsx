
import type { ISbStoriesParams, StoryblokClient } from '@storyblok/react/rsc';
import { StoryblokServerRichText } from '@storyblok/react/rsc';
import { getStoryblokApi } from '@/lib/storyblok';


export default async function RichtextPage() {
  const { data } = await fetchData();

  if (!data.story?.content) {
    return (
      <div className="animate-pulse text-lg text-gray-600 dark:text-gray-400">
        <div className="min-h-screen flex items-center justify-center">
          Loading content...
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 prose prose-lg dark:prose-invert max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Rich Text Example</h1>
      {data.story.content.richText
        ? (
            <StoryblokServerRichText document={data.story.content.richText}/>
          )
        : (
            <p className="text-gray-600 dark:text-gray-400">No content available</p>
          )}
    </div>
  );
}

async function fetchData() {
  const sbParams: ISbStoriesParams = { version: 'draft' };

  const storyblokApi: StoryblokClient = getStoryblokApi();
  return storyblokApi.get(`cdn/stories/richtext`, sbParams);
}
