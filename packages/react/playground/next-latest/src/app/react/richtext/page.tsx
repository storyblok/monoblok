import React, { Fragment } from 'react';
import Link from 'next/link';
import { Mark } from '@tiptap/core';
import Heading from '@tiptap/extension-heading';
import type { ISbStoriesParams, StoryblokClient } from '@storyblok/react/rsc';
import {
  asTag,
  StoryblokServerComponent,
  StoryblokServerRichText,
} from '@storyblok/react/rsc';
import { getStoryblokApi } from '@/lib/storyblok';
import { segmentStoryblokRichTextDynamic } from '@storyblok/js';
import Heading2 from '../../components/Heading';
import { HtmlRenderer } from '@/app/components/HtmlRenderer';
// Custom link mark: Next.js Link for story links, <a> for everything else
const CustomLink = Mark.create({
  name: 'link',
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, string> }) {
    if (HTMLAttributes.linktype === 'story') {
      return [asTag(Link), { href: HTMLAttributes.href, className: 'next-link' }, 0];
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
  renderHTML({ node, HTMLAttributes }: { node: { attrs: { level: number } }, HTMLAttributes: Record<string, any> }) {
    return [asTag(CustomHeadingComponent), { ...HTMLAttributes, level: node.attrs.level }, 0];
  },
});

const tiptapExtensions = {
  link: CustomLink,
  heading: CustomHeading,
};

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
const segments = segmentStoryblokRichTextDynamic(data.story.content.richText, { supportedSegments: ['link', 'heading'] as const});
console.log(segments);
  
return (
    <div className="container mx-auto px-4 py-8 prose prose-lg dark:prose-invert max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Rich Text Example</h1>
      <div className="flex">
            <div>
            {segments.map((segment, index) => {
              if (segment.type ==="html") {
                return                   <HtmlRenderer
        key={index}
html={segment.content}
      />
              }
              if (segment.type === "heading") {
                return <Heading2 key={index}  level={segment.props.level} content={segment.content} />;
              }
              if (segment.type==="link") {
                return <Link style={{display:"inline"}} key={index} href={segment.props.href} className="next-link">{segment.content}</Link>;
              }
              if (segment.type ==="blok") {
                return <StoryblokServerComponent key={index} blok={segment.props} />;
              }
              return null;
            })}
          </div>
                  <div>
      {data.story.content.richText
        ? (
            <StoryblokServerRichText
              doc={data.story.content.richText}
              tiptapExtensions={tiptapExtensions}
            />
          )
        : (
            <p className="text-gray-600 dark:text-gray-400">No content available</p>
          )}
        </div>
      </div>

    </div>
  );
}

async function fetchData() {
  const sbParams: ISbStoriesParams = { version: 'draft' };

  const storyblokApi: StoryblokClient = getStoryblokApi();
  return storyblokApi.get(`cdn/stories/richtext`, sbParams);
}
