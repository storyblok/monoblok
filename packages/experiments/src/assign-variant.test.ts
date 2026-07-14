import type { Experiment } from './types';
import { describe, expect, it } from 'vitest';
import { assignVariant } from './assign-variant';
import { homepageExperiment } from './fixtures';

const withWeights = (controlWeight: number, variantWeight: number): Experiment => ({
  ...homepageExperiment,
  variants: [
    { ...homepageExperiment.variants[0], weight: controlWeight },
    { ...homepageExperiment.variants[1], weight: variantWeight },
  ],
});

describe('assignVariant', () => {
  it('is sticky: same visitorId always lands on the same variant', () => {
    const first = assignVariant({ experiment: homepageExperiment, visitorId: 'visitor-42' });
    for (let i = 0; i < 50; i++) {
      const again = assignVariant({ experiment: homepageExperiment, visitorId: 'visitor-42' });
      expect(again?.variant.public_id).toBe(first?.variant.public_id);
    }
  });

  it('returns the experiment id with the assignment', () => {
    const assignment = assignVariant({ experiment: homepageExperiment, visitorId: 'visitor-1' });
    expect(assignment?.experimentId).toBe(123);
  });

  it('honors weights: 100/0 always assigns control', () => {
    const experiment = withWeights(100, 0);
    for (let i = 0; i < 200; i++) {
      const assignment = assignVariant({ experiment, visitorId: `visitor-${i}` });
      expect(assignment?.variant.public_id).toBe('var_control');
    }
  });

  it('honors weights: 0/100 always assigns the variant', () => {
    const experiment = withWeights(0, 100);
    for (let i = 0; i < 200; i++) {
      const assignment = assignVariant({ experiment, visitorId: `visitor-${i}` });
      expect(assignment?.variant.public_id).toBe('var_b');
    }
  });

  it('splits roughly evenly for a 50/50 experiment', () => {
    let control = 0;
    const total = 2000;
    for (let i = 0; i < total; i++) {
      const assignment = assignVariant({ experiment: homepageExperiment, visitorId: `visitor-${i}` });
      if (assignment?.variant.is_control) {
        control++;
      }
    }
    const ratio = control / total;
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });

  it('falls back to control when no variant has positive weight', () => {
    const experiment = withWeights(0, 0);
    const assignment = assignVariant({ experiment, visitorId: 'visitor-1' });
    expect(assignment?.variant.is_control).toBe(true);
  });

  it('returns undefined for an experiment with no variants', () => {
    const experiment: Experiment = { ...homepageExperiment, variants: [] };
    expect(assignVariant({ experiment, visitorId: 'visitor-1' })).toBeUndefined();
  });
});
