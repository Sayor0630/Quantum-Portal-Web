import React from 'react';
import { ColorSchemeScript } from '@mantine/core'; // MantineProvider is now in Providers
import { Providers } from './providers'; // Import the new Providers component
import './globals.css'; // Import global styles including Mantine core styles

export const metadata = {
  title: 'E-commerce Platform', // Made more generic
  description: 'A modern e-commerce platform.', // Made more generic
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body suppressHydrationWarning>
        <Providers> {/* Use the Providers component here */}
          {children}
        </Providers>
      </body>
    </html>
  );
}
