import { forwardRef } from 'react';
import { useStoryblokRichText } from './richtext';
import type { StoryblokRichtextProps } from './core/richtext-hoc';
import type { ComponentPropsWithoutRef } from 'react';

type DivProps = Omit<
  ComponentPropsWithoutRef<'div'>,
  'children'
>;

type WrappedProps = StoryblokRichtextProps &
  DivProps & {
    wrapper?: true;
  };

type UnwrappedProps = StoryblokRichtextProps & {
  wrapper: false;
};

type Props = WrappedProps | UnwrappedProps;

const StoryblokRichText = forwardRef<HTMLDivElement, Props>(
  ({ document, optimizeImage, components, wrapper = true, ...rest }, ref) => {
    const html = useStoryblokRichText({ document, optimizeImage, components });
    if (!wrapper) {
      return html;
    }
    return (
      <div ref={ref} {...rest}>
        {html}
      </div>
    );
  },
);

export default StoryblokRichText;
