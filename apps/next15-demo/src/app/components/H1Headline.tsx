interface H1HeadlineProps {
  children: React.ReactNode;
}

export default function H1Headline({ children }: H1HeadlineProps) {
  return (
    <h1 className="my-12 text-center text-3xl font-black sm:text-4xl lg:text-5xl">
      {children}
    </h1>
  );
}
