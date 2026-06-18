import type { Adapter, Assignment, Experiment, ExperimentEvent, ExperimentVariant } from './types';
import { assignVariant } from './assign-variant';
import { resolveExperiment } from './resolve-experiment';
import { trackEvent } from './track-event';

export interface CreateExperimentsOptions {
  experiments: Experiment[];
  adapters?: Adapter[];
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
}

/**
 * Pre-binds the experiments payload and adapters for ergonomic, server-side
 * per-request use. The bare `resolveExperiment` / `assignVariant` / `trackEvent`
 * functions stay available for full control.
 */
export function createExperiments({ experiments, adapters = [] }: CreateExperimentsOptions): Experiments {
  // Per-instance (per-request) state: assignments made during resolveExperiment,
  // keyed by experiment id, so track() can attribute without re-passing context.
  const assignments = new Map<number, Assignment>();

  const emit = (event: ExperimentEvent): void => {
    for (const adapter of adapters) {
      trackEvent(event, { adapter });
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

      const resolved = resolveExperiment({ experiments, slug, assignment });
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
  };
}
