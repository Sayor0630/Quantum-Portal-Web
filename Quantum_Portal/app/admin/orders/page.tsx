'use client';

import AdminLayout from '../../../components/admin/AdminLayout';
import { Title, Text, Paper, Table, Group, Button, ActionIcon, LoadingOverlay, Alert, ScrollArea, Pagination, TextInput, Select, Badge, Space, Grid } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconEye, IconAlertCircle, IconSearch, IconFilter, IconCalendarEvent } from '@tabler/icons-react'; // Changed IconCalendar to IconCalendarEvent
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDebouncedValue } from '@mantine/hooks';
import dayjs from 'dayjs';

interface OrderItemProduct { // More specific for clarity
    name: string;
    sku?: string;
    // price: number; // Not needed for this view if orderItem.price is used
    // images?: string[]; // Not typically shown in order list items
}
interface OrderItem {
     product: OrderItemProduct | string; // API might send populated product or just ID
     quantity: number;
     price: number; // Price at time of order
}

interface OrderCustomer {
     _id: string;
     firstName?: string;
     lastName?: string;
     email: string;
}

interface Order {
  _id: string;
  customer?: OrderCustomer | string; // API might send populated customer or just ID
  orderItems: OrderItem[];
  totalAmount: number;
  status: string;
  createdAt: string; // ISO Date string
}

interface PaginatedOrdersResponse {
     orders: Order[];
     currentPage: number;
     totalPages: number;
     totalItems: number;
}

const getStatusColor = (status: string) => {
     switch (status?.toLowerCase()) { // Added null check for status
     case 'pending': return 'yellow';
     case 'processing': return 'blue';
     case 'shipped': return 'cyan';
     case 'delivered': return 'green';
     case 'cancelled': return 'red';
     case 'refunded': return 'gray';
     case 'on-hold': return 'orange';
     case 'failed': return 'pink';
     default: return 'dimmed';
     }
 };

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'on-hold', 'failed'];


export default function OrdersPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 500);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);


  const fetchOrders = useCallback(async (page: number, search: string, statusFilter: string | null, dates: [Date | null, Date | null]) => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '10',
      });
      if (search) queryParams.append('search', search);
      if (statusFilter) queryParams.append('status', statusFilter);
      if (dates[0]) queryParams.append('dateFrom', dayjs(dates[0]).format('YYYY-MM-DD'));
      if (dates[1]) queryParams.append('dateTo', dayjs(dates[1]).format('YYYY-MM-DD'));

      const response = await fetch(`/api/admin/orders?${queryParams.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: PaginatedOrdersResponse = await response.json();
      setOrders(data.orders);
      setCurrentPage(data.currentPage);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch orders.');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/admin/login');
    }
    if (authStatus === 'authenticated') {
      fetchOrders(currentPage, debouncedSearchTerm, selectedStatus, dateRange);
    }
  }, [authStatus, router, currentPage, debouncedSearchTerm, selectedStatus, dateRange, fetchOrders]);

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

  const handleDateRangeChange = (dates: [Date | null, Date | null]) => {
    setDateRange(dates);
    setCurrentPage(1);
  };


  if (authStatus === 'loading' || (isLoading && authStatus === 'authenticated' && orders.length === 0 && !error) ) {
     return (
         <AdminLayout>
             <LoadingOverlay visible={true} overlayProps={{ radius: 'sm', blur: 2, fixed: true }} />
         </AdminLayout>
     );
  }
  if (authStatus === 'unauthenticated') {
     return <Text p="xl">Redirecting to login...</Text>;
  }

  const rows = orders.map((order) => {
    const customerName = order.customer && typeof order.customer !== 'string'
        ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || order.customer.email
        : 'Guest';
    return (
        <Table.Tr key={order._id}>
        <Table.Td>
           <Link href={`/admin/orders/${order._id}`} passHref legacyBehavior>
               <Text component="a" c="blue.6" fw={500} size="sm">
                   {order._id.substring(0, 8)}...
               </Text>
           </Link>
        </Table.Td>
        <Table.Td>{customerName}</Table.Td>
        <Table.Td>{dayjs(order.createdAt).format('MMM D, YYYY h:mm A')}</Table.Td>
        <Table.Td>${order.totalAmount.toFixed(2)}</Table.Td>
        <Table.Td>
           <Badge color={getStatusColor(order.status)} variant="light" radius="sm">
               {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
           </Badge>
        </Table.Td>
        <Table.Td>{order.orderItems.reduce((acc, item) => acc + item.quantity, 0)}</Table.Td>
        <Table.Td>
          <ActionIcon variant="subtle" color="blue" component={Link} href={`/admin/orders/${order._id}`} aria-label={`View order ${order._id}`}>
            <IconEye size={18} />
          </ActionIcon>
        </Table.Td>
      </Table.Tr>
    );
  });


  return (
    <AdminLayout>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Orders</Title>
        {/* <Button leftSection={<IconPlus size={16} />} component={Link} href="/admin/orders/new"> Add New Order </Button> */}
      </Group>

      <Paper withBorder shadow="sm" radius="md" p="md" mb="xl">
         <Grid grow gutter="md">
            <Grid.Col span={{ base: 12, md: 6, lg:4 }}>
                <TextInput
                    placeholder="Search Order ID, Customer..."
                    leftSection={<IconSearch size={16} />}
                    value={searchTerm}
                    onChange={handleSearchChange}
                />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6, lg:3 }}>
                <Select
                    placeholder="Filter by status"
                    leftSection={<IconFilter size={16} />}
                    data={[{ label: 'All Statuses', value: '' }, ...ORDER_STATUSES.map(s => ({label: s.charAt(0).toUpperCase() + s.slice(1), value: s}))]}
                    value={selectedStatus}
                    onChange={handleStatusChange}
                    clearable
                />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6, lg:2.5 }}>
                <DateInput
                    placeholder="From date"
                    value={dateRange[0]}
                    onChange={(date) => handleDateRangeChange([date, dateRange[1]])}
                    leftSection={<IconCalendarEvent size={16} />}
                    clearable
                    maxDate={dateRange[1] || undefined}
                    popoverProps={{ withinPortal: true }}
                />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6, lg:2.5 }}>
                <DateInput
                    placeholder="To date"
                    value={dateRange[1]}
                    onChange={(date) => handleDateRangeChange([dateRange[0], date])}
                    leftSection={<IconCalendarEvent size={16} />}
                    clearable
                    minDate={dateRange[0] || undefined}
                    popoverProps={{ withinPortal: true }}
                />
            </Grid.Col>
         </Grid>
      </Paper>

      {error && !isLoading && (
         <Alert title="Error Fetching Orders" color="red" icon={<IconAlertCircle />} withCloseButton onClose={() => setError(null)} mb="lg">
             {error} Please try <Button variant="subtle" size="xs" onClick={() => fetchOrders(currentPage, debouncedSearchTerm, selectedStatus, dateRange)}>reloading</Button>.
         </Alert>
      )}

      <Paper withBorder shadow="sm" radius="md">
         <ScrollArea>
             <LoadingOverlay visible={isLoading && authStatus === 'authenticated'} overlayProps={{ radius: 'sm', blur: 1 }} />
             {!isLoading && !error && orders.length === 0 && (
                 <Text p="xl" ta="center" c="dimmed">No orders found matching your criteria.</Text>
             )}
             {!error && orders.length > 0 && (
                 <Table striped highlightOnHover verticalSpacing="md" miw={900}> {/* Increased verticalSpacing */}
                     <Table.Thead>
                     <Table.Tr>
                         <Table.Th>Order ID</Table.Th>
                         <Table.Th>Customer</Table.Th>
                         <Table.Th>Date</Table.Th>
                         <Table.Th>Total</Table.Th>
                         <Table.Th>Status</Table.Th>
                         <Table.Th>Items</Table.Th>
                         <Table.Th>Actions</Table.Th>
                     </Table.Tr>
                     </Table.Thead>
                     <Table.Tbody>{rows}</Table.Tbody>
                 </Table>
             )}
         </ScrollArea>
      </Paper>

      {totalPages > 1 && !error && orders.length > 0 && (
         <Group justify="center" mt="xl">
             <Pagination total={totalPages} value={currentPage} onChange={handlePageChange} />
         </Group>
      )}
      <Space h="xl" />
    </AdminLayout>
  );
}
