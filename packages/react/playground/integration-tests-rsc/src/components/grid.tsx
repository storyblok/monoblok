import { type SbBlokData, StoryblokServerComponent, storyblokEditable } from "@storyblok/react/rsc";

const Grid = ({ blok }: { blok: SbBlokData & { columns?: SbBlokData[] } }) => {
  if (!blok.columns) {
    return null;
  }

  return (
    <ul {...storyblokEditable(blok)} data-test="grid">
      {blok.columns.map((nestedBlok) => (
        <li key={nestedBlok._uid}>
          <StoryblokServerComponent blok={nestedBlok} />
        </li>
      ))}
    </ul>
  );
};

export default Grid;
