import { forwardRef } from 'react';
import {
  getComponent,
  getCustomFallbackComponent,
  getEnableFallbackComponent,
} from '../core/state';
import type { SbBlokData } from '@/types';

interface SbServerComponentProps extends Omit<Record<string, unknown>, 'blok'> {
  blok: SbBlokData;
}

const StoryblokServerComponent = forwardRef<HTMLElement, SbServerComponentProps>(
  ({ blok, ...restProps }: SbServerComponentProps, ref) => {
    if (!blok) {
      console.error(
        'Please provide a \'blok\' property to the StoryblokComponent',
      );
      return (
        <div>Please provide a blok property to the StoryblokServerComponent</div>
      );
    }

    const Component = getComponent(blok.component);

    if (Component) {
      return <Component ref={ref} blok={blok} {...restProps} />;
    }

    if (getEnableFallbackComponent()) {
      const CustomFallbackComponent = getCustomFallbackComponent();

      if (CustomFallbackComponent) {
        return <CustomFallbackComponent blok={blok} {...restProps} />;
      }
      else {
        return (
          <>
            <p>
              Component could not be found for blok
              {' '}
              <strong>{blok.component}</strong>
              ! Is it configured correctly?
            </p>
          </>
        );
      }
    }

    return <div></div>;
  },
);

StoryblokServerComponent.displayName = 'StoryblokServerComponent';

export default StoryblokServerComponent;
