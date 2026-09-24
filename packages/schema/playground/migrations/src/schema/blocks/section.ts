import { defineBlock, defineField } from "@storyblok/schema";

import { authorBlock } from "./author";
import { cardBlock } from "./card";
import { faqBlock } from "./faq";
import { galleryBlock } from "./gallery";
import { mediaBlock } from "./media";
import { pricingTableBlock } from "./pricing-table";
import { quoteBlock } from "./quote";
import { teaserBlock } from "./teaser";

// Named separately so `items` can allow a section inside a section without the
// module importing itself.
const SECTION_NAME = "section";

export const sectionBlock = defineBlock({
  name: SECTION_NAME,
  is_nestable: true,
  fields: [
    defineField("heading", { type: "text", max_length: 120, translatable: true }),
    defineField("theme", {
      type: "option",
      source: "internal",
      datasource: "section_themes",
      default_value: "light",
    }),
    defineField("accent_color", { type: "custom", field_type: "native-color-picker" }),
    defineField("items", {
      type: "bloks",
      allow: [
        SECTION_NAME,
        cardBlock.name,
        teaserBlock.name,
        galleryBlock.name,
        mediaBlock.name,
        quoteBlock.name,
        faqBlock.name,
        pricingTableBlock.name,
        authorBlock.name,
      ],
    }),
  ],
});
