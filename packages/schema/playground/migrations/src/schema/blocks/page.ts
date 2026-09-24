import { defineBlock, defineField } from "@storyblok/schema";

import { authorBlock } from "./author";
import { cardBlock } from "./card";
import { contentBoardBlock } from "./content-board";
import { faqBlock } from "./faq";
import { galleryBlock } from "./gallery";
import { mediaBlock } from "./media";
import { pricingTableBlock } from "./pricing-table";
import { quoteBlock } from "./quote";
import { sectionBlock } from "./section";
import { teaserBlock } from "./teaser";

export const pageBlock = defineBlock({
  name: "page",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("seo_title", { type: "text", max_length: 70, translatable: true }),
    defineField("seo_description", { type: "textarea", max_length: 160, translatable: true }),
    defineField("body", {
      type: "bloks",
      allow: [
        sectionBlock.name,
        cardBlock.name,
        teaserBlock.name,
        galleryBlock.name,
        mediaBlock.name,
        quoteBlock.name,
        faqBlock.name,
        pricingTableBlock.name,
        authorBlock.name,
        contentBoardBlock.name,
      ],
    }),
  ],
});
