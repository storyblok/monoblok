import { client } from "./client";

export const resolveRelations = [
  "banner-reference.banners",
  "featured-articles-section.articles",
  "article-page.categories",
  "article-page.author",
  "article-page.call_to_action",
  "testimonials-section.testimonials",
]

export const getStory = async (slug: string) => {
  return client.get(`cdn/stories/${slug}`, {
    version: "draft",
    resolve_relations: resolveRelations,
    resolve_links: "url",
    from_release: "0",
    resolve_level: 2,
  }, {
    next: {
      revalidate: 3600,
    },
  })
};
