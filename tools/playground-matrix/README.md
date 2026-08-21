# playground-matrix

Builds and runs the playgrounds the way a consumer would: from packed tarballs, in a clean
container, with npm, pnpm, or yarn, on more than one Node version.

## Why this exists

Inside this repo the playgrounds resolve `@storyblok/*` through pnpm workspace links. None of them
exercise the thing a release actually ships: the tarball, its manifest, and the way a package
manager resolves it.

A bundler change can therefore be completely green in CI and still break every consumer. A
dependency gets inlined instead of externalized, an `exports` entry points at a file that no longer
exists, a `"use client"` directive is emitted twice, a stylesheet has no reachable subpath. Each of
those is invisible to a workspace-linked build and obvious the first time someone runs
`npm install`.

This suite closes that gap.

## What it checks

Before any container starts (`--pack-only`):

- `pnpm pack` still matches how releases publish. `nx release publish` delegates to
  `@nx/js:release-publish`, which runs the workspace package manager's `publish`. With pnpm that
  shares its packer and its `workspace:` to semver rewrite with `pnpm pack`. The suite asserts both
  facts, so the day either one changes the run fails instead of quietly packing a different
  artifact.
- No `workspace:` or `catalog:` specifier survives into a packed manifest.
- Every path the manifest advertises exists inside the tarball: `main`, `module`, `types`, `bin`,
  and each leaf of `exports`.
- Nothing in the shipped code imports a package the manifest never declares.

Inside each container, after a real install and a real build:

- Each package under test resolves, and resolves to the version built from this checkout rather than
  one fetched from the registry.
- Every declared runtime dependency appears as a bare import in the shipped code. If it does not,
  either the bundler inlined a copy, which makes the declared range decorative and means the version
  the consumer installed never runs, or the dependency is unused and should not be declared. The
  first of those is the defect that motivated this suite.
- Only one copy of each package is installed.
- Both entry conditions load: `import()` and `require()` each return exports.
- No file carries more than one `"use client"` or `"use server"` directive.

Against the running app, from a browser on the host:

- The page responds, renders more than a trace of text, and contains whatever the playground's
  config says it should.
- No module resolution error at runtime. A bare specifier that survived into a browser bundle
  produces a green build and a blank page, and this is where it shows up.

## Usage

Docker must be running.

```bash
pnpm matrix                      # smoke tier: Node 24, latest of each manager
pnpm matrix --tier=full          # Node 22 and 24 across 7 manager configurations
pnpm matrix --pack-only          # tarball checks only, no Docker
pnpm matrix --stage-only         # stage the playgrounds and stop
pnpm matrix --playground=vue --pm=yarn-latest-pnp
pnpm matrix --help
```

Artifacts land in `.matrix/`: `tarballs/`, `stage/`, per-job `logs/`, `report.md`, and
`report.json`.

Iterating is cheap. `--skip-pack` reuses the previous tarballs and `--skip-build` packs without
rebuilding.

### The browser

Playwright runs on the host and points at the container's published port. The image deliberately has
no browser in it, because it is meant to look like a consumer's machine. Set `MATRIX_PLAYWRIGHT_WS`
to drive a remote Playwright server instead, or pass `--no-browser` to skip the smoke tests.

## Configuration

Everything lives in `matrix.config.json`: the Node versions, the package manager configurations, the
tiers, and the playgrounds with their build script and how to serve them.

`serve.type: "none"` marks a playground as build-only, and the report records it as build-only
rather than silently passing. Two playgrounds use it: `astro-ssr`, whose Vercel adapter emits an
artifact with no locally runnable server, and `svelte-kit`, whose `adapter-auto` produces nothing
runnable off a host it recognizes.

## Layout

| Path                        | Role                                                             |
| --------------------------- | ---------------------------------------------------------------- |
| `matrix.config.json`        | The matrix and the playground definitions                        |
| `src/pack.ts`               | Builds and packs, and guards release parity                      |
| `src/verify-pack.ts`        | Static tarball checks                                            |
| `src/stage.ts`              | Copies a playground out of the workspace, rewrites its manifests |
| `src/docker.ts`             | Container lifecycle and phase-marker protocol                    |
| `src/run.ts`                | Job execution and concurrency                                    |
| `src/smoke.ts`              | Host-side browser checks                                         |
| `docker/entrypoint.sh`      | One job: install, build, verify, serve                           |
| `docker/verify-install.mjs` | The post-install assertions, run inside the container            |
