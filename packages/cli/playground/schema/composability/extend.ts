import { defineBlock, defineField, defineProp } from '@storyblok/schema';
import { headlineField, imageField } from './fields';
import { ctaFields, seoFields } from './field-groups';

const baseHeroBlock = defineBlock({
  name: 'hero',
  is_nestable: true,
  schema: {
    headline: defineProp(headlineField, { pos: 0, required: true }),
    image: defineProp(imageField, { pos: 1 }),
    ...ctaFields(2),
  },
});

export const heroWithSeoBlock = defineBlock({
  ...baseHeroBlock,
  name: 'hero_with_seo',
  schema: {
    ...baseHeroBlock.schema,
    ...seoFields(10),
  },
});

export const heroCompactBlock = defineBlock({
  ...baseHeroBlock,
  name: 'hero_compact',
  display_name: 'Hero (Compact)',
  schema: {
    ...baseHeroBlock.schema,
    headline: defineProp(
      defineField({ type: 'text', max_length: 60 }),
      { pos: 0, required: false },
    ),
  },
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
