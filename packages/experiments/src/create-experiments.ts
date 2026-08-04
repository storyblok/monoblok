import type { ConversionGoal } from './define-goal';
import type { Adapter, Assignment, Experiment, ExperimentEvent, ExperimentVariant, Exposure } from './types';
import { assignVariant } from './assign-variant';
import { findExperimentBySlug } from './find-experiment-by-slug';
import { resolveExperiment } from './resolve-experiment';

export interface CreateExperimentsOptions {
  experiments: Experiment[];
  adapters?: Adapter[];
  /**
   * Called when an adapter throws or its returned promise rejects. Adapter
   * failures are otherwise swallowed so a downed analytics sink never breaks
   * the request. Defaults to a no-op.
   */
  onError?: (error: unknown, event: ExperimentEvent) => void;
  /**
   * Receives every pending async delivery so the host platform keeps the
   * process alive until it settles. Without this, serverless runtimes
   * (Vercel, Netlify, Cloudflare) may freeze the process as soon as the
   * response is sent and silently drop in-flight events. Pass the platform's
   * `waitUntil` (or Next.js `after`). The promise never rejects; failures
   * still go to `onError`.
   *
   * Convenient for a per-request instance. A module-scope instance has no
   * request to bind at construction time. There, await the `delivered` promise
   * from `resolveExperiment` (or the promise from `track` / `send`) and hand
   * that to the platform instead.
   */
  waitUntil?: (promise: Promise<unknown>) => void;
}

export interface FactoryResolveOptions {
  slug: string;
  visitorId: string;
  /**
   * Set to `false` to get the exposure descriptor back without delivering it.
   * Use this to defer exposure counting to the client, so a prefetched or
   * bot-rendered page does not inflate the denominator, then hand the
   * descriptor to `send` once the page is actually viewed. Defaults to `true`.
   */
  exposure?: boolean;
}

export interface FactoryResolvedExperiment {
  /** The slug to render: `original_slug` for control, `variant_slug` otherwise. */
  slug: string;
  /** The assigned variant, when an experiment applied. */
  variant?: ExperimentVariant;
  /**
   * The exposure for this resolve, when an experiment applied. Already
   * delivered unless `exposure: false` was passed.
   */
  exposure?: Exposure;
  /**
   * Resolves once the exposure delivery has settled. Never rejects; failures go
   * to `onError`. Already resolved when nothing was delivered.
   */
  delivered: Promise<void>;
}

export interface TrackOptions {
  /** Arbitrary event properties forwarded to the sink. */
  props?: Record<string, unknown>;
  /** Numeric metric value for the goal (revenue in cents, cart total, …). */
  value?: number;
}

export interface Experiments {
  /**
   * Assigns, resolves, and, unless `exposure: false`, delivers the exposure
   * event through the configured adapters.
   *
   * Fires one exposure per call and does not deduplicate: two resolves for the
   * same visitor and experiment deliver two events. Count distinct `visitorId`
   * per variant in your sink, which you need regardless, since a returning
   * visitor is legitimately exposed again.
   */
  resolveExperiment: (options: FactoryResolveOptions) => FactoryResolvedExperiment;
  /**
   * Delivers a conversion event for every experiment `visitorId` is bucketed
   * into. Resolves once delivery has settled; never rejects.
   *
   * Bucketing is deterministic, so this needs no prior `resolveExperiment` and
   * works from any request, runtime, or instance. It records against every
   * running experiment rather than only the one that was rendered. Join on
   * `visitorId` in the sink to scope conversions to visitors who saw an
   * exposure.
   */
  track: {
    (goal: string | ConversionGoal, visitorId: string, options?: TrackOptions): Promise<void>;
    /**
     * @deprecated Pass `visitorId` explicitly:
     * `track('signup', visitorId, { props })`.
     *
     * This form attributes the conversion to assignments remembered from a
     * `resolveExperiment` call on this same instance. That only holds when both
     * happen in one request, so it silently records nothing when the conversion
     * arrives in a later request (the usual SSR case), and misattributes on an
     * instance shared between visitors.
     *
     * Scheduled for removal in 2.0 — see the `2.0 cleanup` note in this file.
     */
    (goal: string | ConversionGoal, props?: Record<string, unknown>): Promise<void>;
  };
  /**
   * Builds the conversion events for `visitorId` without delivering them, for
   * when the send has to happen elsewhere: embedded in a page and beaconed on
   * click, or handed to a queue.
   */
  createEvent: (goal: string | ConversionGoal, visitorId: string, options?: TrackOptions) => ExperimentEvent[];
  /**
   * Delivers an already-built event through the configured adapters. Use it to
   * forward an event that arrived from the browser, or to fire an exposure that
   * was deferred with `exposure: false`. Resolves once delivery has settled;
   * never rejects.
   */
  send: (event: ExperimentEvent) => Promise<void>;
  /**
   * Resolves once every pending async delivery has settled. Never rejects;
   * failures go to `onError`. Await it before returning a response on
   * platforms without a `waitUntil` hook.
   *
   * On a module-scope instance the pending set is shared across concurrent
   * requests, so this waits on other requests' deliveries too. Prefer awaiting
   * the promise from the specific call there.
   */
  flush: () => Promise<void>;
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && 'then' in value && typeof value.then === 'function';
}

/**
 * 2.0 cleanup — everything below is kept only for 1.x compatibility and should
 * be removed together, since each piece exists to support the others:
 *
 * 1. The `track(goal, props?)` overload on `Experiments`.
 * 2. The `visitorIdOrProps` branch in `track`, leaving
 *    `track(goal, visitorId, options?)` with a plain signature.
 * 3. `rememberedAssignments` and the `.set` call in `resolveExperiment`. This is
 *    the only per-visitor state left in the factory; dropping it is what makes a
 *    module-scope instance provably safe rather than safe-by-convention.
 *
 * Consider also renaming `ExperimentEvent.props` to `properties`, which is what
 * PostHog, Mixpanel, Segment, and GrowthBook all call the same bag. It was left
 * alone here only to avoid breaking existing adapters that read `event.props`.
 */

/**
 * Pre-binds the experiments payload and adapters for ergonomic use. Holds no
 * per-visitor state, so one instance can be created at module scope and shared
 * across requests. The bare `assignVariant` / `resolveExperiment` functions stay
 * available for full control.
 */
export function createExperiments({ experiments, adapters = [], onError, waitUntil }: CreateExperimentsOptions): Experiments {
  // Async deliveries still in flight, so flush() can await them.
  const pending = new Set<Promise<void>>();

  // Assignments remembered by resolveExperiment, solely to keep the deprecated
  // `track(goal, props)` form working. Keyed by experiment id only, so it cannot
  // represent more than one visitor at a time, which is exactly why the
  // supported form takes an explicit visitorId. Its size is bounded by the
  // number of running experiments, so it does not grow with traffic. Goes away
  // with the overload.
  const rememberedAssignments = new Map<number, Assignment>();

  // An adapter that throws synchronously or rejects asynchronously must never
  // surface as an unhandled rejection or break the request. Route failures to
  // `onError` (default: swallow). Adapters are invoked synchronously so the
  // request (e.g. a fetch) is initiated before the handler returns; async
  // deliveries are tracked for flush() and handed to waitUntil so serverless
  // runtimes do not freeze the process while they are in flight. The returned
  // promise settles when this event's deliveries do, and never rejects.
  const send = (event: ExperimentEvent): Promise<void> => {
    const settled: Promise<void>[] = [];
    for (const adapter of adapters) {
      try {
        const result = adapter(event);
        if (isThenable(result)) {
          const delivery = Promise.resolve(result).then(
            () => undefined,
            (error) => { onError?.(error, event); },
          );
          pending.add(delivery);
          delivery.then(() => pending.delete(delivery));
          waitUntil?.(delivery);
          settled.push(delivery);
        }
      }
      catch (error) {
        onError?.(error, event);
      }
    }
    return settled.length > 0 ? Promise.all(settled).then(() => undefined) : Promise.resolve();
  };

  const sendAll = async (events: ExperimentEvent[]): Promise<void> => {
    await Promise.all(events.map(send));
  };

  const toGoal = (goal: string | ConversionGoal): ConversionGoal =>
    typeof goal === 'string' ? { name: goal } : goal;

  const conversionFrom = (
    assignment: Assignment,
    goal: ConversionGoal,
    overrides: TrackOptions,
  ): ExperimentEvent | undefined => {
    const experiment = experiments.find(candidate => candidate.id === assignment.experimentId);
    if (!experiment) {
      return undefined;
    }
    const value = overrides.value ?? goal.value;
    const props = overrides.props ?? goal.props;
    return {
      type: 'conversion',
      experiment: { id: experiment.id, name: experiment.name },
      variant: { name: assignment.variant.name, public_id: assignment.variant.public_id },
      visitorId: assignment.visitorId,
      name: goal.name,
      ...(value === undefined ? {} : { value }),
      ...(props === undefined ? {} : { props }),
    };
  };

  const isEvent = (event: ExperimentEvent | undefined): event is ExperimentEvent => event !== undefined;

  const buildEvents = (
    goal: string | ConversionGoal,
    visitorId: string,
    options: TrackOptions = {},
  ): ExperimentEvent[] => {
    const resolvedGoal = toGoal(goal);
    return experiments
      .map(experiment => assignVariant({ experiment, visitorId }))
      .filter((assignment): assignment is Assignment => assignment !== undefined)
      .map(assignment => conversionFrom(assignment, resolvedGoal, options))
      .filter(isEvent);
  };

  async function track(
    goal: string | ConversionGoal,
    visitorIdOrProps?: string | Record<string, unknown>,
    options?: TrackOptions,
  ): Promise<void> {
    // A string second argument is unambiguously the visitorId; an object is the
    // deprecated props bag. Discriminating on `typeof` rather than on a
    // `visitorId` key matters: `track('signup', { visitorId })` was a real 1.x
    // call, and key-sniffing would silently reinterpret it as the new shape.
    if (typeof visitorIdOrProps === 'string') {
      await sendAll(buildEvents(goal, visitorIdOrProps, options));
      return;
    }

    const resolvedGoal = toGoal(goal);
    const overrides = visitorIdOrProps === undefined ? {} : { props: visitorIdOrProps };
    await sendAll(
      [...rememberedAssignments.values()]
        .map(assignment => conversionFrom(assignment, resolvedGoal, overrides))
        .filter(isEvent),
    );
  }

  return {
    resolveExperiment({ slug, visitorId, exposure: fireExposure = true }) {
      const experiment = findExperimentBySlug({ experiments, slug });
      if (!experiment) {
        return { slug, delivered: Promise.resolve() };
      }

      const assignment = assignVariant({ experiment, visitorId });
      if (!assignment) {
        return { slug, delivered: Promise.resolve() };
      }
      rememberedAssignments.set(experiment.id, assignment);

      const resolved = resolveExperiment({ experiments: [experiment], slug, assignment });
      const delivered = resolved.exposure && fireExposure ? send(resolved.exposure) : Promise.resolve();
      return { slug: resolved.slug, variant: resolved.variant, exposure: resolved.exposure, delivered };
    },

    track,

    createEvent(goal, visitorId, options) {
      return buildEvents(goal, visitorId, options);
    },

    send,

    async flush() {
      // Deliveries can enqueue further deliveries (e.g. an adapter emitting
      // through another instance), so drain until the set is empty.
      while (pending.size > 0) {
        await Promise.all(pending);
      }
    },
  };
}
