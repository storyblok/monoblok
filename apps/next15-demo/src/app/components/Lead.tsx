interface LeadProps {
  children: React.ReactNode;
}

export default function Lead({ children }: LeadProps) {
  return <div className="mb-6 text-lg md:text-xl">{children}</div>;
}
