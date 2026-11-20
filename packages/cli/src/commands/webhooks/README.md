# Webhooks Command

The `webhooks` command lists, prints, creates, updates, and deletes the webhooks of a Storyblok
space.

```bash
storyblok webhooks list --space 12345
storyblok webhooks get <webhook> --space 12345
storyblok webhooks create --set name=Deploy --set endpoint=https://example.com --set actions=story.published --space 12345
storyblok webhooks update <webhook> --set activated=false --space 12345
storyblok webhooks delete <webhook> --space 12345
```

A webhook is addressed by ID or by name. `create`, `update`, and `delete` take `-` to read webhooks
from stdin, so `webhooks list | jq … | webhooks update -` edits webhooks in bulk. Output never
contains the signing secret, only whether a webhook has one.

Run `storyblok webhooks <command> --help` for every flag. The commands are built on the shared CRUD
commands in `src/lib/crud/`.
