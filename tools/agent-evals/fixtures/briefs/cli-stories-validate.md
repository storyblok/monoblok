## Request

We define our content schema in code and change it regularly. Every time we rename a field, tighten
a field's allowed options or drop a component, we have no idea which of the stories already in our
space break until an editor stumbles over one, or a page fails in production. As a developer on a
team with a few thousand stories, I want to run a check from the command line that tells me which
stories no longer match the schema in my repository, before I ship the schema change. It should be
usable in CI and should be able to look at just one part of the content tree, since a full run on a
big space is slow.

## Decisions

- The command is `storyblok stories validate`; it streams every story in the space and validates its
  draft content against the local code-defined schema.
- `--starts-with` limits the run to stories under a slug prefix.
- `--level` sets the minimum severity that is reported.
- `--format` selects the output format, the same options as the existing schema validation command.
- The exit code is 2 when validation finds failures, so CI can fail the build.
- Translations of translatable fields are validated at the field level, not only the default
  language.
- A value that is no longer among a field's declared options is reported.
- Option fields whose options come from the space (datasources, stories) are skipped, since the
  accepted values cannot be known from the schema.

## Unknown to the requester

- How stories are fetched or paged internally.
- How the validation layer is structured or which package hosts it.
- Output wording and exact report layout beyond "readable in a terminal and parseable in CI".
- Performance tuning and concurrency.
