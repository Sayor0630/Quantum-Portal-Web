'use client';

import AdminLayout from '../../../components/admin/AdminLayout';
import { Title, Text, Paper, Table, Group, Button, ActionIcon, LoadingOverlay, Alert, ScrollArea, Pagination, TextInput, Select, Badge, Space } from '@mantine/core';
import { IconEye, IconAlertCircle, IconSearch, IconFilter, IconUserCheck, IconUserOff, IconUserPlus, IconPencil } from '@tabler/icons-react'; // Added IconPencil
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { hasPermission, Permission, Role } from '../../../lib/permissions'; // Import permission utils
import Link from 'next/link';
import { useDebouncedValue } from '@mantine/hooks';
import dayjs from 'dayjs';

interface Customer {
  _id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  // orderCount?: number;
}

interface PaginatedCustomersResponse {
     customers: Customer[];
     currentPage: number;
     totalPages: number;
     totalItems: number;
}

const getStatusColor = (isActive: boolean) => isActive ? 'green' : 'gray';

export default function CustomersPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const userRole = (session?.user as any)?.role as Role | undefined;
  const canManageCustomers = userRole ? hasPermission(userRole, Permission.MANAGE_CUSTOMERS) : false;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 500);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null); // 'active', 'inactive', or '' for all

  const fetchCustomers = useCallback(async (page: number, search: string, statusFilter: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '10',
      });
      if (search) queryParams.append('search', search);
      if (statusFilter === 'active') queryParams.append('status', 'active');
      else if (statusFilter === 'inactive') queryParams.append('status', 'inactive');


      const response = await fetch(`/api/admin/customers?${queryParams.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: PaginatedCustomersResponse = await response.json();
      setCustomers(data.customers);
      setCurrentPage(data.currentPage);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch customers.');
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/admin/login');
    }
    if (authStatus === 'authenticated') {
      fetchCustomers(currentPage, debouncedSearchTerm, selectedStatus);
    }
  }, [authStatus, router, currentPage, debouncedSearchTerm, selectedStatus, fetchCustomers]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.currentTarget.value);
    setCurrentPage(1);
  };

  const handleStatusChange = (value: string | null) => {
    setSelectedStatus(value);
    setCurrentPage(1);
  };


  if (authStatus === 'loading' || (isLoading && authStatus === 'authenticated' && customers.length === 0 && !error) ) {
     return (
         <AdminLayout>
             <LoadingOverlay visible={true} overlayProps={{ radius: 'sm', blur: 2, fixed: true }} />
         </AdminLayout>
     );
  }
  if (authStatus === 'unauthenticated') {
     return <Text p="xl">Redirecting to login...</Text>;
  }

  const rows = customers.map((customer) => (
    <Table.Tr key={customer._id}>
      <Table.Td>{`${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'N/A'}</Table.Td>
      <Table.Td>{customer.email}</Table.Td>
      <Table.Td>{dayjs(customer.createdAt).format('MMM D, YYYY')}</Table.Td>
      {/* <Table.Td>{customer.orderCount !== undefined ? customer.orderCount : 'N/A'}</Table.Td> */}
      <Table.Td>
         <Badge
             color={getStatusColor(customer.isActive)}
             variant="light"
             radius="sm"
             leftSection={customer.isActive ? <IconUserCheck size={14} /> : <IconUserOff size={14} />}
         >
             {customer.isActive ? 'Active' : 'Inactive'}
         </Badge>
      </Table.Td>
      <Table.Td>
        <Group gap="xs" wrap="nowrap">
          <ActionIcon
            variant="subtle"
            color="blue"
            component={Link}
            href={`/admin/customers/${customer._id}`}
            aria-label={`View customer ${customer.email}`}
          >
            <IconEye size={18} />
          </ActionIcon>
          {canManageCustomers && (
            <ActionIcon
              variant="subtle"
              color="gray" // Or another color like 'orange' or 'teal'
              component={Link}
              href={`/admin/customers/${customer._id}/edit`}
              aria-label={`Edit customer ${customer.email}`}
            >
              <IconPencil size={18} />
            </ActionIcon>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <AdminLayout>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Customers</Title>
        {canManageCustomers && (
          <Button leftSection={<IconUserPlus size={16} />} component={Link} href="/admin/customers/new">
            Add New Customer
          </Button>
        )}
      </Group>

      <Paper withBorder shadow="sm" radius="md" p="md" mb="xl">
         <Group grow>
             <TextInput
                 placeholder="Search by name or email..."
                 leftSection={<IconSearch size={16} />}
                 value={searchTerm}
                 onChange={handleSearchChange}
             />
             <Select
                 label="Status"
                 placeholder="Filter by status"
                 leftSection={<IconFilter size={16} />}
                 data={[
                     { label: 'All Statuses', value: '' }, // Representing 'null' or no filter for status
                     { label: 'Active', value: 'active' },
                     { label: 'Inactive', value: 'inactive' },
                 ]}
                 value={selectedStatus}
                 onChange={handleStatusChange}
                 clearable
             />
         </Group>
      </Paper>

      {error && !isLoading && (
         <Alert title="Error Fetching Customers" color="red" icon={<IconAlertCircle />} withCloseButton onClose={() => setError(null)} mb="lg">
             {error} Please try <Button variant="subtle" size="xs" onClick={() => fetchCustomers(currentPage, debouncedSearchTerm, selectedStatus)}>reloading</Button>.
         </Alert>
      )}

      <Paper withBorder shadow="sm" radius="md">
         <ScrollArea>
             <LoadingOverlay visible={isLoading && authStatus === 'authenticated'} overlayProps={{ radius: 'sm', blur: 1 }} />
             {!isLoading && !error && customers.length === 0 && (
                 <Text p="xl" ta="center" c="dimmed">No customers found matching your criteria.</Text>
             )}
             {!error && customers.length > 0 && (
                 <Table striped highlightOnHover verticalSpacing="sm" miw={800}>
                     <Table.Thead>
                     <Table.Tr>
                         <Table.Th>Name</Table.Th>
                         <Table.Th>Email</Table.Th>
                         <Table.Th>Registered</Table.Th>
                         {/* <Table.Th>Orders</Table.Th> */}
                         <Table.Th>Status</Table.Th>
                         <Table.Th>Actions</Table.Th>
                     </Table.Tr>
                     </Table.Thead>
                     <Table.Tbody>{rows}</Table.Tbody>
                 </Table>
             )}
         </ScrollArea>
      </Paper>

      {totalPages > 1 && !error && customers.length > 0 && (
         <Group justify="center" mt="xl">
             <Pagination total={totalPages} value={currentPage} onChange={handlePageChange} />
         </Group>
      )}
      <Space h="xl" />
    </AdminLayout>
  );
}
