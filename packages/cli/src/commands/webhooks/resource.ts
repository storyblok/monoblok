import type { Webhook, WebhookCreate, WebhookUpdate } from "@storyblok/management-api-client";
import { getMapiClient } from "../../api";
import { webhookFields } from "../../generated/mapi/resource-fields.gen";
import { CrudError } from "../../lib/crud/errors";
import type { Payload } from "../../lib/crud/fields";
import { hasRequiredFields, toRequestBody } from "../../lib/crud/request";
import type { FieldGuards } from "../../lib/crud/request";
import type { CrudResource, Noun } from "../../lib/crud/types";

const NOUN: Noun = { singular: "webhook", plural: "webhooks" };

const isString = (value: unknown): value is string => typeof value === "string";
const isNullableString = (value: unknown): value is string | null =>
  value === null || isString(value);
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isString);

const WEBHOOK_FIELDS: FieldGuards<WebhookUpdate> = {
  name: isString,
  description: isNullableString,
  endpoint: isString,
  secret: isNullableString,
  activated: isBoolean,
  actions: isStringList,
};

const toWebhookUpdate = (payload: Payload): WebhookUpdate =>
  toRequestBody(WEBHOOK_FIELDS, payload, NOUN);

function toWebhookCreate(payload: Payload): WebhookCreate {
  const body = toWebhookUpdate(payload);
  if (!hasRequiredFields(webhookFields, body)) {
    throw new CrudError("The webhook lacks a required field.");
  }
  return body;
}

export const webhooksResource: CrudResource<Webhook> = {
  noun: NOUN,
  fields: webhookFields,
  secretFields: ["secret"],
  nameField: "name",
  columns: [
    { header: "ID", value: (webhook) => String(webhook.id) },
    { header: "Name", value: (webhook) => webhook.name },
    { header: "Endpoint", value: (webhook) => webhook.endpoint, flexible: true },
    { header: "Actions", value: (webhook) => webhook.actions.join(", ") },
    { header: "Activated", value: (webhook) => (webhook.activated ? "yes" : "no") },
  ],
  connect: ({ spaceId }) => {
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
