import { type ISbStoryData, type SbBlokData, storyblokEditable } from "@storyblok/react/rsc";

type Post = ISbStoryData | string;

const isResolved = (post: Post): post is ISbStoryData => typeof post === "object" && post !== null;

const FeaturedArticles = ({
  blok,
}: {
  blok: SbBlokData & { heading?: string; posts?: Post[] };
}) => (
  <div {...storyblokEditable(blok)} data-test="featured-articles">
    <h2>{blok.heading}</h2>
    <div className="posts">
      {(blok.posts ?? []).filter(isResolved).map((post) => (
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
