import type { Experiment, ExperimentEvent } from './types';
import { describe, expect, it, vi } from 'vitest';
import { assignVariant } from './assign-variant';
import { createExperiments } from './create-experiments';
import { defineGoal } from './define-goal';
import { homepageExperiment, pricingExperiment } from './fixtures';

/**
 * Scenario coverage for the topologies the package has to support. Each block
 * mirrors a real deployment shape rather than a single unit, because the bugs
 * these guard against only appear across request boundaries: an SSR render and
 * the click that converts never share a factory instance.
 */

/** A minimal in-memory sink standing in for a customer's analytics store. */
function createSink() {
  const events: ExperimentEvent[] = [];
  return {
    events,
    adapter: (event: ExperimentEvent) => {
      events.push(event);
    },
    ofType: (type: ExperimentEvent['type']) => events.filter(event => event.type === type),
  };
}

/**
 * Finds two visitor ids that bucket into *different* variants, so an
 * attribution test can prove a mix-up rather than accidentally passing because
 * both visitors happen to share a variant.
 */
function visitorsWithDifferentVariants(experiment: Experiment): [string, string] {
  const first = 'visitor-1';
  const firstVariant = assignVariant({ experiment, visitorId: first })?.variant.public_id;
  for (let index = 2; index < 200; index++) {
    const candidate = `visitor-${index}`;
    if (assignVariant({ experiment, visitorId: candidate })?.variant.public_id !== firstVariant) {
      return [first, candidate];
    }
  }
  throw new Error('fixture is not split, cannot find two visitors on different variants');
}

const variantOf = (experiment: Experiment, visitorId: string) =>
  assignVariant({ experiment, visitorId })?.variant.public_id;

describe('scenario: SSR render, click converts in a later request', () => {
  it('records the conversion from a fresh instance with no prior resolve', async () => {
    const sink = createSink();
    const config = { experiments: [homepageExperiment], adapters: [sink.adapter] };

    // Request 1: the page render. This instance is discarded with the response.
    const render = createExperiments(config);
    const { slug } = render.resolveExperiment({ slug: 'home', visitorId: 'visitor-7' });
    expect(['home', 'home-b']).toContain(slug);

    // Request 2: the conversion. A brand new instance, no shared state.
    const conversion = createExperiments(config);
    await conversion.track('signup', 'visitor-7');

    expect(sink.ofType('exposure')).toHaveLength(1);
    expect(sink.ofType('conversion')).toHaveLength(1);
    expect(sink.ofType('conversion')[0]).toMatchObject({
      name: 'signup',
      visitorId: 'visitor-7',
      experiment: { id: 123 },
    });
  });

  it('attributes the conversion to the same variant the render used', async () => {
    const sink = createSink();
    const config = { experiments: [homepageExperiment], adapters: [sink.adapter] };

    createExperiments(config).resolveExperiment({ slug: 'home', visitorId: 'visitor-7' });
    await createExperiments(config).track('signup', 'visitor-7');

    const [exposure] = sink.ofType('exposure');
    const [conversion] = sink.ofType('conversion');
    expect(conversion.variant).toEqual(exposure.variant);
  });

  it('never emits an exposure as a side effect of tracking', async () => {
    const sink = createSink();
    const experiments = createExperiments({ experiments: [homepageExperiment], adapters: [sink.adapter] });

    await experiments.track('signup', 'visitor-7');

    expect(sink.ofType('exposure')).toHaveLength(0);
    expect(sink.ofType('conversion')).toHaveLength(1);
  });

  it('carries visitorId on both events so a sink can join them', async () => {
    const sink = createSink();
    const config = { experiments: [homepageExperiment], adapters: [sink.adapter] };

    createExperiments(config).resolveExperiment({ slug: 'home', visitorId: 'visitor-7' });
    await createExperiments(config).track('signup', 'visitor-7');

    // The join a customer's warehouse has to be able to do.
    const joined = sink.ofType('conversion').filter(conversion =>
      sink.ofType('exposure').some(exposure =>
        exposure.visitorId === conversion.visitorId
        && exposure.experiment.id === conversion.experiment.id),
    );
    expect(joined).toHaveLength(1);
  });
});

describe('scenario: shared module-scope instance', () => {
  it('attributes concurrent visitors to their own variants', async () => {
    const sink = createSink();
    const [visitorA, visitorB] = visitorsWithDifferentVariants(homepageExperiment);
    // One instance, created once, serving every request.
    const experiments = createExperiments({ experiments: [homepageExperiment], adapters: [sink.adapter] });

    experiments.resolveExperiment({ slug: 'home', visitorId: visitorA });
    experiments.resolveExperiment({ slug: 'home', visitorId: visitorB });
    await experiments.track('signup', visitorA);
    await experiments.track('signup', visitorB);

    const byVisitor = (visitorId: string) =>
      sink.ofType('conversion').find(event => event.visitorId === visitorId);
    expect(byVisitor(visitorA)?.variant.public_id).toBe(variantOf(homepageExperiment, visitorA));
    expect(byVisitor(visitorB)?.variant.public_id).toBe(variantOf(homepageExperiment, visitorB));
    // The whole point: the two visitors are on different variants, so a shared
    // assignments map would have attributed both conversions to the last resolve.
    expect(byVisitor(visitorA)?.variant.public_id).not.toBe(byVisitor(visitorB)?.variant.public_id);
  });

  it('resolves interleaved visitors independently', () => {
    const sink = createSink();
    const [visitorA, visitorB] = visitorsWithDifferentVariants(homepageExperiment);
    const experiments = createExperiments({ experiments: [homepageExperiment], adapters: [sink.adapter] });

    const a1 = experiments.resolveExperiment({ slug: 'home', visitorId: visitorA });
    const b1 = experiments.resolveExperiment({ slug: 'home', visitorId: visitorB });
    const a2 = experiments.resolveExperiment({ slug: 'home', visitorId: visitorA });

    expect(a1.slug).toBe(a2.slug);
    expect(a1.slug).not.toBe(b1.slug);
  });
});

describe('scenario: deferring the exposure to the client', () => {
  it('returns the exposure descriptor without firing it', () => {
    const sink = createSink();
    const experiments = createExperiments({ experiments: [homepageExperiment], adapters: [sink.adapter] });

    const resolved = experiments.resolveExperiment({ slug: 'home', visitorId: 'visitor-7', exposure: false });

    expect(sink.events).toHaveLength(0);
    expect(resolved.exposure).toMatchObject({ type: 'exposure', visitorId: 'visitor-7' });
    // Suppressing the exposure must not change what gets rendered.
    const control = resolved.exposure!.variant.public_id === 'var_control';
    expect(resolved.slug).toBe(control ? 'home' : 'home-b');
  });

  it('fires the deferred exposure through send when the client reports back', async () => {
    const sink = createSink();
    const config = { experiments: [homepageExperiment], adapters: [sink.adapter] };

    // Render: hand the descriptor to the browser instead of firing it.
    const { exposure } = createExperiments(config)
      .resolveExperiment({ slug: 'home', visitorId: 'visitor-7', exposure: false });
    // Later request: the browser beacons it back once the component mounted.
    await createExperiments(config).send(exposure!);

    expect(sink.ofType('exposure')).toHaveLength(1);
    expect(sink.ofType('exposure')[0].visitorId).toBe('visitor-7');
  });

  it('still returns the fired exposure when autofire is on', () => {
    const sink = createSink();
    const experiments = createExperiments({ experiments: [homepageExperiment], adapters: [sink.adapter] });

    const resolved = experiments.resolveExperiment({ slug: 'home', visitorId: 'visitor-7' });

    expect(sink.ofType('exposure')).toHaveLength(1);
    expect(resolved.exposure).toEqual(sink.ofType('exposure')[0]);
  });

  it('reports no exposure for an unmatched slug', () => {
    const experiments = createExperiments({ experiments: [homepageExperiment] });

    const resolved = experiments.resolveExperiment({ slug: 'about', visitorId: 'visitor-7' });

    expect(resolved.slug).toBe('about');
    expect(resolved.exposure).toBeUndefined();
    expect(resolved.variant).toBeUndefined();
  });
});

describe('scenario: client builds the payload, server forwards it', () => {
  it('createEvent returns a ready-to-send conversion without delivering it', () => {
    const sink = createSink();
    const experiments = createExperiments({ experiments: [homepageExperiment], adapters: [sink.adapter] });

    const events = experiments.createEvent('signup', 'visitor-7', { props: { plan: 'pro' }, value: 4900 });

    expect(sink.events).toHaveLength(0);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'conversion',
      name: 'signup',
      visitorId: 'visitor-7',
      value: 4900,
      props: { plan: 'pro' },
      experiment: { id: 123, name: 'homepage_hero' },
    });
    expect(events[0].variant.public_id).toBe(variantOf(homepageExperiment, 'visitor-7'));
  });

  it('round-trips a createEvent payload through send', async () => {
    const sink = createSink();
    const config = { experiments: [homepageExperiment], adapters: [sink.adapter] };

    // Render: embed the payload for a beacon.
    const [payload] = createExperiments(config).createEvent('signup', 'visitor-7');
    const serialized = JSON.stringify(payload);
    // Endpoint: forward exactly what the browser sent.
    await createExperiments(config).send(JSON.parse(serialized) as ExperimentEvent);

    expect(sink.ofType('conversion')).toHaveLength(1);
    expect(sink.ofType('conversion')[0]).toEqual(payload);
  });

  it('accepts a defineGoal declaration and applies call-site overrides', () => {
    const signup = defineGoal({ name: 'signup', props: { source: 'hero' } });
    const experiments = createExperiments({ experiments: [homepageExperiment] });

    const [defaults] = experiments.createEvent(signup, 'visitor-7');
    const [overridden] = experiments.createEvent(signup, 'visitor-7', { props: { source: 'footer' }, value: 100 });

    expect(defaults).toMatchObject({ name: 'signup', props: { source: 'hero' } });
    expect(defaults.value).toBeUndefined();
    expect(overridden).toMatchObject({ name: 'signup', props: { source: 'footer' }, value: 100 });
  });

  it('reuses one declaration across track and createEvent', async () => {
    const sink = createSink();
    const purchase = defineGoal({ name: 'purchase', value: 1000 });
    const experiments = createExperiments({ experiments: [homepageExperiment], adapters: [sink.adapter] });

    await experiments.track(purchase, 'visitor-7');
    const [built] = experiments.createEvent(purchase, 'visitor-7');

    expect(sink.ofType('conversion')[0]).toEqual(built);
  });

  it('returns no events for a visitor with no running experiments', () => {
    const experiments = createExperiments({ experiments: [] });

    expect(experiments.createEvent('signup', 'visitor-7')).toEqual([]);
  });
});

describe('scenario: multiple running experiments', () => {
  it('records one conversion per experiment the visitor is bucketed into', async () => {
    const sink = createSink();
    const experiments = createExperiments({
      experiments: [homepageExperiment, pricingExperiment],
      adapters: [sink.adapter],
    });

    await experiments.track('signup', 'visitor-7');

    // Deliberate: a conversion is recorded against every assignment, not only
    // the experiment whose slug was rendered. The sink joins on visitorId to
    // decide which of these had a matching exposure.
    expect(sink.ofType('conversion').map(event => event.experiment.id).sort()).toEqual([123, 456]);
    for (const event of sink.ofType('conversion')) {
      expect(event.visitorId).toBe('visitor-7');
    }
  });

  it('exposes only the experiment matching the rendered slug', () => {
    const sink = createSink();
    const experiments = createExperiments({
      experiments: [homepageExperiment, pricingExperiment],
      adapters: [sink.adapter],
    });

    experiments.resolveExperiment({ slug: 'pricing', visitorId: 'visitor-7' });

    expect(sink.ofType('exposure')).toHaveLength(1);
    expect(sink.ofType('exposure')[0].experiment.id).toBe(456);
  });
});

describe('scenario: repeated resolves are not deduplicated', () => {
  it('fires one exposure per resolve, leaving dedupe to the sink', () => {
    const sink = createSink();
    const experiments = createExperiments({ experiments: [homepageExperiment], adapters: [sink.adapter] });

    // A layout and a page both resolving, or a reload: the package does not
    // remember what it already sent, so both are delivered. visitorId on the
    // event is what makes sink-side dedupe possible.
    experiments.resolveExperiment({ slug: 'home', visitorId: 'visitor-7' });
    experiments.resolveExperiment({ slug: 'home', visitorId: 'visitor-7' });

    const exposures = sink.ofType('exposure');
    expect(exposures).toHaveLength(2);
    const deduped = new Set(exposures.map(event => `${event.visitorId}:${event.experiment.id}`));
    expect(deduped.size).toBe(1);
  });
});

describe('scenario: serverless delivery lifetime', () => {
  it('track resolves only after an async adapter settles', async () => {
    let delivered = false;
    let release: () => void;
    const delivery = new Promise<void>((resolve) => {
      release = resolve;
    });
    const experiments = createExperiments({
      experiments: [homepageExperiment],
      adapters: [() => delivery.then(() => { delivered = true; })],
    });

    const tracked = experiments.track('signup', 'visitor-7');
    expect(delivered).toBe(false);

    release!();
    await tracked;
    expect(delivered).toBe(true);
  });

  it('exposes the exposure delivery as a promise the host can hand to waitUntil', async () => {
    let delivered = false;
    let release: () => void;
    const delivery = new Promise<void>((resolve) => {
      release = resolve;
    });
    const experiments = createExperiments({
      experiments: [homepageExperiment],
      adapters: [() => delivery.then(() => { delivered = true; })],
    });

    const { delivered: pending } = experiments.resolveExperiment({ slug: 'home', visitorId: 'visitor-7' });
    expect(delivered).toBe(false);

    release!();
    await pending;
    expect(delivered).toBe(true);
  });

  it('resolves delivered immediately when no exposure was fired', async () => {
    const experiments = createExperiments({ experiments: [homepageExperiment], adapters: [() => Promise.resolve()] });

    const { delivered } = experiments.resolveExperiment({ slug: 'about', visitorId: 'visitor-7' });

    await expect(delivered).resolves.toBeUndefined();
  });

  it('still hands deliveries to a construction-time waitUntil', async () => {
    const waitUntil = vi.fn();
    const experiments = createExperiments({
      experiments: [homepageExperiment],
      adapters: [() => Promise.resolve()],
      waitUntil,
    });

    await experiments.track('signup', 'visitor-7');

    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('never rejects when an adapter fails, routing to onError instead', async () => {
    const onError = vi.fn();
    const boom = new Error('sink down');
    const experiments = createExperiments({
      experiments: [homepageExperiment],
      adapters: [() => Promise.reject(boom)],
      onError,
    });

    await expect(experiments.track('signup', 'visitor-7')).resolves.toBeUndefined();
    const { delivered } = experiments.resolveExperiment({ slug: 'home', visitorId: 'visitor-7' });
    await expect(delivered).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledWith(boom, expect.objectContaining({ type: 'conversion' }));
    expect(onError).toHaveBeenCalledWith(boom, expect.objectContaining({ type: 'exposure' }));
  });

  it('never rejects from send when an adapter throws synchronously', async () => {
    const onError = vi.fn();
    const experiments = createExperiments({
      experiments: [homepageExperiment],
      adapters: [() => { throw new Error('sink down'); }],
      onError,
    });

    const [event] = experiments.createEvent('signup', 'visitor-7');
    await expect(experiments.send(event)).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe('scenario: 1.x callers keep working', () => {
  it('supports the deprecated props-only track after a same-instance resolve', async () => {
    const sink = createSink();
    const experiments = createExperiments({ experiments: [homepageExperiment], adapters: [sink.adapter] });

    experiments.resolveExperiment({ slug: 'home', visitorId: 'visitor-7' });
    await experiments.track('signup', { plan: 'pro' });

    expect(sink.ofType('conversion')[0]).toMatchObject({
      name: 'signup',
      props: { plan: 'pro' },
      visitorId: 'visitor-7',
    });
  });

  it('supports the deprecated no-argument track', async () => {
    const sink = createSink();
    const experiments = createExperiments({ experiments: [homepageExperiment], adapters: [sink.adapter] });

    experiments.resolveExperiment({ slug: 'home', visitorId: 'visitor-7' });
    await experiments.track('signup');

    expect(sink.ofType('conversion')).toHaveLength(1);
    expect(sink.ofType('conversion')[0].props).toBeUndefined();
  });

  it('records nothing on the deprecated path when no resolve happened', async () => {
    const sink = createSink();
    const experiments = createExperiments({ experiments: [homepageExperiment], adapters: [sink.adapter] });

    await experiments.track('signup', { plan: 'pro' });

    expect(sink.events).toHaveLength(0);
  });

  it('treats a props bag containing visitorId as props, not as the new shape', async () => {
    const sink = createSink();
    const experiments = createExperiments({ experiments: [homepageExperiment], adapters: [sink.adapter] });

    experiments.resolveExperiment({ slug: 'home', visitorId: 'real-visitor' });
    // The exact call the 1.x workaround produced. Discriminating on the presence
    // of a `visitorId` key would silently reinterpret this; discriminating on
    // `typeof` cannot.
    await experiments.track('signup', { visitorId: 'prop-value' });

    const [conversion] = sink.ofType('conversion');
    expect(conversion.props).toEqual({ visitorId: 'prop-value' });
    expect(conversion.visitorId).toBe('real-visitor');
  });

  it('does not leak assignments from the deprecated path across visitors', async () => {
    const sink = createSink();
    const [visitorA, visitorB] = visitorsWithDifferentVariants(homepageExperiment);
    const experiments = createExperiments({ experiments: [homepageExperiment], adapters: [sink.adapter] });

    experiments.resolveExperiment({ slug: 'home', visitorId: visitorA });
    // Explicit visitorId must win over whatever the instance remembered.
    await experiments.track('signup', visitorB);

    const [conversion] = sink.ofType('conversion');
    expect(conversion.visitorId).toBe(visitorB);
    expect(conversion.variant.public_id).toBe(variantOf(homepageExperiment, visitorB));
  });
});
