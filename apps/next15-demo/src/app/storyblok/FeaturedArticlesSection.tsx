import { storyblokEditable } from "@storyblok/react";
import type { ArticlePage, FeaturedArticlesSection } from "@/lib/types";
import { useMemo } from "react";
import Headline from "../components/Headline";
import Lead from "../components/Lead";
import ArticleCardVertical from "../components/ArticleCardVertical";
import getGridClasses from "@/lib/getGridClasses";
import { ISbStoryData } from "@storyblok/js";

interface FeaturedArticlesSectionComponentProps {
  blok: FeaturedArticlesSection;
  index?: number;
}

const FeaturedArticlesSectionComponent = ({
  blok,
  index,
}: FeaturedArticlesSectionComponentProps) => {
  const gridClasses = useMemo(() => getGridClasses(blok.cols), [blok.cols]);

  return (
    <section
      {...storyblokEditable(blok)}
      className={`page-section featured-articles-section bg-${blok.background_color || "white"}`}
    >
      <div className="container">
        {blok.headline && (
          <div className="text-center">
            <Headline headline={blok.headline} index={index} />
          </div>
        )}
        {blok.lead && (
          <div className="text-center">
            <Lead>{blok.lead}</Lead>
          </div>
        )}
        {blok.articles && (
          <div className={gridClasses}>
            {blok.articles.map((article) => (
              <ArticleCardVertical
                key={(article as ISbStoryData<ArticlePage>).uuid}
                article={article as ISbStoryData<ArticlePage>}
                slug={(article as ISbStoryData<ArticlePage>).full_slug || ""}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default FeaturedArticlesSectionComponent;
