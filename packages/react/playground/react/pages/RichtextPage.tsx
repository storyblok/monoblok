import React from 'react';
import { Link } from 'react-router';
import { Mark } from '@tiptap/core';
import Heading from '@tiptap/extension-heading';
import {
  asTag,
  StoryblokRichText,
  useStoryblok,
} from '@storyblok/react';

// Custom link mark: React Router Link for story links, <a> for everything else
const CustomLink = Mark.create({
  name: 'link',
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, string> }) {
    if (HTMLAttributes.linktype === 'story') {
      return [asTag(Link), { to: HTMLAttributes.href, className: 'router-link' }, 0];
    }
    return ['a', { href: HTMLAttributes.href, target: HTMLAttributes.target }, 0];
  },
});

// Custom heading with React component styling
function CustomHeadingComponent({ level, children }: { level: number; children: React.ReactNode }) {
  const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
  return React.createElement(Tag, {
    style: { color: '#1b243f', borderLeft: '4px solid #00b3b0', paddingLeft: '12px' },
  }, children);
}

const CustomHeading = Heading.extend({
  renderHTML({ node }: { node: { attrs: { level: number } } }) {
    return [asTag(CustomHeadingComponent), { level: node.attrs.level }, 0];
  },
});

const tiptapExtensions = {
  link: CustomLink,
  heading: CustomHeading,
};

function RichtextPage() {
  const story = useStoryblok('richtext', { version: 'draft' });

  if (!story?.content) {
    return <div>Loading...</div>;
  }

  return (
    story.content.richText && (
      <StoryblokRichText
        doc={story.content.richText}
        tiptapExtensions={tiptapExtensions}
      />
    )
  );
}

export default RichtextPage;
