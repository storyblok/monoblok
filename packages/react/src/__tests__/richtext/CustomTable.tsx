import { type SbReactRichTextProps, splitTableRows, StoryblokRichText } from '@storyblok/react';

export default function CustomTable({
  attrs,
  content,
  context,
}: SbReactRichTextProps<'table'>) {
  const { headerRows, bodyRows } = splitTableRows(content);

  return (
    <table {...attrs} className="custom-table">
      <thead>
        <StoryblokRichText wrapper={false} document={headerRows} {...context} />
      </thead>
      <tbody>
        <StoryblokRichText wrapper={false} document={bodyRows} {...context} />
      </tbody>
    </table>
  );
}
