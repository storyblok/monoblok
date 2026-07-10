export default (blok?: { _editable?: string }) => {
  if (typeof blok !== 'object' || typeof blok._editable !== 'string') {
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
