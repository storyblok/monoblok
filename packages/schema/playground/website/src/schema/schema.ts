import { defineSchema } from "@storyblok/schema";
import type { Schema as InferSchema, Story as InferStory } from "@storyblok/schema";
import type { BlockContent, MapiStory as InferStoryMapi } from "@storyblok/schema";

import { accordionCarouselBlock } from "./blocks/enterprise-body/accordion-carousel";
import { accordionCarouselItemBlock } from "./blocks/accordion-carousel-item";
import { actionBoxItemBlock } from "./blocks/action-box-item";
import { actionBoxWithOptionalCtaBlock } from "./blocks/enterprise-body/action-box-with-optional-cta";
import { anchorLinkSectionBlock } from "./blocks/enterprise-body/anchor-link-section";
import { anchorLinkSectionItemBlock } from "./blocks/enterprise-body/anchor-link-section-item";
import { anchorLinkSectionsBlock } from "./blocks/enterprise-body/anchor-link-sections";
import { animatedTileBlock } from "./blocks/animated-tile";
import { animatedTilesBlock } from "./blocks/enterprise-body/animated-tiles";
import { annotatedImageBlock } from "./blocks/root-body/annotated-image";
import { appsBlock } from "./blocks/apps/apps";
import { appStoreBannerBlock } from "./blocks/apps/app-store-banner";
import { authorBlock } from "./blocks/author";
import { bannerSectionBlock } from "./blocks/enterprise-body/banner-section";
import { blocksGroupBlock } from "./blocks/enterprise-body/blocks-group";
import { blogCategoryListingPageBlock } from "./blocks/blog/blog-category-listing-page";
import { blogEntriesCategoryListingBlock } from "./blocks/blog/blog-entries-category-listing";
import { blogEntriesListingBlock } from "./blocks/blog/blog-entries-listing";
import { blogEntryBlock } from "./blocks/blog/blog-entry";
import { blogHighlightBlock } from "./blocks/blog/blog-highlight";
import { blogSliderBlock } from "./blocks/blog/blog-slider";
import { boxesSliderBlock } from "./blocks/enterprise-body/boxes-slider";
import { boxesSliderBoxBlock } from "./blocks/boxes-slider-box";
import { bulletListBlock } from "./blocks/bullet-list";
import { bulletListItemBlock } from "./blocks/bullet-list-item";
import { bulletListsBlock } from "./blocks/enterprise-body/bullet-lists";
import { cardGridBlock } from "./blocks/enterprise-body/card-grid";
import { cardWithImageAndOverlayBlock } from "./blocks/card-with-image-and-overlay";
import { cardWithLogoBlock } from "./blocks/card-with-logo";
import { cardWithTextBlock } from "./blocks/card-with-text";
import { caseStudiesListingBlock } from "./blocks/enterprise-body/case-studies-listing";
import { caseStudyBigCardBlock } from "./blocks/enterprise-body/case-study-big-card";
import { changelogEntryBlock } from "./blocks/changelog/changelog-entry";
import { changelogLinkBlock } from "./blocks/changelog/changelog-link";
import { changelogLinksBlock } from "./blocks/changelog/changelog-links";
import { changelogRichtextBlock } from "./blocks/changelog/changelog-richtext";
import { changelogsBlock } from "./blocks/changelog/changelogs";
import { codeblockBlock } from "./blocks/root-body/codeblock";
import { coloredBigCardWithImageAndCtaBlock } from "./blocks/enterprise-body/colored-big-card-with-image-and-cta";
import { configurationBlock } from "./blocks/configuration/configuration";
import { contentBoardBlock } from "./blocks/enterprise-body/content-board";
import { contentBoardListBlock } from "./blocks/content-board-list";
import { contentBoardListItemBlock } from "./blocks/content-board-list-item";
import { contentConfidenceCalculatorBlock } from "./blocks/content-confidence/content-confidence-calculator";
import { contentConfidenceTickerBlock } from "./blocks/content-confidence/content-confidence-ticker";
import { contentConfidenceTickerStatsBlock } from "./blocks/content-confidence/content-confidence-ticker-stats";
import { contentConfidenceTickerStatsItemBlock } from "./blocks/content-confidence/content-confidence-ticker-stats-item";
import { cookieGroupBlock } from "./blocks/cookie-group";
import { cookieSettingsBlock } from "./blocks/enterprise-body/cookie-settings";
import { ctaImageBlock } from "./blocks/enterprise-body/cta-image";
import { customBoxesGridBlock } from "./blocks/enterprise-body/custom-boxes-grid";
import { customBoxesGridSmallBoxBlock } from "./blocks/custom-boxes-grid-small-box";
import { customersLogosBlock } from "./blocks/enterprise-body/customers-logos";
import { customRichtextBlock } from "./blocks/root-body/custom-richtext";
import { customTableBlock } from "./blocks/root-body/custom-table";
import { demoFormBlock } from "./blocks/demo-form";
import { demoFormG2ScoreBlock } from "./blocks/demo-form-g2-score";
import { demoFormLogosBlock } from "./blocks/demo-form-logos";
import { demoFormQuoteBlock } from "./blocks/demo-form-quote";
import { doubleCtaBlock } from "./blocks/enterprise-body/double-cta";
import { doubleCtaCtaBlock } from "./blocks/deprecated-body/double-cta-cta";
import { enterpriseBoxGridBlock } from "./blocks/enterprise-body/enterprise-box-grid";
import { enterpriseCaseStudyReferencesBlock } from "./blocks/enterprise-body/enterprise-case-study-references";
import { enterpriseCtaGroupBlock } from "./blocks/enterprise-body/enterprise-cta-group";
import { enterpriseCtaSectionBlock } from "./blocks/enterprise-body/enterprise-cta-section";
import { enterpriseFactsBlock } from "./blocks/enterprise-body/enterprise-facts";
import { enterpriseFaqsBlock } from "./blocks/enterprise-body/enterprise-faqs";
import { enterprisePageBlock } from "./blocks/enterprise-page";
import { enterprisePricingBlock } from "./blocks/enterprise-body/enterprise-pricing";
import { enterpriseSingleBoxBlock } from "./blocks/enterprise-body/enterprise-single-box";
import { enterpriseSingleBoxImageBlock } from "./blocks/enterprise-single-box-image";
import { enterpriseSpacerBlock } from "./blocks/enterprise-body/enterprise-spacer";
import { enterpriseTextBlock } from "./blocks/enterprise-body/enterprise-text";
import { enterpriseTextImageBlock } from "./blocks/enterprise-body/enterprise-text-image";
import { enterpriseVideoBlock } from "./blocks/enterprise-body/enterprise-video";
import { eventBlock } from "./blocks/event/event";
import { eventsListingBlock } from "./blocks/event/events-listing";
import { eventsListingPageBlock } from "./blocks/event/events-listing-page";
import { factsWithImagesBlock } from "./blocks/enterprise-body/facts-with-images";
import { faqBlock } from "./blocks/faq";
import { faqItemBlock } from "./blocks/faq-item";
import { faqsListingBlock } from "./blocks/enterprise-body/faqs-listing";
import { featuredSearchResultBlock } from "./blocks/search/featured-search-result";
import { featureItemBlock } from "./blocks/feature-item";
import { featureShowcaseBlock } from "./blocks/enterprise-body/feature-showcase";
import { footerNavigationItemBlock } from "./blocks/configuration/footer-navigation-item";
import { footerSocialBlock } from "./blocks/configuration/footer-social";
import { footnoteBlock } from "./blocks/footnote";
import { footnotesBlock } from "./blocks/enterprise-body/footnotes";
import { formSectionEnterpriseBlock } from "./blocks/enterprise-body/form-section-enterprise";
import { gatedContentBlock } from "./blocks/gated-content";
import { heroBlock } from "./blocks/enterprise-body/hero";
import { heroWithImageCtasBlock } from "./blocks/enterprise-body/hero-with-image-ctas";
import { hintBlock } from "./blocks/root-body/hint";
import { imageBlock } from "./blocks/root-body/image";
import { imageWithDecorationsBlock } from "./blocks/enterprise-body/image-with-decorations";
import { inContentEventRegistrationBlock } from "./blocks/root-body/in-content-event-registration";
import { inContentNestedSharedContentBlock } from "./blocks/root-body/in-content-nested-shared-content";
import { inContentSharedContentBlock } from "./blocks/in-content-shared-content";
import { inContentTabBlock } from "./blocks/in-content-tab";
import { inContentTabsBlock } from "./blocks/root-body/in-content-tabs";
import { jobsListingBlock } from "./blocks/enterprise-body/jobs-listing";
import { logoBlock } from "./blocks/logo";
import { logoGridBlock } from "./blocks/enterprise-body/logo-grid";
import { logoGridItemBlock } from "./blocks/logo-grid-item";
import { metricBlock } from "./blocks/enterprise-body/metric";
import { mvpBlock } from "./blocks/mvp/mvp";
import { mvpCategoryDescriptionsBlock } from "./blocks/mvp/mvp-category-descriptions";
import { mvpCategorySummariesBlock } from "./blocks/mvp/mvp-category-summaries";
import { mvpContributionEntryBlock } from "./blocks/mvp/mvp-contribution-entry";
import { mvpHighlightsBlock } from "./blocks/mvp/mvp-highlights";
import { mvpProgramEntryBlock } from "./blocks/mvp/mvp-program-entry";
import { mvpsListingBlock } from "./blocks/mvp/mvps-listing";
import { navatticDemoBlock } from "./blocks/enterprise-body/navattic-demo";
import { navigationCategoryBlock } from "./blocks/configuration/navigation-category";
import { navigationCategoryItemBlock } from "./blocks/configuration/navigation-category-item";
import { navigationGroupBlock } from "./blocks/configuration/navigation-group";
import { navigationItemBlock } from "./blocks/configuration/navigation-item";
import { navigationMenuBlock } from "./blocks/configuration/navigation-menu";
import { newQuoteBlock } from "./blocks/new-quote";
import { newsletterSectionBlock } from "./blocks/enterprise-body/newsletter-section";
import { paperCtaBlock } from "./blocks/enterprise-body/paper-cta";
import { partnerBlock } from "./blocks/partner";
import { partnersListingBlock } from "./blocks/enterprise-body/partners-listing";
import { pressEntryBlock } from "./blocks/press-entry";
import { pressListingBlock } from "./blocks/enterprise-body/press-listing";
import { pricingFeatureBlock } from "./blocks/pricing-feature";
import { pricingPlanBlock } from "./blocks/pricing-plan";
import { pricingTableBlock } from "./blocks/enterprise-body/pricing-table";
import { pricingTableSectionBlock } from "./blocks/pricing-table-section";
import { quizCategoryBlock } from "./blocks/quiz/quiz-category";
import { quizConfigurationBlock } from "./blocks/quiz/quiz-configuration";
import { quizFormBlock } from "./blocks/quiz/quiz-form";
import { quizProfileBlock } from "./blocks/quiz/quiz-profile";
import { quizResponseOptionBlock } from "./blocks/quiz/quiz-response-option";
import { quizResponseSingleOptionBlock } from "./blocks/quiz/quiz-response-single-option";
import { quizResultsBlock } from "./blocks/quiz/quiz-results";
import { quotesBlock } from "./blocks/enterprise-body/quotes";
import { quotesItemBlock } from "./blocks/quotes-item";
import { richtextHeadingWithDescriptionAndCtasBlock } from "./blocks/enterprise-body/richtext-heading-with-description-and-ctas";
import { roadmapBlock } from "./blocks/enterprise-body/roadmap";
import { roadmapCategoryBlock } from "./blocks/roadmap-category";
import { roiBenefitsInfoBlock } from "./blocks/roi-benefits-info";
import { roiCalculatorBlock } from "./blocks/roi-calculator";
import { scrollingLogosBlock } from "./blocks/enterprise-body/scrolling-logos";
import { searchBlock } from "./blocks/search/search";
import { sectionWithBulletListsAndOptionalVideoBlock } from "./blocks/enterprise-body/section-with-bullet-lists-and-optional-video";
import { sectionWithNavigationBlock } from "./blocks/enterprise-body/section-with-navigation";
import { sectionWithNavigationSubsectionBlock } from "./blocks/section-with-navigation-subsection";
import { sectionWithQuoteCardBlock } from "./blocks/enterprise-body/section-with-quote-card";
import { singlePricingBoxBlock } from "./blocks/enterprise-body/single-pricing-box";
import { socialProofBadgesBlock } from "./blocks/enterprise-body/social-proof-badges";
import { tabsWithImagesBlock } from "./blocks/enterprise-body/tabs-with-images";
import { tabWithImageBlock } from "./blocks/enterprise-body/tab-with-image";
import { targetedPageBlock } from "./blocks/targeted-page";
import { technologyPartnerBlock } from "./blocks/technology-partner";
import { technologyPartnersListingBlock } from "./blocks/enterprise-body/technology-partners-listing";
import { textFormBlock } from "./blocks/enterprise-body/text-form";
import { textLogosLinksBlock } from "./blocks/root-body/text-logos-links";
import { textLogosLinksGroupBlock } from "./blocks/text-logos-links-group";
import { textLogosLinksLogoBlock } from "./blocks/text-logos-links-logo";
import { textQuotesIllustrationBlock } from "./blocks/enterprise-body/text-quotes-illustration";
import { textQuotesIllustrationLinkBlock } from "./blocks/text-quotes-illustration-link";
import { tileBlock } from "./blocks/tile";
import { tilesGridBlock } from "./blocks/enterprise-body/tiles-grid";
import { timelineBlock } from "./blocks/enterprise-body/timeline";
import { timelineStepBlock } from "./blocks/timeline-step";
import { tutorialsListingBlock } from "./blocks/enterprise-body/tutorials-listing";
import { videoBlock } from "./blocks/root-body/video";
import { videoAssetBlock } from "./blocks/video-asset";
import { videoShowcaseBlock } from "./blocks/enterprise-body/video-showcase";
import { videoShowcaseSlideBlock } from "./blocks/video-showcase-slide";
import { videoSpeakerBlock } from "./blocks/video-speaker";
import { videoTranscriptBlock } from "./blocks/root-body/video-transcript";
import { videoTranscriptChapterBlock } from "./blocks/video-transcript-chapter";
import { whitepaperBlock } from "./blocks/whitepaper";
import { whitepapersListingBlock } from "./blocks/enterprise-body/whitepapers-listing";
import { lightColorsForPalettePluginDatasource } from "./datasources/light-colors-for-palette-plugin";
import { lighterColorsForPalettePluginDatasource } from "./datasources/lighter-colors-for-palette-plugin";
import { faqCategoriesDatasource } from "./datasources/faq-categories";
import { lightestColorsForPalettePluginDatasource } from "./datasources/lightest-colors-for-palette-plugin";
import { mvpCategoriesDatasource } from "./datasources/mvp-categories";
import { blogCategoriesDatasource } from "./datasources/blog-categories";
import { lucideIconsDatasource } from "./datasources/lucide-icons";
import { partnersCompanySizesDatasource } from "./datasources/partners-company-sizes";
import { partnersCompetenciesDatasource } from "./datasources/partners-competencies";
import { partnersIndustriesDatasource } from "./datasources/partners-industries";
import { partnersLanguagesDatasource } from "./datasources/partners-languages";
import { shapesDatasource } from "./datasources/shapes";
import { technologiesDatasource } from "./datasources/technologies";
import { categorizedTechnologiesDatasource } from "./datasources/categorized-technologies";
import { technologyPartnersCategoriesDatasource } from "./datasources/technology-partners-categories";
import { footerTypesDatasource } from "./datasources/footer-types";
import { headerTypesDatasource } from "./datasources/header-types";
import { caseStudiesIndustriesDatasource } from "./datasources/case-studies-industries";
import { mediumColorsForPalettePluginDatasource } from "./datasources/medium-colors-for-palette-plugin";
import { technologyPartnersIntegrationStatusesDatasource } from "./datasources/technology-partners-integration-statuses";
import { caseStudiesLayoutDatasource } from "./datasources/case-studies-layout";
import { tutorialsTopicsDatasource } from "./datasources/tutorials-topics";
import { caseStudiesTypesDatasource } from "./datasources/case-studies-types";
import { whitepapersCategoriesDatasource } from "./datasources/whitepapers-categories";
import { changelogCategoriesDatasource } from "./datasources/changelog-categories";
import { darkColorsForPalettePluginDatasource } from "./datasources/dark-colors-for-palette-plugin";
import { colorHuesDatasource } from "./datasources/color-hues";
import { partnersTiersDatasource } from "./datasources/partners-tiers";
import { contentTagsDatasource } from "./datasources/content-tags";
import { darkColorsForPalettePluginCardwithtextOnlyDatasource } from "./datasources/dark-colors-for-palette-plugin-cardwithtext-only";
import { decorationsListDatasource } from "./datasources/decorations-list";
import { pricingPlansDatasource } from "./datasources/pricing-plans";
import { formTemplatesDatasource } from "./datasources/form-templates";
import { gatedContentFormTemplatesDatasource } from "./datasources/gated-content-form-templates";
import { iconsDatasource } from "./datasources/icons";
import {
  appsFolder,
  blogFolder,
  changelogFolder,
  configurationFolder,
  contentConfidenceFolder,
  deprecatedBodyFolder,
  enterpriseBodyFolder,
  eventFolder,
  mvpFolder,
  quizFolder,
  rootBodyFolder,
  searchFolder,
} from "./folders";
import { nativeColorPickerFieldPlugin } from "./field-plugins/native-color-picker";

export const schema = defineSchema({
  blocks: {
    accordionCarouselBlock,
    accordionCarouselItemBlock,
    actionBoxItemBlock,
    actionBoxWithOptionalCtaBlock,
    anchorLinkSectionBlock,
    anchorLinkSectionItemBlock,
    anchorLinkSectionsBlock,
    animatedTileBlock,
    animatedTilesBlock,
    annotatedImageBlock,
    appsBlock,
    appStoreBannerBlock,
    authorBlock,
    bannerSectionBlock,
    blocksGroupBlock,
    blogCategoryListingPageBlock,
    blogEntriesCategoryListingBlock,
    blogEntriesListingBlock,
    blogEntryBlock,
    blogHighlightBlock,
    blogSliderBlock,
    boxesSliderBlock,
    boxesSliderBoxBlock,
    bulletListBlock,
    bulletListItemBlock,
    bulletListsBlock,
    cardGridBlock,
    cardWithImageAndOverlayBlock,
    cardWithLogoBlock,
    cardWithTextBlock,
    caseStudiesListingBlock,
    caseStudyBigCardBlock,
    changelogEntryBlock,
    changelogLinkBlock,
    changelogLinksBlock,
    changelogRichtextBlock,
    changelogsBlock,
    codeblockBlock,
    coloredBigCardWithImageAndCtaBlock,
    configurationBlock,
    contentBoardBlock,
    contentBoardListBlock,
    contentBoardListItemBlock,
    contentConfidenceCalculatorBlock,
    contentConfidenceTickerBlock,
    contentConfidenceTickerStatsBlock,
    contentConfidenceTickerStatsItemBlock,
    cookieGroupBlock,
    cookieSettingsBlock,
    ctaImageBlock,
    customBoxesGridBlock,
    customBoxesGridSmallBoxBlock,
    customersLogosBlock,
    customRichtextBlock,
    customTableBlock,
    demoFormBlock,
    demoFormG2ScoreBlock,
    demoFormLogosBlock,
    demoFormQuoteBlock,
    doubleCtaBlock,
    doubleCtaCtaBlock,
    enterpriseBoxGridBlock,
    enterpriseCaseStudyReferencesBlock,
    enterpriseCtaGroupBlock,
    enterpriseCtaSectionBlock,
    enterpriseFactsBlock,
    enterpriseFaqsBlock,
    enterprisePageBlock,
    enterprisePricingBlock,
    enterpriseSingleBoxBlock,
    enterpriseSingleBoxImageBlock,
    enterpriseSpacerBlock,
    enterpriseTextBlock,
    enterpriseTextImageBlock,
    enterpriseVideoBlock,
    eventBlock,
    eventsListingBlock,
    eventsListingPageBlock,
    factsWithImagesBlock,
    faqBlock,
    faqItemBlock,
    faqsListingBlock,
    featuredSearchResultBlock,
    featureItemBlock,
    featureShowcaseBlock,
    footerNavigationItemBlock,
    footerSocialBlock,
    footnoteBlock,
    footnotesBlock,
    formSectionEnterpriseBlock,
    gatedContentBlock,
    heroBlock,
    heroWithImageCtasBlock,
    hintBlock,
    imageBlock,
    imageWithDecorationsBlock,
    inContentEventRegistrationBlock,
    inContentNestedSharedContentBlock,
    inContentSharedContentBlock,
    inContentTabBlock,
    inContentTabsBlock,
    jobsListingBlock,
    logoBlock,
    logoGridBlock,
    logoGridItemBlock,
    metricBlock,
    mvpBlock,
    mvpCategoryDescriptionsBlock,
    mvpCategorySummariesBlock,
    mvpContributionEntryBlock,
    mvpHighlightsBlock,
    mvpProgramEntryBlock,
    mvpsListingBlock,
    navatticDemoBlock,
    navigationCategoryBlock,
    navigationCategoryItemBlock,
    navigationGroupBlock,
    navigationItemBlock,
    navigationMenuBlock,
    newQuoteBlock,
    newsletterSectionBlock,
    paperCtaBlock,
    partnerBlock,
    partnersListingBlock,
    pressEntryBlock,
    pressListingBlock,
    pricingFeatureBlock,
    pricingPlanBlock,
    pricingTableBlock,
    pricingTableSectionBlock,
    quizCategoryBlock,
    quizConfigurationBlock,
    quizFormBlock,
    quizProfileBlock,
    quizResponseOptionBlock,
    quizResponseSingleOptionBlock,
    quizResultsBlock,
    quotesBlock,
    quotesItemBlock,
    richtextHeadingWithDescriptionAndCtasBlock,
    roadmapBlock,
    roadmapCategoryBlock,
    roiBenefitsInfoBlock,
    roiCalculatorBlock,
    scrollingLogosBlock,
    searchBlock,
    sectionWithBulletListsAndOptionalVideoBlock,
    sectionWithNavigationBlock,
    sectionWithNavigationSubsectionBlock,
    sectionWithQuoteCardBlock,
    singlePricingBoxBlock,
    socialProofBadgesBlock,
    tabsWithImagesBlock,
    tabWithImageBlock,
    targetedPageBlock,
    technologyPartnerBlock,
    technologyPartnersListingBlock,
    textFormBlock,
    textLogosLinksBlock,
    textLogosLinksGroupBlock,
    textLogosLinksLogoBlock,
    textQuotesIllustrationBlock,
    textQuotesIllustrationLinkBlock,
    tileBlock,
    tilesGridBlock,
    timelineBlock,
    timelineStepBlock,
    tutorialsListingBlock,
    videoBlock,
    videoAssetBlock,
    videoShowcaseBlock,
    videoShowcaseSlideBlock,
    videoSpeakerBlock,
    videoTranscriptBlock,
    videoTranscriptChapterBlock,
    whitepaperBlock,
    whitepapersListingBlock,
  },
  datasources: {
    lightColorsForPalettePluginDatasource,
    lighterColorsForPalettePluginDatasource,
    faqCategoriesDatasource,
    lightestColorsForPalettePluginDatasource,
    mvpCategoriesDatasource,
    blogCategoriesDatasource,
    lucideIconsDatasource,
    partnersCompanySizesDatasource,
    partnersCompetenciesDatasource,
    partnersIndustriesDatasource,
    partnersLanguagesDatasource,
    shapesDatasource,
    technologiesDatasource,
    categorizedTechnologiesDatasource,
    technologyPartnersCategoriesDatasource,
    footerTypesDatasource,
    headerTypesDatasource,
    caseStudiesIndustriesDatasource,
    mediumColorsForPalettePluginDatasource,
    technologyPartnersIntegrationStatusesDatasource,
    caseStudiesLayoutDatasource,
    tutorialsTopicsDatasource,
    caseStudiesTypesDatasource,
    whitepapersCategoriesDatasource,
    changelogCategoriesDatasource,
    darkColorsForPalettePluginDatasource,
    colorHuesDatasource,
    partnersTiersDatasource,
    contentTagsDatasource,
    darkColorsForPalettePluginCardwithtextOnlyDatasource,
    decorationsListDatasource,
    pricingPlansDatasource,
    formTemplatesDatasource,
    gatedContentFormTemplatesDatasource,
    iconsDatasource,
  },
  folders: {
    appsFolder,
    blogFolder,
    changelogFolder,
    configurationFolder,
    contentConfidenceFolder,
    deprecatedBodyFolder,
    enterpriseBodyFolder,
    eventFolder,
    mvpFolder,
    quizFolder,
    rootBodyFolder,
    searchFolder,
  },
  fieldPlugins: {
    nativeColorPickerFieldPlugin,
  },
});

export type Schema = InferSchema<typeof schema>;
export type Blocks = Schema["blocks"];
export type FieldPlugins = Schema["fieldPlugins"];
export type Story = InferStory<Blocks, FieldPlugins>;
export type StoryMapi = InferStoryMapi<Blocks, FieldPlugins>;

// Type a component's props by block name: `Block<"hero">`.
export type Block<TName extends Blocks["name"]> = BlockContent<
  Extract<Blocks, { name: TName }>,
  Blocks,
  FieldPlugins
>;

// Loose union of every block's content, for a dynamic component dispatcher.
export type AnyBlock = BlockContent<Blocks, Blocks, FieldPlugins>;
