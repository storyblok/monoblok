export default function getGridClasses(cols: string = '3'): string {
  let gridClasses = 'grid md:grid-cols-2 gap-10 md:gap-12 md:mt-12 md:place-items-center items-start';

  switch (cols) {
    case '4':
      gridClasses += ' lg:grid-cols-3 xl:grid-cols-4';
      break;
    case '2':
      gridClasses += ' lg:grid-cols-2';
      break;
    case '3':
    default:
      gridClasses += ' lg:grid-cols-3';
  }

  return gridClasses;
}
