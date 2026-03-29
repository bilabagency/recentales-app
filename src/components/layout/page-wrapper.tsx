interface PageWrapperProps {
  children: React.ReactNode;
}

export default function PageWrapper({ children }: PageWrapperProps) {
  return (
    <main className="pt-16 pb-20 px-4 max-w-lg mx-auto min-h-screen">
      {children}
    </main>
  );
}
