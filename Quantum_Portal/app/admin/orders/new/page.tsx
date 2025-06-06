'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '../../../../components/admin/AdminLayout';
import { Title, Paper, TextInput, Textarea, Button, Group, Space, Text, Box, Select, LoadingOverlay, Grid, Loader, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useDebouncedCallback } from '@mantine/hooks';
import { IconAlertCircle, IconSearch, IconUserCheck } from '@tabler/icons-react';

interface PaymentMethodOption {
  value: string;
  label: string;
}

interface FetchedPaymentMethod {
    _id: string;
    name: string;
    isEnabled: boolean;
    details?: string;
}

// Interface for Customer Address (matching Customer model)
interface ICustomerAddress {
    street: string;
    city: string;
    state?: string; // Equivalent to district for our form
    zipCode?: string; // Not directly used in form, but part of customer data
    country: string;
    isDefaultShipping?: boolean;
    isDefaultBilling?: boolean;
}

// Interface for the customer data returned by the lookup API
interface FoundCustomerData {
    _id: string;
    firstName?: string;
    lastName?: string;
    email: string;
    addresses?: ICustomerAddress[];
    // phoneNumber might not be directly on customer model, API might add it if found via other means
}


export default function CreateOrderPage() {
  const router = useRouter();
  const [paymentMethodOptions, setPaymentMethodOptions] = useState<PaymentMethodOption[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(true);

  // State for customer lookup
  const [foundCustomer, setFoundCustomer] = useState<FoundCustomerData | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);


  const form = useForm({
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
      selectedCustomerId: null as string | null, // To store ID if a looked-up customer is used
      // TODO: Add orderItems and totalAmount later
    },
    validate: {
      fullName: (value) => (value.trim().length > 0 ? null : 'Full name is required'),
      phoneNumber: (value) => {
        if (!value) return 'Phone number is required';
        if (!/^\d{11}$/.test(value)) return 'Phone number must be exactly 11 digits';
        if (!/^01/.test(value)) return 'Phone number must start with "01"';
        return null;
      },
      email: (value) => {
        // Email is optional unless used for lookup and a customer is not found,
        // then if user proceeds, it might become "required" in a sense or auto-filled.
        // For now, just format validation if provided.
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Invalid email address';
        }
        return null;
      },
      deliveryAddress: (value) => (value.trim().length > 0 ? null : 'Delivery address is required'),
      city: (value) => (value.trim().length > 0 ? null : 'City is required'),
      district: (value) => (value.trim().length > 0 ? null : 'District is required'),
      paymentMethod: (value) => (value ? null : 'Payment method is required'),
    },
  });

  const handleCustomerLookup = useDebouncedCallback(async (lookupValue: string, type: 'email' | 'phone') => {
    if (!lookupValue || (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lookupValue))) {
      setFoundCustomer(null);
      setLookupError(type === 'email' && lookupValue ? 'Invalid email format for lookup.' : null);
      // Do not clear selectedCustomerId here, user might have typed then corrected
      return;
    }

    setLookupLoading(true);
    setLookupError(null);
    setFoundCustomer(null);
    // setSelectedCustomerId(null); // Clear previous selection on new lookup

    try {
      // Currently API only supports email lookup effectively
      if (type === 'phone') {
        setLookupError('Phone lookup is not fully supported yet. Please use email.');
        setLookupLoading(false);
        return;
      }

      const response = await fetch(`/api/admin/customers/lookup?${type}=${encodeURIComponent(lookupValue)}`);
      const result = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          setLookupError('No customer found with this email. You can continue to create a new customer.');
          notifications.show({ title: 'Customer Lookup', message: 'No customer found. New customer details can be entered.', color: 'blue' });
        } else {
          throw new Error(result.message || `API error: ${response.status}`);
        }
      } else if (result.success && result.data) {
        setFoundCustomer(result.data);
        notifications.show({ icon: <IconUserCheck size={18} />, title: 'Customer Found', message: `Details for ${result.data.firstName || ''} ${result.data.lastName || ''} loaded.`, color: 'green' });
      } else {
         // Should not happen if API is consistent
        setLookupError('Could not retrieve customer data.');
      }
    } catch (error: any) {
      setLookupError(error.message || 'Failed to lookup customer.');
      notifications.show({ title: 'Lookup Error', message: error.message, color: 'red', icon: <IconAlertCircle/> });
    } finally {
      setLookupLoading(false);
    }
  }, 500);


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

  const handleUseCustomerDetails = () => {
    if (foundCustomer) {
      form.setValues({
        ...form.values, // Preserve other form values like paymentMethod
        fullName: `${foundCustomer.firstName || ''} ${foundCustomer.lastName || ''}`.trim(),
        email: foundCustomer.email,
        // phoneNumber: foundCustomer.phoneNumber || form.values.phoneNumber, // If phone was on customer model
        selectedCustomerId: foundCustomer._id, // Store the customer ID
      });

      if (foundCustomer.addresses && foundCustomer.addresses.length > 0) {
        // Use the first address, or try to find a default shipping address
        const addressToUse = foundCustomer.addresses.find(addr => addr.isDefaultShipping) || foundCustomer.addresses[0];
        if (addressToUse) {
          form.setValues({
            ...form.values, // Preserve again, setValues might overwrite if not careful
            fullName: `${foundCustomer.firstName || ''} ${foundCustomer.lastName || ''}`.trim(),
            email: foundCustomer.email,
            selectedCustomerId: foundCustomer._id,
            deliveryAddress: addressToUse.street,
            city: addressToUse.city,
            district: addressToUse.state || '', // Map state to district
            country: addressToUse.country || 'Bangladesh', // Default if not present
            // postalCode: addressToUse.zipCode || '', // If we add postal code to form
          });
        }
      }
      setFoundCustomer(null); // Clear found customer after using details
      setLookupError(null);
      setSelectedCustomerId(foundCustomer._id); // Explicitly track selected customer
      notifications.show({ title: 'Details Applied', message: 'Customer details have been populated into the form.', color: 'teal' });
    }
  };


  const handleSubmit = (values: typeof form.values) => {
    const apiPayload = {
      customerName: values.fullName,
      email: values.email,
      phoneNumber: values.phoneNumber,
      shippingAddress: {
        street: values.deliveryAddress,
        city: values.city,
        state: values.district, // Assuming district maps to state for API
        country: values.country,
        // postalCode: values.postalCode, // If added to form
      },
      paymentMethod: values.paymentMethod,
      deliveryNote: values.deliveryNote,
      customerId: selectedCustomerId, // Pass the ID of the looked-up/selected customer
      // TODO: Add orderItems and totalAmount (these would come from another part of the form)
      // orderItems: [{ productId: "someProductId", name: "Test Product", price: 100, quantity: 1 }],
      // totalAmount: 100,
      status: 'pending', // Default status
    };

    console.log('Form submitted (transformed for API simulation):', apiPayload);
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
          label="Full Name"
          placeholder="Enter customer's full name"
          required
          mb="sm"
          {...form.getInputProps('fullName')}
        />

        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <TextInput
              label="Phone Number"
              placeholder="01xxxxxxxxx"
              required
              mb="sm"
              {...form.getInputProps('phoneNumber')}
              description="11 digits, starting with 01"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <TextInput
              label="Email (Optional)"
              placeholder="customer@example.com"
              mb="sm"
              {...form.getInputProps('email')}
              // Add onBlur or debounced onChange for lookup
              // For simplicity, let's use onBlur for email to trigger lookup
              onBlur={(event) => handleCustomerLookup(event.currentTarget.value, 'email')}
              rightSection={lookupLoading && form.values.email ? <Loader size="xs" /> : null}
            />
          </Grid.Col>
        </Grid>

        {/* Customer Lookup Results Display */}
        {!lookupLoading && lookupError && form.values.email && (
          <Alert icon={<IconAlertCircle size="1rem" />} color="orange" variant="light" my="xs">
            {lookupError}
          </Alert>
        )}
        {!lookupLoading && !lookupError && foundCustomer && (
          <Paper p="xs" shadow="xs" withBorder my="xs" bg="green.0">
            <Text size="sm" c="green.7" fw={500}>
              Found customer: {foundCustomer.firstName || ''} {foundCustomer.lastName || ''} ({foundCustomer.email})
            </Text>
            {foundCustomer.addresses && foundCustomer.addresses.length > 0 && (
                <Text size="xs" c="dimmed">
                    Address: {foundCustomer.addresses[0].street}, {foundCustomer.addresses[0].city}
                </Text>
            )}
            <Button
              size="xs"
              variant="light"
              color="teal"
              mt="xs"
              onClick={handleUseCustomerDetails}
              leftSection={<IconUserCheck size={14}/>}
            >
              Use these details
            </Button>
          </Paper>
        )}

        <Title order={4} mt="lg" mb="md">
          Delivery Information
        </Title>

        <Textarea
          label="Delivery Address (Street/Area)"
          placeholder="Enter street address, area details"
          required
          minRows={2}
          mb="sm"
          {...form.getInputProps('deliveryAddress')}
        />
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <TextInput
              label="City"
              placeholder="Enter city"
              required
              mb="sm"
              {...form.getInputProps('city')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <TextInput
              label="District"
              placeholder="Enter district"
              required
              mb="sm"
              {...form.getInputProps('district')}
            />
          </Grid.Col>
        </Grid>
        <TextInput
          label="Country"
          readOnly
          mb="sm"
          {...form.getInputProps('country')}
        />
         <Textarea
          label="Delivery Note (Optional)"
          placeholder="Any special instructions for delivery"
          minRows={2}
          mb="md"
          {...form.getInputProps('deliveryNote')}
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
