import { storyblokEditable, StoryblokRichText } from "@storyblok/react";
import type { ArticlePage } from "@/lib/types";
import H1Headline from "../components/H1Headline";
import CategoriesList from "../components/CategoriesList";
import DecorationImageTopRight from "../components/DecorationImageTopRight";
import Banner from "./Banner";

interface ArticlePageComponentProps {
  blok: ArticlePage;
}

export default function ArticlePageComponent({
  blok,
}: ArticlePageComponentProps) {
  return (
    <article {...storyblokEditable(blok)}>
      <div className="container">
        <header>
          <div className="mx-auto mb-12 max-w-2xl text-center">
            {blok?.categories && blok.categories.length > 0 && (
              <CategoriesList
                categories={blok.categories}
                className="mt-12 flex justify-center space-x-4"
              />
            )}
            {blok.headline && <H1Headline>{blok.headline}</H1Headline>}
          </div>
          {blok.image?.filename && (
            <div className="px-4 lg:px-0">
              <div className="relative">
                <DecorationImageTopRight className="absolute right-0 top-0 origin-top-right translate-x-[20px] translate-y-[25px] scale-50 md:translate-x-[40px] md:translate-y-[-50px] md:scale-100" />
                <img
                  src={blok.image.filename}
                  alt={blok.image.alt || ""}
                  className="h-auto w-full rounded-xl"
                />
              </div>
            </div>
          )}
        </header>
        {blok.text && (
          <main className="prose prose-lg mx-auto my-12">
            <StoryblokRichText doc={blok.text} />
          </main>
        )}
      </div>
      {blok?.call_to_action &&
        blok.call_to_action.length > 0 &&
        typeof blok.call_to_action[0] !== "string" && (
          <Banner blok={blok.call_to_action[0].content} />
        )}
    </article>
  );
}
