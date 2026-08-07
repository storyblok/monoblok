import { defineBlock, defineDatasource, defineField } from '@storyblok/schema';
import { headlineField, imageField, themeOptionField } from './1_fields';
import { seoFields } from './2_field-groups';
import { createCardBlock, createSectionBlock } from './4_factories';
import { baseHeroBlock, heroCompactBlock, heroNoCta, heroWithSeoBlock } from './3_extend';
import { withSection, withTracking } from './5_mixins';

const themesDatasource = defineDatasource({ name: 'Themes', slug: 'themes' });

const aboutSection = createSectionBlock({
  name: 'about_section',
  displayName: 'About Section',
  withCta: true,
  withImage: true,
});

const textSection = createSectionBlock({
  name: 'text_section',
  displayName: 'Text Section',
});

const serviceCard = createCardBlock({
  name: 'service_card',
  extraFields: [themeOptionField],
});

const teamMemberCard = createCardBlock({
  name: 'team_member_card',
});

// Mixin: append a tracking_id field to an existing fields array
const trackedAboutSection = defineBlock({
  name: 'tracked_about_section',
  display_name: 'About Section (Tracked)',
  is_nestable: true,
  fields: withTracking([
    { ...headlineField, required: true },
    defineField('body', { type: 'richtext', customize_toolbar: true, toolbar: ['bold', 'italic', 'link'] }),
    imageField,
  ]),
});

// Mixin: prepend a collapsible section grouping to a fields array
const sectionedTeamCard = defineBlock({
  name: 'sectioned_team_card',
  is_nestable: true,
  fields: withSection(
    [
      defineField('title', { type: 'text', max_length: 80, required: true }),
      defineField('description', { type: 'textarea', max_length: 300 }),
      imageField,
      defineField('link', { type: 'multilink' }),
    ],
    { title: 'Team Member Details', keys: ['title', 'description', 'image'] },
  ),
});

const pageBlock = defineBlock({
  name: 'page',
  is_root: true,
  is_nestable: false,
  fields: [
    ...seoFields(),
    defineField('body', {
      type: 'bloks',
      allow: [
        baseHeroBlock.name,
        heroCompactBlock.name,
        heroNoCta.name,
        aboutSection.name,
        trackedAboutSection.name,
        textSection.name,
        serviceCard.name,
        teamMemberCard.name,
        sectionedTeamCard.name,
      ],
    }),
  ],
});

export const schema = {
  blocks: {
    pageBlock,
    baseHeroBlock,
    heroWithSeoBlock,
    heroCompactBlock,
    heroNoCta,
    aboutSection,
    textSection,
    serviceCard,
    teamMemberCard,
    trackedAboutSection,
    sectionedTeamCard,
  },
  datasources: { themesDatasource },
};
