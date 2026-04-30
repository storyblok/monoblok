import { defineBlock, defineField, defineProp, defineDatasource } from '@storyblok/schema';
import { defineBlockFolder } from '@storyblok/schema/mapi';
import { headlineField, themeOptionField } from './fields';
import { seoFields } from './field-groups';
import { createSectionBlock, createCardBlock } from './factories';
import { baseHeroBlock, heroWithSeoBlock, heroCompactBlock, heroNoCta } from './extend';
import { withTracking, withSection } from './mixins';

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
  extraFields: { theme: themeOptionField },
});

const teamMemberCard = createCardBlock({
  name: 'team_member_card',
  folderUuid: cardsFolder.uuid,
});

const trackedAboutSection = withTracking({
  ...aboutSection,
  name: 'tracked_about_section',
  display_name: 'About Section (Tracked)',
});

const sectionedTeamCard = withSection(
  { ...teamMemberCard, name: 'sectioned_team_card' },
  { title: 'Team Member Details', keys: ['title', 'description', 'image'] },
);

const pageBlock = defineBlock({
  name: 'page',
  is_root: true,
  is_nestable: false,
  schema: {
    ...seoFields(0),
    body: defineProp(
      defineField({
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
      { pos: 2 },
    ),
  },
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
