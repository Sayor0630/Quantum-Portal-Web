'use client'; // Client component for potential interactivity like theme toggle, mobile menu

import { Header, Group, Title, ActionIcon, Burger, NavLink, Menu, UnstyledButton, Avatar, Text, Box, Container } from '@mantine/core';
import { useDisclosure, useHeadroom } from '@mantine/hooks';
import { IconSun, IconMoonStars, IconShoppingCart, IconUserCircle, IconChevronDown } from '@tabler/icons-react';
import { useMantineColorScheme } from '@mantine/core';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react'; // For user session
import React from 'react';

interface NavItem {
    _id?: string; title: string; url: string; children?: NavItem[]; order: number;
}
interface NavData { name: string; items: NavItem[]; }
interface SiteConfig { siteName?: string; logoUrl?: string; }

interface StoreHeaderProps {
  siteConfig: SiteConfig | null;
  navData: NavData | null;
}

// Recursive NavLink renderer for header (can be different from AdminLayout's)
const renderHeaderLinks = (items: NavItem[], isMobile?: boolean) => {
    return items.sort((a,b) => a.order - b.order).map((item) => {
        if (item.children && item.children.length > 0) {
            return (
                <Menu key={item.title} trigger="hover" openDelay={100} closeDelay={400}>
                    <Menu.Target>
                        <UnstyledButton component={Link} href={item.url} ff="var(--mantine-font-family-headings)" fz="sm" fw={500} style={{padding: '8px 12px'}}>
                            <Group gap={4} preventGrowOverflow={false} wrap="nowrap">
                                {item.title}
                                <IconChevronDown size={14} />
                            </Group>
                        </UnstyledButton>
                    </Menu.Target>
                    <Menu.Dropdown>
                        {item.children.sort((a,b) => a.order - b.order).map(child => (
                            <Menu.Item key={child.title} component={Link} href={child.url}>
                                {child.title}
                            </Menu.Item>
                        ))}
                    </Menu.Dropdown>
                </Menu>
            );
        }
        return (
            <UnstyledButton component={Link} href={item.url} key={item.title} ff="var(--mantine-font-family-headings)" fz="sm" fw={500} style={{padding: '8px 12px'}}>
                {item.title}
            </UnstyledButton>
        );
    });
};


export default function StoreHeader({ siteConfig, navData }: StoreHeaderProps) {
  const [opened, { toggle }] = useDisclosure(false); // For mobile menu
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const { data: session, status } = useSession();
  const router = useRouter(); // Not imported, but would be needed for programmatic navigation
  const pinned = useHeadroom({ fixedAt: 120 });


  return (
    <Header height={70} p="md" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, boxShadow: pinned ? '0 2px 4px rgba(0,0,0,0.1)' : 'none', transition: 'box-shadow 0.3s ease-in-out' }}>
      <Container size="xl" style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <Group justify="space-between" style={{ flex: 1 }}>
          <Link href="/" passHref legacyBehavior>
            <Group component="a" gap="xs" style={{textDecoration: 'none', color: 'inherit'}}>
              {siteConfig?.logoUrl && <img src={siteConfig.logoUrl} alt={siteConfig.siteName || 'Logo'} style={{ height: '30px', width: 'auto' }} />}
              <Title order={3} size="h4">{siteConfig?.siteName || 'My Store'}</Title>
            </Group>
          </Link>

          <Group gap="xs" visibleFrom="sm">
            {navData?.items && renderHeaderLinks(navData.items)}
          </Group>

          <Group>
            <ActionIcon
              onClick={() => setColorScheme(colorScheme === 'light' ? 'dark' : 'light')}
              variant="default"
              size="lg"
              aria-label="Toggle color scheme"
            >
              {colorScheme === 'light' ? <IconMoonStars stroke={1.5} /> : <IconSun stroke={1.5} />}
            </ActionIcon>

            <ActionIcon component={Link} href="/cart" variant="default" size="lg" aria-label="Cart">
                <IconShoppingCart stroke={1.5} />
            </ActionIcon>

            {status === 'authenticated' && session?.user ? (
                <Menu shadow="md" width={200}>
                    <Menu.Target>
                        <UnstyledButton style={{display: 'flex', alignItems: 'center'}}>
                            <Avatar src={session.user.image} alt={session.user.name || session.user.email} radius="xl" size="sm" />
                            <Box ml="xs" style={{lineHeight: 1}}>
                                <Text size="xs" fw={500}>{session.user.name || session.user.email?.split('@')[0]}</Text>
                                <Text size="xs" c="dimmed">{session.user.email}</Text>
                            </Box>
                            <IconChevronDown size={14} style={{marginLeft: 4}}/>
                        </UnstyledButton>
                    </Menu.Target>
                    <Menu.Dropdown>
                        <Menu.Label>My Account</Menu.Label>
                        <Menu.Item component={Link} href="/account/profile" leftSection={<IconUserCircle size={14} />}>Profile</Menu.Item>
                        <Menu.Item component={Link} href="/account/orders" leftSection={<IconListDetails size={14} />}>My Orders</Menu.Item>
                        {(session.user as any).role?.includes('admin') && <Menu.Item component={Link} href="/admin" leftSection={<IconLayoutDashboard size={14}/>}>Admin Panel</Menu.Item>}
                        <Menu.Divider />
                        <Menu.Item color="red" leftSection={<IconLogout size={14}/>} onClick={() => signOut({ callbackUrl: '/' })}>
                            Logout
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
            ) : (
                <Button component={Link} href="/api/auth/signin" variant="default">Login</Button> // Or your custom login page
            )}

            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          </Group>
        </Group>
      </Container>
      {/* Mobile Menu (Drawer or below header) - Basic version */}
      {opened && !isSmallScreen && ( /* This logic needs useMediaQuery or similar for isSmallScreen */
        <Box hiddenFrom="sm" p="md" style={{borderTop: '1px solid var(--mantine-color-gray-2)', background: 'var(--mantine-color-body)'}}>
            {navData?.items && renderHeaderLinks(navData.items, true).map((link, index) => <Box key={index} py="xs">{link}</Box>)}
        </Box>
      )}
    </Header>
  );
}

// For mobile menu, a more robust solution would use Mantine Drawer or handle screen size.
// The placeholder above is very basic. Let's assume `isSmallScreen` is not implemented for this pass.
// So, the mobile menu part might not work as intended without `useMediaQuery`. I'll remove the isSmallScreen check for now.
// The mobile menu would typically be a Drawer.
import { IconLogout, IconListDetails, IconLayoutDashboard } from '@tabler/icons-react'; // Ensure all icons used are imported
import { useRouter } from 'next/navigation'; // Import if used programmatically
```

**Self-correction:**
- The mobile menu part ` {opened && !isSmallScreen && (` needs `useMediaQuery` from Mantine hooks or similar to determine `isSmallScreen`. For now, I will simplify this or make it a basic dropdown. The provided code in the prompt doesn't fully flesh out the mobile navigation, so I will focus on the desktop header for now and a very simple mobile item list if `opened` is true.
- `IconLogout`, `IconListDetails`, `IconLayoutDashboard` were re-imported at the bottom. This should be cleaned up.
- `useRouter` was imported but not used. I will remove it if not added during refinement.
- `ff="var(--mantine-font-family-headings)"` is an example of direct theme variable usage.

Given the complexity, I'll simplify the mobile navigation to just a placeholder `Text` for this step, as a full Drawer implementation is out of scope for "basic structure". The focus is on data display and core elements. I will also remove the `useHeadroom` for now to simplify.The `StoreLayout.tsx` has been created. Now, I will create the `StoreHeader.tsx` component. This component will be a client component responsible for displaying the site logo/name, header navigation links, a theme toggle, and placeholders for cart/user icons.

I will simplify the mobile navigation part for this subtask, focusing on the desktop layout of the header. I'll also remove `useHeadroom` for now to keep it focused.
