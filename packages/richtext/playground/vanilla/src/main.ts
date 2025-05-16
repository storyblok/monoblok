import './style.css';
import { MarkTypes, richTextResolver, type StoryblokRichTextNode, type StoryblokRichTextOptions } from '@storyblok/richtext';
import StoryblokClient from 'storyblok-js-client';

/* const test = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Hey ',
        },
      ],
    },
    {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'nested',
            },
          ],
        },
      ],
    },
  ],
}; */
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
      attrs: { id: 'paragraph-id', class: 'bg-red' },
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
      attrs: {
        class: 'language-html',
      },
      content: [
        {
          text: `<script setup lang=\"ts\">\nimport { useGLTF, useTweakPane } from '@tresjs/cientos'\nimport { useRenderLoop } from '@tresjs/core'\nimport { shallowRef, watch } from 'vue'\nimport Airplane from './Airplane.vue'\nimport Cloud from './Cloud.vue'\n\nconst { scene: planet } = await useGLTF(\n  'https://raw.githubusercontent.com/Tresjs/assets/main/models/gltf/low-poly/planet.gltf',\n)\n\nconst { pane } = useTweakPane()\n\nconst planetRef = shallowRef()\n\nplanet.traverse(child => {\n  if (child.isMesh) {\n    child.receiveShadow = true\n  }\n})\n\nwatch(\n  () => planetRef.value,\n  planet => {\n    if (!planet) return\n    pane.addInput(planetRef.value, 'visible', { label: 'Planet' })\n  },\n)\n\nconst { onLoop } = useRenderLoop()\n\nonLoop(({ delta }) => {\n  if (!planet) return\n  planet.rotation.y += delta * 0.04\n  planet.rotation.z += delta * 0.02\n  planet.rotation.x += delta * 0.05\n  planet.updateMatrixWorld()\n})\n</script>\n<template>\n  <TresMesh ref=\"planetRef\" v-bind=\"planet\" />\n  <Airplane :planet=\"planetRef\" />\n  <Cloud v-for=\"cloud of [1, 2, 3, 4, 5, 6, 7, 8, 9]\" :key=\"cloud\" :planet=\"planetRef\" />\n</template>\n`,
          type: 'text',
        },
      ],
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

/* const tableDoc: StoryblokRichTextDocumentNode = {
  type: 'doc',
  content: [
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: {
                colspan: 1,
                rowspan: 1,
                colwidth: null,
              },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      text: 'Header 1',
                      type: 'text',
                    },
                  ],
                },
              ],
            },
            {
              type: 'tableCell',
              attrs: {
                colspan: 1,
                rowspan: 1,
                colwidth: null,
              },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      text: 'Header  2',
                      type: 'text',
                    },
                  ],
                },
              ],
            },
            {
              type: 'tableCell',
              attrs: {
                colspan: 1,
                rowspan: 1,
                colwidth: null,
              },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      text: 'Header 3',
                      type: 'text',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: {
                colspan: 1,
                rowspan: 1,
                colwidth: null,
              },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      text: 'R1C1',
                      type: 'text',
                    },
                  ],
                },
              ],
            },
            {
              type: 'tableCell',
              attrs: {
                colspan: 1,
                rowspan: 1,
                colwidth: null,
              },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      text: 'R1C2',
                      type: 'text',
                    },
                  ],
                },
              ],
            },
            {
              type: 'tableCell',
              attrs: {
                colspan: 1,
                rowspan: 1,
                colwidth: null,
              },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      text: 'R1C3',
                      type: 'text',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: {
                colspan: 1,
                rowspan: 1,
                colwidth: null,
              },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      text: 'R2C1',
                      type: 'text',
                    },
                  ],
                },
              ],
            },
            {
              type: 'tableCell',
              attrs: {
                colspan: 1,
                rowspan: 1,
                colwidth: null,
              },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      text: 'R2C2',
                      type: 'text',
                    },
                  ],
                },
              ],
            },
            {
              type: 'tableCell',
              attrs: {
                colspan: 1,
                rowspan: 1,
                colwidth: null,
              },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      text: 'R2C3',
                      type: 'text',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableCell',
              attrs: {
                colspan: 1,
                rowspan: 1,
                colwidth: null,
              },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      text: 'R3C1',
                      type: 'text',
                    },
                  ],
                },
              ],
            },
            {
              type: 'tableCell',
              attrs: {
                colspan: 1,
                rowspan: 1,
                colwidth: null,
              },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      text: 'R3C2',
                      type: 'text',
                    },
                  ],
                },
              ],
            },
            {
              type: 'tableCell',
              attrs: {
                colspan: 1,
                rowspan: 1,
                colwidth: null,
              },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    {
                      text: 'R3C3',
                      type: 'text',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'paragraph',
    },
  ],
}; */

// Storyblok

const client = new StoryblokClient({
  accessToken: import.meta.env.VITE_STORYBLOK_TOKEN,
});

const story = await client.get('cdn/stories/home', {
  version: 'draft',
});

const docFromStory = story.data.story.content.richtext;

const options: StoryblokRichTextOptions<string> = {
  resolvers: {
    [MarkTypes.LINK]: (node: StoryblokRichTextNode<string>) => {
      return `<button href="${node.attrs?.href}" target="${node.attrs?.target}">${node.children}</button>`;
    },
  },
  optimizeImages: {
    /* class: 'v-class',
    loading: 'lazy', */
    width: 800,
    height: 600,
    filters: {
      format: 'webp',
      blur: 120,
      /*  quality: 10,
      grayscale: true,
      blur: 10,
      brightness: 10, */
    },
  },
};

const html = richTextResolver(options).render(docFromStory);

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="this-div-is-on-purpose">
  ${html}
  </div>
`;
