import type { Block } from "../schema/schema";

type Multilink = NonNullable<Block<"card">["link"]>;

/** Resolves a multilink to an href, for both the story and the url linktype. */
export function linkHref(link: Multilink | null | undefined): string | undefined {
  if (!link) {
    return undefined;
  }
  if (link.linktype === "story") {
    return link.cached_url ? `/${link.cached_url}` : undefined;
  }
  return link.url || link.cached_url || undefined;
}
