// Entry for the `react-server` export condition of `@storyblok/react`: what
// the root import resolves to in React Server Components. Everything from the
// root entry, except `StoryblokPreview`, which is the Server Component from
// `@storyblok/react/rsc`. The client `StoryblokPreview` can't work there: its
// `renderContent` would have to be a function passed to a Client Component.
//
// A local export takes precedence over the same name from `export *`.
export * from "./index";
export { StoryblokPreview, type StoryblokPreviewProps } from "./rsc";
