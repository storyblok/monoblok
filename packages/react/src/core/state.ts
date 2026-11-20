import type { SbReactComponentsMap, StoryblokClient } from "@/types";

declare global {
  // Server-side only: the access token used to verify Visual Editor requests.
  // Kept on `globalThis` because bundlers can instantiate this module more than
  // once per process (webpack puts server actions in their own layer).
  // eslint-disable-next-line vars-on-top
  var __storyblokPreviewAccessToken: string | null | undefined;
}

// Shared state - single source of truth
let storyblokApiInstance: StoryblokClient = null;
const componentsMap: Map<string, React.ElementType> = new Map<string, React.ElementType>();
let enableFallbackComponent: boolean = false;
let customFallbackComponent: React.ElementType = null;

// State accessors
export const getStoryblokApiInstance = (): StoryblokClient => storyblokApiInstance;
export const setStoryblokApiInstance = (instance: StoryblokClient): void => {
  storyblokApiInstance = instance;
};

export const getComponentsMap = (): Map<string, React.ElementType> => componentsMap;
export const setComponents = (
  newComponentsMap: SbReactComponentsMap,
): Map<string, React.ElementType> => {
  Object.entries(newComponentsMap).forEach(([key, value]) => {
    componentsMap.set(key, value);
  });
  return componentsMap;
};

export const getComponent = (componentKey: string): React.ElementType | false => {
  if (!componentsMap.has(componentKey)) {
    console.error(`Component ${componentKey} doesn't exist.`);
    return false;
  }

  return componentsMap.get(componentKey);
};

export const getEnableFallbackComponent = (): boolean => enableFallbackComponent;
export const setEnableFallbackComponent = (value: boolean): void => {
  enableFallbackComponent = value;
};

export const getCustomFallbackComponent = (): React.ElementType => customFallbackComponent;
export const setCustomFallbackComponent = (component: React.ElementType): void => {
  customFallbackComponent = component;
};

/**
 * Environment variable read by the live edit server action. It doesn't depend on
 * any module having run `storyblokInit`, so it works for statically rendered pages
 * and on cold server instances.
 */
export const PREVIEW_TOKEN_ENV_VAR = "STORYBLOK_PREVIEW_TOKEN";

const readPreviewTokenFromEnv = (): string | null => {
  if (typeof process === "undefined" || !process.env) {
    return null;
  }
  const value = process.env[PREVIEW_TOKEN_ENV_VAR];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

export const getPreviewAccessToken = (): string | null =>
  globalThis.__storyblokPreviewAccessToken ?? null;
export const setPreviewAccessToken = (token: string | null | undefined): void => {
  globalThis.__storyblokPreviewAccessToken =
    typeof token === "string" && token.length > 0 ? token : null;
};

/**
 * All access tokens the live edit server action can verify Visual Editor
 * requests against: `STORYBLOK_PREVIEW_TOKEN` first, then the token passed to a
 * server-side `storyblokInit`.
 */
export const getPreviewAccessTokenCandidates = (): string[] => {
  const candidates = [readPreviewTokenFromEnv(), getPreviewAccessToken()].filter(
    (token): token is string => token !== null,
  );
  return [...new Set(candidates)];
};
