import type { ArticlePage } from "../../../.storyblok/types/286726323865714/storyblok-components";
import { ISbStoryData } from "@storyblok/js";
import CategoriesList from "./CategoriesList";
import ReadMoreLink from "./ReadMoreLink";

interface ArticleCardVerticalProps {
  article: ISbStoryData<ArticlePage>;
  slug: string;
  layout?: string;
}

export default function ArticleCardVertical({ article, slug, layout }: ArticleCardVerticalProps) {
  if (!article) return null;

  const optimizedImage = article.content.image?.filename 
    ? `${article.content.image.filename}/m/800x600` 
    : null;

  return (
    <div className="flex h-full flex-col">
      {optimizedImage && (
        <img
          src={optimizedImage}
          alt={article.content.image?.alt || ""}
          className="mb-6 rounded-xl sm:max-w-sm md:max-w-full"
        />
      )}
      <div className="flex h-full flex-col">
        <div className="flex grow flex-col space-y-4">
          {article.content.categories && article.content.categories.length > 0 && (
            <CategoriesList 
              categories={article.content.categories} 
              className="flex space-x-4" 
            />
          )}
          {article.content.headline && (
            <h3 className="font-display text-2xl font-black">
              {article.content.headline}
            </h3>
          )}
        </div>
        <ReadMoreLink href={`/${slug}`} title={article.content.headline || ""} />
      </div>
    </div>
  );
}
