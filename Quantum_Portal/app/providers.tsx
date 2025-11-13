'use client';

import { MantineProvider, createTheme } from '@mantine/core';
import { SessionProvider } from 'next-auth/react';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals'; // New import
import React, { ReactNode } from 'react';

// Example: You can define a custom theme for Mantine if needed
const theme = createTheme({
  // fontFamily: 'Open Sans, sans-serif',
  // primaryColor: 'blue',
  // Add other theme overrides here
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <Notifications />
        <ModalsProvider> {/* Add ModalsProvider here */}
          {children}
        </ModalsProvider>
      </MantineProvider>
    </SessionProvider>
  );
}
