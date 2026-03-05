interface Blok {
  _editable?: string;
}

interface EditableOptions {
  id: string;
  uid: string;
}

export default function storyblokEditable(blok?: Blok) {
  const editable = blok?._editable;
  if (!editable) {
    return {};
  }

  const prefix = '<!--#storyblok#';
  const suffix = '-->';

  if (!editable.startsWith(prefix) || !editable.endsWith(suffix)) {
    return {};
  }

  try {
    const json = editable.slice(prefix.length, -suffix.length);
    const options = JSON.parse(json) as EditableOptions;

    return {
      'data-blok-c': JSON.stringify(options),
      'data-blok-uid': `${options.id}-${options.uid}`,
    };
  }
  catch {
    return {};
  }
}
