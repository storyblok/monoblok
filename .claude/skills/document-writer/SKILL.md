---
name: document-writer
description: Update package or platform documentation after code changes. Use when explicitly asked to update docs, write a README section, or add migration notes.
model: sonnet
disable-model-invocation: true
effort: medium
---

# Docs

Update documentation for: $ARGUMENTS

## Context

Read these before writing:
- `.claude/context/docs-platform.md` - Docs site structure, navigation, versioning, library docs paths
- `.claude/rules/writing-style.md` - Writing style (voice, punctuation, capitalization)

## Instructions

1. **Identify what changed** - New feature? Breaking change? Bug fix?
2. **Find affected docs** - Package README, docs-platform pages, migration notes, examples
3. **Update with examples** - Show copy-paste code, not just descriptions
4. **Add troubleshooting** - If relevant, add common errors and solutions

## Documentation Structure

### For New Features
```markdown
## Feature Name

Brief description of what it does.

### Usage
\`\`\`typescript
// Copy-paste example that works
\`\`\`

### Options
| Option | Type | Default | Description |
|--------|------|---------|-------------|

### Example
[Complete working example]
```

### For Breaking Changes
```markdown
## Migration from vX to vY

### Before
\`\`\`typescript
// Old way
\`\`\`

### After
\`\`\`typescript
// New way
\`\`\`

### Why
[Brief explanation of the change]
```

### For Bug Fixes
Only update docs if the previous docs were misleading or incorrect.

## Rules
- Start with a working code example
- Keep explanations concise
- Use tables for options/parameters
- Include error messages in troubleshooting

## Output Format

```markdown
## Documentation Updated
| File | Change |
|------|--------|
| packages/cli/README.md | Added section on X |

## Preview
[Show the key additions]
```
