// Environment detection utilities
export const isBrowser = () => typeof window !== 'undefined';
export const isServer = () => typeof window === 'undefined';

// Storyblok bridge detection utilities
export const isBridgeLoaded = () => isBrowser() && typeof window.storyblokRegisterEvent !== 'undefined';
export const isIframe = () => isBrowser() && window.self !== window.top;

/**
 * Detects if the current page is running inside Storyblok's Visual Editor.
 * Requires the page to be in an iframe context with the _storyblok URL parameter.
 * This is more reliable than just checking for the URL parameter alone.
 */
export const isVisualEditor = () => isBrowser() && isIframe() && window.location.search.includes('_storyblok');
