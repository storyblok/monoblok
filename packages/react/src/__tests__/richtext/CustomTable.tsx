import { type SbReactRichTextProps, splitTableRows, StoryblokRichText } from '@storyblok/react';

export default function CustomTable({
  attrs,
  content,
  components,
  optimizeImage,
}: SbReactRichTextProps<'table'>) {
  const { headerRows, bodyRows } = splitTableRows(content);

  return (
    <table {...attrs} className="custom-table">
      <thead>
        <StoryblokRichText wrapper={false} document={headerRows} components={components} optimizeImage={optimizeImage} />
      </thead>
      <tbody>
        <StoryblokRichText wrapper={false} document={bodyRows} components={components} optimizeImage={optimizeImage} />
      </tbody>
    </table>
  );
}
