"use client";
import { storyblokEditable } from "@storyblok/react";
import { useMemo, useEffect, useState } from "react";
import { client } from "@/lib/client";
import { ISbStoryData } from "@storyblok/js";
import type { ArticlePage, Category } from "@/lib/types";
import H1Headline from "../components/H1Headline";
import ArticleCardVertical from "../components/ArticleCardVertical";
import getGridClasses from "@/lib/getGridClasses";

interface CategoryComponentProps {
  blok: Category;
  story?: ISbStoryData;
}

export default function CategoryComponent({
  blok,
  story,
}: CategoryComponentProps) {
  const [articles, setArticles] = useState<ISbStoryData<ArticlePage>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const gridClasses = useMemo(() => getGridClasses(), []);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        setIsLoading(true);
        const response = await client.get("cdn/stories", {
          version: "draft",
          starts_with: "articles",
          filter_query: {
            categories: {
              in_array: story?.uuid,
            },
          },
          resolve_relations: ["article-page.categories"],
          resolve_links: "url",
          from_release: "0",
        });
        setArticles(response.data.stories);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch articles"
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (story?.uuid) {
      fetchArticles();
    }
  }, [story?.uuid]);

  if (isLoading) {
    return (
      <section
        {...storyblokEditable(blok)}
        className="page-section category py-16 lg:py-24"
      >
        <div className="container">
          <div className="text-center py-12">Loading articles...</div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        {...storyblokEditable(blok)}
        className="page-section category py-16 lg:py-24"
      >
        <div className="container">
          <div className="text-center py-12 text-red-600">Error: {error}</div>
        </div>
      </section>
    );
  }

  return (
    <section
      {...storyblokEditable(blok)}
      className="page-section category py-16 lg:py-24"
    >
      <div className="container">
        {blok.headline && <H1Headline>{blok.headline}</H1Headline>}
        {articles.length > 0 && (
          <div className={gridClasses}>
            {articles.map((article) => (
              <ArticleCardVertical
                key={article.uuid}
                article={article}
                slug={article.full_slug}
              />
            ))}
          </div>
        )}
        {articles.length === 0 && (
          <div className="text-center py-12">
            No articles found in this category.
          </div>
        )}
      </div>
    </section>
  );
}
