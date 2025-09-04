import type { ArticlePage } from "../../../.storyblok/types/286726323865714/storyblok-components";
import { ISbStoryData } from "@storyblok/js";
import CategoriesList from "./CategoriesList";
import ReadMoreLink from "./ReadMoreLink";

interface ArticleCardHorizontalProps {
  article: ISbStoryData<ArticlePage>;
  slug: string;
}

export default function ArticleCardHorizontal({ article, slug }: ArticleCardHorizontalProps) {
  if (!article) return null;

  const optimizedImage = article.content.image?.filename 
    ? `${article.content.image.filename}/m/400x400` 
    : null;

  return (
    <div className="article-card border-medium flex flex-col gap-6 border-b pb-12 md:grow md:flex-row md:justify-between">
      {optimizedImage && (
        <img
          src={optimizedImage}
          alt={article.content.image?.alt || ""}
          width={200}
          height={200}
          className="aspect-square size-[200px] rounded-xl md:order-1"
        />
      )}
      <div>
        {article.content.categories && article.content.categories.length > 0 && (
          <CategoriesList 
            categories={article.content.categories} 
            className="mb-4 flex gap-4 lg:flex-col xl:flex-row" 
          />
        )}
        {article.content.headline && (
          <h3 className="font-display text-2xl font-black">
            {article.content.headline}
          </h3>
        )}
        <ReadMoreLink href={`/${slug}`} title={article.content.headline || ""} />
      </div>
    </div>
  );
}
