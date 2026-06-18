/**
 * End-to-end test: real Storyblok experiments payload → @storyblok/experiments round-trip
 *
 * Validates that:
 *  1. A running experiment set up through the MAPI surfaces on `GET /v2/cdn/experiments`
 *     with the shape the package's `Experiment` type expects.
 *  2. `assignVariant` deterministically buckets visitors into the real variants.
 *  3. `resolveExperiment` maps the original slug to the control's original slug and to a
 *     variant's mapped `variant_slug`, with an exposure event.
 *  4. `trackEvent` and the `createExperiments` factory deliver events through an adapter.
 *  5. The resolved slug points at a story that is actually fetchable via the CAPI.
 *
 * The MAPI client has no dedicated experiments resource yet, so the setup drives the
 * management endpoints directly through the generic HTTP escape hatches (`mapi.post`,
 * `mapi.put`, `mapi.get`, `mapi.delete`).
 *
 * Run manually (never in CI):
 *   pnpm --filter @storyblok/experiments test:e2e
 *
 * Requires .env.qa-engineer-manual at the repo root with:
 *   STORYBLOK_TOKEN=<personal-access-token>
 *   STORYBLOK_SPACE_ID=<numeric-space-id>
 *
 * The target space must have A/B testing (experiments) enabled.
 */

import type { Experiment, ExperimentEvent } from '@storyblok/experiments';
import { createApiClient } from '@storyblok/api-client';
import { createManagementApiClient } from '@storyblok/management-api-client';
import { assignVariant, createExperiments, resolveExperiment, trackEvent } from '@storyblok/experiments';
import { fetchAdapter } from '@storyblok/experiments/adapters';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const token = process.env.STORYBLOK_TOKEN!;
const spaceId = Number(process.env.STORYBLOK_SPACE_ID!);

const COMPONENT_NAME = 'e2e_experiments_page';
const EXPERIMENT_NAME = 'e2e_experiments_hero';
const EXPERIMENT_PREFIX = 'e2e_experiments_';
const STORY_SLUG_PREFIX = 'e2e-experiments-';
const ORIGINAL_SLUG = `${STORY_SLUG_PREFIX}home`;

const mapi = createManagementApiClient({
  personalAccessToken: token,
  spaceId,
  throwOnError: true,
});

const experimentsPath = `/v1/spaces/${spaceId}/experiments`;

interface ExperimentVariantResponse {
  id: number;
  name: string;
  is_control: boolean;
}

interface CreateExperimentResponse {
  experiment: {
    id: number;
    experiment_variants: ExperimentVariantResponse[];
  };
}

interface CreateStoryMappingResponse {
  story_mapping: {
    variant_story_id: number;
    variant_slug: string;
  };
}

interface ExperimentsListResponse {
  experiments: { id: number; name: string; status: string }[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Narrows the untyped CAPI `cdn/experiments` body to the package's payload shape. */
function readExperimentsPayload(data: unknown): { experiments: Experiment[]; cv: number } {
  if (!isRecord(data) || !Array.isArray(data.experiments) || typeof data.cv !== 'number') {
    throw new TypeError('GET cdn/experiments did not return an { experiments, cv } payload');
  }
  return { experiments: data.experiments as Experiment[], cv: data.cv };
}

/** Reads the slug of a story returned by the CAPI `cdn/stories/:slug` endpoint. */
function readStorySlug(data: unknown): string {
  if (!isRecord(data) || !isRecord(data.story) || typeof data.story.full_slug !== 'string') {
    throw new TypeError('GET cdn/stories/:slug did not return a story');
  }
  return data.story.full_slug;
}

async function cleanup(): Promise<void> {
  // Experiments first: a linked story cannot be removed while its experiment exists.
  const listRes = await mapi.get<ExperimentsListResponse>(experimentsPath, { throwOnError: false });
  for (const experiment of listRes.data?.experiments ?? []) {
    if (!experiment.name?.startsWith(EXPERIMENT_PREFIX) || !experiment.id) {
      continue;
    }
    // Only draft or completed experiments can be deleted, so a running or
    // paused one must be completed first.
    if (experiment.status === 'running' || experiment.status === 'paused') {
      await mapi.put(`${experimentsPath}/${experiment.id}/complete`, { throwOnError: false });
    }
    await mapi.delete(`${experimentsPath}/${experiment.id}`, { throwOnError: false });
  }

  // Stories: catches the original and the auto-duplicated variant copy.
  const storiesRes = await mapi.stories.list({ query: { per_page: 100 }, throwOnError: false });
  for (const story of storiesRes.data?.stories ?? []) {
    if (story.slug?.startsWith(STORY_SLUG_PREFIX) && story.id) {
      await mapi.stories.delete(story.id, { throwOnError: false });
    }
  }

  // Components last: nothing references them once the stories are gone.
  const componentsRes = await mapi.components.list({ throwOnError: false });
  for (const component of componentsRes.data?.components ?? []) {
    if (component.name?.startsWith(EXPERIMENT_PREFIX) && component.id) {
      await mapi.components.delete(component.id, { throwOnError: false });
    }
  }
}

describe('@storyblok/experiments CDN round-trip', () => {
  let previewToken: string;
  let experiments: Experiment[];
  let experiment: Experiment;
  let variantSlug: string;

  beforeAll(async () => {
    await cleanup();

    // 1. Public token for CAPI reads.
    const spaceRes = await mapi.spaces.get();
    previewToken = spaceRes.data!.space!.first_token!;
    expect(previewToken).toBeTruthy();

    // 2. A root component so the original story has valid content.
    await mapi.components.create({
      body: {
        component: {
          name: COMPONENT_NAME,
          is_root: true,
          is_nestable: false,
          schema: { title: { type: 'text', pos: 0 } },
        },
      },
    });

    // 3. The original (control) story, published so the CAPI can serve it.
    const storyRes = await mapi.stories.create({
      body: {
        story: {
          name: 'E2E Experiments Home',
          slug: ORIGINAL_SLUG,
          // @ts-expect-error the generated `content` type wrongly requires `_uid`; this will be fixed upstream.
          content: { component: COMPONENT_NAME, title: 'Home' },
        },
      },
    });
    const originalStoryId = storyRes.data!.story!.id!;
    await mapi.stories.publish(originalStoryId);

    // 4. The experiment (draft) with a 50/50 control + variant split.
    const createRes = await mapi.post<CreateExperimentResponse>(experimentsPath, {
      body: {
        experiment: {
          name: EXPERIMENT_NAME,
          display_name: 'E2E Experiments Hero',
          story_ids: [originalStoryId],
          experiment_variants_attributes: [
            { name: 'control', display_name: 'Control', weight: 50, is_control: true },
            { name: 'variant_b', display_name: 'Variant B', weight: 50, is_control: false },
          ],
        },
      },
    });
    const experimentId = createRes.data!.experiment.id;
    const variantB = createRes.data!.experiment.experiment_variants.find(variant => !variant.is_control)!;

    // 5. Map the original story to variant B; omitting variant_story_id duplicates a copy.
    const mappingRes = await mapi.post<CreateStoryMappingResponse>(
      `${experimentsPath}/${experimentId}/variants/${variantB.id}/story_mappings`,
      { body: { story_mapping: { original_story_id: originalStoryId } } },
    );
    variantSlug = mappingRes.data!.story_mapping.variant_slug;
    const variantStoryId = mappingRes.data!.story_mapping.variant_story_id;

    // 6. Activation requires every non-control variant story to be published.
    await mapi.stories.publish(variantStoryId);

    // 7. Activate: only running experiments appear on the CDN.
    await mapi.put(`${experimentsPath}/${experimentId}/activate`, {});

    // 8. Read the public experiments payload with the user's own client.
    const capi = createApiClient({ accessToken: previewToken });
    const cdnRes = await capi.get('/v2/cdn/experiments');
    experiments = readExperimentsPayload(cdnRes.data).experiments;
    experiment = experiments.find(candidate => candidate.name === EXPERIMENT_NAME)!;
  });

  afterAll(cleanup);

  describe('payload', () => {
    it('returns the running experiment in the package Experiment shape', () => {
      expect(experiment).toBeDefined();
      expect(experiment.display_name).toBe('E2E Experiments Hero');
      expect(Array.isArray(experiment.story_ids)).toBe(true);
      expect(experiment.variants.length).toBe(2);

      for (const variant of experiment.variants) {
        expect(typeof variant.name).toBe('string');
        expect(typeof variant.public_id).toBe('string');
        expect(typeof variant.weight).toBe('number');
        expect(typeof variant.is_control).toBe('boolean');
        expect(Array.isArray(variant.story_mappings)).toBe(true);
      }

      const variant = experiment.variants.find(candidate => !candidate.is_control)!;
      const mapping = variant.story_mappings.find(candidate => candidate.original_slug === ORIGINAL_SLUG)!;
      expect(mapping.variant_slug).toBe(variantSlug);
    });
  });

  describe('assignVariant', () => {
    it('is deterministic for the same visitor and experiment', () => {
      const first = assignVariant({ experiment, visitorId: 'visitor-determinism' });
      const second = assignVariant({ experiment, visitorId: 'visitor-determinism' });

      expect(first?.variant.public_id).toBeDefined();
      expect(first?.variant.public_id).toBe(second?.variant.public_id);
    });

    it('buckets visitors across both real variants', () => {
      let controlVisitor: string | undefined;
      let variantVisitor: string | undefined;

      for (let index = 0; index < 50 && (!controlVisitor || !variantVisitor); index++) {
        const visitorId = `visitor-${index}`;
        const assignment = assignVariant({ experiment, visitorId })!;
        if (assignment.variant.is_control) {
          controlVisitor ??= visitorId;
        }
        else {
          variantVisitor ??= visitorId;
        }
      }

      expect(controlVisitor).toBeDefined();
      expect(variantVisitor).toBeDefined();
    });
  });

  describe('resolveExperiment', () => {
    it('renders the original slug for the control variant', () => {
      const control = experiment.variants.find(variant => variant.is_control)!;
      const assignment = { experimentId: experiment.id, variant: control };

      const resolved = resolveExperiment({ experiments, slug: ORIGINAL_SLUG, assignment });

      expect(resolved.slug).toBe(ORIGINAL_SLUG);
      expect(resolved.variant?.is_control).toBe(true);
      expect(resolved.exposure).toMatchObject({ type: 'exposure', experiment: { id: experiment.id } });
    });

    it('renders the mapped variant slug for a variant assignment', () => {
      const variant = experiment.variants.find(candidate => !candidate.is_control)!;
      const assignment = { experimentId: experiment.id, variant };

      const resolved = resolveExperiment({ experiments, slug: ORIGINAL_SLUG, assignment });

      expect(resolved.slug).toBe(variantSlug);
      expect(resolved.exposure?.variant.public_id).toBe(variant.public_id);
    });

    it('passes the slug through unchanged when no experiment matches', () => {
      const resolved = resolveExperiment({ experiments, slug: 'definitely-not-in-any-experiment' });

      expect(resolved.slug).toBe('definitely-not-in-any-experiment');
      expect(resolved.exposure).toBeUndefined();
    });
  });

  describe('trackEvent', () => {
    it('delivers the exposure event to an adapter', () => {
      const variant = experiment.variants.find(candidate => !candidate.is_control)!;
      const assignment = { experimentId: experiment.id, variant };
      const resolved = resolveExperiment({ experiments, slug: ORIGINAL_SLUG, assignment });

      const captured: ExperimentEvent[] = [];
      trackEvent(resolved.exposure!, { adapter: event => captured.push(event) });

      expect(captured).toHaveLength(1);
      expect(captured[0]).toMatchObject({ type: 'exposure', experiment: { id: experiment.id } });
    });

    it('exposes fetchAdapter from the /adapters subpath', () => {
      expect(typeof fetchAdapter).toBe('function');
    });
  });

  describe('createExperiments', () => {
    it('auto-fires exposure on resolve and attributes a later conversion', () => {
      const events: ExperimentEvent[] = [];
      const exp = createExperiments({ experiments, adapters: [event => events.push(event)] });

      const resolved = exp.resolveExperiment({ slug: ORIGINAL_SLUG, visitorId: 'visitor-factory' });
      expect([ORIGINAL_SLUG, variantSlug]).toContain(resolved.slug);

      exp.track('signup', { plan: 'pro' });

      expect(events.some(event => event.type === 'exposure')).toBe(true);
      expect(events.some(event => event.type === 'conversion' && event.name === 'signup')).toBe(true);
    });
  });

  describe('story round-trip', () => {
    it('resolves to a slug that the CAPI can fetch', async () => {
      const variant = experiment.variants.find(candidate => !candidate.is_control)!;
      const assignment = { experimentId: experiment.id, variant };
      const resolved = resolveExperiment({ experiments, slug: ORIGINAL_SLUG, assignment });

      const capi = createApiClient({ accessToken: previewToken });
      const storyRes = await capi.get(`/v2/cdn/stories/${resolved.slug}`);

      expect(readStorySlug(storyRes.data)).toBe(resolved.slug);
    });
  });
});
