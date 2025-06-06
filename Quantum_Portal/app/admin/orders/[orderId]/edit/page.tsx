'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '../../../../../components/admin/AdminLayout';
import { Title, Paper, TextInput, Textarea, Button, Group, Space, Text, Select, LoadingOverlay, Grid, NumberInput, ActionIcon, Box } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import Link from 'next/link';
import Image from 'next/image';
import { IconArrowLeft, IconTrash, IconDeviceFloppy } from '@tabler/icons-react';
import dayjs from 'dayjs';

// Interfaces (should align with Order model and previous page definitions)
interface PaymentMethodOption {
  value: string;
  label: string;
}
interface FetchedPaymentMethod {
    _id: string;
    name: string;
    isEnabled: boolean;
}
interface OrderItemProduct {
    _id: string;
    name: string;
    sku?: string;
    images?: Array<{url: string}> | string[]; // Support both formats
}
interface OrderItem {
    _id?: string; // Existing items will have _id
    product?: OrderItemProduct | string | null; // string if product details not populated, or just ID
    productId: string; // Ensure we always have productId for submission
    name: string; // Denormalized name
    price: number; // Price at time of order
    quantity: number;
    image?: string; // Denormalized image
}
interface FormValues {
    fullName: string;
    phoneNumber: string;
    email?: string;
    deliveryAddress: string;
    city: string;
    district: string;
    country: string;
    deliveryNote?: string;
    paymentMethod: string;
    paymentStatus: 'unpaid' | 'paid';
    status: string; // Overall order status
    orderItems: OrderItem[];
    selectedCustomerId?: string | null; // From order.customer
}
// Interface for the fetched order data (align with Order model and API response)
interface FetchedOrder {
    _id: string;
    customer?: { _id: string; firstName?: string; lastName?: string; email: string; };
    orderItems: Array<{
        _id?: string;
        product: OrderItemProduct | string | null; // API might send populated or just ID
        name: string;
        price: number;
        quantity: number;
        image?: string;
    }>;
    totalAmount: number; // Though not directly edited in this form, it's part of order
    status: string;
    paymentStatus: 'unpaid' | 'paid';
    shippingAddress: {
        fullName: string;
        phone: string;
        email?: string;
        street: string;
        city: string;
        district: string;
        postalCode: string;
        country: string;
        state?: string; // Optional broader region
    };
    paymentMethod?: string;
    deliveryNote?: string;
    createdAt: string;
}


// Order statuses (consistent with list page)
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


export default function EditOrderPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.orderId as string;

  const [isLoading, setIsLoading] = useState(true); // For initial order fetch
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [paymentMethodOptions, setPaymentMethodOptions] = useState<PaymentMethodOption[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(true);

  const form = useForm<FormValues>({
    initialValues: {
      fullName: '',
      phoneNumber: '',
      email: '',
      deliveryAddress: '',
      city: '',
      district: '',
      country: 'Bangladesh',
      deliveryNote: '',
      paymentMethod: '',
      paymentStatus: 'unpaid',
      status: 'pending',
      orderItems: [],
      selectedCustomerId: null,
    },
    validate: {
      fullName: (value) => (value.trim().length > 0 ? null : 'Full name is required'),
      phoneNumber: (value) => {
        if (!value) return 'Phone number is required';
        if (!/^\d{11}$/.test(value)) return 'Phone number must be exactly 11 digits';
        if (!/^01/.test(value)) return 'Phone number must start with "01"';
        return null;
      },
      email: (value) => (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? 'Invalid email address' : null),
      deliveryAddress: (value) => (value.trim().length > 0 ? null : 'Delivery address is required'),
      city: (value) => (value.trim().length > 0 ? null : 'City is required'),
      district: (value) => (value.trim().length > 0 ? null : 'District is required'),
      paymentMethod: (value) => (value ? null : 'Payment method is required'),
      status: (value) => (value ? null : 'Order status is required'),
      orderItems: {
        quantity: (value) => (value > 0 ? null : 'Quantity must be greater than 0'),
      }
    },
  });

  const fetchOrderData = useCallback(async () => {
    if (!orderId) return;
    setIsLoading(true);
    setError(null);
    try {
      // API endpoint for fetching single order needs to return all new fields
      const response = await fetch(`/api/admin/orders/${orderId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch order data. Status: ${response.status}`);
      }
      const orderData: FetchedOrder = await response.json(); // Assuming API returns order directly, not {success, data}

      form.setValues({
        fullName: orderData.shippingAddress.fullName || '',
        phoneNumber: orderData.shippingAddress.phone || '',
        email: orderData.shippingAddress.email || '',
        deliveryAddress: orderData.shippingAddress.street || '',
        city: orderData.shippingAddress.city || '',
        district: orderData.shippingAddress.district || '',
        country: orderData.shippingAddress.country || 'Bangladesh',
        deliveryNote: orderData.deliveryNote || '',
        paymentMethod: orderData.paymentMethod || '',
        paymentStatus: orderData.paymentStatus || 'unpaid',
        status: orderData.status || 'pending',
        orderItems: orderData.orderItems.map(item => ({
            _id: item._id,
            // Handle product being string (ID) or object
            productId: typeof item.product === 'string' ? item.product : (item.product?._id || ''),
            name: item.name || (typeof item.product !== 'string' && item.product?.name) || 'N/A',
            price: item.price,
            quantity: item.quantity,
            image: item.image || (typeof item.product !== 'string' && item.product?.images?.[0] as any)?.url || '',
            product: item.product // Keep original product for display if needed
        })),
        selectedCustomerId: orderData.customer?._id || null,
      });

    } catch (err: any) {
      setError(err.message);
      notifications.show({ title: 'Error fetching order', message: err.message, color: 'red' });
    } finally {
      setIsLoading(false);
    }
  }, [orderId, form.setValues]);

  const fetchEnabledPaymentMethods = useCallback(async () => {
    setIsLoadingPaymentMethods(true);
    try {
      const response = await fetch('/api/admin/payment-methods');
      if (!response.ok) throw new Error('Failed to fetch payment methods');
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        const enabledMethods = result.data
          .filter((method: FetchedPaymentMethod) => method.isEnabled)
          .map((method: FetchedPaymentMethod) => ({ value: method.name, label: method.name }));
        setPaymentMethodOptions(enabledMethods);
      } else {
        throw new Error(result.message || 'Invalid data for payment methods');
      }
    } catch (error: any) {
      notifications.show({ title: 'Error Fetching Payment Methods', message: error.message, color: 'red' });
    } finally {
      setIsLoadingPaymentMethods(false);
    }
  }, []);

  useEffect(() => {
    fetchEnabledPaymentMethods();
    if (orderId) {
      fetchOrderData();
    } else {
      setIsLoading(false); // No orderId, so not loading
      setError("No Order ID provided.");
    }
  }, [orderId, fetchOrderData, fetchEnabledPaymentMethods]);

  const handleSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    setError(null);

    const orderUpdatePayload = {
        shippingAddress: {
            fullName: values.fullName,
            phone: values.phoneNumber,
            email: values.email,
            street: values.deliveryAddress,
            city: values.city,
            district: values.district,
            postalCode: form.values.country === 'Bangladesh' ? (values.city.substring(0,2) + values.district.substring(0,2) + "00").toUpperCase() : 'N/A', // Example for postal code, might need actual input
            country: values.country,
        },
        deliveryNote: values.deliveryNote,
        paymentMethod: values.paymentMethod,
        paymentStatus: values.paymentStatus,
        status: values.status,
        orderItems: values.orderItems.map(item => ({
            productId: item.productId, // Ensure this is just the ID string
            name: item.name, // Denormalized name
            price: item.price, // Price at time of order
            quantity: item.quantity,
            image: item.image, // Denormalized image
            _id: item._id // Keep _id for existing items if backend needs it to identify them
        })),
        // customerId is not typically changed during order edit.
        // totalAmount might be recalculated on backend based on items.
    };

    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, { // General update endpoint
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderUpdatePayload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) { // Assuming API returns {success: boolean, ...}
        throw new Error(result.message || 'Failed to update order.');
      }
      notifications.show({ title: 'Order Updated', message: 'Order saved successfully.', color: 'green', icon: <IconDeviceFloppy/> });
      router.push(`/admin/orders/${orderId}`); // Redirect to details page
    } catch (err: any) {
      setError(err.message);
      notifications.show({ title: 'Error updating order', message: err.message, color: 'red' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleItemQuantityChange = (index: number, quantity: number | string) => {
    const newQuantity = typeof quantity === 'string' ? parseInt(quantity, 10) : quantity;
    if (isNaN(newQuantity) || newQuantity < 0) return; // Or set to 0 or 1
    form.setFieldValue(`orderItems.${index}.quantity`, newQuantity);
  };


  if (isLoading || !orderId) {
    return <AdminLayout><LoadingOverlay visible={true} /></AdminLayout>;
  }

  if (error && !isSubmitting) { // Don't show page error if it's a submission error shown on form
    return <AdminLayout><Paper p="xl"><Text c="red">{error}</Text></Paper></AdminLayout>;
  }

  return (
    <AdminLayout>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Edit Order {orderId.substring(0,8)}...</Title>
        <Button component={Link} href={`/admin/orders/${orderId}`} variant="outline" leftSection={<IconArrowLeft size={16} />}>
          Back to Order Details
        </Button>
      </Group>

      <Paper component="form" onSubmit={form.onSubmit(handleSubmit)} shadow="sm" p="xl" radius="md" withBorder>
        <LoadingOverlay visible={isSubmitting || isLoadingPaymentMethods} />

        <Title order={4} mb="md">Customer & Delivery Information</Title>
        <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
                <TextInput label="Full Name" required {...form.getInputProps('fullName')} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
                <TextInput label="Phone Number" required {...form.getInputProps('phoneNumber')} description="11 digits, starting with 01"/>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
                <TextInput label="Email (Optional)" {...form.getInputProps('email')} />
            </Grid.Col>
        </Grid>
        <Textarea label="Delivery Address (Street/Area)" required mt="sm" {...form.getInputProps('deliveryAddress')} />
        <Grid mt="xs">
            <Grid.Col span={{ base: 12, md: 4 }}><TextInput label="City" required {...form.getInputProps('city')} /></Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}><TextInput label="District" required {...form.getInputProps('district')} /></Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}><TextInput label="Country" readOnly {...form.getInputProps('country')} /></Grid.Col>
        </Grid>
        <Textarea label="Delivery Note (Optional)" mt="sm" {...form.getInputProps('deliveryNote')} />

        <Title order={4} mt="lg" mb="md">Order & Payment Details</Title>
        <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
                <Select label="Payment Method" required data={paymentMethodOptions} disabled={isLoadingPaymentMethods} {...form.getInputProps('paymentMethod')} />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
                 <Select label="Payment Status" required data={[{value: 'unpaid', label: 'Unpaid'}, {value: 'paid', label: 'Paid'}]} {...form.getInputProps('paymentStatus')} />
            </Grid.Col>
            <Grid.Col span={12}>
                 <Select label="Order Status" required data={VALID_ORDER_STATUSES_FOR_DROPDOWN} {...form.getInputProps('status')} />
            </Grid.Col>
        </Grid>

        <Title order={4} mt="lg" mb="md">Order Items</Title>
        <Box mah="300px" style={{ overflowY: 'auto' }} p="xs">
        {form.values.orderItems.map((item, index) => (
          <Paper key={item._id || item.productId || index} p="sm" withBorder mb="xs" radius="sm">
            <Grid align="center">
              <Grid.Col span={1}>
                {item.image && <Image src={item.image} alt={item.name} width={40} height={40} style={{ objectFit: 'contain' }} />}
              </Grid.Col>
              <Grid.Col span={5}>
                <Text size="sm" fw={500}>{item.name}</Text>
                <Text size="xs" c="dimmed">Product ID: {typeof item.product === 'string' ? item.product : item.product?._id}</Text>
              </Grid.Col>
              <Grid.Col span={2}><Text size="sm" ta="right">${item.price.toFixed(2)}</Text></Grid.Col>
              <Grid.Col span={2}>
                <NumberInput
                  label="Qty"
                  size="xs"
                  value={item.quantity}
                  onChange={(val) => handleItemQuantityChange(index, val ?? 1)}
                  min={1} // Assuming quantity cannot be less than 1
                />
              </Grid.Col>
              <Grid.Col span={2}><Text size="sm" ta="right" fw={500}>${(item.price * item.quantity).toFixed(2)}</Text></Grid.Col>
              {/* No delete item button for now to keep it simple */}
            </Grid>
          </Paper>
        ))}
        </Box>
        {/* Placeholder for adding new items - deferred */}
        {/* <Button mt="sm" variant="outline" size="xs">Add Item (Future)</Button> */}


        <Group justify="flex-end" mt="xl">
          <Button component={Link} href={`/admin/orders/${orderId}`} variant="default" disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" loading={isSubmitting} leftSection={<IconDeviceFloppy size={16}/>}>Save Changes</Button>
        </Group>
      </Paper>
    </AdminLayout>
  );
}
