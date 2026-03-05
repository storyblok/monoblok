import React from 'react';
import { ReactRichText } from './ReactRichtext';

export default function Wrapper({ segments }: { segments: any }) {
  return (
    <div>
      <ReactRichText
        segments={segments}
        components={{
          blok: (blok) => {
            return <pre>{JSON.stringify({ blok }, null, 2)}</pre>;
          },
        }}
      />
    </div>
  );
}
