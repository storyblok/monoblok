# Storyblok CLI Agent Guidelines

## Where to put code

| Need                                                 | Put it here                                                                                                                         |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Top-level CLI registration                           | `src/index.ts` import                                                                                                               |
| Module initialization, global `preAction` behavior   | `src/program.ts`                                                                                                                    |
| Commander command definition                         | `src/commands/<name>/index.ts` or `command.ts`                                                                                      |
| API calls, filesystem writes, transformations        | `actions.ts`                                                                                                                        |
| Utilities shared by sibling subcommands              | parent command directory (e.g. `schema/serialize.ts`, not `schema/push/serialize.ts`) — subcommands must not import from each other |
| JSONL on stdout/stdin, `-`, staged-run progress      | `src/lib/pipe/`                                                                                                                     |
| Config resolution, global option behavior            | `src/lib/config/`                                                                                                                   |
| Machine-readable command reports                     | `src/lib/reporter/`                                                                                                                 |
| Validation issue filtering, grouping, and formatting | `src/lib/validation/`                                                                                                               |

Subcommands attach to the parent command instance they import (e.g. `componentsCommand` from
`components/command.ts`).

Use `pathe`, not `node:path`: CI runs the CLI on Windows.

## Module initialization

The `preAction` hook in `src/program.ts` initializes everything in order: config → session and API
client → logger → UI → reporter → command action. Anything a command action relies on is already
resolved by the time it runs, so read config through `command.optsWithGlobals()` and reach for
modules through their getters rather than initializing them yourself.

## Terminal output

| If you need                                     | Use                                           |
| ----------------------------------------------- | --------------------------------------------- |
| User-facing text, titles, warnings, blank lines | `const ui = getUI()`                          |
| Progress spinners                               | `ui.createSpinner()`                          |
| Progress bars                                   | `ui.createProgressBar()`                      |
| Interactive prompts                             | `await select({...}, stderrPromptContext)`    |
| Operational diagnostics                         | `const logger = getLogger()`                  |
| Command errors                                  | `handleError(new CommandError(...), verbose)` |

- All UI output goes to stderr. No `console.*` or raw `Spinner` in command code.
- Stop every spinner on all return paths.
- Every `@inquirer/prompts` call (`select`, `confirm`, `input`, `password`) passes
  `stderrPromptContext` from `src/lib/ui/` as the second argument.
- Commands without `getLogger()` calls get them when you touch them.
  `src/commands/datasources/pull/` is the reference command.

## Errors

Throw the typed errors from `src/utils/error/`: `APIError` (ID from `API_ERRORS`, action from
`API_ACTIONS`), `FileSystemError`, and `CommandError` for usage errors. `handleError()` sets
`process.exitCode`: 2 for `CommandError`, 1 for runtime errors. With `--exit-code` (`schema diff`),
1 means a result, so runtime errors exit 2.

## Tests

Follow `docs/testing-patterns.md`. CLI specifics:

- Test commands by executing them (`<command>.parseAsync([...])`) with named preconditions when
  behavior depends on files, API responses, or session state. Name each precondition after the state
  it establishes, including failure states (`failsToUpdateRemoteStories`), so a test reads as its
  own setup. Example: `src/commands/stories/push/index.test.ts`.
- Resolve paths with `resolveCommandPath` and the `directories` constants instead of hardcoding
  `.storyblok/...`, so a layout change does not break every test.
