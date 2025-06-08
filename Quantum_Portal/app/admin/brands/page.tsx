'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Title, Paper, Table, ActionIcon, Group, Text, Button, TextInput, 
  Select, Badge, Pagination, Alert, LoadingOverlay, Avatar, Tooltip,
  Switch, Menu, Modal, Loader
} from '@mantine/core';
import { 
  IconPlus, IconPencil, IconTrash, IconSearch, IconWorld, 
  IconAlertCircle, IconDots, IconEye
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useDebouncedValue } from '@mantine/hooks';
import AdminLayout from '../../../components/admin/AdminLayout';

interface Brand {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  website?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedBrandsResponse {
  brands: Brand[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
}



export default function BrandsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingBrandId, setDeletingBrandId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 500);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  const fetchBrands = useCallback(async (
    page = 1, 
    search = '', 
    status: string | null = null, 
    sort = 'name', 
    order = 'asc'
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
        sortBy: sort,
        sortOrder: order,
      });
      
      if (search) params.append('search', search);
      if (status !== null) params.append('isActive', status);

      const response = await fetch(`/api/admin/brands?${params}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch brands');
      }

      const data: PaginatedBrandsResponse = await response.json();
      setBrands(data.brands);
      setCurrentPage(data.currentPage);
      setTotalPages(data.totalPages);
      setTotalItems(data.totalItems);
    } catch (err: any) {
      setError(err.message);
      setBrands([]);
      notifications.show({ 
        title: 'Error', 
        message: err.message || 'Could not load brands.', 
        color: 'red' 
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/admin/login');
    }
  }, [authStatus, router]);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      fetchBrands(currentPage, debouncedSearchTerm, filterStatus, sortBy, sortOrder);
    }
  }, [authStatus, currentPage, debouncedSearchTerm, filterStatus, sortBy, sortOrder, fetchBrands]);



  const handleStatusChange = (value: string | null) => {
    setFilterStatus(value);
    setCurrentPage(1);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.currentTarget.value);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleDeleteBrand = (brandId: string, brandName: string) => {
    modals.openConfirmModal({
      title: 'Delete Brand',
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete the brand &quot;<strong>{brandName}</strong>&quot;?
          This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        setDeletingBrandId(brandId);
        try {
          const response = await fetch(`/api/admin/brands/${brandId}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to delete brand');
          }

          notifications.show({
            title: 'Success',
            message: 'Brand deleted successfully',
            color: 'green',
          });

          fetchBrands(currentPage, debouncedSearchTerm, filterStatus, sortBy, sortOrder);
        } catch (err: any) {
          notifications.show({
            title: 'Error',
            message: err.message,
            color: 'red',
          });
        } finally {
          setDeletingBrandId(null);
        }
      },
    });
  };

  const handleToggleStatus = async (brand: Brand) => {
    try {
      const response = await fetch(`/api/admin/brands/${brand._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...brand,
          isActive: !brand.isActive,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update brand status');
      }

      notifications.show({
        title: 'Success',
        message: `Brand ${brand.isActive ? 'deactivated' : 'activated'} successfully`,
        color: 'green',
      });

      fetchBrands(currentPage, debouncedSearchTerm, filterStatus, sortBy, sortOrder);
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.message,
        color: 'red',
      });
    }
  };

  if (authStatus === 'loading' || (isLoading && authStatus === 'authenticated')) {
    return (
      <AdminLayout>
        <LoadingOverlay visible />
      </AdminLayout>
    );
  }

  if (authStatus === 'unauthenticated') {
    return null;
  }

  return (
    <AdminLayout>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Brand Management</Title>
        <Button 
          leftSection={<IconPlus size={16} />} 
          onClick={() => router.push('/admin/brands/new')}
        >
          Add New Brand
        </Button>
      </Group>

      <Paper withBorder p="md" mb="lg">
        <Group justify="space-between">
          <Group>
            <TextInput
              placeholder="Search brands by name or slug..."
              value={searchTerm}
              onChange={handleSearchChange}
              leftSection={<IconSearch size={16} />}
              style={{ minWidth: 300 }}
            />
            <Select
              placeholder="Filter by status"
              value={filterStatus}
              onChange={handleStatusChange}
              data={[
                { value: '', label: 'All Statuses' },
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
              ]}
              clearable
            />
          </Group>
          <Group>
            <Text size="sm" c="dimmed">
              {totalItems} total brands
            </Text>
          </Group>
        </Group>
      </Paper>

      {error && !isLoading && (
        <Alert 
          title="Error Fetching Brands" 
          color="red" 
          icon={<IconAlertCircle />} 
          withCloseButton 
          onClose={() => setError(null)} 
          mb="lg"
        >
          {error} Please try{' '}
          <Button 
            variant="subtle" 
            size="xs" 
            onClick={() => fetchBrands(currentPage, debouncedSearchTerm, filterStatus, sortBy, sortOrder)}
          >
            reloading
          </Button>.
        </Alert>
      )}

      <Paper withBorder shadow="sm" radius="md">
        <LoadingOverlay 
          visible={isLoading && authStatus === 'authenticated'} 
          overlayProps={{ radius: 'sm', blur: 0.5, backgroundOpacity: 0.3 }} 
          loaderProps={{ size: 'md' }}
        />
        
        {!isLoading && !error && brands.length === 0 && (
          <Text ta="center" py="xl" c="dimmed">
            {debouncedSearchTerm || filterStatus 
              ? "No brands found matching your search criteria." 
              : "No brands found. "}
            {!debouncedSearchTerm && !filterStatus && (
              <Button variant="subtle" onClick={() => router.push('/admin/brands/new')}>
                Create the first brand
              </Button>
            )}
          </Text>
        )}

        {brands.length > 0 && (
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Brand</Table.Th>
                <Table.Th>Slug</Table.Th>
                <Table.Th>Description</Table.Th>
                <Table.Th>Website</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th style={{ width: 150, minWidth: 150 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {brands.map((brand) => (
                <Table.Tr key={brand._id}>
                  <Table.Td>
                    <Group gap="sm">
                      {brand.logo ? (
                        <Avatar src={brand.logo} size="sm" radius="sm" />
                      ) : (
                        <Avatar size="sm" radius="sm">{brand.name.charAt(0)}</Avatar>
                      )}
                      <div>
                        <Text fw={500}>{brand.name}</Text>
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed" fw={500}>/{brand.slug}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={2} style={{ maxWidth: 200 }}>
                      {brand.description || '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {brand.website ? (
                      <Tooltip label={brand.website}>
                        <ActionIcon 
                          variant="subtle" 
                          component="a" 
                          href={brand.website} 
                          target="_blank"
                        >
                          <IconWorld size={16} />
                        </ActionIcon>
                      </Tooltip>
                    ) : (
                      <Text c="dimmed">—</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Switch
                      checked={brand.isActive}
                      onChange={() => handleToggleStatus(brand)}
                      size="sm"
                      color={brand.isActive ? 'green' : 'gray'}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {new Date(brand.createdAt).toLocaleDateString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap" justify="flex-start">
                      <ActionIcon 
                        variant="subtle" 
                        color="green" 
                        onClick={() => router.push(`/admin/brands/${brand._id}`)}
                        aria-label={`View products for ${brand.name}`}
                      >
                        <IconEye size={18} />
                      </ActionIcon>
                      <ActionIcon 
                        variant="subtle" 
                        color="blue" 
                        onClick={() => router.push(`/admin/brands/${brand._id}/edit`)}
                        aria-label={`Edit ${brand.name}`}
                      >
                        <IconPencil size={18} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleDeleteBrand(brand._id, brand.name)}
                        loading={deletingBrandId === brand._id}
                        aria-label={`Delete ${brand.name}`}
                      >
                        <IconTrash size={18} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}

        {totalPages > 1 && (
          <Group justify="center" p="md">
            <Pagination
              total={totalPages}
              value={currentPage}
              onChange={handlePageChange}
            />
          </Group>
        )}
      </Paper>

      {totalItems > 0 && (
        <Text size="sm" c="dimmed" mt="sm">
          Showing {brands.length} of {totalItems} brands
        </Text>
      )}
    </AdminLayout>
  );
}
