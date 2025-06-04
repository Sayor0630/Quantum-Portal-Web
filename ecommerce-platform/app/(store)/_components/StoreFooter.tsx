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
