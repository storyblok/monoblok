/**
 * The schema as it stood before migration 20261029132727-rename-teaser-to-excerpt.
 * Generated. Blocks the migration reads list their fields; the blocks around
 * them are name-only stubs. Keep this file unchanged once the migration ships,
 * so the fields it reads stay typed after later schema changes.
 */
import { defineBlock, defineField, defineSchema } from "@storyblok/schema";
import type { Schema } from "@storyblok/schema";

const blogEntryBlock = defineBlock({
  name: "blog_entry",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("title", {
      required: true,
      type: "text",
    }),
    defineField("teaser", {
      type: "textarea",
    }),
    defineField("preview_image", {
      type: "asset",
    }),
    defineField("og_description", {
      type: "textarea",
    }),
    defineField("og_image", {
      type: "asset",
    }),
    defineField("noindex", {
      type: "boolean",
    }),
    defineField("body", {
      allow: [
        "annotated_image",
        "codeblock",
        "custom_richtext",
        "custom_table",
        "enterprise_spacer",
        "hint",
        "image",
        "in_content_nested_shared_content",
        "in_content_tabs",
        "newsletter_section",
        "quotes",
        "text_logos_links",
        "video",
      ],
      type: "bloks",
    }),
    defineField("tab-5c66dab0-9322-4171-9e13-224031243fcb", {
      type: "tab",
    }),
    defineField("tab-2586dfb6-775e-4464-a65d-80699fb28004", {
      type: "tab",
    }),
    defineField("authors", {
      source: "internal_stories",
      type: "options",
    }),
    defineField("category", {
      required: true,
      source: "internal",
      type: "options",
    }),
  ],
});

const eventBlock = defineBlock({
  name: "event",
  is_root: true,
  is_nestable: false,
  fields: [
    defineField("title", {
      type: "text",
    }),
    defineField("teaser", {
      type: "textarea",
    }),
    defineField("preview_image", {
      type: "asset",
    }),
    defineField("og_description", {
      type: "textarea",
    }),
    defineField("og_image", {
      type: "asset",
    }),
    defineField("noindex", {
      type: "boolean",
    }),
    defineField("storyblok_event", {
      type: "boolean",
    }),
    defineField("start_date", {
      type: "datetime",
    }),
    defineField("end_date", {
      type: "datetime",
    }),
    defineField("unlisted", {
      type: "boolean",
    }),
    defineField("hide_time", {
      type: "boolean",
    }),
    defineField("event_type", {
      options: [
        {
          name: "Storyblok Event (deprecated)",
          value: "storyblok_event",
        },
        {
          name: "Webinar",
          value: "webinar",
        },
      ],
      type: "option",
    }),
    defineField("text", {
      type: "richtext",
    }),
    defineField("body", {
      allow: [
        "accordion_carousel",
        "action_box_with_optional_cta",
        "anchor_link_sections",
        "animated_tiles",
        "annotated_image",
        "banner_section",
        "blocks_group",
        "blog_entries_listing",
        "blog_highlight",
        "blog_slider",
        "boxes_slider",
        "bullet_lists",
        "card_grid",
        "case_studies_listing",
        "case_study_big_card",
        "codeblock",
        "colored_big_card_with_image_and_cta",
        "content_board",
        "content_confidence_calculator",
        "content_confidence_ticker",
        "cookie_settings",
        "cta_image",
        "custom_boxes_grid",
        "customers_logos",
        "custom_richtext",
        "custom_table",
        "demo_form",
        "double_cta",
        "enterprise_box_grid",
        "enterprise_case_study_references",
        "enterprise_cta_group",
        "enterprise_cta_section",
        "enterprise_facts",
        "enterprise_faqs",
        "enterprise_pricing",
        "enterprise_single_box",
        "enterprise_spacer",
        "enterprise_text",
        "enterprise_text_image",
        "enterprise_video",
        "facts_with_images",
        "faqs_listing",
        "feature_showcase",
        "footnotes",
        "form_section_enterprise",
        "hero",
        "hero_with_image_ctas",
        "hint",
        "image",
        "image_with_decorations",
        "in_content_event_registration",
        "in_content_nested_shared_content",
        "in_content_tabs",
        "jobs_listing",
        "logo_grid",
        "mvp_category_descriptions",
        "mvp_highlights",
        "mvps_listing",
        "navattic_demo",
        "newsletter_section",
        "paper_cta",
        "partners_listing",
        "press_listing",
        "pricing_table",
        "quiz_form",
        "quiz_results",
        "quotes",
        "richtext_heading_with_description_and_ctas",
        "roadmap",
        "roi_calculator",
        "scrolling_logos",
        "section_with_bullet_lists_and_optional_video",
        "section_with_navigation",
        "section_with_quote_card",
        "single_pricing_box",
        "social_proof_badges",
        "tabs_with_images",
        "technology_partners_listing",
        "text_form",
        "text_logos_links",
        "text_quotes_illustration",
        "tiles_grid",
        "timeline",
        "tutorials_listing",
        "video",
        "video_showcase",
        "video_transcript",
        "whitepapers_listing",
      ],
      type: "bloks",
    }),
    defineField("tab-64feb046-a030-4c15-8a32-53f34077f6cd", {
      type: "tab",
    }),
    defineField("tab-2586dfb6-775e-4464-a65d-80699fb28004", {
      type: "tab",
    }),
    defineField("tab-251172ee-a227-49fa-a8be-de29741443c3", {
      type: "tab",
    }),
    defineField("tab-f2a1687e-58c5-499c-bc9d-31ba6b34bdeb", {
      type: "tab",
    }),
    defineField("enable_external_link", {
      type: "boolean",
    }),
    defineField("external_link", {
      type: "multilink",
    }),
    defineField("width", {
      options: [
        {
          name: "Default",
          value: "default",
        },
        {
          name: "Wide",
          value: "wide",
        },
      ],
      type: "option",
    }),
  ],
});

const accordionCarouselBlock = defineBlock({ name: "accordion_carousel", fields: [] });
const actionBoxWithOptionalCtaBlock = defineBlock({
  name: "action_box_with_optional_cta",
  fields: [],
});
const anchorLinkSectionsBlock = defineBlock({ name: "anchor_link_sections", fields: [] });
const animatedTilesBlock = defineBlock({ name: "animated_tiles", fields: [] });
const annotatedImageBlock = defineBlock({ name: "annotated_image", fields: [] });
const bannerSectionBlock = defineBlock({ name: "banner_section", fields: [] });
const blocksGroupBlock = defineBlock({ name: "blocks_group", fields: [] });
const blogEntriesListingBlock = defineBlock({ name: "blog_entries_listing", fields: [] });
const blogHighlightBlock = defineBlock({ name: "blog_highlight", fields: [] });
const blogSliderBlock = defineBlock({ name: "blog_slider", fields: [] });
const boxesSliderBlock = defineBlock({ name: "boxes_slider", fields: [] });
const bulletListsBlock = defineBlock({ name: "bullet_lists", fields: [] });
const cardGridBlock = defineBlock({ name: "card_grid", fields: [] });
const caseStudiesListingBlock = defineBlock({ name: "case_studies_listing", fields: [] });
const caseStudyBigCardBlock = defineBlock({ name: "case_study_big_card", fields: [] });
const codeblockBlock = defineBlock({ name: "codeblock", fields: [] });
const coloredBigCardWithImageAndCtaBlock = defineBlock({
  name: "colored_big_card_with_image_and_cta",
  fields: [],
});
const contentBoardBlock = defineBlock({ name: "content_board", fields: [] });
const contentConfidenceCalculatorBlock = defineBlock({
  name: "content_confidence_calculator",
  fields: [],
});
const contentConfidenceTickerBlock = defineBlock({ name: "content_confidence_ticker", fields: [] });
const cookieSettingsBlock = defineBlock({ name: "cookie_settings", fields: [] });
const ctaImageBlock = defineBlock({ name: "cta_image", fields: [] });
const customBoxesGridBlock = defineBlock({ name: "custom_boxes_grid", fields: [] });
const customRichtextBlock = defineBlock({ name: "custom_richtext", fields: [] });
const customTableBlock = defineBlock({ name: "custom_table", fields: [] });
const customersLogosBlock = defineBlock({ name: "customers_logos", fields: [] });
const demoFormBlock = defineBlock({ name: "demo_form", fields: [] });
const doubleCtaBlock = defineBlock({ name: "double_cta", fields: [] });
const enterpriseBoxGridBlock = defineBlock({ name: "enterprise_box_grid", fields: [] });
const enterpriseCaseStudyReferencesBlock = defineBlock({
  name: "enterprise_case_study_references",
  fields: [],
});
const enterpriseCtaGroupBlock = defineBlock({ name: "enterprise_cta_group", fields: [] });
const enterpriseCtaSectionBlock = defineBlock({ name: "enterprise_cta_section", fields: [] });
const enterpriseFactsBlock = defineBlock({ name: "enterprise_facts", fields: [] });
const enterpriseFaqsBlock = defineBlock({ name: "enterprise_faqs", fields: [] });
const enterprisePageBlock = defineBlock({ name: "enterprise_page", fields: [] });
const enterprisePricingBlock = defineBlock({ name: "enterprise_pricing", fields: [] });
const enterpriseSingleBoxBlock = defineBlock({ name: "enterprise_single_box", fields: [] });
const enterpriseSpacerBlock = defineBlock({ name: "enterprise_spacer", fields: [] });
const enterpriseTextBlock = defineBlock({ name: "enterprise_text", fields: [] });
const enterpriseTextImageBlock = defineBlock({ name: "enterprise_text_image", fields: [] });
const enterpriseVideoBlock = defineBlock({ name: "enterprise_video", fields: [] });
const eventsListingPageBlock = defineBlock({ name: "events_listing_page", fields: [] });
const factsWithImagesBlock = defineBlock({ name: "facts_with_images", fields: [] });
const faqBlock = defineBlock({ name: "faq", fields: [] });
const faqsListingBlock = defineBlock({ name: "faqs_listing", fields: [] });
const featureShowcaseBlock = defineBlock({ name: "feature_showcase", fields: [] });
const footnotesBlock = defineBlock({ name: "footnotes", fields: [] });
const formSectionEnterpriseBlock = defineBlock({ name: "form_section_enterprise", fields: [] });
const heroBlock = defineBlock({ name: "hero", fields: [] });
const heroWithImageCtasBlock = defineBlock({ name: "hero_with_image_ctas", fields: [] });
const hintBlock = defineBlock({ name: "hint", fields: [] });
const imageBlock = defineBlock({ name: "image", fields: [] });
const imageWithDecorationsBlock = defineBlock({ name: "image_with_decorations", fields: [] });
const inContentEventRegistrationBlock = defineBlock({
  name: "in_content_event_registration",
  fields: [],
});
const inContentNestedSharedContentBlock = defineBlock({
  name: "in_content_nested_shared_content",
  fields: [],
});
const inContentSharedContentBlock = defineBlock({ name: "in_content_shared_content", fields: [] });
const inContentTabsBlock = defineBlock({ name: "in_content_tabs", fields: [] });
const jobsListingBlock = defineBlock({ name: "jobs_listing", fields: [] });
const logoGridBlock = defineBlock({ name: "logo_grid", fields: [] });
const mvpCategoryDescriptionsBlock = defineBlock({ name: "mvp_category_descriptions", fields: [] });
const mvpHighlightsBlock = defineBlock({ name: "mvp_highlights", fields: [] });
const mvpsListingBlock = defineBlock({ name: "mvps_listing", fields: [] });
const navatticDemoBlock = defineBlock({ name: "navattic_demo", fields: [] });
const newsletterSectionBlock = defineBlock({ name: "newsletter_section", fields: [] });
const paperCtaBlock = defineBlock({ name: "paper_cta", fields: [] });
const partnersListingBlock = defineBlock({ name: "partners_listing", fields: [] });
const pressListingBlock = defineBlock({ name: "press_listing", fields: [] });
const pricingTableBlock = defineBlock({ name: "pricing_table", fields: [] });
const quizFormBlock = defineBlock({ name: "quiz_form", fields: [] });
const quizResultsBlock = defineBlock({ name: "quiz_results", fields: [] });
const quotesBlock = defineBlock({ name: "quotes", fields: [] });
const richtextHeadingWithDescriptionAndCtasBlock = defineBlock({
  name: "richtext_heading_with_description_and_ctas",
  fields: [],
});
const roadmapBlock = defineBlock({ name: "roadmap", fields: [] });
const roiCalculatorBlock = defineBlock({ name: "roi_calculator", fields: [] });
const scrollingLogosBlock = defineBlock({ name: "scrolling_logos", fields: [] });
const sectionWithBulletListsAndOptionalVideoBlock = defineBlock({
  name: "section_with_bullet_lists_and_optional_video",
  fields: [],
});
const sectionWithNavigationBlock = defineBlock({ name: "section_with_navigation", fields: [] });
const sectionWithQuoteCardBlock = defineBlock({ name: "section_with_quote_card", fields: [] });
const singlePricingBoxBlock = defineBlock({ name: "single_pricing_box", fields: [] });
const socialProofBadgesBlock = defineBlock({ name: "social_proof_badges", fields: [] });
const tabsWithImagesBlock = defineBlock({ name: "tabs_with_images", fields: [] });
const targetedPageBlock = defineBlock({ name: "targeted_page", fields: [] });
const technologyPartnersListingBlock = defineBlock({
  name: "technology_partners_listing",
  fields: [],
});
const textFormBlock = defineBlock({ name: "text_form", fields: [] });
const textLogosLinksBlock = defineBlock({ name: "text_logos_links", fields: [] });
const textQuotesIllustrationBlock = defineBlock({ name: "text_quotes_illustration", fields: [] });
const tilesGridBlock = defineBlock({ name: "tiles_grid", fields: [] });
const timelineBlock = defineBlock({ name: "timeline", fields: [] });
const tutorialsListingBlock = defineBlock({ name: "tutorials_listing", fields: [] });
const videoBlock = defineBlock({ name: "video", fields: [] });
const videoShowcaseBlock = defineBlock({ name: "video_showcase", fields: [] });
const videoTranscriptBlock = defineBlock({ name: "video_transcript", fields: [] });
const videoTranscriptChapterBlock = defineBlock({ name: "video_transcript_chapter", fields: [] });
const whitepapersListingBlock = defineBlock({ name: "whitepapers_listing", fields: [] });

export const schema = defineSchema({
  blocks: {
    blogEntryBlock,
    eventBlock,
    accordionCarouselBlock,
    actionBoxWithOptionalCtaBlock,
    anchorLinkSectionsBlock,
    animatedTilesBlock,
    annotatedImageBlock,
    bannerSectionBlock,
    blocksGroupBlock,
    blogEntriesListingBlock,
    blogHighlightBlock,
    blogSliderBlock,
    boxesSliderBlock,
    bulletListsBlock,
    cardGridBlock,
    caseStudiesListingBlock,
    caseStudyBigCardBlock,
    codeblockBlock,
    coloredBigCardWithImageAndCtaBlock,
    contentBoardBlock,
    contentConfidenceCalculatorBlock,
    contentConfidenceTickerBlock,
    cookieSettingsBlock,
    ctaImageBlock,
    customBoxesGridBlock,
    customRichtextBlock,
    customTableBlock,
    customersLogosBlock,
    demoFormBlock,
    doubleCtaBlock,
    enterpriseBoxGridBlock,
    enterpriseCaseStudyReferencesBlock,
    enterpriseCtaGroupBlock,
    enterpriseCtaSectionBlock,
    enterpriseFactsBlock,
    enterpriseFaqsBlock,
    enterprisePageBlock,
    enterprisePricingBlock,
    enterpriseSingleBoxBlock,
    enterpriseSpacerBlock,
    enterpriseTextBlock,
    enterpriseTextImageBlock,
    enterpriseVideoBlock,
    eventsListingPageBlock,
    factsWithImagesBlock,
    faqBlock,
    faqsListingBlock,
    featureShowcaseBlock,
    footnotesBlock,
    formSectionEnterpriseBlock,
    heroBlock,
    heroWithImageCtasBlock,
    hintBlock,
    imageBlock,
    imageWithDecorationsBlock,
    inContentEventRegistrationBlock,
    inContentNestedSharedContentBlock,
    inContentSharedContentBlock,
    inContentTabsBlock,
    jobsListingBlock,
    logoGridBlock,
    mvpCategoryDescriptionsBlock,
    mvpHighlightsBlock,
    mvpsListingBlock,
    navatticDemoBlock,
    newsletterSectionBlock,
    paperCtaBlock,
    partnersListingBlock,
    pressListingBlock,
    pricingTableBlock,
    quizFormBlock,
    quizResultsBlock,
    quotesBlock,
    richtextHeadingWithDescriptionAndCtasBlock,
    roadmapBlock,
    roiCalculatorBlock,
    scrollingLogosBlock,
    sectionWithBulletListsAndOptionalVideoBlock,
    sectionWithNavigationBlock,
    sectionWithQuoteCardBlock,
    singlePricingBoxBlock,
    socialProofBadgesBlock,
    tabsWithImagesBlock,
    targetedPageBlock,
    technologyPartnersListingBlock,
    textFormBlock,
    textLogosLinksBlock,
    textQuotesIllustrationBlock,
    tilesGridBlock,
    timelineBlock,
    tutorialsListingBlock,
    videoBlock,
    videoShowcaseBlock,
    videoTranscriptBlock,
    videoTranscriptChapterBlock,
    whitepapersListingBlock,
  },
});

export type Before = Schema<typeof schema>;

/** The version of the snapshot format, for the tools that read this file. */
export const snapshotFormat = 1;

/** Blocks in the space whose fields are not part of this snapshot. */
export const nameOnlyBlocks: string[] = [
  "accordion_carousel",
  "accordion_carousel_item",
  "action_box_item",
  "action_box_with_optional_cta",
  "anchor_link_section",
  "anchor_link_section_item",
  "anchor_link_sections",
  "animated_tile",
  "animated_tiles",
  "annotated_image",
  "app_store_banner",
  "apps",
  "author",
  "banner_section",
  "blocks_group",
  "blog_category_listing_page",
  "blog_entries_category_listing",
  "blog_entries_listing",
  "blog_highlight",
  "blog_slider",
  "boxes_slider",
  "boxes_slider_box",
  "bullet_list",
  "bullet_list_item",
  "bullet_lists",
  "card_grid",
  "card_with_image_and_overlay",
  "card_with_logo",
  "card_with_text",
  "case_studies_listing",
  "case_study_big_card",
  "changelog_entry_v2",
  "changelog_link",
  "changelog_links",
  "changelog_richtext",
  "changelogs",
  "codeblock",
  "colored_big_card_with_image_and_cta",
  "configuration",
  "content_board",
  "content_board_list",
  "content_board_list_item",
  "content_confidence_calculator",
  "content_confidence_ticker",
  "content_confidence_ticker_stats",
  "content_confidence_ticker_stats_item",
  "cookie_group",
  "cookie_settings",
  "cta_image",
  "custom_boxes_grid",
  "custom_boxes_grid_small_box",
  "custom_richtext",
  "custom_table",
  "customers_logos",
  "demo_form",
  "demo_form_g2_score",
  "demo_form_logos",
  "demo_form_quote",
  "double_cta",
  "double_cta_cta",
  "enterprise_box_grid",
  "enterprise_case_study_references",
  "enterprise_cta_group",
  "enterprise_cta_section",
  "enterprise_facts",
  "enterprise_faqs",
  "enterprise_page",
  "enterprise_pricing",
  "enterprise_single_box",
  "enterprise_single_box_image",
  "enterprise_spacer",
  "enterprise_text",
  "enterprise_text_image",
  "enterprise_video",
  "events_listing",
  "events_listing_page",
  "facts_with_images",
  "faq",
  "faq_item",
  "faqs_listing",
  "feature_item",
  "feature_showcase",
  "featured_search_result",
  "footer_navigation_item",
  "footer_social",
  "footnote",
  "footnotes",
  "form_section_enterprise",
  "gated_content",
  "hero",
  "hero_with_image_ctas",
  "hint",
  "image",
  "image_with_decorations",
  "in_content_event_registration",
  "in_content_nested_shared_content",
  "in_content_shared_content",
  "in_content_tab",
  "in_content_tabs",
  "jobs_listing",
  "logo",
  "logo_grid",
  "logo_grid_item",
  "metric",
  "mvp",
  "mvp_category_descriptions",
  "mvp_category_summaries",
  "mvp_contribution_entry",
  "mvp_highlights",
  "mvp_program_entry",
  "mvps_listing",
  "navattic_demo",
  "navigation_category",
  "navigation_category_item",
  "navigation_group",
  "navigation_item",
  "navigation_menu",
  "new_quote",
  "newsletter_section",
  "paper_cta",
  "partner",
  "partners_listing",
  "press_entry",
  "press_listing",
  "pricing_feature",
  "pricing_plan",
  "pricing_table",
  "pricing_table_section",
  "quiz_category",
  "quiz_configuration",
  "quiz_form",
  "quiz_profile",
  "quiz_response_option",
  "quiz_response_single_option",
  "quiz_results",
  "quotes",
  "quotes_item",
  "richtext_heading_with_description_and_ctas",
  "roadmap",
  "roadmap_category",
  "roi_benefits_info",
  "roi_calculator",
  "scrolling_logos",
  "search",
  "section_with_bullet_lists_and_optional_video",
  "section_with_navigation",
  "section_with_navigation_subsection",
  "section_with_quote_card",
  "single_pricing_box",
  "social_proof_badges",
  "tab_with_image",
  "tabs_with_images",
  "targeted_page",
  "technology_partner",
  "technology_partners_listing",
  "text_form",
  "text_logos_links",
  "text_logos_links_group",
  "text_logos_links_logo",
  "text_quotes_illustration",
  "text_quotes_illustration_link",
  "tile",
  "tiles_grid",
  "timeline",
  "timeline_step",
  "tutorials_listing",
  "video",
  "video_asset",
  "video_showcase",
  "video_showcase_slide",
  "video_speaker",
  "video_transcript",
  "video_transcript_chapter",
  "whitepaper",
  "whitepapers_listing",
];
