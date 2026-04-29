# CLI Architecture

## Command structure

Every command lives in `commands/<name>/` with `index.ts` (definition), `actions.ts` (logic), and `index.test.ts`. Registered in `program.ts` via import.

## Key conventions

- **UI module** (`utils/ui.ts`) is the single entry point for all terminal output. Always use `getUI()`, never raw `Spinner`, `konsola`, or `console.*`. Always stop spinners before early returns (`.succeed()` or `.failed()`).
- **Logger** (`lib/logger/`) for structured operational logs. **UI** for user-facing output.
- **Modules init** in `program.ts` preAction hook: config → session → API client → logger → UI → reporter → command runs.

## Migration checklist (when touching old commands)

Old commands may use `Spinner` directly, `isVitest`, or `konsola`. When touching them:

1. Replace `Spinner` with `ui.createSpinner()` — UI handles test suppression
2. Remove `isVitest` — commands must never import it
3. Replace `konsola.*` with `ui.*`
4. Add `getLogger()` for structured logging

Reference: `commands/datasources/pull/index.ts` is the canonical migrated command.
