'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '../../../../components/admin/AdminLayout';
import { Title, Paper, TextInput, Textarea, Button, Group, Space, Text, Box, Select, LoadingOverlay, Grid, Loader, Alert, Autocomplete, ThemeIcon } from '@mantine/core';
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

// Interface for the customer data returned by the search API
interface SearchCustomerData {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    fullName: string;
    displayText: string;
    addresses: ICustomerAddress[];
    isActive: boolean;
}


export default function CreateOrderPage() {
  const router = useRouter();
  const [paymentMethodOptions, setPaymentMethodOptions] = useState<PaymentMethodOption[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(true);

  // State for customer search and selection
  const [customerSearchResults, setCustomerSearchResults] = useState<SearchCustomerData[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<SearchCustomerData | null>(null);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerSearchValue, setCustomerSearchValue] = useState('');
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

  // Live customer search with debouncing
  const handleCustomerSearch = useDebouncedCallback(async (searchValue: string) => {
    if (!searchValue.trim()) {
      setCustomerSearchResults([]);
      setCustomerSearchLoading(false);
      return;
    }

    if (searchValue.length < 3) {
      setCustomerSearchResults([]);
      return;
    }

    setCustomerSearchLoading(true);
    try {
      const response = await fetch(`/api/admin/customers/search?q=${encodeURIComponent(searchValue)}&limit=5`);
      const result = await response.json();

      if (response.ok && result.success) {
        setCustomerSearchResults(result.data || []);
      } else {
        console.error('Customer search failed:', result.message);
        setCustomerSearchResults([]);
      }
    } catch (error: any) {
      console.error('Customer search error:', error);
      setCustomerSearchResults([]);
    } finally {
      setCustomerSearchLoading(false);
    }
  }, 300);


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

  const handleUseCustomerDetails = (customer: SearchCustomerData) => {
    form.setValues({
      ...form.values, // Preserve other form values like paymentMethod
      fullName: customer.fullName,
      email: customer.email,
      phoneNumber: customer.phoneNumber || form.values.phoneNumber,
      selectedCustomerId: customer._id, // Store the customer ID
    });

    if (customer.addresses && customer.addresses.length > 0) {
      // Use the first address, or try to find a default shipping address
      const addressToUse = customer.addresses.find(addr => addr.isDefaultShipping) || customer.addresses[0];
      if (addressToUse) {
        form.setValues({
          ...form.values, // Preserve again, setValues might overwrite if not careful
          fullName: customer.fullName,
          email: customer.email,
          phoneNumber: customer.phoneNumber || form.values.phoneNumber,
          selectedCustomerId: customer._id,
          deliveryAddress: addressToUse.street,
          city: addressToUse.city,
          district: addressToUse.state || '', // Map state to district
          country: addressToUse.country || 'Bangladesh', // Default if not present
          // postalCode: addressToUse.zipCode || '', // If we add postal code to form
        });
      }
    }
    setSelectedCustomer(customer);
    setSelectedCustomerId(customer._id); // Explicitly track selected customer
    setCustomerSearchValue(customer.displayText);
    setCustomerSearchResults([]); // Clear search results
    notifications.show({ 
      title: 'Details Applied', 
      message: 'Customer details have been populated into the form.', 
      color: 'teal',
      icon: <IconUserCheck size={18} />
    });
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

        <Autocomplete
          label="Customer Search"
          placeholder="Search by name, email, or phone..."
          value={customerSearchValue}
          onChange={(value) => {
            setCustomerSearchValue(value);
            handleCustomerSearch(value);
          }}
          data={customerSearchResults.map(customer => customer.displayText)}
          onOptionSubmit={(value) => {
            const customer = customerSearchResults.find(c => c.displayText === value);
            if (customer) {
              handleUseCustomerDetails(customer);
            }
          }}
          rightSection={customerSearchLoading ? <Loader size="xs" /> : <IconSearch size="1rem" />}
          comboboxProps={{ withinPortal: false }}
          maxDropdownHeight={200}
          limit={5}
          mb="sm"
          description="Search for existing customers to auto-fill their details"
        />

        {/* Show selected customer info */}
        {selectedCustomer && (
          <Paper withBorder shadow="sm" p="md" radius="md" my="sm">
            <Group gap="xs" mb="sm" align="center">
              <ThemeIcon variant="light" color="green" size="lg" radius="md">
                <IconUserCheck size="1.2rem" />
              </ThemeIcon>
              <div>
                <Text fw={700} size="sm" c="green.7">
                  Customer Selected
                </Text>
                <Text size="xs" c="dimmed">
                  Details have been applied to the form
                </Text>
              </div>
            </Group>
            
            <Group gap="xs" mb="xs">
              <Text size="sm" fw={500}>
                {selectedCustomer.fullName}
              </Text>
              <Text size="sm" c="dimmed">
                ({selectedCustomer.email})
              </Text>
            </Group>
            
            {selectedCustomer.phoneNumber && (
              <Text size="xs" c="dimmed" mb="xs">
                Phone: {selectedCustomer.phoneNumber}
              </Text>
            )}
            
            {selectedCustomer.addresses && selectedCustomer.addresses.length > 0 && (
              <Text size="xs" c="dimmed" mb="sm">
                Address: {selectedCustomer.addresses[0].street}, {selectedCustomer.addresses[0].city}
              </Text>
            )}
            
            <Button
              size="xs"
              variant="outline"
              color="red"
              onClick={() => {
                setSelectedCustomer(null);
                setSelectedCustomerId(null);
                setCustomerSearchValue('');
                // Clear form fields that were populated from customer
                form.setValues({
                  ...form.values,
                  fullName: '',
                  email: '',
                  phoneNumber: '',
                  deliveryAddress: '',
                  city: '',
                  district: '',
                  country: 'Bangladesh',
                  selectedCustomerId: null,
                });
              }}
            >
              Clear Selection
            </Button>
          </Paper>
        )}

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
            />
          </Grid.Col>
        </Grid>

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
