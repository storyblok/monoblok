'use client';

import {
  type ISbStoryData,
  loadStoryblokBridge,
  registerStoryblokBridge,
  type StoryblokBridgeConfigV2,
} from '@storyblok/js';
import { Component, type ReactNode, startTransition, useEffect, useRef, useState } from 'react';
import { isBridgeLoaded, isVisualEditor } from '../utils';
import type { LiveEditRenderProps } from './live-edit-props';
import type { LiveEditRenderResult } from './live-edit-render-action';

type LiveEditRenderAction = (input: {
  story: Pick<ISbStoryData, 'content'>;
  props?: LiveEditRenderProps;
}) => Promise<LiveEditRenderResult>;

interface StoryblokLiveEditingProps {
  story: ISbStoryData;
  bridgeOptions?: StoryblokBridgeConfigV2;
  /**
   * Server-rendered story. Shown until the first Visual Editor update has been
   * rendered, and for every visitor outside the Visual Editor.
   */
  children?: ReactNode;
  /**
   * Props forwarded to the rendered story; passed by `StoryblokStory`.
   * Their presence turns on rendering Visual Editor updates on the server.
   * @internal
   */
  renderProps?: LiveEditRenderProps;
  /**
   * Names of `StoryblokStory` props left out of `renderProps` because
   * they aren't primitives. Only used to warn in the Visual Editor.
   * @internal
   */
  omittedRenderProps?: string[];
  /**
   * Replaces the live editing Server Action. Only for tests.
   * @internal
   */
  renderAction?: LiveEditRenderAction;
}

/**
 * Imported on first use from this client component, not passed down by
 * `StoryblokStory`: a static import from a Server Component makes Next.js 13
 * reject the build unless Server Actions are enabled.
 */
const loadRenderAction = async (): Promise<LiveEditRenderAction> => {
  const { renderLiveEditStory } = await import('./live-edit-render-action');
  return renderLiveEditStory;
};

let warnedStandalone = false;
const warnStandalone = (): void => {
  if (warnedStandalone) {
    return;
  }
  warnedStandalone = true;
  console.warn(
    'StoryblokLiveEditing: Visual Editor changes aren\'t shown when it\'s used on its own. Render the story with `StoryblokStory` to see them live.',
  );
};

let warnedUnsupported = false;
const warnUnsupported = (): void => {
  if (warnedUnsupported) {
    return;
  }
  warnedUnsupported = true;
  console.warn(
    'StoryblokStory: Visual Editor changes can\'t be shown live, because the live editing Server Action runs in the browser. Live editing needs Next.js 14 or later. Changes show after you save.',
  );
};

let warnedOmittedProps = false;
const warnOmittedProps = (names: string[] | undefined): void => {
  if (warnedOmittedProps || !names?.length) {
    return;
  }
  warnedOmittedProps = true;
  console.warn(
    `StoryblokStory: these props aren't applied while live editing, because only string, number, boolean, and null props are: ${names.join(', ')}`,
  );
};

/**
 * Retries per Visual Editor change when the server instance is cold. On
 * serverless platforms, a retry can land on another cold instance.
 */
const MAX_RETRIES = 3;

interface LiveContentBoundaryProps {
  /** Whether `children` is a live render, rather than the server render. */
  live: boolean;
  /** Shown instead of a live render that throws. */
  fallback: ReactNode;
  children: ReactNode;
}

interface LiveContentBoundaryState {
  error: unknown;
  children: ReactNode;
}

/**
 * A live render gets only primitive props, so a component that needs another
 * prop can throw. Show the server render instead of breaking the preview. Each
 * new render gets another chance; errors outside a live render propagate.
 */
class LiveContentBoundary extends Component<LiveContentBoundaryProps, LiveContentBoundaryState> {
  state: LiveContentBoundaryState = { error: null, children: this.props.children };

  static getDerivedStateFromError(error: unknown): Partial<LiveContentBoundaryState> {
    return { error: error ?? new Error('Unknown render error') };
  }

  static getDerivedStateFromProps(
    props: LiveContentBoundaryProps,
    state: LiveContentBoundaryState,
  ): Partial<LiveContentBoundaryState> | null {
    return props.children === state.children ? null : { error: null, children: props.children };
  }

  componentDidCatch(error: unknown): void {
    if (this.props.live) {
      console.warn(
        'StoryblokLiveEditing: the live update couldn\'t be rendered, showing the server render instead:',
        error,
      );
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      if (!this.props.live) {
        throw this.state.error;
      }
      return this.props.fallback;
    }
    return this.props.children;
  }
}

type InputHandler = (story: ISbStoryData) => void;

/**
 * The bridge only delivers events to the first listener registered on the page,
 * and has no way to remove one. So each story id is registered once, through a
 * dispatcher that forwards to the handler of the currently mounted component.
 * Remounts (React Strict Mode, client-side navigation) replace the handler
 * instead of registering a listener that would never be called. For the same
 * reason, the `bridgeOptions` of the first registration stay in effect.
 */
const inputHandlers = new Map<number, InputHandler>();
const registeredStoryIds = new Set<number>();

const subscribe = (
  storyId: number,
  handler: InputHandler,
  bridgeOptions: StoryblokBridgeConfigV2,
): (() => void) => {
  inputHandlers.set(storyId, handler);
  if (!registeredStoryIds.has(storyId)) {
    registeredStoryIds.add(storyId);
    registerStoryblokBridge(storyId, story => inputHandlers.get(storyId)?.(story), bridgeOptions);
  }
  return () => {
    if (inputHandlers.get(storyId) === handler) {
      inputHandlers.delete(storyId);
    }
  };
};

/**
 * Connects a server-rendered story to the Storyblok Visual Editor.
 *
 * On every Visual Editor change, it asks the server to render the updated story
 * and shows the result. The rendered update only reaches this browser: nothing
 * is cached or revalidated on the server.
 */
const StoryblokLiveEditing = ({
  story = null,
  bridgeOptions = {},
  children = null,
  renderAction,
  renderProps,
  omittedRenderProps,
}: StoryblokLiveEditingProps): ReactNode => {
  // Tagged with its story, so a different story passed to the same instance
  // shows its own server render instead of the previous story's live render.
  const [liveContent, setLiveContent] = useState<{
    storyId: number;
    node: ReactNode;
  } | null>(null);
  const latest = useRef({ renderAction, renderProps, omittedRenderProps });
  latest.current = { renderAction, renderProps, omittedRenderProps };

  const storyId = typeof story?.id === 'number' ? story.id : null;
  useEffect(() => {
    if (storyId === null || !isVisualEditor()) {
      return;
    }

    let disposed = false;
    let unsubscribe: (() => void) | null = null;
    let inFlight = false;
    let queued: { story: ISbStoryData; retries: number } | null = null;

    // One render at a time. A story arriving meanwhile replaces any queued one,
    // so fast typing renders the latest content without piling up requests.
    const render = (incoming: ISbStoryData, retries = 0) => {
      const { renderAction, renderProps, omittedRenderProps } = latest.current;
      if (!renderAction && !renderProps) {
        warnStandalone();
        return;
      }
      warnOmittedProps(omittedRenderProps);
      inFlight = true;
      Promise.resolve(renderAction ?? loadRenderAction())
        .then(action => action({ story: { content: incoming.content }, props: renderProps }))
        .then((result) => {
          if (disposed || !result) {
            return;
          }
          if (result.ok) {
            const { node } = result;
            startTransition(() => setLiveContent({ storyId, node }));
          }
          else if ('unsupported' in result && result.unsupported) {
            warnUnsupported();
          }
          else if ('retry' in result && result.retry && retries < MAX_RETRIES) {
            // The server instance was cold and has now loaded the app's
            // components. Send the story again, unless a newer one is queued.
            queued ??= { story: incoming, retries: retries + 1 };
          }
        })
        .catch((error: unknown) => {
          console.warn('StoryblokLiveEditing: rendering the live update failed:', error);
        })
        .finally(() => {
          inFlight = false;
          const next = queued;
          queued = null;
          if (next && !disposed) {
            render(next.story, next.retries);
          }
        });
    };

    const handleInput = (incoming: ISbStoryData) => {
      // Visual History sends stories without content: keep the current render.
      if (disposed || !incoming || incoming.content == null) {
        return;
      }
      if (inFlight) {
        queued = { story: incoming, retries: 0 };
        return;
      }
      render(incoming);
    };

    (async () => {
      // In RSC environments, Storyblok components are server-side rendered,
      // so the bridge script is never automatically loaded on the client.
      // We need to explicitly load it here for live editing to work.
      if (!isBridgeLoaded()) {
        await loadStoryblokBridge();
      }
      if (!disposed) {
        unsubscribe = subscribe(storyId, handleInput, bridgeOptions);
      }
    })();

    return () => {
      disposed = true;
      queued = null;
      unsubscribe?.();
    };
  }, [storyId, JSON.stringify(bridgeOptions)]);

  const live = liveContent !== null && liveContent.storyId === storyId;
  return (
    <LiveContentBoundary live={live} fallback={children}>
      {live ? liveContent.node : children}
    </LiveContentBoundary>
  );
};

export default StoryblokLiveEditing;
