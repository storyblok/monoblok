// `React` namespace is read with `Reflect.get` so bundlers can't turn the
// `useState` lookup into a named import, which the `react-server` build lacks.
import * as React from "react";
import type { SbReactComponentsMap, StoryblokClient } from "@/types";

interface RenderState {
  componentsMap: Map<string, React.ElementType>;
  enableFallbackComponent: boolean;
  customFallbackComponent: React.ElementType;
}

const RSC_RENDER_STATE_KEY = Symbol.for("@storyblok/react/rsc-render-state");

/**
 * True when this module runs under the `react-server` condition (React Server
 * Components and Server Actions), whose React build has no `useState`.
 */
export const isReactServerEnvironment = (): boolean =>
  typeof Reflect.get(React, "useState") !== "function";

const createRenderState = (): RenderState => ({
  componentsMap: new Map<string, React.ElementType>(),
  enableFallbackComponent: false,
  customFallbackComponent: null,
});

const isRenderState = (value: unknown): value is RenderState =>
  !!value && typeof value === "object" && "componentsMap" in value;

/**
 * Bundlers can load this module more than once per server process: Next.js runs
 * Server Actions in a different module instance than the page render. Under
 * `react-server` the registered components are shared through `globalThis`, so
 * the live editing Server Action renders with the components the app passed to
 * `storyblokInit`. Every `react-server` instance registers the same kind of
 * component, so sharing is safe there. SSR and browser instances keep their own
 * state, as before.
 *
 * Only the render state is shared, because the live editing action only
 * renders. The API client stays per module instance: in an instance that didn't
 * run `storyblokInit`, `getStoryblokApi()` returns `null` even though components
 * are registered. Share it too before a Server Action needs it.
 */
const resolveRenderState = (): RenderState => {
  if (!isReactServerEnvironment()) {
    return createRenderState();
  }
  const existing: unknown = Reflect.get(globalThis, RSC_RENDER_STATE_KEY);
  if (isRenderState(existing)) {
    return existing;
  }
  const state = createRenderState();
  Reflect.set(globalThis, RSC_RENDER_STATE_KEY, state);
  return state;
};

// Shared state - single source of truth
let storyblokApiInstance: StoryblokClient = null;
const renderState = resolveRenderState();

// State accessors
export const getStoryblokApiInstance = (): StoryblokClient => storyblokApiInstance;
export const setStoryblokApiInstance = (instance: StoryblokClient): void => {
  storyblokApiInstance = instance;
};

export const getComponentsMap = (): Map<string, React.ElementType> => renderState.componentsMap;
export const setComponents = (
  newComponentsMap: SbReactComponentsMap,
): Map<string, React.ElementType> => {
  Object.entries(newComponentsMap).forEach(([key, value]) => {
    renderState.componentsMap.set(key, value);
  });
  return renderState.componentsMap;
};

export const getComponent = (componentKey: string): React.ElementType | false => {
  if (!renderState.componentsMap.has(componentKey)) {
    console.error(`Component ${componentKey} doesn't exist.`);
    return false;
  }

  return renderState.componentsMap.get(componentKey);
};

export const getEnableFallbackComponent = (): boolean => renderState.enableFallbackComponent;
export const setEnableFallbackComponent = (value: boolean): void => {
  renderState.enableFallbackComponent = value;
};

export const getCustomFallbackComponent = (): React.ElementType =>
  renderState.customFallbackComponent;
export const setCustomFallbackComponent = (component: React.ElementType): void => {
  renderState.customFallbackComponent = component;
};
