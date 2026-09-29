import type { StoryblokBlockComponentProps } from "@storyblok/react";
import type { Block, Story } from "@/schema/blocks";

type FeaturedArticlesProps = StoryblokBlockComponentProps<
  Omit<Block<"featured-articles">, "posts"> & { posts?: Story[] | null }
>;

const FeaturedArticles = ({ block, editable }: FeaturedArticlesProps) => (
  <div {...editable} data-test="featured-articles">
    <h2>{block.heading}</h2>
    <div className="posts">
      {(block.posts ?? []).map((post) => (
        <div className="post" data-test="featured-article-post" key={post.full_slug}>
          <p className="post-title">{post.name}</p>
          <a className="post-link" href={`/${post.full_slug}`}>
            Read full article
          </a>
        </div>
      ))}
    </div>
  </div>
);

export default FeaturedArticles;
