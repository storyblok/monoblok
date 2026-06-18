# @storyblok/experiments

Runtime A/B testing utilities for the Storyblok experiments API (`GET /v2/cdn/experiments`). Bucket visitors, decide which story to render, and track exposure and conversion events. Composable, framework-agnostic, and server-first.

Storyblok variants are whole separate stories (`original_slug` maps to `variant_slug`), not field-level content, so this package decides which slug to render. Fetching the story and the experiments payload stays on your own client, which keeps the core dependency-free.

## Installation

```sh
npm install @storyblok/experiments
pnpm add @storyblok/experiments
yarn add @storyblok/experiments
```

## Units

Each unit is usable on its own.

### `resolveExperiment`

Maps the experiments payload, a slug, and an assignment to the slug that should be rendered, plus an exposure descriptor. Control resolves to the original slug, an assigned variant resolves to its mapped slug. Pure, no I/O.

```ts
import { resolveExperiment } from '@storyblok/experiments';

const { slug, variant, exposure } = resolveExperiment({ experiments, slug: 'home', assignment });
const story = await client.stories.get(`cdn/stories/${slug}`); // your own client
```

When no experiment matches the slug, or the assignment is missing, the slug passes through unchanged and `exposure` is `undefined`.

### `assignVariant`

Deterministic weighted bucketing. The same `visitorId` always lands on the same variant for a given experiment, with no storage. You decide what `visitorId` is (a cookie, a header, anything), and persisting it is your job.

```ts
import { assignVariant } from '@storyblok/experiments';

const assignment = assignVariant({ experiment, visitorId }); // sticky for the same visitorId
```

`assignVariant` hashes `visitorId` plus the experiment id into a `0..99` bucket and walks the variants' cumulative weights, so the same visitor resolves to the same variant on every request.

### `trackEvent`

Sends an event to a pluggable adapter. The event is the subject, the adapter is the destination.

```ts
import { trackEvent } from '@storyblok/experiments';
import { fetchAdapter } from '@storyblok/experiments/adapters';

trackEvent(exposure, { adapter: fetchAdapter('https://my-sink.example/events') });

// Bring your own sink:
trackEvent(
  { type: 'conversion', experiment, variant, name: 'signup' },
  { adapter: event => myAnalytics.track(event) },
);
```

Adapters live in their own entrypoint, `@storyblok/experiments/adapters`, which is the source of truth for adapter imports. They are intentionally not re-exported from the package root: most users bring their own sink, and a separate entrypoint keeps adapters out of the bundle when they go unused.

## Full example

```ts
import { assignVariant, resolveExperiment, trackEvent } from '@storyblok/experiments';
import { fetchAdapter } from '@storyblok/experiments/adapters';

const adapter = fetchAdapter('https://my-sink.example/events');

// 1. Fetch the experiment config (cacheable, same for every visitor).
const { experiments } = await client.experiments.list();

// 2. Identify the visitor (you own this: cookie, header, etc.).
const visitorId = getCookie('visitor_id') ?? setCookie('visitor_id', crypto.randomUUID());

// 3. Assign: deterministic bucketing, same visitorId maps to the same variant.
const experiment = experiments.find(candidate => candidate.name === 'homepage_hero');
const assignment = assignVariant({ experiment, visitorId });

// 4. Resolve: which slug does this visitor get? (pure, no I/O)
const { slug, exposure } = resolveExperiment({ experiments, slug: 'home', assignment });

// 5. Fetch and render the resolved story with your existing client.
const story = await client.stories.get(`cdn/stories/${slug}`);
render(story);

// 6. Exposure: fire when the visitor actually saw the variant.
//    `exposure` is undefined when no experiment applied, so guard it.
if (exposure) {
  trackEvent(exposure, { adapter });
}

// 7. Conversion: later, wherever the goal happens.
trackEvent(
  { type: 'conversion', experiment, variant: assignment.variant, name: 'signup' },
  { adapter },
);
```

## Factory

`createExperiments` pre-binds the config and adapters, auto-fires exposure on resolve, and remembers assignments so conversions attribute without re-passing context. Designed for server-side, per-request use.

```ts
import { createExperiments } from '@storyblok/experiments';
import { fetchAdapter } from '@storyblok/experiments/adapters';

const exp = createExperiments({ experiments, adapters: [fetchAdapter(url)] });

const { slug } = exp.resolveExperiment({ slug: 'home', visitorId }); // exposure auto-fired
const story = await client.stories.get(`cdn/stories/${slug}`);

// later, on the page:
exp.track('signup', { plan: 'pro' }); // conversion
```

## License

MIT
