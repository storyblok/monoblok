import { type SbBlokData, storyblokEditable } from "@storyblok/react/rsc";

const Teaser = ({ blok }: { blok: SbBlokData & { headline?: string } }) => (
  <div {...storyblokEditable(blok)} data-test="teaser">
    <h2>{blok.headline}</h2>
  </div>
);

export default Teaser;
