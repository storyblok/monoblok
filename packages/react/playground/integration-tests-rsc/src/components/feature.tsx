import { type SbBlokData, storyblokEditable } from "@storyblok/react/rsc";

const Feature = ({ blok }: { blok: SbBlokData & { name?: string; description?: string } }) => (
  <div {...storyblokEditable(blok)} data-test="feature">
    <div>{blok.name}</div>
    <p>{blok.description}</p>
  </div>
);

export default Feature;
