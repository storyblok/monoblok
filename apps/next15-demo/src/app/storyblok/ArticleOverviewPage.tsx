"use client";
import { storyblokEditable } from "@storyblok/react";
import type { ArticleOverviewPage } from "@/lib/types";
import { useState } from "react";
import useSWR from "swr";
import H1Headline from "../components/H1Headline";
import ArticleCardVertical from "../components/ArticleCardVertical";
import getGridClasses from "@/lib/getGridClasses";
import { ISbStoryData, ISbStoriesParams } from "@storyblok/js";
import type {
  ArticlePage,
  Category,
} from "../../../.storyblok/types/286726323865714/storyblok-components";
import { client } from "@/lib/client";

interface ArticleOverviewPageComponentProps {
  blok: ArticleOverviewPage;
}

// SWR fetcher function for articles using existing Storyblok client
const fetchStories = async (params: ISbStoriesParams) => {
  const response = await client.get("cdn/stories", params);
  return response.data.stories.filter(
    (story: any) => story.is_startpage !== true
  );
};

export default function ArticleOverviewPageComponent({
  blok,
}: ArticleOverviewPageComponentProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [checkedCategory, setCheckedCategory] = useState("");

  const gridClasses = getGridClasses();

  // Fetch categories using SWR
  const {
    data: categories = [],
    error: categoriesError,
    isLoading: categoriesLoading,
  } = useSWR<ISbStoryData<Category>[]>(
    {
      version: "draft",
      starts_with: "categories",
    },
    fetchStories,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5 minutes
    }
  );

  const {
    data: articles = [],
    error: articlesError,
    isLoading: articlesLoading,
    mutate: mutateArticles,
  } = useSWR<ISbStoryData<ArticlePage>[]>(
    {
      version: "draft",
      starts_with: "articles",
      search_term: searchTerm || undefined,
      filter_query: checkedCategory
        ? { categories: { in: checkedCategory } }
        : undefined,
      resolve_relations: ["article-page.categories"],
      from_release: "0",
      resolve_level: 2,
    },
    fetchStories,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
    }
  );

  const handleSearch = () => {
    mutateArticles();
  };

  const handleCategoryChange = (categoryId: string) => {
    setCheckedCategory(categoryId);
  };

  const resetCategories = () => {
    setCheckedCategory("");
  };

  return (
    <section {...storyblokEditable(blok as any)} className="container">
      <header>
        {blok.headline && <H1Headline>{blok.headline}</H1Headline>}
        <nav>
          <div className="mb-12 flex justify-center">
            <label htmlFor="search" className="sr-only">
              Search
            </label>
            <input
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              type="search"
              name="search"
              placeholder="Search for anything"
              className="focus-ring border-dark rounded-lg border-2 px-12 py-4 text-xl"
            />
          </div>
          <div className="border-medium mb-12 flex flex-col rounded-lg border p-1 lg:flex-row">
            <button
              className={`w-full cursor-pointer rounded-md px-6 py-3 text-center text-lg ${
                !checkedCategory
                  ? "bg-primary-dark text-white"
                  : "text-primary-dark"
              }`}
              onClick={resetCategories}
            >
              All
            </button>
            {categories.map((category: ISbStoryData<Category>) => (
              <label
                key={category.uuid}
                htmlFor={category.uuid}
                className={`w-full cursor-pointer rounded-md px-6 py-3 text-center text-lg text-primary-dark ${
                  checkedCategory === category.uuid
                    ? "bg-primary-dark text-white"
                    : "text-primary-dark"
                }`}
              >
                <input
                  id={category.uuid}
                  type="radio"
                  name="category"
                  value={category.uuid}
                  checked={checkedCategory === category.uuid}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="sr-only"
                />
                <span>{category.name}</span>
              </label>
            ))}
          </div>
        </nav>
      </header>
      <main className="pb-24">
        {!articlesLoading && articles.length > 0 && (
          <section className={gridClasses}>
            {articles.map((article: ISbStoryData<ArticlePage>) => (
              <ArticleCardVertical
                key={article.uuid}
                article={article as any}
                slug={article.full_slug}
              />
            ))}
          </section>
        )}
        {!articlesLoading && articles.length === 0 && (
          <section>Unfortunately, no articles matched your criteria.</section>
        )}
        {articlesLoading && (
          <section className="text-center py-12">
            <div>Loading articles...</div>
          </section>
        )}
        {articlesError && (
          <section className="text-center py-12 text-red-600">
            <div>Error loading articles. Please try again.</div>
          </section>
        )}
      </main>
    </section>
  );
}
