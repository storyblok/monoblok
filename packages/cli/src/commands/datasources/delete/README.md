# `datasources delete`

Delete a datasource from your Storyblok space by name or id.

## Basic Usage

```sh
# Delete by name
storyblok datasources delete <DATASOURCE_NAME> --space <SPACE_ID>

# Delete by id (no name required)
storyblok datasources delete --space <SPACE_ID> --id <DATASOURCE_ID>
```

## Options

| Option         | Description                                              |
| --------------| -------------------------------------------------------- |
| `--id <id>`   | Delete by datasource id instead of name                 |
| `--space`     | (Required) The ID of the space to delete from           |

## Examples

### Delete by name
```sh
storyblok datasources delete colors --space 12345
```

### Delete by id
```sh
storyblok datasources delete --space 12345 --id 67890
```

### Both name and id (not recommended)
```sh
storyblok datasources delete colors --space 12345 --id 67890
# ⚠️ Will warn and use the id as the source of truth
```

## Notes
- You must be authenticated and provide a valid space id.
- If both name and id are provided, the command will warn and use the id as the source of truth.
- If deleting by name, the command will resolve the datasource id automatically.
- The command will show a spinner and output success or error messages.
