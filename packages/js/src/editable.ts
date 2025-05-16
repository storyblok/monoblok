import type { SbBlokData } from './types';

export default (blok: SbBlokData) => {
  if (typeof blok !== 'object' || typeof blok._editable === 'undefined') {
    return {};
  }

  try {
    const options = JSON.parse(
      blok._editable.replace(/^<!--#storyblok#/, '').replace(/-->$/, ''),
    );

    if (options) {
      return {
        'data-blok-c': JSON.stringify(options),
        'data-blok-uid': `${options.id}-${options.uid}`,
      };
    }

    return {};
  }
  catch {
    return {};
  }
};
