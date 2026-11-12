<!-- target: src/content/docs/docs/libraries/js/management-api-client/index.mdx#createmanagementapiclient -->

Replace the `region` row of the options table:

| Option   | Description                                                                                                                                                                |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `region` | Region code (`'eu'`, `'us'`, `'ap'`, `'ca'`, `'cn'`). Defaults to the region the `spaceId` belongs to, or `'eu'` without one. For a space in China, set `'cn'` explicitly. |

<!-- target: src/content/docs/docs/libraries/js/management-api-client/index.mdx#per-request-space-override -->

Append to the section:

The client picks its region once, when it's created. An overridden `space_id` must belong to the
same region as the client.
