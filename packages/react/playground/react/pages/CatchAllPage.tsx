import { StoryblokComponent, useStoryblok } from '@storyblok/react';
import { useParams } from 'react-router';

function CatchAllPage() {
  const params = useParams();
  const slug = params['*'];
  const story = useStoryblok(slug || 'react', { version: 'draft' });
  if (!story?.content) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h1>Catch All Page</h1>
      <StoryblokComponent blok={story.content} />
    </div>
  );
}

export default CatchAllPage;
