import { defineBlock, defineField } from "@storyblok/schema";

import { searchFolder } from "../../folders";

export const featuredSearchResultBlock = defineBlock({
  name: "featured_search_result",
  is_root: false,
  is_nestable: true,
  folder: searchFolder,
  preview_tmpl: "{{link.cached_url}}",
  fields: [
    defineField("link", {
      link_scope: "",
      type: "multilink",
    }),
  ],
});
