import { type SbBlokData, StoryblokServerComponent, storyblokEditable } from "@storyblok/react/rsc";

const Page = ({ blok }: { blok: SbBlokData & { body?: SbBlokData[] } }) => (
  <div {...storyblokEditable(blok)} data-test="page">
    {blok.body?.map((nestedBlok) => (
      <div key={nestedBlok._uid}>
        <StoryblokServerComponent blok={nestedBlok} />
      </div>
    ))}
  </div>
);

export default Page;
