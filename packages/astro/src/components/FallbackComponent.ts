import type { SbBlokData } from '@storyblok/js';

function FallbackComponent(
  _props: Record<string, unknown> & {
    /** The Storyblok blok data for this component (required) */
    blok: SbBlokData;
  },
): any {}
export default FallbackComponent;
