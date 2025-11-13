'use client';

import AdminLayout from '../../../../components/admin/AdminLayout';
import { Title, Text, Paper, Table, Group, Button, ActionIcon, LoadingOverlay, Alert, ScrollArea, Pagination, TextInput, Badge, Space, Select } from '@mantine/core';
import { IconPencil, IconTrash, IconPlus, IconAlertCircle, IconSearch, IconLayoutGrid, IconEyeCheck, IconEyeOff, IconEye } from '@tabler/icons-react';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDebouncedValue } from '@mantine/hooks';
import dayjs from 'dayjs';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';

interface DynamicPage {
  _id: string;
  title: string;
  slug: string;
  pageType?: 'landing' | 'content' | 'category' | 'brand' | 'custom';
  isPublished: boolean;
  updatedAt: string;
  viewCount: number;
  segmentCount: number;
}

interface PaginatedDynamicPagesResponse {
  pages: DynamicPage[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

const getStatusColor = (isPublished: boolean) => isPublished ? 'green' : 'gray';
const getPageTypeColor = (pageType?: string) => {
  if (!pageType) return 'gray';
  const colors: Record<string, string> = {
    landing: 'blue',
    content: 'teal',
    category: 'orange',
    brand: 'purple',
    custom: 'gray',
  };
  return colors[pageType] || 'gray';
};

export default function DynamicPagesListPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [pages, setPages] = useState<DynamicPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingPageId, setDeletingPageId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [searchTerm, setSearchTerm] = useState('');
  const [pageTypeFilter, setPageTypeFilter] = useState<string>('all');
  const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 500);

  const fetchDynamicPages = useCallback(async (page: number, search: string, pageType: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '10',
      });
      if (search) queryParams.append('search', search);
      if (pageType && pageType !== 'all') queryParams.append('pageType', pageType);

      const response = await fetch(`/api/admin/dynamic-pages?${queryParams.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: PaginatedDynamicPagesResponse = await response.json();
      setPages(data.pages);
      setCurrentPage(data.currentPage);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dynamic pages.');
      setPages([]);
      notifications.show({ title: 'Error', message: err.message || 'Could not load dynamic pages.', color: 'red' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/admin/login');
    }
    if (authStatus === 'authenticated') {
      fetchDynamicPages(currentPage, debouncedSearchTerm, pageTypeFilter);
    }
  }, [authStatus, router, currentPage, debouncedSearchTerm, pageTypeFilter, fetchDynamicPages]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.currentTarget.value);
    setCurrentPage(1);
  };

  const handleDeleteDynamicPage = (pageId: string, pageTitle: string) => {
    modals.openConfirmModal({
      title: 'Delete Dynamic Page',
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete the page &quot;<strong>{pageTitle}</strong>&quot;? This action is permanent and will delete all segments and blocks.
        </Text>
      ),
      labels: { confirm: 'Delete Page', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        setDeletingPageId(pageId);
        try {
          const response = await fetch(`/api/admin/dynamic-pages/${pageId}`, { method: 'DELETE' });
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to delete page.');
          }
          setPages((prev) => prev.filter((p) => p._id !== pageId));
          if (pages.length === 1 && currentPage > 1) {
            setCurrentPage(currentPage - 1);
          } else if (pages.length === 1 && currentPage === 1) {
            fetchDynamicPages(1, debouncedSearchTerm, pageTypeFilter);
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

  if (authStatus === 'loading' || (isLoading && authStatus === 'authenticated' && pages.length === 0 && !error)) {
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
        <Text 
          component={Link} 
          href={`/admin/content/dynamic-pages/edit/${pageItem._id}`}
          c="blue.6" 
          fw={500}
          style={{ textDecoration: 'none' }}
        >
          {pageItem.title}
        </Text>
      </Table.Td>
      <Table.Td>/{pageItem.slug}</Table.Td>
      <Table.Td>
        <Badge color={getPageTypeColor(pageItem.pageType)} variant="light" radius="sm">
          {pageItem.pageType ? pageItem.pageType.charAt(0).toUpperCase() + pageItem.pageType.slice(1) : 'Custom'}
        </Badge>
      </Table.Td>
      <Table.Td>{pageItem.segmentCount}</Table.Td>
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
      <Table.Td>
        <Group gap={4}>
          <IconEye size={14} />
          <Text size="sm">{pageItem.viewCount || 0}</Text>
        </Group>
      </Table.Td>
      <Table.Td>{dayjs(pageItem.updatedAt).format('MMM D, YYYY h:mm A')}</Table.Td>
      <Table.Td>
        <Group gap="xs">
          <ActionIcon
            variant="subtle"
            color="blue"
            component={Link}
            href={`/admin/content/dynamic-pages/edit/${pageItem._id}`}
            aria-label={`Edit ${pageItem.title}`}
          >
            <IconPencil size={18} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => handleDeleteDynamicPage(pageItem._id, pageItem.title)}
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
        <Title order={2}>
          <Group gap="xs">
            <IconLayoutGrid />
            Dynamic Pages
          </Group>
        </Title>
        <Button leftSection={<IconPlus size={16} />} component={Link} href="/admin/content/dynamic-pages/new">
          Create New Page
        </Button>
      </Group>

      <Text c="dimmed" mb="md">
        Build custom pages with infinite possibilities. Add segments, blocks, images, videos, products, and more with full responsive control.
      </Text>

      <Paper withBorder shadow="sm" radius="md" p="md" mb="xl">
        <Group grow>
          <TextInput
            placeholder="Search by title, slug, or description..."
            leftSection={<IconSearch size={16} />}
            value={searchTerm}
            onChange={handleSearchChange}
          />
          <Select
            placeholder="Filter by page type"
            value={pageTypeFilter}
            onChange={(value) => {
              setPageTypeFilter(value || 'all');
              setCurrentPage(1);
            }}
            data={[
              { value: 'all', label: 'All Types' },
              { value: 'landing', label: 'Landing Page' },
              { value: 'content', label: 'Content Page' },
              { value: 'category', label: 'Category Page' },
              { value: 'brand', label: 'Brand Page' },
              { value: 'custom', label: 'Custom Page' },
            ]}
          />
        </Group>
      </Paper>

      {error && !isLoading && (
        <Alert title="Error Fetching Pages" color="red" icon={<IconAlertCircle />} withCloseButton onClose={() => setError(null)} mb="lg">
          {error} Please try{' '}
          <Button variant="subtle" size="xs" onClick={() => fetchDynamicPages(currentPage, debouncedSearchTerm, pageTypeFilter)}>
            reloading
          </Button>
          .
        </Alert>
      )}

      <Paper withBorder shadow="sm" radius="md">
        <ScrollArea>
          <LoadingOverlay visible={isLoading && authStatus === 'authenticated' && pages.length > 0} overlayProps={{ radius: 'sm', blur: 1 }} />
          {!isLoading && !error && pages.length === 0 && (
            <Text p="xl" ta="center" c="dimmed">
              No dynamic pages created yet. Click &quot;Create New Page&quot; to build your first custom page with infinite possibilities!
            </Text>
          )}
          {!error && pages.length > 0 && (
            <Table striped highlightOnHover verticalSpacing="sm" miw={900}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Title</Table.Th>
                  <Table.Th>Slug</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Segments</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Views</Table.Th>
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
