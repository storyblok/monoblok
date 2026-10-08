const _METHOD = {
  GET: "get",
  DELETE: "delete",
  POST: "post",
  PUT: "put",
  PATCH: "patch",
} as const;

type ObjectValues<T> = T[keyof T];
type Method = ObjectValues<typeof _METHOD>;

export default Method;

export const StoryblokContentVersion = {
  DRAFT: "draft",
  PUBLISHED: "published",
} as const;

export type StoryblokContentVersionKeys =
  (typeof StoryblokContentVersion)[keyof typeof StoryblokContentVersion];

export const StoryblokContentVersionValues = Object.values(
  StoryblokContentVersion,
) as StoryblokContentVersionKeys[];
