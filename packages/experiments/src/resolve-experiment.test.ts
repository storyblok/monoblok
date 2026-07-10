import type { Assignment, Experiment } from './types';
import { describe, expect, it } from 'vitest';
import { homepageExperiment } from './fixtures';
import { resolveExperiment } from './resolve-experiment';

const controlAssignment: Assignment = {
  experimentId: 123,
  variant: homepageExperiment.variants[0],
};

const variantAssignment: Assignment = {
  experimentId: 123,
  variant: homepageExperiment.variants[1],
};

describe('resolveExperiment', () => {
  it('renders the original slug for control, with an exposure', () => {
    const result = resolveExperiment({
      experiments: [homepageExperiment],
      slug: 'home',
      assignment: controlAssignment,
    });
    expect(result.slug).toBe('home');
    expect(result.variant?.public_id).toBe('var_control');
    expect(result.exposure).toEqual({
      type: 'exposure',
      experiment: { id: 123, name: 'homepage_hero' },
      variant: { name: 'control', public_id: 'var_control' },
    });
  });

  it('renders the mapped variant slug for a non-control variant', () => {
    const result = resolveExperiment({
      experiments: [homepageExperiment],
      slug: 'home',
      assignment: variantAssignment,
    });
    expect(result.slug).toBe('home-b');
    expect(result.variant?.public_id).toBe('var_b');
    expect(result.exposure?.variant.public_id).toBe('var_b');
  });

  it('passes through an unmatched slug with no exposure', () => {
    const result = resolveExperiment({
      experiments: [homepageExperiment],
      slug: 'about',
      assignment: variantAssignment,
    });
    expect(result.slug).toBe('about');
    expect(result.variant).toBeUndefined();
    expect(result.exposure).toBeUndefined();
  });

  it('passes through when the assignment is missing', () => {
    const result = resolveExperiment({ experiments: [homepageExperiment], slug: 'home' });
    expect(result.slug).toBe('home');
    expect(result.exposure).toBeUndefined();
  });

  it('passes through when the assignment is for a different experiment', () => {
    const result = resolveExperiment({
      experiments: [homepageExperiment],
      slug: 'home',
      assignment: { ...variantAssignment, experimentId: 999 },
    });
    expect(result.slug).toBe('home');
    expect(result.exposure).toBeUndefined();
  });

  it('resolves folder-nested full slugs when the payload carries them', () => {
    // Guards the SDK's half of the nested-story case: once the backend serializes
    // `original_slug` as a full slug (see PR notes), matching and mapping must work
    // for a folder path just as they do for a root slug.
    const nested: Experiment = {
      ...homepageExperiment,
      variants: [
        {
          ...homepageExperiment.variants[0],
          story_mappings: [
            { original_story_id: 1, original_slug: 'pages/home', variant_story_id: 1, variant_slug: 'pages/home' },
          ],
        },
        {
          ...homepageExperiment.variants[1],
          story_mappings: [
            { original_story_id: 1, original_slug: 'pages/home', variant_story_id: 2, variant_slug: 'pages/home-b' },
          ],
        },
      ],
    };
    const result = resolveExperiment({
      experiments: [nested],
      slug: 'pages/home',
      assignment: { experimentId: 123, variant: nested.variants[1] },
    });
    expect(result.slug).toBe('pages/home-b');
    expect(result.exposure?.variant.public_id).toBe('var_b');
  });

  it('falls back to the original slug when the variant mapping has a null variant_slug', () => {
    const nullSlug: Experiment = {
      ...homepageExperiment,
      variants: [
        homepageExperiment.variants[0],
        {
          ...homepageExperiment.variants[1],
          story_mappings: [
            { original_story_id: 1, original_slug: 'home', variant_story_id: null, variant_slug: null },
          ],
        },
      ],
    };
    const result = resolveExperiment({
      experiments: [nullSlug],
      slug: 'home',
      assignment: { experimentId: 123, variant: nullSlug.variants[1] },
    });
    expect(result.slug).toBe('home');
    expect(result.variant?.public_id).toBe('var_b');
  });
});
