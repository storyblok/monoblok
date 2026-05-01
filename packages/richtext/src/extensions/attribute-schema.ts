import * as v from 'valibot'; // 1.31 kB

export const ImageSchema = v.object({
  id: v.number(),
  alt: v.string(),
  src: v.string(),
  title: v.string(),
  source: v.string(),
  copyright: v.string(),
  meta_data: v.object({
    alt: v.string(),
    title: v.string(),
    source: v.string(),
    copyright: v.string(),
  }),
});
export type StoryblokImageAttrs =
  v.InferOutput<typeof ImageSchema>;

export const EmojiSchema = v.object({
  name: v.string(),
  emoji: v.string(),
  fallbackImage: v.string(),
});
export type StoryblokEmojiAttrs =
  v.InferOutput<typeof EmojiSchema>;

export const LinkSchema = v.object({
  href: v.string(),
  uuid: v.nullable(v.string()),
  anchor: v.nullable(v.string()),
  target: v.nullable(
    v.picklist([
      '_self',
      '_blank',
      '_parent',
      '_top',
    ]),
  ),
  linktype: v.picklist([
    'story',
    'url',
    'email',
    'asset',
  ]),
});
export type StoryblokLinkAttrs =
  v.InferOutput<typeof LinkSchema>;
const createAttributes = (
  schema: { entries: Record<string, unknown> },
) =>
  Object.fromEntries(
    Object.entries(schema.entries).map(([key, value]) => [
      key,
      {
        default: (value as { default?: unknown }).default ?? null,
      },
    ]),
  );

export const imageAttributes = createAttributes(ImageSchema);
export const emojiAttributes = createAttributes(EmojiSchema);
export const linkAttributes = createAttributes(LinkSchema);
