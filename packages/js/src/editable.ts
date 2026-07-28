export default (blok?: unknown) => {
  if (typeof blok !== 'object' || blok === null) {
    return {};
  }

  const _editable = (blok as Record<string, unknown>)._editable;

  if (typeof _editable !== 'string') {
    return {};
  }

  try {
    const options = JSON.parse(
      _editable.replace(/^<!--#storyblok#/, '').replace(/-->$/, ''),
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
