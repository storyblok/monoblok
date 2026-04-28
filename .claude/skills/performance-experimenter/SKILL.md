---
name: performance-experimenter
description: Run performance experiments using benchmark harnesses, discover bottlenecks, and validate optimizations for any monoblok package
---

# Performance Experimenter

## Responsibilities

- Discover and validate performance improvements for any package in the monorepo.
- Maintain rigorous scientific methodology: one variable at a time, always measure before and after.
- Track experiment results in a structured checklist so progress and findings are visible.
- Ensure all optimizations pass existing tests and type checks before being considered valid.

## When to use

Use this skill when the goal is to improve the performance of a command or pipeline in any monoblok package. This includes:
- Running the benchmark harness to establish baselines
- Identifying bottleneck candidates through code analysis and profiling
- Implementing and measuring isolated experiments
- Comparing results and deciding what to keep

## Preparation

Before starting, find the relevant benchmark directory inside the target package:

1. Look for a `__benchmarks__/` directory inside the package (e.g. `packages/cli/__benchmarks__/`).
2. Identify the subdirectory for the command or pipeline you are working on (e.g. `stories-push/`).
3. Read the `BENCHMARKS.md` in that subdirectory. It contains:
   - Which source files to study before experimenting
   - Prerequisites (build steps, environment variables)
   - How to run the benchmark scripts and what flags are available
   - What the benchmark measures (phases, seed sizes, etc.)
   - Any command-specific considerations or gotchas
4. Read the source files listed in `BENCHMARKS.md` to understand the pipeline architecture before hypothesizing.

If no `__benchmarks__/` directory exists yet for the target package or command, you will need to create the benchmark infrastructure first. Use the existing `packages/cli/__benchmarks__/stories-push/` as a reference for the expected structure.

## Benchmark harness

Each benchmark runs the **actual built binary or entry point** of the package against a **real external service** (e.g. a Storyblok space). This captures true end-to-end performance including real API latency, rate limiting, and server-side behavior.

All benchmark infrastructure for a given command lives in `packages/<pkg>/__benchmarks__/<command>/`. The `BENCHMARKS.md` inside that directory is the authoritative reference for how to run that specific benchmark.

## Experiment workflow

Follow this process for **every** performance experiment. Do not skip steps or combine experiments.

### Step 1: Create experiment tracking

Before starting any experiments, check if `__benchmarks__/<benchmark>/EXPERIMENTS.md` exists. If not, create it with this template:

```markdown
# <Command> Performance Experiments

## Experiment Log

### [Experiment Name]
- [ ] Hypothesis documented
- [ ] Baseline measured
- [ ] Implementation complete (branch: `perf/experiment-name`)
- [ ] After-measurement complete
- [ ] Existing tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm test:types`)
- [ ] Decision: KEEP / DISCARD / ITERATE
- **Hypothesis**: [What you expect to improve and by how much]
- **Baseline**: [Key metrics before]
- **Result**: [Key metrics after]
- **Delta**: [% change]
- **Notes**: [Why it worked or didn't, any side effects]
```

Then add your new experiment as a checklist item.

### Step 2: Hypothesize

Before writing any code, clearly state:
1. **What** you think the bottleneck is
2. **Why** you think it's a bottleneck (evidence from code analysis or profiling)
3. **What** improvement you expect
4. **How** you plan to test it

Write this in the experiment entry in `EXPERIMENTS.md`.

### Step 3: Measure baseline

Build the package and run the **quick** benchmark variant (see `BENCHMARKS.md` for the exact command):

```bash
pnpm nx build <package>
pnpm benchmark:<name> --quick --label baseline
```

Save the JSON result file path. This is your baseline for this experiment.

Important: if a global baseline already exists from a previous experiment and the code hasn't changed, reuse it.

### Step 4: Implement

- Make the **minimal** change needed to test the hypothesis
- Do NOT combine multiple optimizations in one experiment
- Keep the change reversible

### Step 5: Measure after

Rebuild and run the same **quick** benchmark to compare:

```bash
pnpm nx build <package>
pnpm benchmark:<name> --quick --label experiment-name --compare results/BASELINE_FILE.json
```

If the quick run shows a promising improvement, **confirm with the full benchmark** (see `BENCHMARKS.md` for the full-scale command) before finalizing.

Only move to Step 6 after the full-scale run confirms the improvement.

### Step 6: Validate

Before evaluating results, ensure correctness:

```bash
pnpm test
pnpm test:types
pnpm lint:fix
```

All must pass. A faster implementation that breaks correctness is a regression.

### Step 7: Evaluate and decide

Update the experiment entry in `EXPERIMENTS.md` with results and decision:

- **KEEP**: The improvement is statistically significant (>5% median improvement, confidence intervals don't overlap) AND all tests pass AND the code complexity is acceptable.
- **DISCARD**: The improvement is not significant, or the trade-offs aren't worth it. Document findings and reasoning. Revert the changes.
- **ITERATE**: The approach has promise but needs refinement. Document what was learned, adjust, and re-run from Step 4.

### Significance criteria

An experiment result is considered **significant** if:
- Median improvement > 5%
- The confidence interval (mean +/- 1 stddev) of the experiment does NOT overlap with the baseline's
- The improvement is consistent across all measured phases

## How to discover new experiments

When looking for new optimization candidates, read the pipeline source code and investigate these areas:

1. **Profile the code** — add temporary timing instrumentation, rebuild, and run a single benchmark to find where time accumulates.
2. **Analyze concurrency behavior** — understand how the concurrency controls interact and whether the pipeline achieves its theoretical throughput.
3. **Look for sequential bottlenecks** — search for `await` in loops or serialized operations that could be parallelized.
4. **Examine I/O patterns** — check how many times files are read, whether data is cached between passes, and whether reads are batched or sequential.
5. **Check data structure efficiency** — look for linear scans where indexed lookups would be better.
6. **Review the stream pipeline** — investigate backpressure, buffer sizes, and in-flight request counts.
7. **Investigate API interaction patterns** — check for rate limiting errors, consider batching, and look for underused API capabilities.

## Important rules

1. **One experiment at a time.** Never combine multiple changes in a single experiment.
2. **Always measure before AND after.** Gut feelings are not evidence.
3. **Keep existing tests passing.** Performance without correctness is a regression.
4. **Document everything** in `EXPERIMENTS.md`. Future experiments build on past knowledge.
5. **Rebuild before measuring.** Always rebuild the package after code changes before benchmarking.
6. **Don't over-optimize.** If an optimization adds significant complexity for <5% improvement, it's probably not worth it.
7. **Account for variance.** Real API benchmarks have natural variance. The default 2 runs is sufficient for most experiments; increase to 3-5 with `--runs` when results are borderline. Focus on medians rather than individual runs.
