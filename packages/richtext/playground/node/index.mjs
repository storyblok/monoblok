import { richTextResolver } from '@storyblok/richtext';

const { render } = richTextResolver();
const rt = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          text: 'The S3 backups included in the Teams plan back up the whole space',
          type: 'text',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          text: 'Customers on Community or Entry have to utilize other ways to make the same thing happen.',
          type: 'text',
        },
      ],
    },
    {
      type: 'paragraph',
      content: [
        {
          text: 'Here are a few tools that may help you achieve what you\'re after.',
          type: 'text',
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
                  text: 'Our CLI',
                  type: 'text',
                  marks: [
                    {
                      type: 'link',
                      attrs: {
                        href: 'https://www.storyblok.com/docs/Guides/command-line-interface',
                        uuid: null,
                        anchor: null,
                        target: null,
                        linktype: 'url',
                      },
                    },
                  ],
                },
                {
                  text: ' provides the option to export the component schema',
                  type: 'text',
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
              content: [
                {
                  text: 'Markus Oberlehner (an ambassador of ours) provides a set of scripts to backup components and stories. Check it out ',
                  type: 'text',
                },
                {
                  text: 'here',
                  type: 'text',
                  marks: [
                    {
                      type: 'link',
                      attrs: {
                        href: 'https://github.com/maoberlehner/storyblok-migrate',
                        uuid: null,
                        anchor: null,
                        target: null,
                        linktype: 'url',
                      },
                    },
                  ],
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
              content: [
                {
                  text: 'For assets, we have a ',
                  type: 'text',
                },
                {
                  text: 'corresponding script',
                  type: 'text',
                  marks: [
                    {
                      type: 'link',
                      attrs: {
                        href: 'https://github.com/storyblok/tool-examples/tree/main/storyblok-assets-backup',
                        uuid: null,
                        anchor: null,
                        target: null,
                        linktype: 'url',
                      },
                    },
                  ],
                },
                {
                  text: ' too',
                  type: 'text',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
const html = render(rt);
// eslint-disable-next-line no-console
console.log(html);
