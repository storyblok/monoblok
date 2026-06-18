import type { Experiment } from './types';

/**
 * A homepage experiment with a 50/50 control/variant split. `control` renders
 * the original `home` slug; variant `b` renders `home-b`.
 */
export const homepageExperiment: Experiment = {
  id: 123,
  name: 'homepage_hero',
  display_name: 'Homepage Hero',
  story_ids: [1, 2],
  variants: [
    {
      name: 'control',
      display_name: 'Control',
      public_id: 'var_control',
      weight: 50,
      is_control: true,
      story_mappings: [
        { original_story_id: 1, original_slug: 'home', variant_story_id: 1, variant_slug: 'home' },
      ],
    },
    {
      name: 'b',
      display_name: 'Variant B',
      public_id: 'var_b',
      weight: 50,
      is_control: false,
      story_mappings: [
        { original_story_id: 1, original_slug: 'home', variant_story_id: 2, variant_slug: 'home-b' },
      ],
    },
  ],
};
