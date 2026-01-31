'use client';

import { Toaster } from 'sonner';
import { ThemeProvider, useTheme } from '@/components/theme-provider';

function ThemeAwareToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
        position="top-center"
        theme={theme}
        className="max-sm:left-4 max-sm:right-4 max-sm:top-16"
      />
    </>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <ThemeAwareToasterAndToggle />
    </ThemeProvider>
  );
}
