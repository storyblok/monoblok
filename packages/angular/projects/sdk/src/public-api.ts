/*
 * Public API Surface of storyblok-angular
 */

export * from './lib/storyblok.service';
export * from './lib/storyblok-components';
export * from './lib/provide-storyblok';
export function greetings(params: string): string {
  return `Hello, ${params}!`;
}
