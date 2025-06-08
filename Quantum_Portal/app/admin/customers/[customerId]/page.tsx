'use client';

import AdminLayout from '../../../../components/admin/AdminLayout';
import { Title, Text, Paper, Group, Button, LoadingOverlay, Alert, Divider, Grid, Card, Badge, Space, ThemeIcon, Switch, Table, ScrollArea, ActionIcon, Menu } from '@mantine/core';
import { IconAlertCircle, IconDeviceFloppy, IconUserCircle, IconMapPin, IconCalendarEvent, IconMail, IconUserCheck, IconUserOff, IconArrowLeft, IconPencil, IconEye, IconEdit, IconDotsVertical, IconShoppingCart, IconReceipt } from '@tabler/icons-react'; // Added IconPencil
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { hasPermission, Permission, Role } from '../../../../lib/permissions'; // Import permission utils
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';

interface Address {
     _id?: string; // Mongoose subdocuments might have _id
     street?: string; // Changed from addressLine1 for consistency with Customer model
     city?: string;
     state?: string;
     zipCode?: string; // Changed from postalCode
     country?: string;
     type?: 'shipping' | 'billing';
     isDefaultShipping?: boolean;
     isDefaultBilling?: boolean;
     // Ensure this matches schema in Customer.ts
}

interface OrderItem {
     product: { name: string; sku?: string; } | string;
     quantity: number;
     price: number;
}

interface OrderCustomer {
     _id: string;
     firstName?: string;
     lastName?: string;
     email: string;
}

interface Order {
  _id: string;
  orderNumber?: string; // MongoDB auto-generated order number
  customer?: OrderCustomer | string;
  orderItems: OrderItem[];
  totalAmount: number;
  status: string;
  paymentStatus: 'unpaid' | 'paid';
  createdAt: string;
}

interface Customer {
    _id: string;
    firstName?: string;
    lastName?: string;
    email: string;
    phoneNumber?: string; // Added phone number field
    isActive: boolean;
    addresses?: Address[];
    createdAt: string;
    updatedAt: string;
    // orderCount?: number;
}

const getStatusColor = (status: string) => {
     switch (status?.toLowerCase()) {
     case 'pending': return 'yellow';
     case 'processing': return 'blue';
     case 'shipped': return 'cyan';
     case 'delivered': return 'green';
     case 'cancelled': return 'red';
     case 'refunded': return 'gray';
     case 'on-hold': return 'orange';
     case 'failed': return 'pink';
     case 'completed': return 'teal';
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

const getAccountStatusColor = (isActive: boolean) => isActive ? 'green' : 'gray';

export default function CustomerDetailsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const customerId = params?.customerId as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false); // Renamed for clarity
  const [error, setError] = useState<string | null>(null);

  const [currentIsActive, setCurrentIsActive] = useState<boolean>(false);

  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [showAllOrders, setShowAllOrders] = useState(false);

  const userRole = (session?.user as any)?.role as Role | undefined;
  const canManageCustomers = userRole ? hasPermission(userRole, Permission.MANAGE_CUSTOMERS) : false;


  const fetchCustomerDetails = useCallback(async () => {
    if (!customerId || authStatus !== 'authenticated') return;
    // Permission check before fetching
    if (authStatus === 'authenticated' && !canManageCustomers) {
        setError("You don't have permission to view this customer.");
        setIsLoading(false);
        notifications.show({ title: 'Access Denied', message: "You don't have permission to view customer details.", color: 'red'});
        return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/customers/${customerId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const result = await response.json(); // API returns { success: true, customer: data }
      if (result.success && result.customer) {
        setCustomer(result.customer);
        setCurrentIsActive(result.customer.isActive);
      } else {
        throw new Error(result.message || 'Customer data not found in response.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch customer details.');
      setCustomer(null);
      notifications.show({ title: 'Error Loading Customer', message: err.message, color: 'red' });
    } finally {
      setIsLoading(false);
    }
  }, [customerId, authStatus, canManageCustomers]); // Added canManageCustomers

  const fetchCustomerOrders = useCallback(async () => {
    if (!customerId || !canManageCustomers) return;

    setIsLoadingOrders(true);
    setOrdersError(null);
    try {
      const response = await fetch(`/api/admin/orders?customerId=${customerId}&limit=${showAllOrders ? 100 : 5}&page=1`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      setOrders(result.orders || []);
    } catch (err: any) {
      setOrdersError(err.message || 'Failed to fetch customer orders.');
      setOrders([]);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [customerId, canManageCustomers, showAllOrders]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/admin/login');
    } else if (authStatus === 'authenticated' && customerId) { // Ensure authStatus is 'authenticated'
      fetchCustomerDetails();
    }
  }, [authStatus, router, customerId, fetchCustomerDetails]);

  useEffect(() => {
    // Fetch orders when customer is loaded and user has permissions
    if (customer && canManageCustomers) {
      fetchCustomerOrders();
    }
  }, [customer, canManageCustomers, fetchCustomerOrders]);

  const handleIsActiveToggle = async () => {
     if (customer === null || currentIsActive === customer.isActive) {
         notifications.show({ title: 'No Change', message: 'Status is already the same.', color: 'blue' });
         return;
     }
     setIsUpdatingStatus(true);
     setError(null);
     try {
         // Send only the isActive field for a partial update
         const response = await fetch(`/api/admin/customers/${customerId}`, {
             method: 'PUT',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
                firstName: customer.firstName,
                lastName: customer.lastName,
                email: customer.email,
                phoneNumber: customer.phoneNumber,
                isActive: currentIsActive,
                addresses: customer.addresses || []
            }),
         });
         const result = await response.json();
         if (!response.ok || !result.success) {
             throw new Error(result.message || 'Failed to update customer status.');
         }
         setCustomer(result.customer); // API returns updated customer
         setCurrentIsActive(result.customer.isActive);
         notifications.show({
             title: 'Status Updated',
             message: `Customer account is now ${result.customer.isActive ? 'Active' : 'Inactive'}.`,
             color: 'green',
             icon: <IconDeviceFloppy />,
         });
     } catch (err: any) {
         setError(err.message);
         notifications.show({ title: 'Update Error', message: err.message, color: 'red' });
         if(customer) setCurrentIsActive(customer.isActive); // Revert UI change
     } finally {
         setIsUpdatingStatus(false);
     }
  };

  if (authStatus === 'loading' || (isLoading && authStatus === 'authenticated' && !customer && !error) ) { // Show loading if loading, or if no customer and no error yet
     return <AdminLayout><LoadingOverlay visible={true} overlayProps={{ radius: 'sm', blur: 2, fixed: true }} /></AdminLayout>;
  }
  if (authStatus === 'unauthenticated') {
     return <Text p="xl">Redirecting to login...</Text>;
  }
  // Page-level permission check after auth status is confirmed
  if (authStatus === 'authenticated' && !canManageCustomers) {
    return (
        <AdminLayout>
            <Paper p="xl">
                <Title order={3}>Access Denied</Title>
                <Text>You do not have permission to view customer details.</Text>
                <Button component={Link} href="/admin" mt="md">Go to Dashboard</Button>
            </Paper>
        </AdminLayout>
    );
  }

  if (error && !customer && !isLoading) { // If there was an error and no customer data could be loaded
     return (
        <AdminLayout>
            <Group justify="space-between" mb="xl"><Title order={2}>Customer Details</Title><Button variant="outline" component={Link} href="/admin/customers" leftSection={<IconArrowLeft size={16}/>}>Back</Button></Group>
            <Alert title="Error Loading Customer" color="red" icon={<IconAlertCircle />}>{error}</Alert>
        </AdminLayout>
    );
  }
  if (!customer && !isLoading) { // If not loading, no error, but still no customer (e.g. ID was invalid but not caught, or API returned success:false without error)
     return (
        <AdminLayout>
             <Group justify="space-between" mb="xl"><Title order={2}>Customer Details</Title><Button variant="outline" component={Link} href="/admin/customers" leftSection={<IconArrowLeft size={16}/>}>Back</Button></Group>
            <Text p="xl" ta="center">Customer not found or still loading...</Text>
        </AdminLayout>
    );
  }

  const renderAddressCard = (addr: Address, index: number) => (
     <Paper key={addr._id || index} p="sm" withBorder radius="sm" mb="sm">
         <Text fw={500} mb={2}>
            Address {index + 1}
            {addr.type && <Badge ml="xs" variant="outline">{addr.type.charAt(0).toUpperCase() + addr.type.slice(1)}</Badge>}
            {addr.isDefaultShipping && <Badge ml="xs" color="blue" variant="light">Default Shipping</Badge>}
            {addr.isDefaultBilling && <Badge ml="xs" color="green" variant="light">Default Billing</Badge>}
         </Text>
         <Text>{addr.street || ''}</Text>
         <Text>{addr.city || ''}, {addr.state || ''} {addr.zipCode || ''}</Text>
         <Text>{addr.country || ''}</Text>
     </Paper>
  );

  return (
    <AdminLayout>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Customer Details: {customer?.firstName || ''} {customer?.lastName || customer?.email}</Title>
        <Group>
            {canManageCustomers && customerId && (
                 <Button component={Link} href={`/admin/customers/${customerId}/edit`} leftSection={<IconPencil size={16}/>}>
                    Edit Customer
                </Button>
            )}
            <Button variant="outline" component={Link} href="/admin/customers" leftSection={<IconArrowLeft size={16}/>}>Back to Customers</Button>
        </Group>
      </Group>

      {error && !isUpdatingStatus && ( // Show general page error if no specific update is happening
         <Alert title="Page Error" color="red" icon={<IconAlertCircle />} withCloseButton onClose={() => setError(null)} mb="lg">
             {error}
         </Alert>
      )}

     <Grid gutter="lg">
         <Grid.Col span={{ base: 12, md: 7 }}> {/* Ensure customer is not null before accessing its properties */}
             <Paper withBorder shadow="sm" p="md" radius="md" mb="lg">
                 <Group gap="xs" mb="sm">
                     <ThemeIcon variant="light" size="lg" radius="md"><IconUserCircle size="1.5rem" /></ThemeIcon>
                     <Title order={4}>Profile Information</Title>
                 </Group>
                 <Text><strong>Name:</strong> {customer ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'N/A' : 'N/A'}</Text>
                 <Text><strong>Email:</strong> {customer?.email ? <a href={`mailto:${customer.email}`}>{customer.email}</a> : 'N/A'}</Text>
                 {/* Display phone number if available on customer object (not directly on model currently) */}
                 {customer?.phoneNumber && <Text><strong>Phone:</strong> {customer.phoneNumber}</Text>}
                 <Text mt="xs"><strong>Registered:</strong> {customer ? dayjs(customer.createdAt).format('MMM D, YYYY h:mm A') : 'N/A'}</Text>
                 <Text size="xs" c="dimmed"><strong>Last Updated:</strong> {customer ? dayjs(customer.updatedAt).format('MMM D, YYYY h:mm A') : 'N/A'}</Text>
             </Paper>

             <Paper withBorder shadow="sm" p="md" radius="md" mb="lg">
                 <Group gap="xs" mb="sm">
                      <ThemeIcon variant="light" size="lg" radius="md"><IconMapPin size="1.5rem" /></ThemeIcon>
                      <Title order={4}>Addresses</Title>
                 </Group>
                 {customer?.addresses && customer.addresses.length > 0
                    ? customer.addresses.map((addr, index) => renderAddressCard(addr, index))
                    : <Text c="dimmed">No addresses on file for this customer.</Text>
                 }
             </Paper>
         </Grid.Col>

         <Grid.Col span={{ base: 12, md: 5 }}>
              <Card withBorder p="md" radius="md" mb="lg">
                 <Group gap="xs" mb="sm" align="center">
                     <ThemeIcon variant="light" color={getAccountStatusColor(currentIsActive)} size="xl" radius="md">
                         {currentIsActive ? <IconUserCheck size="1.5rem" /> : <IconUserOff size="1.5rem" />}
                     </ThemeIcon>
                     <div>
                         <Text fw={700}>Account Status</Text>
                         <Badge color={getAccountStatusColor(currentIsActive)} size="lg" radius="sm" variant="filled">
                             {currentIsActive ? 'Active' : 'Inactive'}
                         </Badge>
                     </div>
                 </Group>
                 <Divider my="sm" />
                 {canManageCustomers && ( // Only show status update controls if user has permission
                     <>
                        <Switch
                            labelPosition='left'
                            label={currentIsActive ? "Account is Active" : "Account is Inactive"}
                            checked={currentIsActive}
                            onChange={(event) => setCurrentIsActive(event.currentTarget.checked)}
                            color={currentIsActive ? "green" : "red"}
                            size="md"
                            disabled={isUpdatingStatus || isLoading}
                            mb="sm"
                            styles={{ root: { display: 'flex', justifyContent: 'space-between'}, label: { fontWeight: 500 } }}
                        />
                        <Button
                            fullWidth
                            onClick={handleIsActiveToggle} // Renamed handler
                            loading={isUpdatingStatus}
                            leftSection={<IconDeviceFloppy size={16}/>}
                            disabled={!customer || customer.isActive === currentIsActive || isLoading}
                        >
                            Save Status Change
                        </Button>
                     </>
                 )}
                 {!canManageCustomers && <Text size="sm" c="dimmed">You do not have permission to change account status.</Text>}
             </Card>
             <Paper withBorder shadow="sm" p="md" radius="md">
                 <Group justify="space-between" align="center" mb="md">
                     <Group gap="xs">
                         <ThemeIcon variant="light" size="lg" radius="md">
                             <IconShoppingCart size="1.5rem" />
                         </ThemeIcon>
                         <Title order={4}>Order History</Title>
                         {orders.length > 0 && (
                             <Badge variant="light" color="blue">
                                 {orders.length} order{orders.length !== 1 ? 's' : ''}
                             </Badge>
                         )}
                     </Group>
                     {orders.length > 5 && !showAllOrders && (
                         <Button 
                             variant="outline" 
                             size="xs" 
                             onClick={() => setShowAllOrders(true)}
                             loading={isLoadingOrders}
                         >
                             Show All Orders
                         </Button>
                     )}
                     {orders.length > 0 && (
                         <Button 
                             variant="outline" 
                             size="xs" 
                             component={Link} 
                             href={`/admin/orders?customerId=${customer?._id || ''}`}
                             leftSection={<IconReceipt size={14} />}
                         >
                             View in Orders Page
                         </Button>
                     )}
                 </Group>

                 {ordersError && (
                     <Alert color="red" mb="md" icon={<IconAlertCircle />}>
                         {ordersError}
                     </Alert>
                 )}

                 {isLoadingOrders ? (
                     <LoadingOverlay visible={true} overlayProps={{ radius: 'sm', blur: 1 }} />
                 ) : orders.length === 0 ? (
                     <Text c="dimmed" ta="center" py="xl">
                         No orders found for this customer.
                     </Text>
                 ) : (
                     <ScrollArea>
                         <Table striped highlightOnHover verticalSpacing="sm" miw={700}>
                             <Table.Thead>
                                 <Table.Tr>
                                     <Table.Th>Order ID</Table.Th>
                                     <Table.Th>Date</Table.Th>
                                     <Table.Th>Total</Table.Th>
                                     <Table.Th>Payment</Table.Th>
                                     <Table.Th>Status</Table.Th>
                                     <Table.Th>Items</Table.Th>
                                     <Table.Th>Actions</Table.Th>
                                 </Table.Tr>
                             </Table.Thead>
                             <Table.Tbody>
                                 {orders.map((order) => (
                                     <Table.Tr key={order._id}>
                                         <Table.Td>
                                             <Link href={`/admin/orders/${order._id}`} passHref legacyBehavior>
                                                 <Text component="a" c="blue.6" fw={500} size="sm">
                                                     #{order.orderNumber || order._id.substring(0, 8) + '...'}
                                                 </Text>
                                             </Link>
                                         </Table.Td>
                                         <Table.Td>
                                             <Text size="sm">
                                                 {dayjs(order.createdAt).format('MMM D, YYYY')}
                                             </Text>
                                             <Text size="xs" c="dimmed">
                                                 {dayjs(order.createdAt).format('h:mm A')}
                                             </Text>
                                         </Table.Td>
                                         <Table.Td>
                                             <Text fw={500} size="sm">
                                                 ${order.totalAmount.toFixed(2)}
                                             </Text>
                                         </Table.Td>
                                         <Table.Td>
                                             <Badge 
                                                 color={getPaymentStatusColor(order.paymentStatus)} 
                                                 variant="light" 
                                                 radius="sm"
                                                 size="sm"
                                             >
                                                 {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                                             </Badge>
                                         </Table.Td>
                                         <Table.Td>
                                             <Badge 
                                                 color={getStatusColor(order.status)} 
                                                 variant="light" 
                                                 radius="sm"
                                                 size="sm"
                                             >
                                                 {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                             </Badge>
                                         </Table.Td>
                                         <Table.Td>
                                             <Text size="sm">
                                                 {order.orderItems.reduce((acc, item) => acc + item.quantity, 0)} item{order.orderItems.reduce((acc, item) => acc + item.quantity, 0) !== 1 ? 's' : ''}
                                             </Text>
                                         </Table.Td>
                                         <Table.Td>
                                             <Menu shadow="md" width={180} withinPortal position="bottom-end">
                                                 <Menu.Target>
                                                     <ActionIcon variant="subtle" color="gray" size="sm">
                                                         <IconDotsVertical size={16} />
                                                     </ActionIcon>
                                                 </Menu.Target>
                                                 <Menu.Dropdown>
                                                     <Menu.Item 
                                                         leftSection={<IconEye size={14} />} 
                                                         component={Link} 
                                                         href={`/admin/orders/${order._id}`}
                                                     >
                                                         View Details
                                                     </Menu.Item>
                                                     <Menu.Item 
                                                         leftSection={<IconEdit size={14} />} 
                                                         component={Link} 
                                                         href={`/admin/orders/${order._id}/edit`}
                                                     >
                                                         Edit Order
                                                     </Menu.Item>
                                                 </Menu.Dropdown>
                                             </Menu>
                                         </Table.Td>
                                     </Table.Tr>
                                 ))}
                             </Table.Tbody>
                         </Table>
                     </ScrollArea>
                 )}
             </Paper>
         </Grid.Col>
     </Grid>
      <Space h="xl" />
    </AdminLayout>
  );
}
