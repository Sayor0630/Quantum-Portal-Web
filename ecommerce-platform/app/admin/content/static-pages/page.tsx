'use client';

import AdminLayout from '../../../../../components/admin/AdminLayout';
import { Title, Text, Paper, Table, Group, Button, ActionIcon, LoadingOverlay, Alert, ScrollArea, Pagination, TextInput, Badge, Space } from '@mantine/core';
import { IconPencil, IconTrash, IconPlus, IconAlertCircle, IconSearch, IconFileText, IconEyeCheck, IconEyeOff } from '@tabler/icons-react';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDebouncedValue } from '@mantine/hooks';
import dayjs from 'dayjs';
import { modals } from '@mantine/modals'; // Import Modals
import { notifications } from '@mantine/notifications'; // Import Notifications

interface StaticPage {
  _id: string;
  title: string;
  slug: string;
  isPublished: boolean;
  updatedAt: string;
}

interface PaginatedStaticPagesResponse {
     pages: StaticPage[];
     currentPage: number;
     totalPages: number;
     totalItems: number;
}

const getStatusColor = (isPublished: boolean) => isPublished ? 'green' : 'gray';

export default function StaticPagesListPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [pages, setPages] = useState<StaticPage[]>([]);
  const [isLoading, setIsLoading] = useState(true); // General loading for fetch
  const [error, setError] = useState<string | null>(null);
  const [deletingPageId, setDeletingPageId] = useState<string | null>(null); // For delete loading state

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 500);

  const fetchStaticPages = useCallback(async (page: number, search: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '10',
      });
      if (search) queryParams.append('search', search);

      const response = await fetch(`/api/admin/static-pages?${queryParams.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: PaginatedStaticPagesResponse = await response.json();
      setPages(data.pages);
      setCurrentPage(data.currentPage);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch static pages.');
      setPages([]);
       notifications.show({ title: 'Error', message: err.message || 'Could not load static pages.', color: 'red' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/admin/login');
    }
    if (authStatus === 'authenticated') {
      fetchStaticPages(currentPage, debouncedSearchTerm);
    }
  }, [authStatus, router, currentPage, debouncedSearchTerm, fetchStaticPages]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.currentTarget.value);
    setCurrentPage(1);
  };

  const handleDeleteStaticPage = (pageId: string, pageTitle: string) => {
    modals.openConfirmModal({
        title: 'Delete Static Page', centered: true,
        children: (<Text size="sm">Are you sure you want to delete the page "<strong>{pageTitle}</strong>"? This action is permanent.</Text>),
        labels: { confirm: 'Delete Page', cancel: 'Cancel' }, confirmProps: { color: 'red' },
        onConfirm: async () => {
            setDeletingPageId(pageId);
            try {
                const response = await fetch(`/api/admin/static-pages/${pageId}`, { method: 'DELETE' });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to delete page.');
                }
                setPages(prev => prev.filter(p => p._id !== pageId));
                // If on last page and it becomes empty, go to previous page
                if (pages.length === 1 && currentPage > 1) {
                    setCurrentPage(currentPage - 1);
                } else if (pages.length === 1 && currentPage === 1) {
                    // If it was the only page, list will be empty, fetch will show "no pages"
                    fetchStaticPages(1, debouncedSearchTerm); // Refetch to show empty state or if totalPages changed
                }
                notifications.show({ title: 'Page Deleted', message: `Page "${pageTitle}" deleted successfully.`, color: 'green', icon: <IconTrash /> });
            } catch (err: any) {
                notifications.show({ title: 'Error Deleting Page', message: err.message, color: 'red', icon: <IconAlertCircle /> });
            } finally {
                setDeletingPageId(null);
            }
        },
    });
  };


  if (authStatus === 'loading' || (isLoading && authStatus === 'authenticated' && pages.length === 0 && !error) ) {
     return (
         <AdminLayout>
             <LoadingOverlay visible={true} overlayProps={{ radius: 'sm', blur: 2, fixed: true }} />
         </AdminLayout>
     );
  }
  if (authStatus === 'unauthenticated') {
     return <Text p="xl">Redirecting to login...</Text>;
  }

  const rows = pages.map((pageItem) => (
    <Table.Tr key={pageItem._id}>
      <Table.Td>
         <Link href={`/admin/content/static-pages/edit/${pageItem._id}`} passHref legacyBehavior>
             <Text component="a" c="blue.6" fw={500}>{pageItem.title}</Text>
         </Link>
      </Table.Td>
      <Table.Td>/{pageItem.slug}</Table.Td>
      <Table.Td>
         <Badge
             color={getStatusColor(pageItem.isPublished)}
             variant="light"
             radius="sm"
             leftSection={pageItem.isPublished ? <IconEyeCheck size={14} /> : <IconEyeOff size={14} />}
         >
             {pageItem.isPublished ? 'Published' : 'Draft'}
         </Badge>
      </Table.Td>
      <Table.Td>{dayjs(pageItem.updatedAt).format('MMM D, YYYY h:mm A')}</Table.Td>
      <Table.Td>
        <Group gap="xs">
          <ActionIcon variant="subtle" color="blue" component={Link} href={`/admin/content/static-pages/edit/${pageItem._id}`} aria-label={`Edit ${pageItem.title}`}>
            <IconPencil size={18} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => handleDeleteStaticPage(pageItem._id, pageItem.title)}
            loading={deletingPageId === pageItem._id}
            aria-label={`Delete ${pageItem.title}`}
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
        <Title order={2}><Group gap="xs"><IconFileText />Static Pages</Group></Title>
        <Button leftSection={<IconPlus size={16} />} component={Link} href="/admin/content/static-pages/new">
          Add New Page
        </Button>
      </Group>

      <Paper withBorder shadow="sm" radius="md" p="md" mb="xl">
         <TextInput
             placeholder="Search by title or slug..."
             leftSection={<IconSearch size={16} />}
             value={searchTerm}
             onChange={handleSearchChange}
         />
      </Paper>

      {error && !isLoading && (
         <Alert title="Error Fetching Pages" color="red" icon={<IconAlertCircle />} withCloseButton onClose={() => setError(null)} mb="lg">
             {error} Please try <Button variant="subtle" size="xs" onClick={() => fetchStaticPages(currentPage, debouncedSearchTerm)}>reloading</Button>.
         </Alert>
      )}

      <Paper withBorder shadow="sm" radius="md">
         <ScrollArea>
             <LoadingOverlay visible={isLoading && authStatus === 'authenticated' && pages.length > 0} overlayProps={{ radius: 'sm', blur: 1 }} /> {/* Show overlay on content if loading more pages */}
             {!isLoading && !error && pages.length === 0 && (
                 <Text p="xl" ta="center" c="dimmed">No static pages created yet. Click "Add New Page" to get started.</Text>
             )}
             {!error && pages.length > 0 && (
                 <Table striped highlightOnHover verticalSpacing="sm" miw={700}>
                     <Table.Thead>
                     <Table.Tr>
                         <Table.Th>Title</Table.Th>
                         <Table.Th>Slug</Table.Th>
                         <Table.Th>Status</Table.Th>
                         <Table.Th>Last Updated</Table.Th>
                         <Table.Th>Actions</Table.Th>
                     </Table.Tr>
                     </Table.Thead>
                     <Table.Tbody>{rows}</Table.Tbody>
                 </Table>
             )}
         </ScrollArea>
      </Paper>

      {totalPages > 1 && !error && pages.length > 0 && (
         <Group justify="center" mt="xl">
             <Pagination total={totalPages} value={currentPage} onChange={handlePageChange} />
         </Group>
      )}
      <Space h="xl" />
    </AdminLayout>
  );
}
