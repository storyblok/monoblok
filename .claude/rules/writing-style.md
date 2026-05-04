---
paths:
  - "**/*.md"
  - "claude-output/**"
---

# Writing Style

Apply these rules when writing any Storyblok documentation, README, or prose content.

## Core rules

- Do not use em dashes or en dashes. Use commas, colons, or periods instead. Hyphens `-` are fine in bullet lists and compound phrases.
- Never hard-wrap lines in markdown files, PR descriptions, or any written prose. Write full sentences/paragraphs as single long lines and let the reader's editor handle wrapping.

## Voice and perspective

- **Active voice**: Always prefer. Avoid passive unless the actor is unknown, the object is more important, or it describes system behavior.
- **Imperative mood**: Use second-person imperative for instructions ("Add the following...").
- **Third-person**: Use for descriptions and technical references.
- **Generic voice**: Simplicity, clarity, consistency. The documentation should feel written by one team.
- **Gerunds**: Avoid in headings and instructions ("Find information" not "Finding information"). Exception: established technical concepts (Caching, Routing, Versioning).

## Spelling and capitalization

- **American English**: Standard spellings (neighbor, center).
- **Abbreviations**: Define on first reference if used more than twice. Use abbreviations for common terms (HTTP, URI).
- **Title Case**: H1/Titles (`#`) and CTAs.
- **Sentence case**: H2 through H6.
- **Technical casing**: Always match code casing (`pop()`, `StoryblokBridge`).
- **File types**: Uppercase (JPEG, ZIP).
- **URLs**: Lowercase.

## Punctuation

- **Oxford comma**: Always.
- **Spaces**: One space between sentences. No space before punctuation.
- **Quotes**: Punctuation inside ("like this."). Exception: literal strings, commands, or code snippets go outside to avoid syntax errors.
- **Parentheticals**: Punctuation after closing parenthesis unless the parenthetical is a full sentence.

## Structure

- One H1 per page. Maintain semantic nesting (H3 under H2, H4 under H3).
- Default to unordered lists. Use ordered only for essential sequences.
- Use parallel structure for list items, subheadings, and tables.
- Place subject first, verb follows: "The `useStoryblokBridge` hook enables live preview."
