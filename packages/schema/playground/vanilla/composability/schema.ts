import { defineBlock, defineBlockFolder, defineDatasource, defineField } from '@storyblok/schema';
import { headlineField, imageField, themeOptionField } from './1_fields';
import { seoFields } from './2_field-groups';
import { createCardBlock, createSectionBlock } from './4_factories';
import { baseHeroBlock, heroCompactBlock, heroNoCta, heroWithSeoBlock } from './3_extend';
import { withSection, withTracking } from './5_mixins';

const layoutFolder = defineBlockFolder({ name: 'Layout' });
const contentFolder = defineBlockFolder({ name: 'Content' });
const cardsFolder = defineBlockFolder({ name: 'Cards' });
const themesDatasource = defineDatasource({ name: 'Themes', slug: 'themes' });

const aboutSection = createSectionBlock({
  name: 'about_section',
  folderUuid: layoutFolder.uuid,
  displayName: 'About Section',
  withCta: true,
  withImage: true,
});

const textSection = createSectionBlock({
  name: 'text_section',
  folderUuid: layoutFolder.uuid,
  displayName: 'Text Section',
});

const serviceCard = createCardBlock({
  name: 'service_card',
  folderUuid: cardsFolder.uuid,
  extraFields: [themeOptionField],
});

const teamMemberCard = createCardBlock({
  name: 'team_member_card',
  folderUuid: cardsFolder.uuid,
});

// Mixin: append a tracking_id field to an existing schema array
const trackedAboutSection = defineBlock({
  name: 'tracked_about_section',
  display_name: 'About Section (Tracked)',
  is_nestable: true,
  component_group_uuid: layoutFolder.uuid,
  schema: withTracking([
    { ...headlineField, required: true },
    defineField('body', { type: 'richtext', customize_toolbar: true, toolbar: ['bold', 'italic', 'link'] }),
    imageField,
  ]),
});

// Mixin: prepend a collapsible section grouping to a schema array
const sectionedTeamCard = defineBlock({
  name: 'sectioned_team_card',
  is_nestable: true,
  component_group_uuid: cardsFolder.uuid,
  schema: withSection(
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
  schema: [
    ...seoFields(),
    defineField('body', {
      type: 'bloks',
      component_whitelist: [
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
  blockFolders: { layoutFolder, contentFolder, cardsFolder },
  datasources: { themesDatasource },
};
