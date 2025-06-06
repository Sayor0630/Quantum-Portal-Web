'use client';

import AdminLayout from '../../../components/admin/AdminLayout';
import { Title, Text, Paper, Table, Group, Button, ActionIcon, LoadingOverlay, Alert, ScrollArea, Pagination, TextInput, Select, Badge, Space, Grid, Menu } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconEye, IconAlertCircle, IconSearch, IconFilter, IconCalendarEvent, IconPlus, IconDotsVertical, IconEdit, IconReceipt, IconCircleCheck, IconCircleX, IconTruckDelivery } from '@tabler/icons-react';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { notifications } from '@mantine/notifications';
import { Role, Permission, hasPermission } from '../../../lib/permissions';
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
  status: string; // e.g. 'pending', 'processing'
  paymentStatus: 'unpaid' | 'paid'; // Added paymentStatus
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
     case 'completed': return 'teal'; // Added for consistency with model
     default: return 'dimmed';
     }
 };

const getPaymentStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid': return 'green';
      case 'unpaid': return 'red';
      default: return 'gray';
    }
};

// From Order Model
const VALID_ORDER_STATUSES_FOR_DROPDOWN = [
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'refunded', label: 'Refunded' },
    { value: 'on-hold', label: 'On Hold' },
    { value: 'failed', label: 'Failed' },
];


export default function OrdersPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const userRole = (session?.user as any)?.role as Role | undefined;

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false); // For individual row updates

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 500);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string | null>(null); // Renamed for clarity
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);


  const fetchOrders = useCallback(async (page: number, search: string, statusFilter: string | null, dates: [Date | null, Date | null]) => {
    setIsLoading(true); // Overall loading for table
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '10', // Consider making limit configurable
      });
      if (search) queryParams.append('search', search);
      if (statusFilter) queryParams.append('status', statusFilter);
      if (dates[0]) queryParams.append('dateFrom', dayjs(dates[0]).format('YYYY-MM-DD'));
      if (dates[1]) queryParams.append('dateTo', dayjs(dates[1]).format('YYYY-MM-DD'));

      // The API endpoint /api/admin/orders should return paymentStatus for each order
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
    if (authStatus === 'authenticated' && userRole) { // Ensure userRole is available
        // Check if user has permission to view orders
        if (hasPermission(userRole, Permission.VIEW_ORDERS)) {
          fetchOrders(currentPage, debouncedSearchTerm, selectedStatusFilter, dateRange);
        }
    }
  }, [authStatus, router, userRole, currentPage, debouncedSearchTerm, selectedStatusFilter, dateRange, fetchOrders]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.currentTarget.value);
    setCurrentPage(1); // Reset to first page on new search
  };

  const handleStatusFilterChange = (value: string | null) => {
    setSelectedStatusFilter(value);
    setCurrentPage(1); // Reset to first page on filter change
  };

  const handleDateRangeChange = (dates: [Date | null, Date | null]) => {
    setDateRange(dates);
    setCurrentPage(1);
  };



  const handleChangePaymentStatus = async (orderId: string, newPaymentStatus: 'paid' | 'unpaid') => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/update-payment-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: newPaymentStatus }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to update payment status');
      }
      notifications.show({ title: 'Success', message: `Order payment status updated to ${newPaymentStatus}.`, color: 'green' });
      fetchOrders(currentPage, debouncedSearchTerm, selectedStatusFilter, dateRange); // Refresh data
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleChangeOrderStatus = async (orderId: string, newOrderStatus: string) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/update-order-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newOrderStatus }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to update order status');
      }
      notifications.show({ title: 'Success', message: `Order status updated to ${newOrderStatus}.`, color: 'green' });
      fetchOrders(currentPage, debouncedSearchTerm, selectedStatusFilter, dateRange); // Refresh data
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    } finally {
      setIsUpdating(false);
    }
  };


  if (authStatus === 'loading' || (isLoading && authStatus === 'authenticated' && orders.length === 0 && !error) ) {
     return <AdminLayout><LoadingOverlay visible={true} overlayProps={{ radius: 'sm', blur: 2, fixed: true }} /></AdminLayout>;
  }
  if (authStatus === 'unauthenticated') {
     return <Text p="xl">Redirecting to login...</Text>; // Or a more sophisticated redirect component
  }
  // Ensure user has permission to be on this page at all (applies to whole page)
  // This could be a more general "access admin" permission or specific "view orders"
  const canViewPage = userRole && hasPermission(userRole, Permission.VIEW_ORDERS);

  if (!canViewPage && authStatus === 'authenticated') {
    return (
        <AdminLayout>
            <Paper p="xl"><Title order={3}>Access Denied</Title><Text>You do not have permission to view this page.</Text></Paper>
        </AdminLayout>
    );
  }


  const rows = orders.map((order) => {
    const customerName = order.customer && typeof order.customer !== 'string'
        ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || order.customer.email
        : 'Guest';
    return (
        <Table.Tr key={order._id}>
        <Table.Td>
           <Link href={`/admin/orders/${order._id}`} passHref legacyBehavior>
               <Text component="a" c="blue.6" fw={500} size="sm">{order._id.substring(0, 8)}...</Text>
           </Link>
        </Table.Td>
        <Table.Td>{customerName}</Table.Td>
        <Table.Td>{dayjs(order.createdAt).format('MMM D, YYYY h:mm A')}</Table.Td>
        <Table.Td>${order.totalAmount.toFixed(2)}</Table.Td>
        <Table.Td>
           <Badge color={getPaymentStatusColor(order.paymentStatus)} variant="light" radius="sm">
               {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
           </Badge>
        </Table.Td>
        <Table.Td>
           <Badge color={getStatusColor(order.status)} variant="light" radius="sm">
               {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
           </Badge>
        </Table.Td>
        <Table.Td>{order.orderItems.reduce((acc, item) => acc + item.quantity, 0)}</Table.Td>
        <Table.Td>
            <Menu shadow="md" width={200} withinPortal position="bottom-end">
                <Menu.Target>
                    <ActionIcon variant="subtle" color="gray" aria-label="More options">
                        <IconDotsVertical size={18} />
                    </ActionIcon>
                </Menu.Target>
                <Menu.Dropdown>
                    <Menu.Item leftSection={<IconEye size={14} />} component={Link} href={`/admin/orders/${order._id}`}>
                        View Details
                    </Menu.Item>
                    <Menu.Item 
                        leftSection={<IconEdit size={14} />} 
                        component={Link} 
                        href={`/admin/orders/${order._id}/edit`}
                        disabled={!userRole || !hasPermission(userRole, Permission.CREATE_ORDER)}
                    >
                        Edit Order
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Label>Payment Status</Menu.Label>
                    <Menu.Item
                        leftSection={<IconCircleCheck size={14} color="green" />}
                        onClick={() => handleChangePaymentStatus(order._id, 'paid')}
                        disabled={order.paymentStatus === 'paid' || isUpdating}
                    >
                        Mark as Paid
                    </Menu.Item>
                    <Menu.Item
                        leftSection={<IconCircleX size={14} color="red" />}
                        onClick={() => handleChangePaymentStatus(order._id, 'unpaid')}
                        disabled={order.paymentStatus === 'unpaid' || isUpdating}
                    >
                        Mark as Unpaid
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Label>Order Status</Menu.Label>
                    {VALID_ORDER_STATUSES_FOR_DROPDOWN.map(statusOption => (
                        <Menu.Item
                            key={statusOption.value}
                            leftSection={<IconTruckDelivery size={14} />} // Generic icon, could be dynamic
                            onClick={() => handleChangeOrderStatus(order._id, statusOption.value)}
                            disabled={order.status === statusOption.value || isUpdating}
                        >
                            Set to {statusOption.label}
                        </Menu.Item>
                    ))}
                </Menu.Dropdown>
            </Menu>
        </Table.Td>
      </Table.Tr>
    );
  });


  return (
    <AdminLayout>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Orders</Title>
        {userRole && hasPermission(userRole, Permission.CREATE_ORDER) && (
          <Button leftSection={<IconPlus size={16} />} component={Link} href="/admin/orders/new">
            Add New Order
          </Button>
        )}
      </Group>

      <Paper withBorder shadow="sm" radius="md" p="md" mb="xl">
         <Grid grow gutter="md">
            <Grid.Col span={{ base: 12, md: 6, lg:4 }}>
                <TextInput
                    placeholder="Search Order ID, Customer..."
                    leftSection={<IconSearch size={16} />}
                    value={searchTerm}
                    onChange={handleSearchChange}
                    disabled={isLoading}
                />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6, lg:3 }}>
                <Select
                    placeholder="Filter by status"
                    leftSection={<IconFilter size={16} />}
                    data={[{ label: 'All Statuses', value: '' }, ...VALID_ORDER_STATUSES_FOR_DROPDOWN]}
                    value={selectedStatusFilter}
                    onChange={handleStatusFilterChange}
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
                    disabled={isLoading}
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
                    disabled={isLoading}
                />
            </Grid.Col>
         </Grid>
      </Paper>

      {error && !isLoading && ( // Show error only if not loading
         <Alert title="Error Fetching Orders" color="red" icon={<IconAlertCircle />} withCloseButton onClose={() => setError(null)} mb="lg">
             {error} Please try <Button variant="subtle" size="xs" onClick={() => fetchOrders(currentPage, debouncedSearchTerm, selectedStatusFilter, dateRange)}>reloading</Button>.
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
                         <Table.Th>Payment Status</Table.Th>
                         <Table.Th>Order Status</Table.Th>
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
