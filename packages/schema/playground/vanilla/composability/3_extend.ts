import { defineBlock, defineField } from '@storyblok/schema';
import { headlineField, imageField } from './1_fields';
import { ctaFields, seoFields } from './2_field-groups';

// The base schema array is exported so variants can spread from it.
export const heroBaseSchema = [
  { ...headlineField, required: true },
  imageField,
  ...ctaFields(),
];

export const baseHeroBlock = defineBlock({
  name: 'hero',
  is_nestable: true,
  fields: heroBaseSchema,
});

// Extend: append SEO fields
export const heroWithSeoBlock = defineBlock({
  name: 'hero_with_seo',
  is_nestable: true,
  fields: [...heroBaseSchema, ...seoFields()],
});

// Override: replace headline with a shorter max_length
export const heroCompactBlock = defineBlock({
  name: 'hero_compact',
  display_name: 'Hero (Compact)',
  is_nestable: true,
  fields: [
    defineField('headline', { type: 'text', max_length: 60 }),
    imageField,
    ...ctaFields(),
  ],
});

// Omit: drop CTA fields
export const heroNoCta = defineBlock({
  name: 'hero_no_cta',
  display_name: 'Hero (No CTA)',
  is_nestable: true,
  fields: [
    { ...headlineField, required: true },
    imageField,
  ],
});
