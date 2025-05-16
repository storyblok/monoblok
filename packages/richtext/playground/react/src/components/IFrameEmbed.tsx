import React from 'react';

// Assuming blok prop is an object that contains an url object which, in turn, contains the actual URL string
interface BlokType {
  url: {
    url: string;
  };
}

interface Props {
  blok: BlokType; // Defining the expected shape of the 'blok' prop
}

const IFrameEmbed: React.FC<Props> = ({ blok }) => {
  return (
    <iframe
      src={blok.url.url}
      className="w-full aspect-video"
      frameBorder="0"
    >
    </iframe>
  );
};

export default IFrameEmbed;
