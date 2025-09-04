'use client';

import { SWRConfig } from 'swr';

interface SWRProviderProps {
  children: React.ReactNode;
  fallback: any;
}

export function SWRProvider({ children, fallback }: SWRProviderProps) {
  return (
    <SWRConfig value={{ 
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      fallback,
    }}>
      {children}
    </SWRConfig>
  );
}
