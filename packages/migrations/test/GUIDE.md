# Manually Test @storyblok/migrations

### Scenario seeds

Use the provided [scenarios](./scenarios/SCENARIOS.md) to quickly seed QA spaces with predictable data for manual testing. Scenarios expect a clean space, so run cleanup first when you want a fresh start.

```bash
bash .agents/skills/qa-engineer-manual/scripts/seed-scenario.sh \
  --scenario has-cross-references \
  --scenario-dir packages/migrations/test/scenarios
```
