'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '../../../../components/admin/AdminLayout';
import { Title, Paper, TextInput, Textarea, Button, Group, Space, Text, Box, Select, LoadingOverlay } from '@mantine/core';
import { useForm } from '@mantine/form'; // Using Mantine's form handling
import { notifications } from '@mantine/notifications';

interface PaymentMethodOption {
  value: string; // Will store the payment method name or ID
  label: string; // Will display the payment method name
}

interface FetchedPaymentMethod { // Interface for methods fetched from API
    _id: string;
    name: string;
    isEnabled: boolean;
    details?: string;
}

export default function CreateOrderPage() {
  const router = useRouter();
  const [paymentMethodOptions, setPaymentMethodOptions] = useState<PaymentMethodOption[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(true);

  const form = useForm({
    initialValues: {
      customerName: '',
      phoneNumber: '',
      shippingAddress: '',
      paymentMethod: '', // Added paymentMethod
      // TODO: Add orderItems and totalAmount later
    },
    validate: {
      customerName: (value) => (value.trim().length > 0 ? null : 'Customer name is required'),
      phoneNumber: (value) =>
        /^\d{11}$/.test(value)
          ? null
          : 'Phone number must be exactly 11 digits',
      shippingAddress: (value) => (value.trim().length > 0 ? null : 'Shipping address is required'),
      paymentMethod: (value) => (value ? null : 'Payment method is required'),
    },
  });

  const fetchEnabledPaymentMethods = useCallback(async () => {
    setIsLoadingPaymentMethods(true);
    try {
      const response = await fetch('/api/admin/payment-methods');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch payment methods');
      }
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        const enabledMethods = result.data
          .filter((method: FetchedPaymentMethod) => method.isEnabled)
          .map((method: FetchedPaymentMethod) => ({
            value: method.name, // Using name as per Order model's paymentMethod field (string)
            label: method.name,
          }));
        setPaymentMethodOptions(enabledMethods);
        if (enabledMethods.length === 0) {
            notifications.show({
                title: 'No Payment Methods',
                message: 'There are no enabled payment methods configured. Please configure them in settings.',
                color: 'yellow',
            });
        }
      } else {
        throw new Error(result.message || 'Received invalid data for payment methods');
      }
    } catch (error: any) {
      console.error("Error fetching payment methods:", error);
      notifications.show({
        title: 'Error Fetching Payment Methods',
        message: error.message || 'Could not load payment options.',
        color: 'red',
      });
      setPaymentMethodOptions([]);
    } finally {
      setIsLoadingPaymentMethods(false);
    }
  }, []);

  useEffect(() => {
    fetchEnabledPaymentMethods();
  }, [fetchEnabledPaymentMethods]);

  const handleSubmit = (values: typeof form.values) => {
    // TODO: This will be replaced with actual API call to create order
    // For now, the API /api/admin/orders/new expects:
    // customerName, email, phoneNumber, shippingAddress (object), orderItems (array), totalAmount, paymentMethod (string), status (string, optional)
    // The current form only has a subset of these.
    console.log('Form submitted (simulated):', values);
    // For now, we'll just log it and maybe redirect or show a success message
    // router.push('/admin/orders'); // Optional: redirect after submission
    alert('Order creation simulated. Check console for data.');
  };

  return (
    <AdminLayout>
      <Title order={2} mb="xl">
        Create New Order
      </Title>

      <Paper component="form" onSubmit={form.onSubmit(handleSubmit)} shadow="sm" p="xl" radius="md" withBorder pos="relative">
        <LoadingOverlay visible={isLoadingPaymentMethods} overlayProps={{ blur: 2 }} />
        <Title order={4} mb="md">
          Customer Information
        </Title>

        <TextInput
          label="Customer Name"
          placeholder="Enter customer's full name"
          required
          mb="md"
          {...form.getInputProps('customerName')}
        />

        <TextInput
          label="Phone Number"
          placeholder="Enter 11 digit phone number"
          required
          mb="md"
          leftSection={<Text size="sm">+88</Text>}
          leftSectionWidth={45}
          {...form.getInputProps('phoneNumber')}
          description="Enter the 11 digits after the +88 prefix."
        />

        <Textarea
          label="Shipping Address"
          placeholder="Enter full shipping address (street, city, postal code, country)"
          required
          minRows={3}
          mb="md" // Reduced margin bottom
          {...form.getInputProps('shippingAddress')}
        />

        <Select
          label="Payment Method"
          placeholder="Select payment method"
          data={paymentMethodOptions}
          required
          mb="xl"
          {...form.getInputProps('paymentMethod')}
          disabled={isLoadingPaymentMethods || paymentMethodOptions.length === 0}
        />

        <Title order={4} mb="md" mt="xl">
          Product Selection (Placeholder)
        </Title>
        <Text c="dimmed" mb="xl">
          Product selection functionality will be implemented here. This will involve adding product IDs, quantities, and calculating total amount.
        </Text>


        <Group justify="flex-end" mt="xl">
          <Button type="button" variant="default" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit">Create Order</Button>
        </Group>
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
