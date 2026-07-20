import type StoryblokBridge from '@storyblok/preview-bridge';

let loaded = false;
let loadPromise: Promise<void> | undefined;
const callbacks: Array<() => void> = [];

export const loadBridge = (): Promise<void> => {
  if (typeof window === 'undefined') {
    return Promise.reject(
      new Error('Cannot load Storyblok bridge: window is undefined (server-side environment)'),
    );
  }

  // Set up the callback queue synchronously so useStoryblokBridge can register
  // callbacks immediately after loadBridge() is called, before the async
  // import has settled. Matches the original CDN script behaviour.
  window.storyblokRegisterEvent = (cb: () => void) => {
    if (!window.location.search.includes('_storyblok')) {
      console.warn('You are not in Draft Mode or in the Visual Editor.');
      return;
    }

    if (!loaded) {
      callbacks.push(cb);
    }
    else {
      cb();
    }
  };

  if (loaded) {
    return Promise.resolve();
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = import('@storyblok/preview-bridge')
    .then(({ default: StoryblokBridgeClass }: { default: typeof StoryblokBridge }) => {
      // Expose the class on window so that code using the legacy pattern
      // `new window.StoryblokBridge(options)` continues to work.
      (window as any).StoryblokBridge = StoryblokBridgeClass;
      callbacks.forEach(cb => cb());
      loaded = true;
    })
    .catch((error) => {
      loadPromise = undefined;
      throw error;
    });

  return loadPromise;
};
