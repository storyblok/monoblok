/**
 * The catalogue, keyed by the id each migration takes from its filename.
 *
 * It exists for the harness, which runs every row against the committed
 * fixtures. The offline and live runners do not read it: they scan this
 * directory, so a file that is here and not in this map still runs, and a row
 * that stops applying shows up as a failing assertion rather than as a
 * migration quietly dropped from a list.
 */
import type { CompiledMigration } from "@storyblok/schema/migrations";

import renameCardTitle from "./0001-rename-card-title";
import renameNestedAuthorBio from "./0002-rename-nested-author-bio";
import splitAuthorName from "./0003-split-author-name";
import mergeAuthorName from "./0004-merge-author-name";
import coerceCardPrice from "./0005-coerce-card-price";
import removeCardSubtitle from "./0006-remove-card-subtitle";
import addCardSlug from "./0007-add-card-slug";
import pinPageOpener from "./0008-pin-page-opener";
import scopeSlugUnderCard from "./0009-scope-slug-under-card";
import renameTeaserBlock from "./0010-rename-teaser-block";
import singleAssetToList from "./0011-single-asset-to-list";
import rewriteRichtextLinks from "./0012-rewrite-richtext-links";
import storyLinkToUrl from "./0013-story-link-to-url";
import translateCardHeadline from "./0014-translate-card-headline";
import renameCategoryValues from "./0015-rename-category-values";
import wrapPageBody from "./0016-wrap-page-body";
import unwrapPageSections from "./0017-unwrap-page-sections";
import toggles from "./0018-toggles";
import noMatches from "./0019-no-matches";
import pricingTableColumn from "./0020-pricing-table-column";

export const migrations: Record<string, CompiledMigration> = {
  "0001-rename-card-title": renameCardTitle,
  "0002-rename-nested-author-bio": renameNestedAuthorBio,
  "0003-split-author-name": splitAuthorName,
  "0004-merge-author-name": mergeAuthorName,
  "0005-coerce-card-price": coerceCardPrice,
  "0006-remove-card-subtitle": removeCardSubtitle,
  "0007-add-card-slug": addCardSlug,
  "0008-pin-page-opener": pinPageOpener,
  "0009-scope-slug-under-card": scopeSlugUnderCard,
  "0010-rename-teaser-block": renameTeaserBlock,
  "0011-single-asset-to-list": singleAssetToList,
  "0012-rewrite-richtext-links": rewriteRichtextLinks,
  "0013-story-link-to-url": storyLinkToUrl,
  "0014-translate-card-headline": translateCardHeadline,
  "0015-rename-category-values": renameCategoryValues,
  "0016-wrap-page-body": wrapPageBody,
  "0017-unwrap-page-sections": unwrapPageSections,
  "0018-toggles": toggles,
  "0019-no-matches": noMatches,
  "0020-pricing-table-column": pricingTableColumn,
};
