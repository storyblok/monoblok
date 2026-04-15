export const resolveHeadingTag = (attrs: { level?: number }): string => {
  const level
    = typeof attrs?.level === 'number'
      ? Math.min(6, Math.max(1, attrs.level))
      : 1;

  return `h${level}`;
};
