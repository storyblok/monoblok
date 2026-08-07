import { z } from 'zod';
import { describe, expectTypeOf, it } from 'vitest';
import type { BlockContentInput, PluginFieldValue } from '../generated/types/field';
import type { Story } from '../generated/types/story';
import { defineBlock } from './define-block';
import { defineField } from './define-field';
import { defineFieldPlugin } from './define-field-plugin';
import { defineSchema } from './define-schema';
import type { Schema } from './schema-type';

const colorPicker = defineFieldPlugin({
  fieldType: 'my-color',
  value: z.object({ color: z.string(), alpha: z.number() }),
});

interface ColorEnvelope {
  color: string;
  alpha: number;
  plugin: string;
  _uid?: string;
}

describe('custom field plugin resolution (read + write share one type)', () => {
  const heroBlock = defineBlock({
    name: 'hero',
    is_root: true,
    fields: [
      defineField('bg', { type: 'custom', field_type: 'my-color' }),
      defineField('legacy', { type: 'custom', field_type: 'unregistered-plugin' }),
    ],
  });

  const _schema = defineSchema({ blocks: { heroBlock }, fieldPlugins: { colorPicker } });
  type S = Schema<typeof _schema>;
  type HeroStory = Story<S['blocks'], S['fieldPlugins']>;

  it('resolves a registered custom field to the validator output merged with the plugin envelope', () => {
    expectTypeOf<NonNullable<HeroStory['content']['bg']>>().toEqualTypeOf<ColorEnvelope>();
  });

  it('leaves an unregistered custom field as PluginFieldValue', () => {
    expectTypeOf<NonNullable<HeroStory['content']['legacy']>>().toEqualTypeOf<PluginFieldValue>();
  });

  it('resolves to the same envelope on the write (input) side', () => {
    type HeroInput = BlockContentInput<typeof heroBlock, false, S['fieldPlugins']>;
    expectTypeOf<NonNullable<HeroInput['bg']>>().toEqualTypeOf<ColorEnvelope>();
  });

  it('falls back to PluginFieldValue for every custom field when no plugins are registered', () => {
    const _bareSchema = defineSchema({ blocks: { heroBlock } });
    type Bare = Schema<typeof _bareSchema>;
    type BareStory = Story<Bare['blocks'], Bare['fieldPlugins']>;
    expectTypeOf<NonNullable<BareStory['content']['bg']>>().toEqualTypeOf<PluginFieldValue>();
  });
});

describe('custom field plugin resolution inside nested bloks', () => {
  const cardBlock = defineBlock({
    name: 'card',
    fields: [defineField('bg', { type: 'custom', field_type: 'my-color' })],
  });

  const pageBlock = defineBlock({
    name: 'page',
    is_root: true,
    fields: [defineField('body', { type: 'bloks', allow: ['card'] })],
  });

  const _schema = defineSchema({ blocks: { pageBlock, cardBlock }, fieldPlugins: { colorPicker } });
  type S = Schema<typeof _schema>;
  type PageStory = Story<S['blocks'], S['fieldPlugins']>;

  it('threads the plugin map into nested block content', () => {
    type CardContent = Extract<NonNullable<PageStory['content']['body']>[number], { component: 'card' }>;
    expectTypeOf<NonNullable<CardContent['bg']>>().toEqualTypeOf<ColorEnvelope>();
  });
});
