'use client';

import AdminLayout from '../../../../components/admin/AdminLayout';
import { Title, Text, Paper, Group, Button, LoadingOverlay, Alert, Select, Divider, Table, Image, Grid, Card, Badge, Space, ThemeIcon, ScrollArea } from '@mantine/core';
import { IconAlertCircle, IconDeviceFloppy, IconTruckDelivery, IconFileInvoice, IconUserCircle, IconMapPin, IconReceipt, IconEdit, IconArrowLeft } from '@tabler/icons-react';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
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
    name?: string; // Denormalized product name (variant-specific)
    sku?: string; // Denormalized SKU (variant-specific)
    image?: string; // Denormalized image URL (variant-specific)
    quantity: number;
    price: number;
    selectedAttributes?: Map<string, string> | Record<string, string>; // Can be Map or plain object
    // Variant-specific fields for consistency with create and edit order pages
    isVariantProduct?: boolean;
    variantId?: string;
}
interface Address { // Define a basic address structure
    fullName: string; // Required field
    phone: string; // Added
    email?: string; // Added
    street: string; // Was street1
    city: string;
    district: string; // Was state, now more specific
    state?: string; // Optional for broader region
    postalCode: string;
    country: string;
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
    paymentStatus: 'unpaid' | 'paid'; // Added
    paymentMethod?: string; // Added payment method
    shippingAddress: Address; // Changed to required, as per new model
    billingAddress?: Address;
    paymentDetails?: PaymentDetails; // Keep for now, though paymentStatus is primary
    deliveryNote?: string; // Added
    createdAt: string;
    updatedAt: string;
}

// VALID_ORDER_STATUSES from list page, can be reused or redefined if different
const VALID_ORDER_STATUSES_DETAILS = [
  'pending', 'processing', 'shipped', 'delivered', 'completed',
  'cancelled', 'refunded', 'on-hold', 'failed'
];

const getStatusColor = (status: string) => {
     switch (status?.toLowerCase()) {
     case 'pending': return 'yellow';
     case 'completed': return 'teal';
     case 'processing': return 'blue';
     case 'shipped': return 'cyan';
     case 'delivered': return 'green';
     case 'cancelled': return 'red';
     case 'refunded': return 'dark';
     case 'on-hold': return 'orange';
     case 'failed': return 'pink';
     default: return 'gray';
     }
 };

const getPaymentStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid': return 'green';
      case 'unpaid': return 'red';
      default: return 'gray';
    }
};


export default function OrderDetailsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const orderId = params?.orderId as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingOrderStatus, setIsUpdatingOrderStatus] = useState(false);
  const [isUpdatingPaymentStatus, setIsUpdatingPaymentStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderStatus, setSelectedOrderStatus] = useState<string>('');
  // No selectedPaymentStatus state needed if using buttons or direct calls

  const fetchOrderDetails = useCallback(async () => {
    if (!orderId || authStatus !== 'authenticated') return;
    setIsLoading(true);
    setError(null);
    try {
      // IMPORTANT: The /api/admin/orders/[orderId] (GET) endpoint
      // MUST be updated to return the new fields: paymentStatus, deliveryNote,
      // and the updated shippingAddress structure.
      const response = await fetch(`/api/admin/orders/${orderId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const result = await response.json(); // Assuming API returns { success: true, data: order }
      if (result.success) {
        setOrder(result.data);
        setSelectedOrderStatus(result.data.status);
      } else {
        throw new Error(result.message || 'Failed to parse order data.');
      }
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
    } else if (orderId) {
      fetchOrderDetails();
    }
  }, [authStatus, router, orderId, fetchOrderDetails]);

  const handleOrderStatusUpdate = async () => {
     if (!selectedOrderStatus || selectedOrderStatus === order?.status) {
         notifications.show({ title: 'No Change', message: 'Order status is already the same or not selected.', color: 'blue' });
         return;
     }
     setIsUpdatingOrderStatus(true);
     setError(null);
     try {
         const response = await fetch(`/api/admin/orders/${orderId}/update-order-status`, { // Correct endpoint
             method: 'PUT',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ status: selectedOrderStatus }),
         });
         const result = await response.json();
         if (!response.ok || !result.success) {
             throw new Error(result.message || 'Failed to update order status.');
         }
         setOrder(result.data); // API returns updated order
         setSelectedOrderStatus(result.data.status);
         notifications.show({
             title: 'Order Status Updated',
             message: `Order status successfully updated to ${result.data.status}.`,
             color: 'green',
             icon: <IconTruckDelivery />,
         });
     } catch (err: any) {
         setError(err.message); // Set error for display within the page if needed
         notifications.show({ title: 'Update Error', message: err.message, color: 'red' });
     } finally {
         setIsUpdatingOrderStatus(false);
     }
  };

  const handlePaymentStatusUpdate = async (newPaymentStatus: 'paid' | 'unpaid') => {
    if (order?.paymentStatus === newPaymentStatus) {
        notifications.show({ title: 'No Change', message: `Payment status is already ${newPaymentStatus}.`, color: 'blue' });
        return;
    }
    setIsUpdatingPaymentStatus(true);
    setError(null);
    try {
        const response = await fetch(`/api/admin/orders/${orderId}/update-payment-status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentStatus: newPaymentStatus }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Failed to update payment status.');
        }
        setOrder(result.data); // API returns updated order
        notifications.show({
            title: 'Payment Status Updated',
            message: `Payment status successfully updated to ${result.data.paymentStatus}.`,
            color: 'green',
            icon: <IconReceipt />,
        });
    } catch (err: any) {
        setError(err.message);
        notifications.show({ title: 'Update Error', message: err.message, color: 'red' });
    } finally {
        setIsUpdatingPaymentStatus(false);
    }
 };


  if (authStatus === 'loading' || (isLoading && authStatus === 'authenticated')) {
     return <AdminLayout><LoadingOverlay visible={true} overlayProps={{ radius: 'sm', blur: 2, fixed: true }} /></AdminLayout>;
  }
  if (authStatus === 'unauthenticated') {
     return <Text p="xl">Redirecting to login...</Text>;
  }
  if (error && !order && !isLoading) { // Show error if loading failed and no order data
     return <AdminLayout><Alert title="Error Loading Order Details" color="red" icon={<IconAlertCircle />}>{error}</Alert></AdminLayout>;
  }
  if (!order) { // If still no order after loading (e.g. fetch error cleared but order is null)
     return <AdminLayout><Text p="xl" ta="center">Order not found or still loading...</Text></AdminLayout>;
  }

  // Updated renderAddress to match new Address structure from Order model
  const renderAddress = (addr: Address | undefined, type: string) => {
     if (!addr) return <Text c="dimmed">Not provided for {type}</Text>;
     return (
         <Paper p="sm" withBorder radius="sm" mt="sm">
             <Text fw={500} mb={2}>{type} Details:</Text>
             <Text><strong>Recipient:</strong> {addr.fullName}</Text>
             <Text><strong>Phone:</strong> {addr.phone}</Text>
             {addr.email && <Text><strong>Email:</strong> {addr.email}</Text>}
             <Text><strong>Address:</strong> {addr.street}</Text>
             <Text>{addr.city}, {addr.district}</Text>
             <Text>{addr.postalCode}, {addr.country}</Text>
             {addr.state && <Text>(State/Region: {addr.state})</Text>}
         </Paper>
     );
  };

  const customerDisplayName = order.customer
    ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || order.customer.email
    : 'Guest Customer';

  return (
    <AdminLayout>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Order Details</Title>
        <Button variant="outline" onClick={() => router.push('/admin/orders')} leftSection={<IconArrowLeft size={16}/>}>Back to Orders</Button>
      </Group>

      {error && !isUpdatingOrderStatus && !isUpdatingPaymentStatus && ( // Show general page error if no specific update is happening
         <Alert title="Page Error" color="red" icon={<IconAlertCircle />} withCloseButton onClose={() => setError(null)} mb="lg">
             {error}
         </Alert>
      )}

     <Grid gutter="lg">
         <Grid.Col span={{ base: 12, lg: 8 }}>
             <Paper withBorder shadow="sm" p="md" radius="md" mb="lg">
                 <Title order={4} mb="sm">Order Items</Title>
                 {/* TODO: Add a check for order.orderItems being an array and having length */}
                 <ScrollArea>
                    <Table striped highlightOnHover verticalSpacing="sm" miw={700}>
                        <Table.Thead>
                            <Table.Tr><Table.Th>Product</Table.Th><Table.Th>SKU</Table.Th><Table.Th>Attributes</Table.Th><Table.Th style={{textAlign: 'center'}}>Qty</Table.Th><Table.Th style={{textAlign: 'right'}}>Unit Price</Table.Th><Table.Th style={{textAlign: 'right'}}>Total</Table.Th></Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {order.orderItems && order.orderItems.map(item => {
                                const product = item.product; // Already populated or null
                                
                                // Use order item's stored image if available, otherwise fallback to product images
                                const imageUrl = (item as any).image || 
                                    (product?.images?.[0]
                                        ? (typeof product.images[0] === 'string' ? product.images[0] : (product.images[0] as ProductImage).url)
                                        : '/placeholder-image.png');
                                
                                // Use order item's stored name if available, otherwise fallback to product name
                                const itemName = (item as any).name || product?.name || 'Product Not Found';
                                
                                // Use order item's stored SKU if available, otherwise fallback to product SKU
                                const itemSku = (item as any).sku || product?.sku || 'N/A';
                                
                                // Handle selectedAttributes - could be Map or plain object
                                const renderAttributes = () => {
                                    if (!item.selectedAttributes) return <Text size="sm" c="dimmed">No attributes</Text>;
                                    
                                    let attributesObj: Record<string, string> = {};
                                    
                                    // Convert Map to object if needed
                                    if (item.selectedAttributes instanceof Map) {
                                        attributesObj = Object.fromEntries(item.selectedAttributes);
                                    } else {
                                        attributesObj = item.selectedAttributes as Record<string, string>;
                                    }
                                    
                                    const attributeEntries = Object.entries(attributesObj);
                                    
                                    if (attributeEntries.length === 0) {
                                        return <Text size="sm" c="dimmed">No attributes</Text>;
                                    }
                                    
                                    return (
                                        <div>
                                            {attributeEntries.map(([key, value]) => (
                                                <Badge key={key} size="sm" variant="outline" mr={4} mb={2}>
                                                    {key}: {value}
                                                </Badge>
                                            ))}
                                        </div>
                                    );
                                };
                                
                                return (
                                <Table.Tr key={item._id || (product?._id || Math.random().toString())}>
                                    <Table.Td>
                                        <Group gap="sm" wrap="nowrap">
                                            <Image src={imageUrl} alt={itemName} w={40} h={40} fit="contain" radius="sm" />
                                            <div>
                                                <Text size="sm" fw={500}>{itemName}</Text>
                                                {item.isVariantProduct && item.variantId && (
                                                    <Badge size="xs" variant="light" color="blue" mt={2}>
                                                        Variant Product
                                                    </Badge>
                                                )}
                                            </div>
                                        </Group>
                                    </Table.Td>
                                    <Table.Td>{itemSku}</Table.Td>
                                    <Table.Td>{renderAttributes()}</Table.Td>
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

             {/* Delivery Note Display */}
            {order.deliveryNote && (
                <Paper withBorder shadow="sm" p="md" radius="md" mb="lg">
                    <Title order={4} mb="xs">Delivery Note</Title>
                    <Text>{order.deliveryNote}</Text>
                </Paper>
            )}

            {/* Removed old paymentDetails block, will rely on new payment status controls */}
         </Grid.Col>

         <Grid.Col span={{ base: 12, lg: 4 }}>
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
                 <Text fw={500} size="sm">Payment Method:</Text>
                 <Text size="sm" c="dimmed" mb="xs">{order.paymentMethod || 'N/A'}</Text>

                 <Title order={5} mb="xs">Payment Status</Title>
                 <Group mb="sm">
                    <Badge color={getPaymentStatusColor(order.paymentStatus)} size="lg" radius="sm" variant="filled">
                        {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                    </Badge>
                 </Group>
                 <Group grow>
                    <Button
                        size="xs" variant="outline" color="green"
                        onClick={() => handlePaymentStatusUpdate('paid')}
                        disabled={order.paymentStatus === 'paid' || isUpdatingPaymentStatus || isUpdatingOrderStatus}
                        loading={isUpdatingPaymentStatus && order.paymentStatus !== 'paid'}
                    >Mark Paid</Button>
                    <Button
                        size="xs" variant="outline" color="red"
                        onClick={() => handlePaymentStatusUpdate('unpaid')}
                        disabled={order.paymentStatus === 'unpaid' || isUpdatingPaymentStatus || isUpdatingOrderStatus}
                        loading={isUpdatingPaymentStatus && order.paymentStatus !== 'unpaid'}
                    >Mark Unpaid</Button>
                 </Group>

                 <Divider my="sm" />
                 <Title order={5} mb="xs">Order Status</Title>
                 <Group mb="md" align="center" justify="space-between">
                     <Badge color={getStatusColor(order.status)} size="lg" radius="sm" variant="filled">
                         {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                     </Badge>
                 </Group>
                 <Select
                     label="Change Order Status"
                     data={VALID_ORDER_STATUSES_DETAILS.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
                     value={selectedOrderStatus}
                     onChange={(value) => setSelectedOrderStatus(value || order.status)}
                     mb="sm"
                     disabled={isUpdatingOrderStatus || isLoading || isUpdatingPaymentStatus}
                 />
                 <Button
                     fullWidth
                     onClick={handleOrderStatusUpdate}
                     loading={isUpdatingOrderStatus}
                     leftSection={<IconEdit size={16}/>}
                     disabled={selectedOrderStatus === order.status || isUpdatingPaymentStatus}
                 >
                     Update Order Status
                 </Button>
                 <Button component={Link} href={`/admin/orders/${orderId}/edit`} fullWidth variant="outline" mt="sm">Edit Full Order</Button>
             </Card>

             {order.customer && (
                 <Paper withBorder shadow="sm" p="md" radius="md" mb="lg">
                      <Group gap="xs" mb="sm">
                         <ThemeIcon variant="light" size="lg" radius="md"><IconUserCircle size="1.2rem" /></ThemeIcon>
                         <Title order={4}>Customer</Title>
                     </Group>
                     <Text>{customerDisplayName}</Text>
                     <Text size="sm" c="dimmed">{order.customer.email}</Text>
                     <Button component={Link} href={`/admin/customers/${order.customer._id}`} variant="subtle" size="xs" mt={5}>View Customer</Button>
                 </Paper>
             )}

             {/* Use the updated renderAddress for shipping. Billing address display logic might need adjustment if its structure also changed. */}
             {renderAddress(order.shippingAddress, 'Shipping')}
             {order.billingAddress && renderAddress(order.billingAddress, 'Billing')}
             {/* Removed the "Billing (same as Shipping)" part as shippingAddress is now required and should always exist if order exists */}


         </Grid.Col>
     </Grid>
      <Space h="xl" />
    </AdminLayout>
  );
}
