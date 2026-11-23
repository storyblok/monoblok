import type { StoryblokBlockComponentProps } from "@storyblok/react";

type WeatherWidgetProps = StoryblokBlockComponentProps<{ title?: string; location?: string }>;

// Static export prerenders every page at build time, so — unlike the
// next-latest playground's WeatherWidget — this stays synchronous with no
// artificial fetch delay to avoid slowing down every `next build`.
const WeatherWidget = ({ block, editable }: WeatherWidgetProps) => (
  <div data-test="weather-widget" {...editable}>
    <h3>{block.title}</h3>
    <p>Location: {block.location}</p>
  </div>
);

export default WeatherWidget;
