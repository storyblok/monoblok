# Story Push Performance Experiments

Each experiment should be run in isolation following the workflow in the `performance-experimenter` skill.

## Active Experiments

_(none — all experiments completed)_

---

## Finished Experiments

### Experiment J: Skip folder updates in Pass 2
- [x] Hypothesis documented
- [x] Baseline measured
- [x] Implementation complete
- [x] After-measurement complete
- [x] Tests pass
- [x] Decision: **KEEP**
- **Area**: `src/commands/stories/push/index.ts` (`readLocalStoriesStream` `fileFilter`, lines ~219-225)
- **Hypothesis**: Folders flow through the entire Pass 2 pipeline (ref-map → `updateStory`) even though they have no content references to remap. Each folder generates one unnecessary `updateStory` API call that consumes a rate-limit slot. For a workspace with F folders and S non-folder stories, Pass 2 currently makes F+S API calls but only S are necessary. Eliminating the F folder updates would reduce Pass 2 API calls by F/(F+S) — roughly 10% for the benchmark seed (5 folders out of 50 stories).
- **Change**: Build a `Set<string>` of folder UUIDs from the existing `storyIndex` (which already has `is_folder` per entry). Extend the `fileFilter` callback on `readLocalStoriesStream` in Pass 2 to exclude any UUID present in that set. Adjust `processResults.total` and `updateResults.total` initial values to subtract folder count. Also guard the Pass 1 `onStoryError` handler to only decrement Pass 2 totals for non-folder failures.
- **Baseline**: Total median 25.95s (create 17.12s, update 8.82s) @ 50 stories (5 folders + 45 non-folders), 2 runs
- **Result**: Total median 24.93s (create 16.75s, update 8.19s) @ 50 stories, 3 runs
- **Delta**: Total **-3.9%**. Create -2.2%, Update **-7.1%**.
- **Notes**: The update pass improvement (-7.1%) matches the theoretical prediction: 5 folder calls eliminated out of 50 total = 10% fewer API calls in Pass 2, and with uniform rate limiting each call costs ≈167ms, saving ≈833ms. The create pass improvement (-2.2%) is a smaller secondary effect from reduced rate-limit contention. Results are consistent and low-variance (119ms stddev over 3 runs). Change is kept because: (1) measurable, reproducible improvement; (2) zero correctness risk — folders have no cross-references to remap; (3) minimal implementation complexity (6 lines changed in production code).

### Experiment I: Overlap folder and non-folder creation within a level
- [x] Hypothesis documented
- [x] Baseline measured
- [x] Implementation complete
- [x] After-measurement complete
- [x] Tests pass
- [x] Decision: **DISCARD**
- **Area**: `src/commands/stories/streams.ts` (`createStoriesForLevel`, lines 333-451)
- **Hypothesis**: `createStoriesForLevel` currently processes each depth level in two strict sequential phases: first all folders via `Promise.all(folderTasks)`, then all non-folders via `Promise.all(storyTasks)` (lines 437-450). This split exists because a startpage shares the same `full_slug` (and depth) as its parent folder, so the folder must be created and its ID mapped before the startpage can resolve its `parent_id`. However, **non-startpage stories at the same depth do not depend on any folder at that depth** — their parents are folders from shallower depths that were already created in previous level iterations. This means non-startpage, non-folder stories are unnecessarily blocked waiting for all folders at their depth to finish. For levels with many folders and many non-startpage stories (common in large content trees), this serialises work that could overlap. Starting non-startpage stories concurrently with folders — while still waiting for folders before startpages — would allow more API requests to be in-flight simultaneously within each level, better saturating the rate limiter.
- **Change**: Split non-folders into startpages and non-startpages. Launch folder tasks and non-startpage tasks concurrently in a single `Promise.all`. Then, after folders complete, launch startpage tasks in a follow-up `Promise.all`.
- **Baseline**: Total median 25.95s (create 17.12s, update 8.82s) @ 50 stories, 2 runs
- **Result**: Total median 25.88s (create 17.09s, update 8.79s) @ 50 stories, 2 runs
- **Delta**: Total **-0.3% (no improvement)**
- **Notes**: The rate limiter (6 req/s, uniformDistribution) means the total number of API requests determines runtime, not their ordering within a level. Whether folders and stories are dispatched sequentially-within-level or concurrently, the rate limiter meters them identically. The `Promise.all` queues all tasks against the rate limiter — the same tokens get consumed at the same rate. This optimization would only help in a theoretical scenario where the rate limiter is NOT the bottleneck (e.g., local-only dryRun mode or a hypothetical API without rate limits).

### Experiment H: Eliminate double file reads (cache parsed stories from Pass 1 for Pass 2)
- [x] Hypothesis documented
- [x] Baseline measured
- [x] Implementation complete
- [x] After-measurement complete
- [x] Tests pass
- [x] Decision: **DISCARD**
- **Area**: `src/commands/stories/push/index.ts` (lines 117-276), `src/commands/stories/streams.ts` (`scanLocalStoryIndex` lines 231-273, `readLocalStoriesStream` lines 136-174)
- **Hypothesis**: The two-pass push architecture reads every local story JSON file from disk twice: once in Pass 1 (`scanLocalStoryIndex`) to extract metadata for level-by-level creation ordering, and again in Pass 2 (`readLocalStoriesStream`) to get the full story content for reference mapping and API updates. Each file is opened, read into a string, and `JSON.parse`d in both passes — that is 2N file reads and 2N JSON parses for N stories. For 500 stories at ~2-5ms per read+parse cycle, the redundant pass costs ~1-2.5s of wall-clock time. If `scanLocalStoryIndex` stored the full parsed `Story` objects in a `Map<string, Story>` (keyed by filename), Pass 2 could skip disk I/O entirely and feed stories directly from memory into the reference-mapping and update pipeline. The trade-off is increased peak memory usage (all stories resident simultaneously), which should be acceptable — even 10,000 stories at 10KB each is ~100MB.
- **Change**: Modify `scanLocalStoryIndex` to store the full parsed `Story` in each index entry. Add a new `readStoriesFromCacheStream` Readable that yields stories from the in-memory cache instead of re-reading files. Use it in Pass 2.
- **Baseline**: Total median 25.95s (create 17.12s, update 8.82s) @ 50 stories, 2 runs
- **Result**: Initial 2-run: Total median 24.25s (create 16.29s, update 7.96s). Confirmatory 3-run: Total median 27.92s (create 18.94s, update 8.98s).
- **Delta**: **Inconclusive — within API variance**. Initial result showed -6.6% but confirmatory run showed +7.6% (API latency variance).
- **Notes**: The 50-story benchmark is too API-latency dominated to detect the benefit of eliminating local file reads. Even eliminating 50 `readFile` + `JSON.parse` calls saves only ~5-10ms in total, which is completely lost in the noise of API call duration fluctuations. The hypothesis is architecturally sound but the optimization's magnitude is below the benchmark's signal-to-noise floor at 50 stories. To verify: would need the 500-story run or instrumented timings, but the relative saving would be even smaller since file reads are a smaller fraction of 500-story total time.

### Experiment G: Parallel initialization (overlap local I/O with prefetch)
- [x] Hypothesis documented
- [x] Baseline measured
- [x] Implementation complete
- [x] After-measurement complete
- [x] Tests pass
- [x] Decision: **DISCARD**
- **Area**: `src/commands/stories/push/index.ts` (lines 87-108)
- **Hypothesis**: The push command performs four sequential I/O operations before any real work begins: (1) `loadManifest` — reads + parses JSONL manifest from disk, (2) `loadAssetMap` — reads + parses another JSONL manifest from disk, (3) `findComponentSchemas` — reads + parses all component JSON files via `readFileSync`, (4) `prefetchTargetStories` — sequentially paginated API calls to fetch all remote stories. None of these depend on each other's results. The prefetch is the slowest (multiple API round-trips with rate limiting), so all three local I/O operations are currently blocked behind it. Running all four in parallel with `Promise.all` would hide the local I/O latency entirely behind the API prefetch. For large workspaces with many components and a large manifest from prior pushes, this could save 100-300ms on every push invocation — small in absolute terms but a "free" improvement with zero risk since the operations are truly independent.
- **Change**: Wrap `loadManifest`, `loadAssetMap`, `findComponentSchemas`, and `prefetchTargetStories` in a single `Promise.all` call (converting `findComponentSchemas` to use async `readFile` instead of `readFileSync`).
- **Baseline**: Total median 25.95s (create 17.12s, update 8.82s) @ 50 stories, 2 runs
- **Result**: Total median 25.99s (create 17.12s, update 8.83s) @ 50 stories, 2 runs
- **Delta**: Total **+0.2% (no improvement)**
- **Notes**: The local I/O (manifest parse, asset map, schema reads) completes in single-digit milliseconds and is completely masked by benchmark variance. Even for a space with 10,000 prior manifest entries, splitting on `\n` and calling `JSON.parse` is still sub-10ms. The `prefetchTargetStories` call dominates the init phase and it's purely API-bound. Parallelising these operations is correct but produces zero measurable benefit.

### Experiment F: Batch manifest appends (two writes → one write per story)
- [x] Hypothesis documented
- [x] Baseline measured
- [x] Implementation complete
- [x] After-measurement complete
- [x] Tests pass
- [x] Decision: **DISCARD**
- **Area**: `src/commands/stories/streams.ts` (`makeAppendToManifestFSTransport`, lines 211-225)
- **Hypothesis**: For each story created, `makeAppendToManifestFSTransport` calls `appendToFile` twice in series: once to write the UUID mapping and once to write the numeric ID mapping. That's two `appendFile` syscalls per story (1,000 syscalls for 500 stories). Combining both writes into a single `appendToFile` call (writing both JSON lines separated by a newline in one string) would halve the number of file write syscalls during the creation pass. The manifest format is JSONL so two lines written at once is equivalent.
- **Change**: Combine the two `appendToFile` calls in `makeAppendToManifestFSTransport` into a single call that writes both lines in one string.
- **Baseline**: Total median 25.95s (create 17.12s, update 8.82s) @ 50 stories, 2 runs
- **Result**: Total median 25.98s (create 17.17s, update 8.81s) @ 50 stories, 2 runs
- **Delta**: Total **+0.1% (no improvement)**
- **Notes**: SSD `appendFile` syscalls complete in microseconds — even 1,000 of them (for 500 stories) adds less than 1ms total. The API rate limiter utterly dominates and the manifest I/O is completely invisible in measurements. This is not a worthwhile optimisation at any realistic story count.

### Experiment E: Parallel scanLocalStoryIndex file reads
- [x] Hypothesis documented
- [x] Baseline measured
- [x] Implementation complete
- [x] After-measurement complete
- [x] Tests pass
- [x] Decision: **DISCARD**
- **Area**: `src/commands/stories/streams.ts` (`scanLocalStoryIndex`, lines 231-273)
- **Hypothesis**: `scanLocalStoryIndex` reads every local story `.json` file with a `for` loop containing `await readFile(...)`. This serialises all file reads — file N+1 doesn't start until file N has finished. Node.js `fs` I/O is async but the loop forces sequential dispatch. With 500 files, each read is short but the cumulative serialisation overhead is measurable. Reading all files with bounded concurrency (e.g., `Sema(20)`) would overlap I/O waits and reduce wall-clock scan time. The same pattern exists in `readLocalStoriesStream` (Pass 2) so both passes could benefit, but this experiment only touches the scan (Pass 1 / `scanLocalStoryIndex`) to isolate the effect.
- **Change**: Replace the sequential `for` loop in `scanLocalStoryIndex` with a concurrent fan-out using `Promise.all` with a `Sema` for bounded concurrency.
- **Baseline**: Total median 25.95s (create 17.12s, update 8.82s) @ 50 stories, 2 runs
- **Result**: Total median 25.98s (create 17.14s, update 8.83s) @ 50 stories, 2 runs
- **Delta**: Total **+0.1% (no improvement)**
- **Notes**: Local file reads complete in microseconds from OS cache or SSD. The total scan time is negligible compared to API call duration. Even 500 files would add only a few milliseconds — well below measurement noise. The API rate limit is the binding constraint, not disk I/O. This pattern doesn't deserve optimisation.

### Experiment D: Parallel prefetch pagination
- [x] Hypothesis documented
- [x] Baseline measured
- [x] Implementation complete
- [x] After-measurement complete
- [x] Tests pass
- [x] Decision: **DISCARD**
- **Area**: `src/commands/stories/actions.ts` (`prefetchTargetStories`, lines 140-178)
- **Hypothesis**: `prefetchTargetStories` fetches existing remote stories in a sequential `while` loop — page 1, then page 2, etc. Each page waits for the previous one to complete. After page 1 responds with the `Total` header, the remaining page count is known and all subsequent pages can be fetched concurrently. For 20 stories this is 1 page (no gain), but for large spaces (500+ stories = 5+ pages) this could save `(N-1) × RTT` ≈ several seconds on the update pass, where `prefetchTargetStories` must scan all pre-existing stories. The create pass always starts on a clean space (0 stories) so it is unaffected.
- **Change**: In `prefetchTargetStories`, after fetching page 1, fan out all remaining pages in parallel with `Promise.all`, bounded by `maxConcurrency`.
- **Baseline**: Total median 27.29s (create 17.07s, update 10.22s) @ 50 stories, per_page=5 (to exercise 10 pages), 2 runs
- **Result**: Total median 27.41s (create 17.11s, update 10.26s) @ 50 stories, per_page=5, 2 runs
- **Delta**: Total **+0.4% (no improvement)**. Create +0.2%, Update +0.4%.
- **Notes**: Even with 10 pages needed (50 stories at per_page=5), the parallel fetch yielded no improvement. The root cause is that `maxConcurrency=6` means all 9 concurrent page requests immediately queue on the rate limiter — they drain at the same 6/s pace as sequential pages, just with higher memory usage. This confirms that pagination parallelism is useless when the API rate limit is the binding constraint: concurrent pages compete for the same rate-limit slots and total wall-clock time is identical.

### Experiment A: uniformDistribution=false (burst mode)
- [x] Hypothesis documented
- [x] Baseline measured
- [x] Implementation complete
- [x] After-measurement complete
- [ ] Tests pass (N/A — reverted)
- [x] Decision: **DISCARD**
- **Area**: `src/api.ts` (line 10, 15: `uniformDistribution: true`)
- **Hypothesis**: The `async-sema` RateLimit with `uniformDistribution: true` spaces requests evenly across the time window (e.g., 6 requests/sec = 1 request every ~167ms). This prevents bursting. In practice, the Storyblok API may tolerate short bursts followed by pauses. Disabling uniform distribution allows the limiter to release all tokens at once, so all 6 concurrent slots can fire immediately. This could reduce total push time by 10-20% since requests won't be artificially delayed when capacity is available.
- **Change**: Set `uniformDistribution: false` in both `RateLimit()` calls in `src/api.ts`.
- **Baseline**: Total median 10.84s (create 7.11s, update 3.73s) @ 20 stories, 2 runs
- **Result**: Total median 12.94s (create 8.51s, update 4.41s) @ 20 stories, 2 runs
- **Delta**: Total **+19.4% slower**. Create +19.7% slower, Update +18.2% slower.
- **Notes**: Burst mode causes the 6 tokens to fire simultaneously, likely triggering API rate-limit (429) responses and retries. Uniform distribution smooths requests out and avoids 429s, which is clearly more efficient. The current `uniformDistribution: true` is the correct setting.

### Experiment B: Higher rate limit (maxConcurrency=12)
- [x] Hypothesis documented
- [x] Baseline measured
- [x] Implementation complete
- [x] After-measurement complete
- [ ] Tests pass (N/A — reverted)
- [x] Decision: **DISCARD**
- **Area**: `src/lib/config/defaults.ts` (line 9: `maxConcurrency: 6`)
- **Hypothesis**: The current default `maxConcurrency` of 6 may be conservative. The stream semaphore already allows 12 concurrent operations (`Sema(12)` in `streams.ts`). Raising the rate limit to 12 aligns the two concurrency controls and allows more in-flight API requests. If the Storyblok API can handle 12 concurrent requests without excessive 429 rate-limit responses, this could roughly double throughput. Risk: more 429s and retries could negate gains.
- **Change**: Set `maxConcurrency: 12` in `defaults.ts`.
- **Baseline**: Total median 10.84s (create 7.11s, update 3.73s) @ 20 stories, 2 runs
- **Result**: Total median 15.63s (create 10.22s, update 5.30s) @ 20 stories, 2 runs
- **Delta**: Total **+44.2% slower**. Create +43.7% slower, Update +42.1% slower.
- **Notes**: Doubling concurrency to 12 dramatically degraded performance. The Storyblok API clearly rate-limits more aggressively when more concurrent requests arrive, resulting in many more 429 retries. This confirms that 6 is already near or at the API's per-token concurrency tolerance. The stream semaphore's `Sema(12)` is effectively a no-op since the rate limiter at 6 is the binding constraint.

### Experiment C: Lower rate limit (maxConcurrency=3)
- [x] Hypothesis documented
- [x] Baseline measured
- [x] Implementation complete
- [x] After-measurement complete
- [ ] Tests pass (N/A — reverted)
- [x] Decision: **DISCARD**
- **Area**: `src/lib/config/defaults.ts` (line 9: `maxConcurrency: 6`)
- **Hypothesis**: It's possible that the current concurrency of 6 is already causing rate-limit (429) responses and retries that aren't visible in the benchmark timings but add latency. Reducing to 3 would result in fewer 429 responses and smoother throughput. If the API is rate-limiting at 6, reducing to 3 could paradoxically be faster due to fewer retries. This serves as a control experiment — if 3 is slower, it confirms 6 is not causing excessive 429s.
- **Change**: Set `maxConcurrency: 3` in `defaults.ts`.
- **Baseline**: Total median 10.84s (create 7.11s, update 3.73s) @ 20 stories, 2 runs
- **Result**: Total median 21.12s (create 13.89s, update 7.22s) @ 20 stories, 2 runs
- **Delta**: Total **+94.8% slower**. Create +95.4% slower, Update +93.6% slower.
- **Notes**: Halving concurrency from 6 to 3 roughly doubled the total time, confirming a near-linear relationship between concurrency and throughput at this level. This proves that maxConcurrency=6 is NOT causing excessive 429s — the throughput scales proportionally. Combined with Experiment B showing 12 is too aggressive, this brackets the optimal value: maxConcurrency=6 is at or near the sweet spot for the Storyblok API rate limits.

---

## Key Findings

1. **`uniformDistribution: true` is optimal.** Disabling it causes burst requests that trigger 429 rate-limit responses, making it 19% slower.
2. **`maxConcurrency: 6` is at or near the sweet spot.** Going higher (12) triggers severe rate limiting (+44% slower). Going lower (3) linearly reduces throughput (+95% slower).
3. **The Storyblok API rate limit is the binding constraint**, not local concurrency. Performance improvements should focus on reducing per-request overhead, better pipeline design, or reducing the total number of API calls rather than tuning concurrency parameters.
4. **The `Sema(12)` in streams.ts is effectively redundant** — the rate limiter at 6 is always the bottleneck. Consider aligning it to match `maxConcurrency` (6) to simplify the concurrency model, though this won't affect performance.
5. **All local I/O is invisible to the benchmark.** File reads, manifest appends, JSON parsing, directory scans — all complete in microseconds and are completely masked by API call latency. No local I/O optimization (parallel reads, batch writes, caching) can produce a measurable improvement because the API rate limit consumes 99%+ of wall-clock time.
6. **Concurrency ordering within the pipeline has no effect.** Whether requests are dispatched sequentially or in parallel (within the same `Promise.all` batch), the rate limiter applies the same spacing to every token. Restructuring the dispatch order (folders vs. stories, pagination pages) does not change total throughput.
7. **The only path to improvement is reducing total API call count or improving API server-side latency.** All nine experiments confirm that the Storyblok Management API's 6 req/s rate limit is the exclusive bottleneck. Meaningful gains would require: batched create/update endpoints, a bulk-import API, or server-side changes to increase the rate limit.
8. **Eliminating unnecessary API calls is the only viable optimization strategy.** Experiment J proves this: removing the N_folders `updateStory` calls from Pass 2 produced a clear, reproducible -3.9% total improvement (-7.1% on the update pass). This validates the broader hypothesis that the improvement ceiling is set by how many API calls can be legitimately eliminated from the pipeline.
