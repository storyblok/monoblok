<!-- target: src/content/docs/docs/libraries/js/management-api-client/index.mdx (frontmatter imports) -->

Add `Badge` to the existing Starlight import:

```mdx
import { Aside, Badge } from "@astrojs/starlight/components";
```

<!-- target: src/content/docs/docs/libraries/js/management-api-client/index.mdx (intro paragraph) -->

Replace the resource list in the intro paragraph with:

> It exposes a single `createManagementApiClient()` factory that returns resource clients for
> stories, components, component folders, assets, asset folders, data sources, data source entries,
> presets, internal tags, spaces, space roles, webhooks, workflows, workflow stages, users,
> organizations, and experiments.

<!-- target: src/content/docs/docs/libraries/js/management-api-client/index.mdx#clientspaces (insert after the `client.spaces` section) -->

### `client.spaceRoles`

_Introduced in_ <Badge text="0.10.0" variant="success" />

Use the `spaceRoles` resource client to manage the roles that control what collaborators can do in a
space.

```ts
client.spaceRoles.list(options?);
client.spaceRoles.get(spaceRoleId, options?);
client.spaceRoles.create(options);
client.spaceRoles.update(spaceRoleId, options);
client.spaceRoles.replace(spaceRoleId, options);
client.spaceRoles.delete(spaceRoleId, options?);
```

`update()` issues a `PATCH` and `replace()` a `PUT`. The API treats both the same way: only the
fields in the body change.

### `client.webhooks`

_Introduced in_ <Badge text="0.10.0" variant="success" />

Use the `webhooks` resource client to manage the webhooks that notify an endpoint when an event
happens in a space, such as a story being published.

```ts
client.webhooks.list(options?);
client.webhooks.get(webhookId, options?);
client.webhooks.create(options);
client.webhooks.update(webhookId, options);
client.webhooks.delete(webhookId, options?);
client.webhooks.allowedActions(options?);
```

A new webhook needs a `name`, an `endpoint`, and `actions`. `allowedActions()` returns the event
actions a webhook can subscribe to. Use it to validate the `actions` of a webhook before you create
it:

```ts
import { createManagementApiClient } from "@storyblok/management-api-client";

const client = createManagementApiClient({
  personalAccessToken: process.env.STORYBLOK_PERSONAL_ACCESS_TOKEN,
  spaceId: 12345,
});

const { data } = await client.webhooks.allowedActions({ throwOnError: true });
const allowedActions = data.allowed_actions.map(({ action }) => action);

if (allowedActions.includes("story.published")) {
  await client.webhooks.create({
    body: {
      webhook_endpoint: {
        name: "Deploy",
        endpoint: "https://example.com/deploy",
        actions: ["story.published"],
      },
    },
  });
}
```

### `client.workflows` and `client.workflowStages`

_Introduced in_ <Badge text="0.10.0" variant="success" />

A workflow is an ordered set of workflow stages that a story moves through before it's published.
Use the `workflows` and `workflowStages` resource clients to manage them.

```ts
client.workflows.list(options?);
client.workflows.get(workflowId, options?);
client.workflows.create(options);
client.workflows.update(workflowId, options);
client.workflows.delete(workflowId, options?);

client.workflowStages.list(options?);
client.workflowStages.get(workflowStageId, options?);
client.workflowStages.create(options);
client.workflowStages.update(workflowStageId, options);
client.workflowStages.replace(workflowStageId, options);
client.workflowStages.delete(workflowStageId, options?);
```

Pass `query: { include_stages: true }` to `workflows.list()` or `workflows.get()` to include the
stages of each workflow, and `query: { in_workflow: workflowId }` to `workflowStages.list()` to list
the stages of one workflow. As with `client.spaceRoles`, `workflowStages.update()` issues a `PATCH`
and `workflowStages.replace()` a `PUT`, and both change only the fields in the body.

`workflows.update()` issues a `PUT`, because the API has no `PATCH` for workflows. It also changes
only the fields in the body.

A new workflow stage needs a `name` and a `color`. Without a `workflow_id`, it's added to the
default workflow. A workflow needs at least one stage, so deleting its last stage fails.

<!-- target: src/content/docs/docs/libraries/js/management-api-client/index.mdx#clientusers (insert after the `client.users` section) -->

### `client.orgs`

_Introduced in_ <Badge text="0.10.0" variant="success" />

Use the `orgs` resource client to read and update the organization of the authenticated user. It
doesn't need a `spaceId`.

```ts
client.orgs.get(options?);
client.orgs.update(options);
client.orgs.replace(options);
```

`update()` issues a `PATCH` and `replace()` a `PUT`. The API treats both the same way: only the
fields in the body change.

```ts
import { createManagementApiClient } from "@storyblok/management-api-client";

const client = createManagementApiClient({
  personalAccessToken: process.env.STORYBLOK_PERSONAL_ACCESS_TOKEN,
});

const { data } = await client.orgs.get({ throwOnError: true });
console.log(data.org.name);
```

`get()` returns an `Organization` for organization admins and owners, and the reduced
`MemberOrganization` for members.

<!-- target: src/content/docs/docs/libraries/js/management-api-client/index.mdx#typescript (append to the section) -->

The package exports the following resource and request types:

- `SpaceRole`, `SpaceRoleCreate`, `SpaceRoleUpdate`
- `Webhook`, `WebhookCreate`, `WebhookUpdate`
- `Workflow`, `WorkflowCreate`, `WorkflowUpdate`
- `WorkflowStage`, `WorkflowStageCreate`, `WorkflowStageUpdate`
- `Organization`, `MemberOrganization`, `OrganizationUpdate`
