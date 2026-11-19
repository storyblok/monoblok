import type { WebhookCreate, WebhookUpdate } from "@storyblok/management-api-client";
import { getMapiClient } from "../../api";
import { webhookFields } from "../../generated/mapi/resource-fields.gen";
import { CrudError } from "../../lib/crud/errors";
import type { Payload } from "../../lib/crud/fields";
import type { CrudResource } from "../../lib/crud/types";

const isString = (value: unknown): value is string => typeof value === "string";

/**
 * Narrows a payload the shared code has already checked against the field
 * descriptor to the request type. Only fields present in the payload are set:
 * an absent field is left as the API has it.
 */
function toWebhookUpdate(payload: Payload): WebhookUpdate {
  const body: WebhookUpdate = {};
  if (isString(payload.name)) {
    body.name = payload.name;
  }
  if (isString(payload.endpoint)) {
    body.endpoint = payload.endpoint;
  }
  if (isString(payload.description) || payload.description === null) {
    body.description = payload.description;
  }
  if (isString(payload.secret) || payload.secret === null) {
    body.secret = payload.secret;
  }
  if (typeof payload.activated === "boolean") {
    body.activated = payload.activated;
  }
  if (Array.isArray(payload.actions)) {
    body.actions = payload.actions.filter(isString);
  }
  // A field the generated list gained, but this function does not copy yet,
  // would otherwise be dropped while the run reports success.
  const dropped = Object.keys(payload).filter((field) => !Object.hasOwn(body, field));
  if (dropped.length > 0) {
    throw new CrudError(`The CLI cannot write these webhook fields yet: ${dropped.join(", ")}.`);
  }
  return body;
}

function toWebhookCreate(payload: Payload): WebhookCreate {
  const body = toWebhookUpdate(payload);
  const { name, endpoint, actions } = body;
  if (name === undefined || endpoint === undefined || actions === undefined) {
    throw new CrudError("Missing required fields: name, endpoint, actions.");
  }
  return { ...body, name, endpoint, actions };
}

export const webhooksResource: CrudResource = {
  noun: { singular: "webhook", plural: "webhooks" },
  fields: webhookFields,
  secretFields: ["secret"],
  nameField: "name",
  columns: [
    { header: "ID", value: (webhook) => String(webhook.id) },
    { header: "Name", value: (webhook) => String(webhook.name) },
    { header: "Endpoint", value: (webhook) => String(webhook.endpoint), flexible: true },
    {
      header: "Actions",
      value: (webhook) => (Array.isArray(webhook.actions) ? webhook.actions.join(", ") : ""),
    },
    { header: "Activated", value: (webhook) => (webhook.activated ? "yes" : "no") },
  ],
  connect: (spaceId) => {
    const client = getMapiClient();
    const path = { space_id: spaceId };
    return {
      // One unpaginated request: the API returns every webhook of the space.
      listAll: async () => {
        const { data } = await client.webhooks.list({ path, throwOnError: true });
        return data.webhook_endpoints;
      },
      get: async (id) => {
        const { data } = await client.webhooks.get(id, { path, throwOnError: true });
        return data.webhook_endpoint;
      },
      create: async (payload) => {
        const { data } = await client.webhooks.create({
          path,
          body: { webhook_endpoint: toWebhookCreate(payload) },
          throwOnError: true,
        });
        return data.webhook_endpoint;
      },
      update: async (id, payload) => {
        const { data } = await client.webhooks.update(id, {
          path,
          body: { webhook_endpoint: toWebhookUpdate(payload) },
          throwOnError: true,
        });
        return data.webhook_endpoint;
      },
      delete: async (id) => {
        await client.webhooks.delete(id, { path, throwOnError: true });
      },
      allowedValues: {
        actions: async () => {
          const { data } = await client.webhooks.allowedActions({ path, throwOnError: true });
          return data.allowed_actions.map(({ action }) => action);
        },
      },
    };
  },
};
