'use client';

import AdminLayout from '../../../../../components/admin/AdminLayout';
import { Title, Text, Paper, Group, Button, ActionIcon, LoadingOverlay, Alert, Accordion, List, ThemeIcon, Space, Box } from '@mantine/core';
import { IconPencil, IconTrash, IconPlus, IconAlertCircle, IconLink, IconMenu2, IconChevronRight, IconNetwork } from '@tabler/icons-react'; // Added IconNetwork
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';

interface MenuItem {
  _id?: string;
  title: string;
  url: string;
  order: number;
  children: MenuItem[];
}

interface NavigationMenu {
  _id: string;
  name: string;
  items: MenuItem[];
  createdAt?: string;
  updatedAt?: string;
}

// Recursive component to render menu items
const RenderMenuItems = ({ items, level = 0 }: { items: MenuItem[]; level?: number }) => {
  if (!items || items.length === 0) {
    return <Text c="dimmed" fs="italic" ml={(level * 20) + 20}>No items in this menu.</Text>; // Indent "No items" message
  }
  const sortedItems = [...items].sort((a, b) => a.order - b.order);

  return (
    <List spacing="xs" size="sm" ml={level * 20} listStyleType="none" withPadding>
      {sortedItems.map((item, index) => (
        <List.Item
          key={item._id || `item-${item.title}-${index}-${level}`} // Use title if _id is missing for new, unsaved items
          icon={
             item.children && item.children.length > 0 ?
             <ThemeIcon size={20} radius="xl" variant="light" color="gray"><IconChevronRight size={14}/></ThemeIcon> :
             <ThemeIcon size={20} radius="xl" variant="light" color="gray"><IconLink size={14}/></ThemeIcon>
          }
          style={{paddingLeft: '10px'}} // Add padding for better alignment of icon and text
        >
          <Group gap="xs" wrap="nowrap">
             <Text span>{item.title}</Text>
             <Text span c="dimmed" size="xs">({item.url})</Text>
          </Group>
          {item.children && item.children.length > 0 && (
            <RenderMenuItems items={item.children} level={level + 1} />
          )}
        </List.Item>
      ))}
    </List>
  );
};


export default function NavigationSettingsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [menus, setMenus] = useState<NavigationMenu[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingMenuId, setDeletingMenuId] = useState<string | null>(null);

  const fetchNavigationMenus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/navigation');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: NavigationMenu[] = await response.json();
      setMenus(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch navigation menus.');
      setMenus([]);
      notifications.show({ title: 'Error', message: err.message || 'Could not load navigation menus.', color: 'red' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/admin/login');
    if (authStatus === 'authenticated') fetchNavigationMenus();
  }, [authStatus, router, fetchNavigationMenus]);

   const handleDeleteMenu = (menuId: string, menuName: string) => {
     modals.openConfirmModal({
         title: 'Delete Navigation Menu', centered: true,
         children: (<Text size="sm">Are you sure you want to delete the menu &quot;<strong>{menuName}</strong>&quot;? This will delete the menu and all its items. This action is permanent.</Text>),
         labels: { confirm: 'Delete Menu', cancel: 'Cancel' }, confirmProps: { color: 'red' },
         onConfirm: async () => {
             setDeletingMenuId(menuId);
             try {
                 const response = await fetch(`/api/admin/navigation/${menuId}`, { method: 'DELETE' });
                 if (!response.ok) {
                      const errorData = await response.json(); // Try to get error from API
                      throw new Error(errorData.message || 'Failed to delete menu.');
                 }
                 setMenus(prev => prev.filter(m => m._id !== menuId));
                 notifications.show({ title: 'Menu Deleted', message: `Menu "${menuName}" deleted successfully.`, color: 'green', icon: <IconTrash /> });
             } catch (err: any) {
                 notifications.show({ title: 'Error Deleting Menu', message: err.message, color: 'red', icon: <IconAlertCircle /> });
             } finally {
                 setDeletingMenuId(null);
             }
         },
     });
  };

  if (authStatus === 'loading' || (isLoading && authStatus === 'authenticated' && menus.length === 0 && !error) ) {
     return <AdminLayout><LoadingOverlay visible={true} overlayProps={{radius:'sm', blur:2, fixed: true}} /></AdminLayout>;
  }
  if (authStatus === 'unauthenticated') return <Text p="xl">Redirecting to login...</Text>;

  return (
    <AdminLayout>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Navigation Management</Title>
        <Button leftSection={<IconPlus size={16} />} component={Link} href="/admin/settings/navigation/new-menu">
          Create New Menu
        </Button>
      </Group>

      {error && !isLoading && <Alert title="Error" color="red" icon={<IconAlertCircle/>} withCloseButton onClose={() => setError(null)} mb="lg">{error} Please try <Button variant="subtle" size="xs" onClick={fetchNavigationMenus}>reloading</Button>.</Alert>}

      <Paper withBorder shadow="sm" radius="md" p="md">
         <LoadingOverlay visible={isLoading && authStatus==='authenticated' && menus.length > 0} />
         {!isLoading && !error && menus.length === 0 && <Text p="xl" ta="center" c="dimmed">No navigation menus defined yet. Click &quot;Create New Menu&quot; to get started.</Text>}

         {menus.length > 0 && (
             <Accordion variant="separated" defaultValue={menus[0]?._id} chevronPosition="left">
                 {menus.map((menu) => (
                     <Accordion.Item value={menu._id} key={menu._id}>
                         <Accordion.Control icon={<IconMenu2 size={20} />}>
                             <Group justify="space-between" wrap="nowrap">
                                 <Text fw={500}>{menu.name}</Text>
                                 <Group gap="xs" wrap="nowrap" style={{marginRight: 'var(--accordion-chevron-size)'}} onClick={(e) => e.stopPropagation()}>
                                     <Button
                                         size="xs"
                                         variant="light"
                                         leftSection={<IconPencil size={14}/>}
                                         component={Link}
                                         href={`/admin/settings/navigation/edit/${menu._id}`}
                                     >
                                         Edit Structure
                                     </Button>
                                     <ActionIcon
                                         variant="light"
                                         color="red"
                                         size="lg"
                                         onClick={() => handleDeleteMenu(menu._id, menu.name)}
                                         loading={deletingMenuId === menu._id}
                                         aria-label={`Delete menu ${menu.name}`}
                                     >
                                         <IconTrash size={16} />
                                     </ActionIcon>
                                 </Group>
                             </Group>
                         </Accordion.Control>
                         <Accordion.Panel>
                             <RenderMenuItems items={menu.items} />
                         </Accordion.Panel>
                     </Accordion.Item>
                 ))}
             </Accordion>
         )}
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
