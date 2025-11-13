'use client';

import { AppShell, Burger, Group, Title, ActionIcon, Text, Box, NavLink, Stack, ScrollArea, useMantineColorScheme } from '@mantine/core'; // Added Stack, ScrollArea
import { useDisclosure } from '@mantine/hooks';
import {
    IconSun, IconMoonStars, IconDashboard, IconShoppingCart, IconListDetails, IconUsers,
    IconPalette, IconFileText, IconSettings, IconLayoutDashboard, IconAdjustments,
    IconCategory, IconReceipt, IconMessageCircle, IconUsersGroup, IconBrowser,
    IconPackage, // Re-using IconPackage for Products
    IconTag, // For Brands
    IconLink as IconNavMenu, // Alias IconLink for Navigation Menus
    IconBoxMultiple // For Stock Management
} from '@tabler/icons-react';
import React, { ReactNode, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react'; // For session and role
import { usePathname } from 'next/navigation'; // For active link state
import Link from 'next/link'; // For NavLink component prop

type AdminLayoutProps = {
  children: ReactNode;
};

interface NavItem {
    label: string;
    href?: string; // Optional if it's a parent with no direct link
    icon: React.ElementType; // Tabler icon component
    children?: NavItem[];
    initiallyOpened?: boolean; // For parent NavLinks
    role?: string; // Optional: restrict to specific role (e.g., 'superadmin')
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [opened, { toggle }] = useDisclosure();
  // const { colorScheme, setColorScheme } = useMantineColorScheme(); // ColorScheme toggle removed as per diff
  // Re-add if needed, but the provided diff did not have it, so following that.
  // For now, let's keep it for theme toggling, assuming it's a desired feature.
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);


  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const pathname = usePathname();
  const currentPath = pathname || ''; // Fallback for null pathname

  const navLinksDefinition: NavItem[] = [
    { label: 'Dashboard', href: '/admin', icon: IconDashboard },
    {
      label: 'Catalog',
      icon: IconShoppingCart,
      children: [
        { label: 'Products', href: '/admin/products', icon: IconPackage },
        { label: 'Stock Management', href: '/admin/products/stock-management', icon: IconPackage },
        { label: 'Categories', href: '/admin/categories', icon: IconCategory },
        { label: 'Brands', href: '/admin/brands', icon: IconTag },
        { label: 'Attributes', href: '/admin/custom-attributes', icon: IconAdjustments },
      ]
    },
    { label: 'Orders', href: '/admin/orders', icon: IconReceipt },
    { label: 'Customers', href: '/admin/customers', icon: IconUsers },
    { label: 'Reviews', href: '/admin/reviews', icon: IconMessageCircle },
    {
      label: 'Content',
      icon: IconFileText,
      children: [
        { label: 'Dynamic Pages', href: '/admin/content/dynamic-pages', icon: IconLayoutDashboard },
        { label: 'Static Pages', href: '/admin/content/static-pages', icon: IconBrowser },
      ]
    },
    {
      label: 'Appearance', // Grouping for visual settings
      icon: IconPalette,
      children: [
        { label: 'Homepage Builder', href: '/admin/homepage-builder', icon: IconLayoutDashboard },
        { label: 'Navigation Menus', href: '/admin/settings/navigation', icon: IconNavMenu },
        { label: 'Site Identity & Theme', href: '/admin/settings/site-identity', icon: IconPalette }, // Re-use IconPalette or new one
      ]
    },
    {
      label: 'Site Settings', // New section for site configuration
      icon: IconSettings,
      children: [
        { label: 'Product Template', href: '/admin/settings/product-template', icon: IconLayoutDashboard },
        { label: 'Payment Methods', href: '/admin/payment-methods', icon: IconReceipt },
      ]
    },
    // Settings might be better as a top-level item if it has many distinct sub-sections
    // For now, Site Identity, Navigation, Product Page Layout are under Appearance.
    // User Management will be its own top-level item for superadmins.
  ];

  if (userRole === 'superadmin') {
    navLinksDefinition.push({
       label: 'User Management',
       icon: IconUsersGroup,
       children: [
           { label: 'Admin Users', href: '/admin/users', icon: IconUsersGroup }
       ]
    });
  }

  const renderNavLinks = (links: NavItem[]) => {
    return links.map((link) => {
        // Filter out links that require a specific role if the user doesn't have it
        if (link.role && link.role !== userRole) {
            return null;
        }

        // A child is active if the current pathname starts with the child's href
        // A parent is active if any of its children are active OR if the pathname starts with the parent's own href (if it's a link itself)
        const isChildActive = (child: NavItem) => child.href && currentPath.startsWith(child.href);
        const isParentActive = link.children?.some(isChildActive) || (link.href && currentPath.startsWith(link.href)) || false;


        if (link.children) {
            return (
                <NavLink
                    key={link.label}
                    label={link.label}
                    leftSection={<link.icon size="1.1rem" stroke={1.5} />}
                    childrenOffset={28}
                    defaultOpened={link.initiallyOpened || isParentActive}
                    active={isParentActive && !link.href} // Highlight parent if a child is active and parent itself is not a direct link
                    // If parent IS a direct link, its own active state will be handled below like other direct links
                >
                    {renderNavLinks(link.children)}
                </NavLink>
            );
        }
        return (
            <NavLink
                key={link.label}
                label={link.label}
                href={link.href || '#'} // Fallback for undefined href
                component={Link}
                leftSection={<link.icon size="1.1rem" stroke={1.5} />} // Adjusted size
                active={currentPath === link.href || (currentPath.startsWith(link.href || '') && link.href !== '/admin' && link.href !== undefined)}
                // More aggressive active state for direct links: active if path starts with href (unless it's just /admin)
                // This helps highlight "Products" when on "/admin/products/edit/123"
            />
        );
    });
  };


  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 280, breakpoint: 'sm', collapsed: { mobile: !opened, desktop: false } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Link href="/admin" style={{ textDecoration: 'none', color: 'inherit' }}>
                <Title order={3}>E-commerce Admin</Title>
            </Link>
          </Group>
          <ActionIcon
            onClick={() => setColorScheme(colorScheme === 'light' ? 'dark' : 'light')}
            variant="default"
            size="lg"
            aria-label="Toggle color scheme"
          >
            {mounted ? (
              colorScheme === 'light' ? <IconMoonStars stroke={1.5} /> : <IconSun stroke={1.5} />
            ) : (
              <IconMoonStars stroke={1.5} />
            )}
          </ActionIcon>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <ScrollArea style={{ height: 'calc(100vh - var(--app-shell-header-height, 0px) - 2 * var(--mantine-spacing-md))' }} scrollbarSize={6} type="auto">
            <Stack gap="xs">
                {renderNavLinks(navLinksDefinition)}
            </Stack>
        </ScrollArea>
      </AppShell.Navbar>

      <AppShell.Main>
        <Box p="md">
          {children}
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
