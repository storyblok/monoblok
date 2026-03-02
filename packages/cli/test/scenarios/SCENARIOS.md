# @storyblok/cli Scenarios

Seed with:

```bash
bash .claude/skills/qa-engineer-manual/scripts/seed-scenario.sh \
  --scenario <name> \
  --scenario-dir packages/cli/test/scenarios
```

For basic story testing, use the global `has-stories` scenario instead:

```bash
bash .claude/skills/qa-engineer-manual/scripts/seed-scenario.sh --scenario has-stories
```

| Scenario | Seeds |
| --- | --- |
| `has-nested-stories` | 1 story folder and 2 nested stories inside that folder (4 components, 3 stories). |
| `has-private-assets` | 1 public asset and 1 private asset (4 components, 2 assets). |
| `has-nested-asset-folders` | 2 nested asset folders (A → B) and 3 assets: 1 at root, 1 in Folder A, 1 in Folder B (4 components, 2 folders, 3 assets). |
