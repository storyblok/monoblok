import {
  type ISbStoriesParams,
  type StoryblokClient,
  StoryblokStory,
} from '@storyblok/react/rsc';
import { getStoryblokApi } from '@/lib/storyblok';

export default async function Home() {
  const { data } = await fetchData();

  return (
    <div>
      <h1>
        Story:
        {data.story.id}
      </h1>
      <StoryblokStory story={data.story} />
    </div>
  );
}

async function fetchData() {
  const sbParams: ISbStoriesParams = { version: 'draft' };

  const storyblokApi: StoryblokClient = getStoryblokApi();
  return storyblokApi.get(`cdn/stories/home`, sbParams);
}
