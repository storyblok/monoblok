# Schema Versioning — Test Plan

## Version changelog

| Version | Components | Folders | Datasources | Type |
|---|---|---|---|---|
| v1.0.0 | page, hero, feature_card | Layout | — | Initial |
| v1.1.0 | + testimonial | + Content | + themes | Additive |
| v1.2.0 | (fields added) | (unchanged) | + dimensions | Additive |
| v2.0.0 | - testimonial, + cta_button | (unchanged) | dims changed | **Breaking** |

## Test flows

### Flow 1 — Forward migration

```bash
pnpm ver:1.0.0       # 3 components, 1 folder
pnpm ver:1.1.0       # + testimonial, + Content folder, + themes datasource
pnpm ver:1.2.0       # + fields, + dimensions
pnpm ver:2.0.0:migrate  # Breaking: renames, removals, type changes
```

### Flow 2 — Rollback

```bash
pnpm ver:1.2.0
pnpm ver:2.0.0
pnpm schema:rollback:latest   # Back to v1.2.0
```

### Flow 3 — Skip versions

```bash
pnpm ver:1.0.0
pnpm ver:2.0.0:dry   # Shows all accumulated changes
```

### Flow 4 — Rollback chain

```bash
pnpm ver:1.0.0
pnpm ver:1.2.0
pnpm schema:rollback:latest   # Back to v1.0.0
pnpm schema:rollback:latest   # Back to v1.2.0
```

## Team workflow

Schema lives in git, reviewed in PRs. CLI changesets provide rollback.
Minor versions: push with `--delete`. Major versions: push with `--migrations`.
Commit changesets to git. Tag releases.
