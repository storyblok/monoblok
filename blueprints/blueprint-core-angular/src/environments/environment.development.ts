import { StoryblokClientConfig } from '@storyblok/angular';

export const environment = {
  production: false,
  accessToken: 'STORYBLOK_DELIVERY_API_TOKEN', // Replace with your Storyblok Delivery API token
  region: 'STORYBLOK_REGION' as StoryblokClientConfig['region'], // Replace with your Storyblok region (e.g. "eu", "us", or "ap")
};
