#!/usr/bin/env tsx

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "@storyblok/openapi-codegen";

const PKG_ROOT = resolve(fileURLToPath(import.meta.url), "../..");

// Emit src/generated/overlay/types.gen.ts and the field descriptors of the
// resources the CLI writes field by field (`--set`). The output
// is not formatted: `src/generated/` is excluded from `vp fmt` (see
// .prettierignore) so regenerating never fights the formatter.
await generate({
  outDir: resolve(PKG_ROOT, "src/generated"),
  include: ["RichTextDoc", "RichTextNode", "RichTextMark"],
  resourceFields: [
    {
      name: "webhook",
      envelope: "webhook_endpoint",
      create: "createWebhookEndpoint",
      update: "updateWebhookEndpoint",
      read: "getWebhookEndpoint",
    },
  ],
});
