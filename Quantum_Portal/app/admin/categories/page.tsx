'use client';

import AdminLayout from '../../../components/admin/AdminLayout';
import { Title, Text, Paper, Table, Group, Button, ActionIcon, LoadingOverlay, Alert, ScrollArea, Space, Badge } from '@mantine/core';
import { IconPencil, IconTrash, IconPlus, IconAlertCircle, IconNetwork } from '@tabler/icons-react';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { modals } from '@mantine/modals'; // Import Modals
import { notifications } from '@mantine/notifications'; // Import Notifications

interface Category {
  _id: string;
  name: string;
  slug: string;
  parent?: {
    _id: string;
    name: string;
  } | null;
  children?: Category[];
  level?: number;
}

const buildTreeAndFlatten = (categories: Category[]): Category[] => {
    const categoryMap: Record<string, Category & { children: Category[] }> = {};
    const rootCategories: Category[] = [];
    categories.forEach(category => {
        categoryMap[category._id] = { ...category, children: [] };
    });
    categories.forEach(category => {
        if (category.parent && categoryMap[category.parent._id]) {
            categoryMap[category.parent._id].children.push(categoryMap[category._id]);
        } else {
            rootCategories.push(categoryMap[category._id]);
        }
    });
    const flattened: Category[] = [];
    function flatten(category: Category, level: number) {
        flattened.push({ ...category, level });
        if (category.children && category.children.length > 0) {
            const sortedChildren = [...category.children].sort((a, b) => a.name.localeCompare(b.name));
            sortedChildren.forEach(child => flatten(child, level + 1));
        }
    }
    const sortedRootCategories = [...rootCategories].sort((a, b) => a.name.localeCompare(b.name));
    sortedRootCategories.forEach(category => flatten(category, 0));
    return flattened;
};

export default function CategoriesPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [displayCategories, setDisplayCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true); // General loading for fetch
  const [error, setError] = useState<string | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null); // For delete loading state

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/categories');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: Category[] = await response.json();
      setAllCategories(data);
      setDisplayCategories(buildTreeAndFlatten(data));
    } catch (err: any) {
      setError(err.message || 'Failed to fetch categories.');
      setAllCategories([]);
      setDisplayCategories([]);
       notifications.show({ title: 'Error', message: err.message || 'Could not load categories.', color: 'red' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/admin/login');
    }
    if (authStatus === 'authenticated') {
      fetchCategories();
    }
  }, [authStatus, router, fetchCategories]);

  const handleDeleteCategory = (categoryId: string, categoryName: string) => {
    modals.openConfirmModal({
        title: 'Delete Category',
        centered: true,
        children: (
            <Text size="sm">
            Are you sure you want to delete the category &quot;<strong>{categoryName}</strong>&quot;?
            Products in this category will be uncategorized.
            This category cannot be deleted if it has child categories (they must be moved or deleted first).
            </Text>
        ),
        labels: { confirm: 'Delete Category', cancel: 'Cancel' },
        confirmProps: { color: 'red' },
        onConfirm: async () => {
            setDeletingCategoryId(categoryId);
            try {
                const response = await fetch(`/api/admin/categories/${categoryId}`, { method: 'DELETE' });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || 'Failed to delete category.');

                // Refetch categories to update the list and hierarchy correctly
                fetchCategories();

                notifications.show({ title: 'Category Deleted', message: data.message || `Category &quot;${categoryName}&quot; deleted.`, color: 'green' });
            } catch (err: any) {
                notifications.show({ title: 'Error Deleting Category', message: err.message, color: 'red' });
            } finally {
                setDeletingCategoryId(null);
            }
        },
    });
  };


  if (authStatus === 'loading' || (isLoading && authStatus === 'authenticated' && allCategories.length === 0 && !error) ) {
     return (
         <AdminLayout>
             <LoadingOverlay visible={true} overlayProps={{ radius: 'sm', blur: 2, fixed: true }} />
         </AdminLayout>
     );
  }
  if (authStatus === 'unauthenticated') {
     return <Text p="xl">Redirecting to login...</Text>;
  }

  const rows = displayCategories.map((category) => (
    <Table.Tr key={category._id}>
      <Table.Td style={{ paddingLeft: `${(category.level || 0) * 25 + 10}px` }}>
         {(category.level || 0) > 0 && <IconNetwork size={16} style={{ marginRight: 8, verticalAlign: 'middle', color: '#adb5bd' }} />}
         {category.name}
      </Table.Td>
      <Table.Td>{category.slug}</Table.Td>
      <Table.Td>{category.parent?.name || <Text c="dimmed">-</Text>}</Table.Td>
      <Table.Td>
        <Group gap="xs">
          <ActionIcon variant="subtle" color="blue" component={Link} href={`/admin/categories/edit/${category._id}`} aria-label={`Edit ${category.name}`}>
            <IconPencil size={18} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => handleDeleteCategory(category._id, category.name)}
            loading={deletingCategoryId === category._id}
            aria-label={`Delete ${category.name}`}
          >
            <IconTrash size={18} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <AdminLayout>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Categories</Title>
        <Button leftSection={<IconPlus size={16} />} component={Link} href="/admin/categories/new">
          Add New Category
        </Button>
      </Group>

      {error && !isLoading && (
         <Alert title="Error" color="red" icon={<IconAlertCircle />} withCloseButton onClose={() => setError(null)} mb="lg">
             {error} Please try <Button variant="subtle" size="xs" onClick={fetchCategories}>reloading</Button>.
         </Alert>
      )}

      <Paper withBorder shadow="sm" radius="md">
         <ScrollArea>
             <LoadingOverlay visible={isLoading && authStatus === 'authenticated' && displayCategories.length > 0} overlayProps={{ radius: 'sm', blur: 1 }} />
             {!isLoading && !error && displayCategories.length === 0 && (
                 <Text p="xl" ta="center" c="dimmed">No categories defined yet. Click &quot;Add New Category&quot; to get started.</Text>
             )}
             {!error && displayCategories.length > 0 && (
                 <Table striped highlightOnHover verticalSpacing="md" miw={700}>
                     <Table.Thead>
                     <Table.Tr>
                         <Table.Th>Name</Table.Th>
                         <Table.Th>Slug</Table.Th>
                         <Table.Th>Parent Category</Table.Th>
                         <Table.Th>Actions</Table.Th>
                     </Table.Tr>
                     </Table.Thead>
                     <Table.Tbody>{rows}</Table.Tbody>
                 </Table>
             )}
         </ScrollArea>
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
