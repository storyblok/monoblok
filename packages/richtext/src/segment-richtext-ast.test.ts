import { describe, expect, it } from 'vitest';
import { segmentStoryblokRichTextAST } from './segment-richtext-ast';

describe('segmentStoryblokRichTextAST', () => {
  it('segments AST into html, link, blok parts', () => {
    const ast = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'This is some ',
              marks: [{ type: 'bold' }],
            },
            {
              type: 'link',
              attrs: {
                href: '/',
                uuid: '277f613b-c8b5-4585-aef8-58466d9f340e',
                anchor: 'Test-Demo',
                target: '_self',
                linktype: 'story',
              },
              content: [
                { type: 'text', text: 'rich', marks: [{ type: 'bold' }] },
              ],
            },
            {
              type: 'text',
              text: ' text and it\'s also working.',
              marks: [{ type: 'bold' }],
            },
          ],
        },
        {
          type: 'blok',
          attrs: {
            _uid: 'i-f386d90b-290f-4b94-91bc-a27928cf84b1',
            name: 'This is a feature componnet',
            component: 'feature',
            _editable:
              '<!--#storyblok#{"name": "feature", "space": "163229", "uid": "i-f386d90b-290f-4b94-91bc-a27928cf84b1", "id": "153793551"}-->',
          },
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'ascbhhasbchsac ahsbchbchac asbch',
              marks: [{ type: 'bold' }],
            },
          ],
        },
      ],
    };

    const segs = segmentStoryblokRichTextAST(ast);
    expect(segs).toMatchInlineSnapshot(`[
      {
        "content": "<p><strong>This is some ",
        "props": {},
        "type": "html",
      },
      {
        "content": "rich",
        "props": {
          "anchor": "Test-Demo",
          "href": "/",
          "linktype": "story",
          "target": "_self",
          "uuid": "277f613b-c8b5-4585-aef8-58466d9f340e",
        },
        "type": "link",
      },
      {
        "content": " text and it&#039;s also working.</strong></p>",
        "props": {},
        "type": "html",
      },
      {
        "content": "",
        "props": {
          "_editable": "<!--#storyblok#{\"name\": \"feature\", \"space\": \"163229\", \"uid\": \"i-f386d90b-290f-4b94-91bc-a27928cf84b1\", \"id\": \"153793551\"}",
          "_uid": "i-f386d90b-290f-4b94-91bc-a27928cf84b1",
          "component": "feature",
          "name": "This is a feature componnet",
        },
        "type": "blok",
      },
      {
        "content": "<p><strong>ascbhhasbchsac ahsbchbchac asbch</strong></p>",
        "props": {},
        "type": "html",
      },
    ]`);
  });
});
