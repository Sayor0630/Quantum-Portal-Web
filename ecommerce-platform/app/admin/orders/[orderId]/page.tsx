'use client';

import AdminLayout from '../../../../components/admin/AdminLayout';
import { Title, Text, Paper, Group, Button, LoadingOverlay, Alert, Select, Divider, Table, Image, Grid, Card, Badge, Space, ThemeIcon, ScrollArea } from '@mantine/core';
import { IconAlertCircle, IconDeviceFloppy, IconTruckDelivery, IconFileInvoice, IconUserCircle, IconMapPin, IconReceipt, IconEdit, IconArrowLeft } from '@tabler/icons-react'; // Added IconArrowLeft
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';

// Interfaces
interface ProductImage { // Assuming Product model has images structured like this if populated
    url: string;
    public_id?: string; // Optional
}
interface ProductInOrder {
    _id: string;
    name: string;
    sku?: string;
    price: number;
    images?: ProductImage[] | string[]; // Can be array of objects or strings (URLs)
    category?: { name: string; slug: string; };
}
interface OrderItem {
    _id: string; // Mongoose subdocuments get an _id by default
    product: ProductInOrder | null;
    quantity: number;
    price: number;
}
interface Address { // Define a basic address structure
    fullName?: string; // May or may not be present
    street1: string;
    street2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
}
interface OrderCustomer {
    _id: string;
    firstName?: string;
    lastName?: string;
    email: string;
    addresses?: Address[];
}
interface PaymentDetails { // Example structure
    method?: string;
    status?: string;
    transactionId?: string;
    // add other relevant payment fields
}
interface Order {
    _id: string;
    customer?: OrderCustomer;
    orderItems: OrderItem[];
    totalAmount: number;
    status: string;
    shippingAddress?: Address;
    billingAddress?: Address;
    paymentDetails?: PaymentDetails;
    createdAt: string;
    updatedAt: string;
    // adminNotes?: string;
}

const ALLOWED_ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'on-hold', 'failed'];
const getStatusColor = (status: string) => {
     switch (status?.toLowerCase()) {
     case 'pending': return 'yellow';
     case 'processing': return 'blue';
     case 'shipped': return 'cyan';
     case 'delivered': return 'green';
     case 'cancelled': return 'red';
     case 'refunded': return 'dark'; // Changed from gray for better visibility
     case 'on-hold': return 'orange';
     case 'failed': return 'pink';
     default: return 'gray'; // Default for unknown statuses
     }
 };


export default function OrderDetailsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  const fetchOrderDetails = useCallback(async () => {
    if (!orderId || authStatus !== 'authenticated') return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: Order = await response.json();
      setOrder(data);
      setSelectedStatus(data.status);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch order details.');
      setOrder(null);
      notifications.show({ title: 'Error Loading Order', message: err.message, color: 'red' });
    } finally {
      setIsLoading(false);
    }
  }, [orderId, authStatus]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/admin/login');
    } else if (orderId) { // Fetch if authenticated and orderId is present
      fetchOrderDetails();
    }
  }, [authStatus, router, orderId, fetchOrderDetails]);

  const handleStatusUpdate = async () => {
     if (!selectedStatus || selectedStatus === order?.status) {
         notifications.show({ title: 'No Change', message: 'Status is already the same or not selected.', color: 'blue' });
         return;
     }
     setIsUpdatingStatus(true);
     setError(null); // Clear previous general errors
     try {
         const response = await fetch(`/api/admin/orders/${orderId}`, {
             method: 'PUT',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ status: selectedStatus }), // API expects { status, adminNotes, trackingNumber }
         });
         const data = await response.json(); // API should return the updated order
         if (!response.ok) {
             throw new Error(data.message || 'Failed to update order status.');
         }
         setOrder(data);
         setSelectedStatus(data.status);
         notifications.show({
             title: 'Status Updated',
             message: `Order status successfully updated to ${data.status}.`,
             color: 'green',
             icon: <IconTruckDelivery />,
         });
     } catch (err: any) {
         setError(err.message); // Set error for display within the page if needed
         notifications.show({ title: 'Update Error', message: err.message, color: 'red' });
     } finally {
         setIsUpdatingStatus(false);
     }
  };

  if (authStatus === 'loading' || (isLoading && authStatus === 'authenticated')) {
     return <AdminLayout><LoadingOverlay visible={true} overlayProps={{ radius: 'sm', blur: 2, fixed: true }} /></AdminLayout>;
  }
  if (authStatus === 'unauthenticated') {
     return <Text p="xl">Redirecting to login...</Text>;
  }
  if (error && !order && !isLoading) {
     return <AdminLayout><Alert title="Error Loading Order Details" color="red" icon={<IconAlertCircle />}>{error}</Alert></AdminLayout>;
  }
  if (!order) {
     return <AdminLayout><Text p="xl" ta="center">Order not found or still loading...</Text></AdminLayout>;
  }

  const renderAddress = (addr: Address | undefined, type: string) => {
     if (!addr) return <Text c="dimmed">Not provided</Text>;
     return (
         <Paper p="sm" withBorder radius="sm" mt="sm">
             <Text fw={500} mb={2}>{type} Address:</Text>
             {addr.fullName && <Text>{addr.fullName}</Text>}
             <Text>{addr.street1} {addr.street2 || ''}</Text>
             <Text>{addr.city}, {addr.state} {addr.postalCode}</Text>
             <Text>{addr.country}</Text>
             {addr.phone && <Text mt={2} size="xs">Phone: {addr.phone}</Text>}
         </Paper>
     );
  };

  const customerDisplayName = order.customer && typeof order.customer !== 'string'
    ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || order.customer.email
    : 'Guest Customer';

  return (
    <AdminLayout>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Order Details</Title>
        <Button variant="outline" onClick={() => router.push('/admin/orders')} leftSection={<IconArrowLeft size={16}/>}>Back to Orders</Button>
      </Group>

      {error && !isUpdatingStatus && (
         <Alert title="Page Error" color="red" icon={<IconAlertCircle />} withCloseButton onClose={() => setError(null)} mb="lg">
             {error}
         </Alert>
      )}

     <Grid gutter="lg">
         <Grid.Col span={{ base: 12, lg: 8 }}> {/* Main content column */}
             <Paper withBorder shadow="sm" p="md" radius="md" mb="lg">
                 <Title order={4} mb="sm">Order Items</Title>
                 <ScrollArea>
                    <Table striped highlightOnHover verticalSpacing="sm" miw={600}>
                        <Table.Thead>
                            <Table.Tr><Table.Th>Product</Table.Th><Table.Th>SKU</Table.Th><Table.Th style={{textAlign: 'center'}}>Qty</Table.Th><Table.Th style={{textAlign: 'right'}}>Unit Price</Table.Th><Table.Th style={{textAlign: 'right'}}>Total</Table.Th></Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {order.orderItems.map(item => {
                                const productExists = item.product && typeof item.product !== 'string';
                                const imageUrl = productExists && Array.isArray(item.product.images) && item.product.images.length > 0
                                    ? (typeof item.product.images[0] === 'string' ? item.product.images[0] : (item.product.images[0] as ProductImage).url)
                                    : '/placeholder-image.png';
                                return (
                                <Table.Tr key={item._id || (productExists ? item.product._id : Math.random().toString()) }>
                                    <Table.Td>
                                        <Group gap="sm" wrap="nowrap">
                                            <Image src={imageUrl} alt={productExists ? item.product.name : 'Product Image'} w={40} h={40} fit="contain" radius="sm" />
                                            <Text size="sm" fw={500}>{productExists ? item.product.name : 'Product Not Found'}</Text>
                                        </Group>
                                    </Table.Td>
                                    <Table.Td>{productExists ? item.product.sku || 'N/A' : 'N/A'}</Table.Td>
                                    <Table.Td style={{textAlign: 'center'}}>{item.quantity}</Table.Td>
                                    <Table.Td style={{textAlign: 'right'}}>${item.price.toFixed(2)}</Table.Td>
                                    <Table.Td style={{textAlign: 'right'}}>${(item.quantity * item.price).toFixed(2)}</Table.Td>
                                </Table.Tr>
                            );})}
                        </Table.Tbody>
                    </Table>
                 </ScrollArea>
                 <Group justify="flex-end" mt="md" p="xs" style={{borderTop: '1px solid #dee2e6'}}>
                     <Text fw={700} size="lg">Order Total: ${order.totalAmount.toFixed(2)}</Text>
                 </Group>
             </Paper>

             {order.paymentDetails && (
                 <Paper withBorder shadow="sm" p="md" radius="md" mb="lg">
                     <Group gap="xs" mb="sm">
                         <ThemeIcon variant="light" size="lg" radius="md"><IconReceipt size="1.2rem" /></ThemeIcon>
                         <Title order={4}>Payment Details</Title>
                     </Group>
                     <Text>Status: {order.paymentDetails.status || 'N/A'}</Text>
                     <Text>Method: {order.paymentDetails.method || 'N/A'}</Text>
                     <Text>Transaction ID: {order.paymentDetails.transactionId || 'N/A'}</Text>
                 </Paper>
             )}
         </Grid.Col>

         <Grid.Col span={{ base: 12, lg: 4 }}> {/* Sidebar column */}
              <Card withBorder p="md" radius="md" mb="lg">
                 <Group gap="xs" mb="sm" align="center">
                     <ThemeIcon variant="light" color={getStatusColor(order.status)} size="xl" radius="md"><IconFileInvoice size="1.5rem" /></ThemeIcon>
                     <div>
                         <Text fw={500} size="sm">Order ID</Text>
                         <Text size="xs" c="dimmed">{order._id}</Text>
                     </div>
                 </Group>
                 <Text size="xs" c="dimmed" mt={-5} mb="sm">Placed on: {dayjs(order.createdAt).format('MMM D, YYYY h:mm A')}</Text>
                 <Divider my="sm" />
                 <Group mb="md" align="center" justify="space-between">
                     <Text fw={500}>Status:</Text>
                     <Badge color={getStatusColor(order.status)} size="lg" radius="sm" variant="filled">
                         {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                     </Badge>
                 </Group>
                 <Select
                     label="Change Order Status"
                     data={ALLOWED_ORDER_STATUSES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
                     value={selectedStatus}
                     onChange={(value) => setSelectedStatus(value || order.status)}
                     mb="sm"
                     disabled={isUpdatingStatus || isLoading}
                 />
                 <Button
                     fullWidth
                     onClick={handleStatusUpdate}
                     loading={isUpdatingStatus}
                     leftSection={<IconEdit size={16}/>}
                     disabled={selectedStatus === order.status}
                 >
                     Update Status
                 </Button>
             </Card>

             {order.customer && typeof order.customer !== 'string' && (
                 <Paper withBorder shadow="sm" p="md" radius="md" mb="lg">
                      <Group gap="xs" mb="sm">
                         <ThemeIcon variant="light" size="lg" radius="md"><IconUserCircle size="1.2rem" /></ThemeIcon>
                         <Title order={4}>Customer</Title>
                     </Group>
                     <Text>{customerDisplayName}</Text>
                     <Text size="sm" c="dimmed">{order.customer.email}</Text>
                     {/* Link to customer edit page: /admin/customers/edit/[customerId] */}
                     <Button component={Link} href={`/admin/customers/${order.customer._id}`} variant="subtle" size="xs" mt={5}>View Customer</Button>
                 </Paper>
             )}

             {order.shippingAddress && renderAddress(order.shippingAddress, 'Shipping')}
             {order.billingAddress && order.shippingAddress?._id !== order.billingAddress?._id && renderAddress(order.billingAddress, 'Billing')}
             {!order.billingAddress && order.shippingAddress && renderAddress(order.shippingAddress, 'Billing (same as Shipping)')}


         </Grid.Col>
     </Grid>
      <Space h="xl" />
    </AdminLayout>
  );
}
