import type { ReactElement } from 'react';
import { Blok, type BlokPropsForComponentOrNever } from './blok';
import { Bloks, type BloksProps } from './bloks';
import type { BlokData } from './types';

// A hook that returns type safe blok components
export const useBloks = <T extends BlokData>() => {
  return {
    // Constrain Blok to work with the specific union type T
    Blok: Blok as <C extends T['component']>(
      props: BlokPropsForComponentOrNever<T, C>
    ) => ReactElement | null,
    Bloks: Bloks as React.FC<BloksProps<T>>,
  };
};
