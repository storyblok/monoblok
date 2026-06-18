import type { ExperimentEvent } from './types';
import { describe, expect, it, vi } from 'vitest';
import { trackEvent } from './track-event';

const exposure: ExperimentEvent = {
  type: 'exposure',
  experiment: { id: 123, name: 'homepage_hero' },
  variant: { name: 'b', public_id: 'var_b' },
};

describe('trackEvent', () => {
  it('hands the event to the adapter', () => {
    const adapter = vi.fn();
    trackEvent(exposure, { adapter });
    expect(adapter).toHaveBeenCalledWith(exposure);
  });

  it('returns whatever the adapter returns', async () => {
    const adapter = vi.fn().mockResolvedValue({ ok: true });
    await expect(trackEvent(exposure, { adapter })).resolves.toEqual({ ok: true });
  });

  it('works with a custom inline adapter', () => {
    const sink: ExperimentEvent[] = [];
    trackEvent(
      { type: 'conversion', experiment: { id: 1, name: 'x' }, variant: { name: 'a', public_id: 'p' }, name: 'signup' },
      { adapter: event => sink.push(event) },
    );
    expect(sink).toHaveLength(1);
    expect(sink[0].name).toBe('signup');
  });
});
