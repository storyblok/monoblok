
type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

interface HeadingProps {
  level: HeadingLevel;
  content: string;
}

export default function Heading({ level, content }: HeadingProps) {
  const Tag = (`h${level}`) as const;

  return (
    <Tag
    style= {{ color: '#1b243f', borderLeft: '4px solid #00b3b0', paddingLeft: '12px' }}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
