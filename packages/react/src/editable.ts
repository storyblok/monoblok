interface BlokPartial {
  _editable?: string;
  _uid: string;
  component: string;
  [key: string]: unknown;
}

export const storyblokEditable = (blok: BlokPartial) => {
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
