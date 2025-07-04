let loaded = false;
const callbacks: Array<() => void> = [];

export const loadBridge = (src: string) => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Cannot load Storyblok bridge: window is undefined (server-side environment)'));
      return;
    }

    // Way to make sure all event handlers are called after loading
    window.storyblokRegisterEvent = (cb: () => void) => {
      if (!loaded) {
        callbacks.push(cb);
      }
      else { cb(); }
    };

    if (document.getElementById('storyblok-javascript-bridge')) {
      resolve(undefined);
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    script.id = 'storyblok-javascript-bridge';

    script.onerror = error => reject(error);
    script.onload = (ev) => {
      callbacks.forEach(cb => cb());
      loaded = true;
      resolve(ev);
    };

    document.getElementsByTagName('head')[0].appendChild(script);
  });
};
