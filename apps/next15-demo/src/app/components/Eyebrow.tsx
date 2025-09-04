interface EyebrowProps {
  children: React.ReactNode;
}

export default function Eyebrow({ children }: EyebrowProps) {
  return <h3 className="mb-3 text-lg font-black">{children}</h3>;
}
