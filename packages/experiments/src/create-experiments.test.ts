import type { ExperimentEvent } from './types';
import { describe, expect, it, vi } from 'vitest';
import { createExperiments } from './create-experiments';
import { homepageExperiment } from './fixtures';

describe('createExperiments', () => {
  it('auto-fires exactly one exposure on resolve', () => {
    const adapter = vi.fn();
    const exp = createExperiments({ experiments: [homepageExperiment], adapters: [adapter] });

    const { slug } = exp.resolveExperiment({ slug: 'home', visitorId: 'visitor-1' });

    expect(['home', 'home-b']).toContain(slug);
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(adapter.mock.calls[0][0]).toMatchObject({ type: 'exposure', experiment: { id: 123 } });
  });

  it('track fires a conversion bound to the resolved assignment', () => {
    const events: ExperimentEvent[] = [];
    const exp = createExperiments({ experiments: [homepageExperiment], adapters: [event => events.push(event)] });

    exp.resolveExperiment({ slug: 'home', visitorId: 'visitor-1' });
    exp.track('signup', { plan: 'pro' });

    const conversion = events.find(event => event.type === 'conversion');
    expect(conversion).toMatchObject({
      type: 'conversion',
      experiment: { id: 123, name: 'homepage_hero' },
      name: 'signup',
      props: { plan: 'pro' },
    });
    expect(conversion?.variant.public_id).toMatch(/^var_/);
  });

  it('does not fire an exposure for an unmatched slug', () => {
    const adapter = vi.fn();
    const exp = createExperiments({ experiments: [homepageExperiment], adapters: [adapter] });

    const { slug } = exp.resolveExperiment({ slug: 'about', visitorId: 'visitor-1' });

    expect(slug).toBe('about');
    expect(adapter).not.toHaveBeenCalled();
  });

  it('does not fire a conversion when nothing was resolved', () => {
    const adapter = vi.fn();
    const exp = createExperiments({ experiments: [homepageExperiment], adapters: [adapter] });

    exp.track('signup');

    expect(adapter).not.toHaveBeenCalled();
  });

  it('swallows a synchronously throwing adapter and routes it to onError', () => {
    const onError = vi.fn();
    const boom = new Error('sink down');
    const exp = createExperiments({
      experiments: [homepageExperiment],
      adapters: [() => { throw boom; }],
      onError,
    });

    expect(() => exp.resolveExperiment({ slug: 'home', visitorId: 'visitor-1' })).not.toThrow();
    expect(onError).toHaveBeenCalledWith(boom, expect.objectContaining({ type: 'exposure' }));
  });

  it('swallows a rejecting async adapter and routes it to onError', async () => {
    const onError = vi.fn();
    const boom = new Error('network');
    const exp = createExperiments({
      experiments: [homepageExperiment],
      adapters: [() => Promise.reject(boom)],
      onError,
    });

    exp.resolveExperiment({ slug: 'home', visitorId: 'visitor-1' });

    // The rejection is handled on a microtask, so let it settle.
    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith(boom, expect.objectContaining({ type: 'exposure' }));
  });

  it('does not throw when an adapter fails and no onError is given', () => {
    const exp = createExperiments({
      experiments: [homepageExperiment],
      adapters: [() => { throw new Error('sink down'); }],
    });

    expect(() => exp.resolveExperiment({ slug: 'home', visitorId: 'visitor-1' })).not.toThrow();
  });
});
