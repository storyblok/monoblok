import * as v from 'valibot'; // 1.31 kB

/** Attribute schema for node extensions */
const ParagraphSchema = v.object({
  textAlign: v.nullable(v.picklist(['left', 'center', 'right', 'justify'])),
});
const HeadingSchema = v.object({
  textAlign: v.nullable(v.picklist(['left', 'center', 'right', 'justify'])),
});
const CodeBlockSchema = v.object({
  class: v.nullable(v.string()),
});
const OrderedListSchema = v.object({
  order: v.optional(v.number(), 1),
});
const TableCellSchema = v.object({
  colspan: v.optional(v.number(), 1),
  rowspan: v.optional(v.number(), 1),
  colwidth: v.array(v.number()),
  backgroundColor: v.nullable(v.string()),
});
const TableHeaderSchema = v.object({
  colspan: v.optional(v.number(), 1),
  rowspan: v.optional(v.number(), 1),
  colwidth: v.array(v.number()),
});
const ImageSchema = v.object({
  id: v.nullable(v.number()),
  alt: v.nullable(v.string()),
  src: v.string(),
  title: v.nullable(v.string()),
  source: v.nullable(v.string()),
  copyright: v.nullable(v.string()),
  meta_data: v.nullable(v.object({
    alt: v.nullable(v.string()),
    title: v.nullable(v.string()),
    source: v.nullable(v.string()),
    copyright: v.nullable(v.string()),
  })),
});
const EmojiSchema = v.object({
  name: v.string(),
  emoji: v.string(),
  fallbackImage: v.string(),
});

/** Attribute schema for mark extensions */
const LinkSchema = v.object({
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
const HighlightSchema = v.object({
  color: v.string(),
});
const TextStyleSchema = v.object({
  color: v.nullable(v.string()),
  id: v.nullable(v.string()),
  class: v.nullable(v.string()),
});
const AnchorSchema = v.object({
  id: v.string(),
});
const StyledSchema = v.object({
  class: v.nullable(v.string()),
});

/** Helper to create Tiptap extension attributes from a Valibot schema. */
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

/** Node extension schemas with runtime attributes. */
export const nodeSchemas = {
  paragraph: {
    schema: ParagraphSchema,
    attributes: createAttributes(ParagraphSchema),
  },
  heading: {
    schema: HeadingSchema,
    attributes: createAttributes(HeadingSchema),
  },
  code_block: {
    schema: CodeBlockSchema,
    attributes: createAttributes(CodeBlockSchema),
  },
  ordered_list: {
    schema: OrderedListSchema,
    attributes: createAttributes(OrderedListSchema),
  },
  tableCell: {
    schema: TableCellSchema,
    attributes: createAttributes(TableCellSchema),
  },
  tableHeader: {
    schema: TableHeaderSchema,
    attributes: createAttributes(TableHeaderSchema),
  },
  image: {
    schema: ImageSchema,
    attributes: createAttributes(ImageSchema),
  },
  emoji: {
    schema: EmojiSchema,
    attributes: createAttributes(EmojiSchema),
  },
} as const;

/** Mark extension schemas with runtime attributes. */
export const markSchemas = {
  link: {
    schema: LinkSchema,
    attributes: createAttributes(LinkSchema),
  },
  highlight: {
    schema: HighlightSchema,
    attributes: createAttributes(HighlightSchema),
  },
  textStyle: {
    schema: TextStyleSchema,
    attributes: createAttributes(TextStyleSchema),
  },
  anchor: {
    schema: AnchorSchema,
    attributes: createAttributes(AnchorSchema),
  },
  styled: {
    schema: StyledSchema,
    attributes: createAttributes(StyledSchema),
  },
} as const;
