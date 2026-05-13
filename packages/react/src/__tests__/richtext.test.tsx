import { StoryblokRichText } from '@storyblok/react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { SbRichTextDoc } from '@storyblok/richtext';

describe('richtext', () => {
  it('renders minimal document correctly', () => {
    const document: SbRichTextDoc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Hello, world!',
            },
          ],
        },
      ],
    };

    const { container } = render(<StoryblokRichText document={document} />);
    expect(container.innerHTML).toBe(
      `<div><p>Hello, world!</p></div>`,
    );
  });
});
