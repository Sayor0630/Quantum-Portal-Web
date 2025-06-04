'use client';

import { Footer, Container, Group, Text, Anchor, Space, SimpleGrid, Title, Box } from '@mantine/core';
import Link from 'next/link';
import React from 'react';

interface NavItem {
    _id?: string; title: string; url: string; children?: NavItem[]; order: number;
}
interface NavData { name: string; items: NavItem[]; }
interface SiteConfig { siteName?: string; logoUrl?: string; }

interface StoreFooterProps {
  siteConfig: SiteConfig | null;
  navData: NavData | null; // For "Footer Links"
}

// Recursive link renderer for footer (can be simple list or grouped)
const renderFooterLinks = (items: NavItem[], title?: string) => {
    if (!items || items.length === 0) return null;

    return (
        <div>
            {title && <Text size="lg" fw={500} mb="sm">{title}</Text>}
            <Stack gap="xs">
                {items.sort((a,b) => a.order - b.order).map((item) => (
                    <Anchor component={Link} href={item.url} key={item.title} c="dimmed" fz="sm">
                        {item.title}
                    </Anchor>
                ))}
            </Stack>
        </div>
    );
};
// For a multi-column footer, you might group links or have multiple NavData props

export default function StoreFooter({ siteConfig, navData }: StoreFooterProps) {
  const currentYear = new Date().getFullYear();

  // Assuming navData.items might be structured if you have multiple footer columns/groups
  // For a simple single list of footer links:
  const footerLinks = navData?.items ? (
    <Group justify="center" gap="lg">
        {navData.items.sort((a,b) => a.order - b.order).map((item) => (
            <Anchor component={Link} href={item.url} key={item.title} c="dimmed" fz="sm">
                {item.title}
            </Anchor>
        ))}
    </Group>
  ) : null;

  return (
    <Footer height="auto" p="xl" mt="xl" style={{ borderTop: '1px solid var(--mantine-color-gray-2)'}}>
      <Container size="xl">
        {/* Example of a more structured footer if navData had grouped items */}
        {/* <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg" mb="xl">
            {renderFooterLinks(navData?.items.filter(i => i.group === 'group1'), 'Column 1')}
            {renderFooterLinks(navData?.items.filter(i => i.group === 'group2'), 'Column 2')}
        </SimpleGrid> */}

        {footerLinks && (
            <Box mb="xl">
                {footerLinks}
            </Box>
        )}

        <Text c="dimmed" size="sm" ta="center">
          © {currentYear} {siteConfig?.siteName || 'My E-Store'}. All rights reserved.
        </Text>
        <Space h="xs"/>
        <Text c="dimmed" size="xs" ta="center">
            Powered by E-commerce Platform
        </Text>
      </Container>
    </Footer>
  );
}

// Need to import Stack if using the grouped renderFooterLinks
import { Stack } from '@mantine/core';
```

**Self-correction during generation:**
- Added `Stack` import for the more structured `renderFooterLinks` (though it's commented out in favor of a simpler `Group` for the initial pass).
- The `footerLinks` variable now directly maps the `navData.items` into a `Group` of `Anchor` tags for a single row of links, which is simpler for the initial setup.
- Added a "Powered by" line as a common footer element.
- Ensured `siteConfig.siteName` is used in the copyright.
- Made footer height `auto` and added top margin `mt="xl"`.
- Added `fz="sm"` and `c="dimmed"` to footer links for typical footer styling.The `StoreFooter.tsx` component has been created. It's a client component that:
-   Receives `siteConfig` and `navData` (for "Footer Links") as props.
-   Renders a list of navigation links provided in `navData.items` in a centered `Group`.
-   Displays a copyright notice with the current year and site name.
-   Includes a "Powered by" placeholder.

Next, I will update `app/(store)/page.tsx`. This involves moving the placeholder content from the root `app/page.tsx` (created in Subtask 28) to this new location and then implementing the dynamic section rendering.

First, I'll get the content of the current root `app/page.tsx` to ensure I'm moving the correct placeholder.
