import { defineDatasource } from '@storyblok/schema';

export const iconsDatasource = defineDatasource({
  name: 'Icons',
  slug: 'icons',
});

export const colorsDatasource = defineDatasource({
  name: 'Colors',
  slug: 'colors',
  dimensions: [
    { name: 'Light Mode', entry_value: 'light' },
    { name: 'Dark Mode', entry_value: 'dark' },
  ],
});
