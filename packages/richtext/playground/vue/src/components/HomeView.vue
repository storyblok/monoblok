<script setup lang="ts">
import type { VNode } from 'vue';
import { createTextVNode, h } from 'vue';
import { BlockTypes, richTextResolver, type StoryblokRichTextNode, type StoryblokRichTextOptions } from '@storyblok/richtext';
import { useStoryblok } from '@storyblok/vue';

import CodeBlock from './CodeBlock.vue';

/* const doc: StoryblokRichTextDocumentNode = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ text: 'Headline 1', type: 'text' }],
    },
    {
      type: 'paragraph',
      content: [
        {
          text: 'Para',
          type: 'text',
          marks: [
            {
              type: 'anchor',
              attrs: {
                id: 'verum-audiamus',
              },
            },
          ],
        },
        { text: 'graph', type: 'text', marks: [{ type: 'bold' }] },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          text: 'Bold and italic',
          type: 'text',
          marks: [{ type: 'bold' }, { type: 'italic' }],
        },
      ],
    },
    {
      type: 'bullet_list',
      content: [
        {
          type: 'list_item',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  text: 'Bull',
                  type: 'text',
                  marks: [{ type: 'italic' }],
                },
                {
                  text: 'et 1',
                  type: 'text',
                  marks: [{ type: 'bold' }],
                },
              ],
            },
          ],
        },
        {
          type: 'list_item',
          content: [
            {
              type: 'paragraph',
              content: [{ text: 'Bullet 2', type: 'text' }],
            },
          ],
        },
        {
          type: 'list_item',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  text: 'Bullet 3',
                  type: 'text',
                  marks: [{ type: 'styled', attrs: { class: 'css-class' } }],
                },
              ],
            },
          ],
        },
        { type: 'list_item', content: [{ type: 'paragraph' }] },
      ],
    },
    {
      type: 'ordered_list',
      attrs: { order: 1 },
      content: [
        {
          type: 'list_item',
          content: [
            {
              type: 'paragraph',
              content: [{ text: 'Ordered 1', type: 'text' }],
            },
          ],
        },
        {
          type: 'list_item',
          content: [
            {
              type: 'paragraph',
              content: [{ text: 'Ordered 2', type: 'text' }],
            },
          ],
        },
        {
          type: 'list_item',
          content: [
            {
              type: 'paragraph',
              content: [{ text: 'Ordered 3', type: 'text' }],
            },
          ],
        },
      ],
    },
    {
      type: 'blockquote',
      content: [
        {
          type: 'paragraph',
          content: [{ text: 'Quote', type: 'text' }],
        },
      ],
    },
    { type: 'horizontal_rule' },
    {
      type: 'code_block',
      attrs: { class: 'language-javascript' },
      content: [{ text: 'JavaScript Code', type: 'text' }],
    },
    {
      type: 'paragraph',
      content: [
        { text: 'I am a two', type: 'text' },
        { type: 'hard_break' },
        {
          text: 'line text!',
          type: 'text',
          marks: [{ type: 'code' }],
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'image',
          attrs: {
            alt: 'Alt',
            src: 'https://a.storyblok.com/f/67536/400x400/166f21bd2c/vue.png',
            title: 'Caption',
          },
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          text: 'External link',
          type: 'text',
          marks: [
            {
              type: 'link',
              attrs: {
                href: 'https://alvarosaburido.dev',
                uuid: null,
                anchor: null,
                target: '_blank',
                linktype: 'url',
              },
            },
          ],
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          text: 'Asset link',
          type: 'text',
          marks: [
            {
              type: 'link',
              attrs: {
                href: 'https://a.storyblok.com/f/67536/400x303/ccbe9ca7b3/nuxt-logo.png',
                uuid: null,
                anchor: null,
                target: null,
                linktype: 'asset',
              },
            },
          ],
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          text: 'hola@alvarosaburido.dev',
          type: 'text',
          marks: [
            {
              type: 'link',
              attrs: {
                href: 'hola@alvarosaburido.dev',
                uuid: null,
                anchor: null,
                target: null,
                linktype: 'email',
              },
            },
          ],
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          text: 'Internal Link',
          type: 'text',
          marks: [
            {
              type: 'link',
              attrs: {
                href: '/',
                uuid: '2bbf3ee7-acbe-401c-ade5-cf33e6e0babb',
                anchor: null,
                target: '_blank',
                linktype: 'story',
              },
            },
          ],
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          text: 'This is with ',
          type: 'text',
        },
        {
          text: 'sub',
          type: 'text',
          marks: [
            {
              type: 'subscript',
            },
          ],
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          text: 'And this with ',
          type: 'text',
        },
        {
          text: 'sup',
          type: 'text',
          marks: [
            {
              type: 'superscript',
            },
          ],
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          text: 'This is ',
          type: 'text',
        },
        {
          text: 'highlighted',
          type: 'text',
          marks: [
            {
              type: 'highlight',
              attrs: {
                color: '#FFF0B4',
              },
            },
          ],
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          text: 'And this has a ',
          type: 'text',
        },
        {
          text: 'text color',
          type: 'text',
          marks: [
            {
              type: 'textStyle',
              attrs: {
                color: '#FC0000',
              },
            },
          ],
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          text: 'And this is an emoji 🥳',
          type: 'text',
        },
        {
          type: 'emoji',
          attrs: {
            name: 'innocent',
            emoji: '😇',
            fallbackImage:
              'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/1f607.png',
          },
        },
      ],
    },
    {
      type: 'blok',
      attrs: {
        id: '489f2970-6787-486a-97c3-6f1e8a99b7a9',
        body: [
          {
            sub: [],
            _uid: 'i-134324ee-1754-48be-93df-02df1e394733',
            title: 'Second button!',
            component: 'button',
          },
          {
            sub: [],
            _uid: 'i-437c2948-0be9-442e-949d-a11c79736aa6',
            title: 'My Button ',
            component: 'button',
          },
        ],
      },
    },
  ],
}; */

const story = await useStoryblok('/home', {
  version: 'draft',
});

const options: StoryblokRichTextOptions<VNode> = {
  renderFn: h,
  textFn: createTextVNode,
  keyedResolvers: true,
  resolvers: {
    [BlockTypes.CODE_BLOCK]: (node: StoryblokRichTextNode<VNode>) => {
      return h(CodeBlock, {
        class: node?.attrs?.class,
      }, node.children);
    },
  },
};

const root = () => richTextResolver<VNode>(options).render(story.value.content.richtext);
</script>

<template>
  <root />
</template>
