import React from 'react';
import { StoryblokRichText, useStoryblok } from '@storyblok/react';

function RichtextPage() {
  const story = useStoryblok('richtext', { version: 'draft' });

  if (!story?.content) {
    return <div>Loading...</div>;
  }

  return (
    story.content.richText && (
      <StoryblokRichText document={story.content.richText} />
    )
  );
}

export default RichtextPage;
