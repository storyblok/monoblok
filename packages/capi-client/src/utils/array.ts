export const chunkArray = <T>(items: T[], chunkSize: number): T[][] => {
  if (chunkSize <= 0) {
    return [];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
};
