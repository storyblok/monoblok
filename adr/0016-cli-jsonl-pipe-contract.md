# ADR-0016: CLI JSONL Pipe Contract

**Status:** Accepted **Date:** 2026-08-27

## Context

`stories find` ([ADR-0015](0015-cli-stories-find-command.md)) is the first CLI command whose result
is data rather than a report, and the first written to be read by another command:

```bash
storyblok stories find -s 123 --includes-block hero --capi-filter --where "…" \
  | storyblok migrations run hero -s 123 -
```

`find` is expected to stay the producer, with `migrations run`, `stories push` and the planned
`stories update` and `stories delete` on the consuming side. That makes the format a contract
between commands rather than a detail of one, and it raises questions no single command can answer
on its own: what a line is worth to a consumer, what it is guaranteed to carry, how a slow consumer
paces a fast producer, and where the code for all of that lives.

Everything about the pipe was initially written inside `find`, half of it in `lib/ui` and half in
the command, with nothing at all on the input side.

## Decisions

### 1. A line is the story, not a pointer to it

Each line is a **complete story object as the Management API returned it**. A consumer takes the
fields it needs off the line, and re-fetches only what the line does not carry.

This is what the pipe is for. `migrations run` today fetches every story in scope one at a time and
only then discovers that the migration changes nothing in most of them: the no-op verdict is reached
_after_ the request that paid for it. Reading the payload removes both the listing and the per-story
content fetch from the consuming side, which is the difference between a 3,951-story space taking
eleven minutes and taking under a minute. A contract that had consumers re-fetch by id would leave
that on the table and reduce the pipe to a slower `--by-ids`.

An earlier position in ADR-0015 had consumers refetch via the Management API before mutating, on
staleness grounds. That is superseded. The staleness window is real, but it belongs to the write
path rather than to the format, and the format carries what is needed to close it.

### 2. Staleness is the consumer's to handle, with `updated_at` as the token

A line is a snapshot. Between the producer reading a story and the consumer writing it, the story
can be edited or moved. Every line carries `updated_at`, so a consumer that overwrites has something
to compare before it does. A command that sends `force_update` on piped input overrides the server's
conflict check across a window it just widened, and discards a concurrent edit without a word.

Naming this here rather than mandating a refetch keeps the cost proportional: a read-only consumer
pays nothing, and a destructive one is expected to reason about it. For anything destructive, the
documented practice is to keep the selection rather than stream it (`find … > selection.jsonl`, then
act on the file), so the same set can be re-applied, audited, or diffed.

### 3. A stated minimum, and `_`-prefixed sidecar keys

The shape of a line depends on the producer's flags: `--skip-content` omits `content`, and
`--check-references` adds `_ref_issues`. Two rules make that safe to consume:

- **Every line carries `id`, `uuid`, and `full_slug`**, whatever produced it. A consumer can be
  written against the format rather than against one flag combination.
- **A key a producer adds that is not part of the story is prefixed `_`.** Unknown sidecar keys are
  ignored, and `stripSidecarKeys` removes them before a story goes back to the API. Top-level keys
  only: `_uid` and `_editable` live inside `content`, where they are part of the document the API
  itself round-trips.

`content` is therefore optional by contract. A consumer that needs it fetches it for the lines that
lack it rather than failing the run.

### 4. `-` is explicit, and stdin is never consumed by detection

A consumer reads stdin only when passed `-`. There are two reasons, and the first alone is decisive:

- **The usual probe cannot see it.** `process.stdin.isTTY` is `null` for a pipe, for `< /dev/null`,
  for a file redirect, and for a closed descriptor alike, so it cannot tell _piped input_ from _no
  input_. Under CI, cron, or `docker` without `-i`, a command that guessed would silently operate on
  zero stories and exit 0.
- **A command that consumes stdin unasked breaks as the child of a loop sharing that descriptor.**
  In `cat components.txt | while read c; do storyblok migrations run "$c" -s 123; done`, an
  auto-detecting consumer would eat the rest of `components.txt` and the loop would run once. This
  is why `ssh` has `-n`. Stdin also cannot express intent when it conflicts with the scope flags:
  does `pull --starts-with en/blog -` intersect them, or does the stream win?

`fstat` on descriptor 0 _can_ distinguish the cases, because a pipe is a FIFO, a redirect is a
regular file, and `/dev/null`, a closed descriptor, and a terminal are all character devices. It is
used for a nudge only: when stdin is a pipe, `-` was not passed, and the command is about to go
space-wide, say so on stderr rather than silently doing the larger thing.

### 5. The pipe applies backpressure, in both directions

The producer's output is the terminal stage of its `stream.pipeline()`, and it holds its stream
callback back until stdout drains. The consumer's input is the head of its pipeline, read at the
pace its stages can take.

Without this, a producer running at Management API speed piped into a consumer writing at the
configured rate limit buffers the difference in stdout's write queue: the whole result set, in
memory, for exactly the pipeline the feature exists to support. Streaming is what makes the memory
claim true, not just the latency one.

### 6. `src/lib/pipe/` owns all of it

The pipe is a module, not a feature of `find`:

| File          | Owns                                                                               |
| ------------- | ---------------------------------------------------------------------------------- |
| `output.ts`   | JSONL out, the backpressured sink, and the closed-pipe signal                      |
| `input.ts`    | `-`, the `fstat` probe, and the JSONL reader with its malformed-line policy        |
| `contract.ts` | the line contract above: required fields, sidecar keys, validation at the boundary |
| `phases.ts`   | progress bars, counters, timing marks, and derived totals for a staged run         |

`phases.ts` is there because a streaming command's instrumentation is the other thing every consumer
would otherwise reimplement. `find` alone had 300 lines of it, `assets` has a smaller copy, and the
subtlest part, keeping each stage's total honest as records are dropped upstream, is worth having
one tested implementation of.

A malformed input line **fails the run** by default. Skipping it silently would make a truncated
producer look like a clean short read, which answers a different question than the one asked. A
consumer that would rather report and continue has to say so.

## Alternatives Considered

- **Consumers refetch by `id`/`uuid`, treating a line as a selection.** Rejected: it is the safe
  default, but it discards the pipe's whole performance argument, and staleness is addressable with
  `updated_at` without it. See decision 1.
- **An envelope around each story** (`{"type":"story","data":{…}}`). Rejected: it makes every `jq`
  one-liner longer for a discriminator nothing needs yet, and the `_`-prefixed sidecar convention
  already leaves room to annotate. Revisit if a producer ever emits more than one kind of record.
- **Auto-detecting stdin.** Rejected: see decision 4.
- **A single JSON array instead of JSONL.** Rejected: a reader could not act on the first record
  without waiting for the last, memory would scale with the result set, and the early exit
  (`| head -5`) would be unreachable.
- **Keeping the pipe code in `lib/ui`.** Rejected: none of it is about terminal presentation, and
  the input half has no place there at all.

## Consequences

- **Producers and consumers agree on a validated boundary.** `parseStoryLine` fails at the point of
  reading, naming the input line, rather than deep inside a write.
- **A consumer must treat `content` as optional** and fetch what it lacks. `--skip-content` on the
  producing side becomes a genuine optimization rather than a trap.
- **`find --check-references` does not stream.** An issue is only decidable once the whole scope has
  been listed, because deciding one needs the _target's_ current slug and publish state. It buffers
  matches and writes them through the same sink afterwards, so it is the one mode where a reader
  does not see a first line early. This is documented in the command's README.
- **`stories validate` and `schema validate` still emit a single JSON blob** behind `--format json`,
  bypassing this module. They predate it, and converging them is follow-up work rather than a
  blocker.
- **Two things a write consumer has to get right, neither about the pipe.** Deleting a folder
  deletes its subtree recursively, so a delete consumer has to report what it removed rather than
  how many lines it read, and treat ids that vanish underneath it as expected. And a selection is a
  snapshot, per decision 2.
