import type { SbBlokData } from '@storyblok/react';
import { StoryblokComponent, useStoryblok } from '@storyblok/react';
import StoryblokRichText from './components/StoryblokRichText';

export default function RichText() {
  const story = useStoryblok('richtext', { version: 'draft' });

  if (!story?.content) {
    return <div>Loading...</div>;
  }

  const richtext = story.content?.richText;

  return (
    <div>
      <h1>Richtext </h1>
      <StoryblokRichText
        doc={richtext}
        components={{
          blok: ({ body }) =>
            body?.map((blok: SbBlokData) => <StoryblokComponent blok={blok} key={blok._uid} />),
          link: CustomBlokComponent,
        }}
      />
    </div>
  );
}
function CustomBlokComponent(props: any) {
  const { children, ...attributes } = props;
  return <a {...attributes}>{children}</a>;
}
