---
name: document-writer
description: Use when writing documentation. Provides a writing style guide and content structure patterns.
---

# Documentation Writer for Storyblok Ecosystem

Provide writing guidance for Storyblok DX documentation.

## When to use

Use this skill for the following tasks:

- Create or edit documentation pages and `README.md` files.
- Ensure a consistent writing style across all content.

## Voice and Perspective

- **Active Voice**: Always use the active voice. Avoid the passive voice.
- **Imperative Mood**: Use the imperative second-person voice for instructions ("Add the following...").
- **Third-person**: Use the third-person voice for descriptions and technical references.
- **Generic Voice**: Strive for simplicity, clarity, and consistency. Avoid soloists; the documentation should feel written by one team.
- **Gerunds**: Avoid gerunds (nouns ending in "-ing") in headings and instructions. Use "Find information" instead of "Finding information."
  - **Exception**: Gerunds are acceptable when referring to established technical concepts (for example, "Caching," "Routing," or "Versioning").

### Active voice

Subject performs action. Prefer this.

| Active (use)                    | Passive (avoid)                       |
| ------------------------------- | ------------------------------------- |
| The module creates a connection | A connection is created by the module |
| You can override defaults       | Defaults can be overridden            |

### When passive is okay

- Actor unknown: "The file is loaded during startup."
- Object more important: "Data is cached for 5 minutes."
- System behavior: "Routes are generated from pages directory."

## Spelling and Capitalization

### Spelling

- **American English**: Use standard American spellings (for example, *neighbor*, *center*).
- **Abbreviations**: Define on first reference if used more than twice (for example, "universal resource identifier (URI)"). Use abbreviations for common terms (for example, "HTTP").
- **Special Characters**: Use only when technically correct. Avoid emojis and decorative symbols unless they add technical value.

### Capitalization

- **Title Case**: Use Title Case for H1/Titles (`#`) and CTAs.
- **Sentence Case**: Use sentence case for headings H2 through H6.
  - Important: if there is no H1 assume that you're only see part of the document and always stick to casing rules!
- **Technical Casing**: Always use the technical casing for code, variables, and instances (for example, `pop()`, `StoryblokBridge` vs `storyblokBridge`).
- **File Types**: Use uppercase (for example, JPEG, ZIP).
- **URLs**: Use lowercase.
- **Lists**: Capitalize list items.
- **Colons**: Use lowercase after a colon unless it's a proper noun or start of a full sentence.

## Punctuation

- **Oxford Comma**: Always use a comma before the last item in a list.
- **Dashes**: 
  - **Hyphens**: Join compound phrases.
  - **Em dashes**: Demarcate an aside, surrounded by spaces. Avoid En dashes.
- **Spaces**: Use only one space between sentences. No space before punctuation.
- **Quotes**: End punctuation goes inside the quotation mark ("like this.").
  - **Exception**: Place punctuation outside quotation marks if the quote is a literal string, command, or code snippet to avoid syntax errors (for example, set the value to "true".).
- **Parentheticals**: End punctuation goes after the closing parenthesis unless the parenthetical is a full sentence.

## Structure

- **Headings**:
  - Only one H1 per page.
  - Maintain semantic nesting (H3 under H2, H4 under H3).
  - No single headings or sub-headings in a section.
- **Lists**:
  - Default to unordered (bulleted) lists. Use ordered (numbered) only for essential sequences.
  - Use parallel structure for list items.
- **Parallels**: Express coordinate ideas in similar form across lists, subheadings, and tables.

### Subject-first declarative

Place subject first, verb follows. Clear and direct.

```text
The `useStoryblokBridge` hook enables live preview.
The Storyblok CLI provides powerful migration tooling.
The debug option controls module behavior during development.
```
