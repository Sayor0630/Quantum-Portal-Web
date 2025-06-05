// app/(store)/layout.tsx
import { Box, MantineProvider, ColorSchemeScript } from '@mantine/core'; // MantineProvider/ColorSchemeScript are in root, but for context
import StoreHeader from './_components/StoreHeader';
import StoreFooter from './_components/StoreFooter';
import React from 'react';

// These functions would ideally be in a service/lib file
async function getSiteConfig() {
    const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/public/site-config`;
    try {
        const res = await fetch(apiUrl, { cache: 'no-store' }); // No cache for dynamic config for now
        if (!res.ok) {
            console.error(`Failed to fetch site config: ${res.status} ${await res.text()}`);
            return null;
        }
        return res.json();
    } catch (error) {
        console.error('Error in getSiteConfig:', error);
        return null;
    }
}

async function getHeaderNav() {
    const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/public/navigation/Main Header`;
    try {
        const res = await fetch(apiUrl, { cache: 'no-store' });
        if (!res.ok) {
            console.error(`Failed to fetch header nav: ${res.status} ${await res.text()}`);
            return null;
        }
        return res.json();
    } catch (error) {
        console.error('Error in getHeaderNav:', error);
        return null;
    }
}

async function getFooterNav() {
    const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/public/navigation/Footer Links`;
    try {
        const res = await fetch(apiUrl, { cache: 'no-store' });
        if (!res.ok) {
            console.error(`Failed to fetch footer nav: ${res.status} ${await res.text()}`);
            return null;
        }
        return res.json();
    } catch (error) {
        console.error('Error in getFooterNav:', error);
        return null;
    }
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
    const [siteConfig, headerNavData, footerNavData] = await Promise.all([
        getSiteConfig(),
        getHeaderNav(),
        getFooterNav()
    ]);

    // The actual MantineProvider and ColorSchemeScript are in the root app/layout.tsx
    // This layout just defines the structure for the store.
    // If siteConfig contained theme overrides, they would typically be applied in a client component
    // that re-initializes or merges with the Mantine theme context.

    return (
        <Box style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <StoreHeader siteConfig={siteConfig} navData={headerNavData} />
            <Box component="main" style={{ flexGrow: 1, paddingTop: 'var(--header-height, 70px)' }}> {/* Default header height */}
                {children}
            </Box>
            <StoreFooter siteConfig={siteConfig} navData={footerNavData} />
        </Box>
    );
}
