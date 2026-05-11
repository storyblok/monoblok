import { defineBlock, defineField } from '@storyblok/schema';
import { headlineField, imageField } from './fields';
import { ctaFields, seoFields } from './field-groups';
import { wrap } from '../helpers';

const baseHeroBlock = defineBlock({
  name: 'hero',
  is_nestable: true,
  schema: wrap({
    headline: { ...headlineField, required: true },
    image: imageField,
    ...ctaFields(),
  }),
});

export const heroWithSeoBlock = defineBlock({
  ...baseHeroBlock,
  name: 'hero_with_seo',
  schema: wrap({
    ...baseHeroBlock.schema,
    ...seoFields(),
  }),
});

export const heroCompactBlock = defineBlock({
  ...baseHeroBlock,
  name: 'hero_compact',
  display_name: 'Hero (Compact)',
  schema: wrap({
    ...baseHeroBlock.schema,
    headline: defineField({ type: 'text', max_length: 60, required: false }),
  }),
});

export const heroNoCta = (() => {
  const { cta_label, cta_link, ...rest } = baseHeroBlock.schema;
  return defineBlock({
    ...baseHeroBlock,
    name: 'hero_no_cta',
    display_name: 'Hero (No CTA)',
    schema: rest,
  });
})();

export { baseHeroBlock };
