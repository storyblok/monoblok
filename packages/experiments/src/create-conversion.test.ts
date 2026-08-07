import { describe, expect, it } from 'vitest';
import { createConversion } from './create-conversion';
import { defineGoal } from './define-goal';
import { assignmentFor, homepageExperiment } from './fixtures';

const assignment = assignmentFor(homepageExperiment, 1, 'visitor-7');

describe('createConversion', () => {
  it('builds a conversion from the assignment alone', () => {
    expect(createConversion({ assignment, goal: 'signup' })).toEqual({
      type: 'conversion',
      experiment: { id: 123, name: 'homepage_hero' },
      variant: { name: 'b', public_id: 'var_b' },
      visitorId: 'visitor-7',
      name: 'signup',
    });
  });

  it('omits value and props when neither the goal nor the caller sets them', () => {
    const event = createConversion({ assignment, goal: 'signup' });

    expect('value' in event).toBe(false);
    expect('props' in event).toBe(false);
  });

  it('carries the goal declaration defaults', () => {
    const purchase = defineGoal({ name: 'purchase', value: 1000, props: { source: 'hero' } });

    expect(createConversion({ assignment, goal: purchase })).toMatchObject({
      name: 'purchase',
      value: 1000,
      props: { source: 'hero' },
    });
  });

  it('lets the caller override the goal defaults', () => {
    const purchase = defineGoal({ name: 'purchase', value: 1000, props: { source: 'hero' } });

    expect(createConversion({ assignment, goal: purchase, value: 4900, props: { source: 'footer' } })).toMatchObject({
      value: 4900,
      props: { source: 'footer' },
    });
  });

  it('does not alias the assignment experiment onto the event', () => {
    // The event is a payload handed to arbitrary adapters, so mutating it must
    // not reach back into the assignment it was built from.
    const event = createConversion({ assignment, goal: 'signup' });
    event.experiment.name = 'mutated';

    expect(assignment.experiment.name).toBe('homepage_hero');
  });
});
