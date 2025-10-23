import { storyblokEditable } from '@storyblok/react/rsc';
import { headers } from 'next/headers';

const Teaser = ({ blok }) => {
  // Although we are not using the headers here, we need to call it to test that server only components are working.
  headers();
  return (
    <h2 data-cy="teaser" {...storyblokEditable(blok)}>
      {blok.headline}
    </h2>
  );
};

export default Teaser;
