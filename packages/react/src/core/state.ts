import type {
  ISbStoryData,
  SbReactComponentsMap,
  StoryblokClient,
} from '@/types';

// Shared state - single source of truth
let storyblokApiInstance: StoryblokClient = null;
const componentsMap: Map<string, React.ElementType> = new Map<string, React.ElementType>();
let enableFallbackComponent: boolean = false;
let customFallbackComponent: React.ElementType = null;

declare global {
  // eslint-disable-next-line no-var, vars-on-top
  var storyCache: Map<string, ISbStoryData>;
}

globalThis.storyCache = globalThis.storyCache || new Map<string, ISbStoryData>();

// State accessors
export const getStoryblokApiInstance = (): StoryblokClient => storyblokApiInstance;
export const setStoryblokApiInstance = (instance: StoryblokClient): void => {
  storyblokApiInstance = instance;
};

export const getComponentsMap = (): Map<string, React.ElementType> => componentsMap;
export const setComponents = (newComponentsMap: SbReactComponentsMap): Map<string, React.ElementType> => {
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
