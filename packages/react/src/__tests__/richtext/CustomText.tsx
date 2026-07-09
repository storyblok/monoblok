import type { SbReactRichTextProps } from '@storyblok/react';

export default function CustomText({ text, context }: SbReactRichTextProps<'text'>) {
  const data = context?.data as { prefix: string } | undefined;
  const prefix = data?.prefix ?? '';
  return (
    <>
      {prefix}
      {' '}
      {text.toUpperCase()}
    </>
  );
}
