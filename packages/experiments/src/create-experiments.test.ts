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

  it('hands each pending async delivery to waitUntil', async () => {
    const waitUntil = vi.fn();
    let delivered = false;
    let resolveDelivery: () => void;
    const delivery = new Promise<void>((resolve) => {
      resolveDelivery = resolve;
    });
    const exp = createExperiments({
      experiments: [homepageExperiment],
      adapters: [() => delivery.then(() => { delivered = true; })],
      waitUntil,
    });

    exp.resolveExperiment({ slug: 'home', visitorId: 'visitor-1' });

    expect(waitUntil).toHaveBeenCalledTimes(1);
    resolveDelivery!();
    await waitUntil.mock.calls[0][0];
    expect(delivered).toBe(true);
  });

  it('does not call waitUntil for a synchronous adapter', () => {
    const waitUntil = vi.fn();
    const exp = createExperiments({
      experiments: [homepageExperiment],
      adapters: [() => {}],
      waitUntil,
    });

    exp.resolveExperiment({ slug: 'home', visitorId: 'visitor-1' });

    expect(waitUntil).not.toHaveBeenCalled();
  });

  it('gives waitUntil a promise that resolves even when the adapter rejects', async () => {
    const waitUntil = vi.fn();
    const onError = vi.fn();
    const boom = new Error('network');
    const exp = createExperiments({
      experiments: [homepageExperiment],
      adapters: [() => Promise.reject(boom)],
      onError,
      waitUntil,
    });

    exp.resolveExperiment({ slug: 'home', visitorId: 'visitor-1' });

    await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(boom, expect.objectContaining({ type: 'exposure' }));
  });

  it('flush resolves after pending async deliveries settle', async () => {
    let delivered = false;
    let resolveDelivery: () => void;
    const delivery = new Promise<void>((resolve) => {
      resolveDelivery = resolve;
    });
    const exp = createExperiments({
      experiments: [homepageExperiment],
      adapters: [() => delivery.then(() => { delivered = true; })],
    });

    exp.resolveExperiment({ slug: 'home', visitorId: 'visitor-1' });
    const flushed = exp.flush();

    resolveDelivery!();
    await flushed;
    expect(delivered).toBe(true);
  });

  it('flush does not reject when a pending delivery fails', async () => {
    const onError = vi.fn();
    const boom = new Error('network');
    const exp = createExperiments({
      experiments: [homepageExperiment],
      adapters: [() => Promise.reject(boom)],
      onError,
    });

    exp.resolveExperiment({ slug: 'home', visitorId: 'visitor-1' });

    await expect(exp.flush()).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(boom, expect.objectContaining({ type: 'exposure' }));
  });

  it('flush resolves immediately when nothing is pending', async () => {
    const exp = createExperiments({ experiments: [homepageExperiment] });

    await expect(exp.flush()).resolves.toBeUndefined();
  });
});
