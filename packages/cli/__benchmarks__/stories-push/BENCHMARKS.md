# Stories Push Benchmark

This document contains everything you need to benchmark the `stories push` command. Read it in full before hypothesizing or running experiments.

## Source files to study

Understand the push pipeline architecture before experimenting:

- `src/commands/stories/push/index.ts` — push command orchestration
- `src/commands/stories/streams.ts` — stream pipeline and concurrency controls
- `src/commands/stories/actions.ts` — API actions
- `src/commands/stories/ref-mapper.ts` — reference mapper
- `src/api.ts` — API client and rate limiting
- `src/lib/config/defaults.ts` — default configuration

## Prerequisites

1. CLI built: `pnpm nx build storyblok`
2. `.env.qa-engineer-manual` in the repo root with `STORYBLOK_TOKEN` and `STORYBLOK_SPACE_ID`

## How to run

```bash
# Iterate: 50 stories, 2 runs (~60s) — use this during experimentation
pnpm benchmark:stories-push --quick --label my-experiment

# Confirm: 500 stories, 2 runs (~8 min) — use this to validate before finalizing
pnpm benchmark:stories-push --label my-experiment-full

# Compare against a previous baseline
pnpm benchmark:stories-push --quick --label experiment --compare results/baseline.json

# More runs for statistical confidence
pnpm benchmark:stories-push --quick --runs 5
```

## What the benchmark measures

Each run performs two pushes in sequence:

1. **Create push**: Pushes stories to a clean space (all stories are created fresh).
2. **Update push**: Pushes the same stories again (all stories already exist, so they are matched and updated).

Two seed sizes are available:
- **50 stories** (`--quick`) — 5 folders + 45 stories across 3 depth levels. Default for iteration and experimentation.
- **500 stories** (no flag) — 25 folders + 475 stories with mixed content complexity. Use to confirm results at scale.

Results are saved as JSON to `results/` and a summary table is printed to the console.

## Benchmark scripts

- `scripts/run-benchmark.sh` — main runner; seeds data, runs the CLI binary, collects timings, writes results
- `scripts/seed-50.sh` — generates 50-story fixture tree (used with `--quick`)
- `scripts/seed-500.sh` — generates 500-story fixture tree (used for full runs)
- `scripts/compute-stats.mjs` — computes median/mean/stddev/throughput and prints the results table; also handles baseline comparison

## Special considerations

### Pagination experiments

Experiments that affect pagination logic (e.g. `prefetchTargetStories`) will show no benefit at 50 stories because the entire set fits in a single page of 100. To exercise the pagination path during a quick run, temporarily lower `per_page` in the relevant `fetchStories` call to `5` so that 50 stories require 10 pages. Remember to revert this before finalizing.

### API rate limit

The Storyblok Management API enforces a rate limit of **6 requests per second** per token. The CLI respects this via `RateLimit(maxConcurrency, { uniformDistribution: true })` in `src/api.ts`, where `maxConcurrency` defaults to 6. Experiments that increase concurrency beyond 6 will trigger 429 responses and retries, making things slower, not faster. Any optimization that reduces the total number of API calls (e.g. parallelising work that currently round-trips the API, or batching requests) has higher upside than tuning the concurrency level itself.
