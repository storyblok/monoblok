import type { Adapter, Assignment, Experiment, ExperimentEvent, ExperimentVariant } from './types';
import { assignVariant } from './assign-variant';
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
   */
  waitUntil?: (promise: Promise<unknown>) => void;
}

export interface FactoryResolveOptions {
  slug: string;
  visitorId: string;
}

export interface FactoryResolvedExperiment {
  slug: string;
  variant?: ExperimentVariant;
}

export interface Experiments {
  /**
   * Assigns, resolves, and auto-fires the exposure event through the configured
   * adapters. Remembers the assignment so a later `track` can attribute
   * conversions.
   */
  resolveExperiment: (options: FactoryResolveOptions) => FactoryResolvedExperiment;
  /** Fires a conversion event for every experiment this visitor was assigned to. */
  track: (name: string, props?: Record<string, unknown>) => void;
  /**
   * Resolves once every pending async delivery has settled. Never rejects;
   * failures go to `onError`. Await it before returning a response on
   * platforms without a `waitUntil` hook.
   */
  flush: () => Promise<void>;
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && 'then' in value && typeof value.then === 'function';
}

/**
 * Pre-binds the experiments payload and adapters for ergonomic, server-side
 * per-request use. The bare `resolveExperiment` / `assignVariant` functions
 * stay available for full control.
 */
export function createExperiments({ experiments, adapters = [], onError, waitUntil }: CreateExperimentsOptions): Experiments {
  // Per-instance (per-request) state: assignments made during resolveExperiment,
  // keyed by experiment id, so track() can attribute without re-passing context.
  const assignments = new Map<number, Assignment>();

  // Async deliveries still in flight, so flush() can await them.
  const pending = new Set<Promise<void>>();

  // An adapter that throws synchronously or rejects asynchronously must never
  // surface as an unhandled rejection or break the request. Route failures to
  // `onError` (default: swallow). Adapters are invoked synchronously so the
  // request (e.g. a fetch) is initiated before the handler returns; async
  // deliveries are tracked for flush() and handed to waitUntil so serverless
  // runtimes do not freeze the process while they are in flight.
  const emit = (event: ExperimentEvent): void => {
    for (const adapter of adapters) {
      try {
        const result = adapter(event);
        if (isThenable(result)) {
          const settled = Promise.resolve(result).then(
            () => undefined,
            (error) => { onError?.(error, event); },
          );
          pending.add(settled);
          settled.then(() => pending.delete(settled));
          waitUntil?.(settled);
        }
      }
      catch (error) {
        onError?.(error, event);
      }
    }
  };

  return {
    resolveExperiment({ slug, visitorId }) {
      const experiment = experiments.find(candidate =>
        candidate.variants.some(variant =>
          variant.story_mappings.some(mapping => mapping.original_slug === slug),
        ),
      );
      if (!experiment) {
        return { slug };
      }

      const assignment = assignVariant({ experiment, visitorId });
      if (!assignment) {
        return { slug };
      }
      assignments.set(experiment.id, assignment);

      const resolved = resolveExperiment({ experiments: [experiment], slug, assignment });
      if (resolved.exposure) {
        emit(resolved.exposure);
      }
      return { slug: resolved.slug, variant: resolved.variant };
    },

    track(name, props) {
      for (const assignment of assignments.values()) {
        const experiment = experiments.find(candidate => candidate.id === assignment.experimentId);
        if (!experiment) {
          continue;
        }
        emit({
          type: 'conversion',
          experiment: { id: experiment.id, name: experiment.name },
          variant: { name: assignment.variant.name, public_id: assignment.variant.public_id },
          name,
          props,
        });
      }
    },

    async flush() {
      // Deliveries can enqueue further deliveries (e.g. an adapter emitting
      // through another instance), so drain until the set is empty.
      while (pending.size > 0) {
        await Promise.all(pending);
      }
    },
  };
}
