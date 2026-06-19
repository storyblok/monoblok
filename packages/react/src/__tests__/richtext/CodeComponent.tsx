import type { SbReactRichTextProps } from '@storyblok/react';

export default function CustomCodeBlock({ children, attrs }: SbReactRichTextProps<'code_block'>) {
  return (
    <pre className={`language-${attrs?.class}`}><code data-lang={attrs?.class}>{children}</code></pre>
  );
}
