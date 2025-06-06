'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '../../../../components/admin/AdminLayout';
import {
    Paper, Title, TextInput, PasswordInput, Button, Switch, Grid, Textarea,
    Group, LoadingOverlay, Checkbox, Alert, Space
} from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { z } from 'zod';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconX, IconAlertCircle } from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import { hasPermission, Permission, Role } from '../../../../lib/permissions';

// Validation schema using Zod
const customerSchema = z.object({
    firstName: z.string().min(1, { message: 'First name is required' }),
    lastName: z.string().min(1, { message: 'Last name is required' }),
    email: z.string().email({ message: 'Invalid email address' }),
    password: z.string().min(8, { message: 'Password must be at least 8 characters long' }),
    confirmPassword: z.string(),
    phoneNumber: z.string().optional().refine(val => !val || (/^01\d{9}$/.test(val)), {
        message: 'Phone number must be 11 digits starting with "01" or empty',
    }),
    shipping_street: z.string().optional(),
    shipping_city: z.string().optional(),
    shipping_district: z.string().optional(),
    shipping_postalCode: z.string().optional(),
    shipping_country: z.string().default('Bangladesh'),
    useShippingAsBilling: z.boolean().default(true),
    billing_street: z.string().optional(),
    billing_city: z.string().optional(),
    billing_district: z.string().optional(),
    billing_postalCode: z.string().optional(),
    billing_country: z.string().default('Bangladesh'),
    isActive: z.boolean().default(true),
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'], // path of error
});


export default function CreateCustomerPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm({
    initialValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      phoneNumber: '',
      shipping_street: '',
      shipping_city: '',
      shipping_district: '',
      shipping_postalCode: '',
      shipping_country: 'Bangladesh',
      useShippingAsBilling: true,
      billing_street: '',
      billing_city: '',
      billing_district: '',
      billing_postalCode: '',
      billing_country: 'Bangladesh',
      isActive: true,
    },
    validate: zodResolver(customerSchema),
  });

  const userRole = session?.user?.role as Role | undefined;
  const canManageCustomers = userRole ? hasPermission(userRole, Permission.MANAGE_CUSTOMERS) : false;

  useEffect(() => {
    if (authStatus === 'authenticated' && !canManageCustomers) {
      notifications.show({ color: 'red', title: 'Access Denied', message: 'You do not have permission to create customers.' });
      router.replace('/admin/customers');
    }
  }, [authStatus, canManageCustomers, router]);


  const handleSubmit = async (values: typeof form.values) => {
    setIsSubmitting(true);
    setSubmitError(null);

    const payload: any = {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
        phoneNumber: values.phoneNumber || undefined,
        isActive: values.isActive,
        addresses: [],
    };

    const hasShippingAddress = values.shipping_street && values.shipping_city && values.shipping_district && values.shipping_postalCode && values.shipping_country;
    if (hasShippingAddress) {
        const shippingAddress = {
            street: values.shipping_street,
            city: values.shipping_city,
            state: values.shipping_district, // Map district to state
            zipCode: values.shipping_postalCode,
            country: values.shipping_country,
            isDefaultShipping: true,
            isDefaultBilling: values.useShippingAsBilling,
        };
        payload.addresses.push(shippingAddress);
    }

    if (!values.useShippingAsBilling) {
        const hasBillingAddress = values.billing_street && values.billing_city && values.billing_district && values.billing_postalCode && values.billing_country;
        if (hasBillingAddress) {
            payload.addresses.push({
                street: values.billing_street,
                city: values.billing_city,
                state: values.billing_district, // Map district to state
                zipCode: values.billing_postalCode,
                country: values.billing_country,
                isDefaultShipping: false,
                isDefaultBilling: true,
            });
        } else if (hasShippingAddress && payload.addresses.length > 0 && payload.addresses[0].isDefaultBilling) {
            // If "same as shipping" was unchecked but no billing address entered,
            // ensure the shipping address is not marked as default billing if it was.
            // This case is mostly for clarity; if useShippingAsBilling is false, shipping should not be default billing.
            payload.addresses[0].isDefaultBilling = false;
        }
    }

    // If no specific shipping address but billing address is provided, mark billing as default shipping too.
    if (!hasShippingAddress && payload.addresses.length > 0 && !values.useShippingAsBilling) {
        payload.addresses[0].isDefaultShipping = true;
    }


    console.log('Submitting payload (simulated):', payload);
    // Simulate API Call
    try {
        // const response = await fetch('/api/admin/customers/create', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(payload),
        // });
        // const result = await response.json();
        // if (!response.ok || !result.success) {
        //     throw new Error(result.message || 'Failed to create customer.');
        // }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
        notifications.show({ title: 'Customer Created (Simulated)', message: `Customer ${payload.firstName} ${payload.lastName} created.`, color: 'green', icon: <IconDeviceFloppy/> });
        router.push('/admin/customers');
    } catch (error: any) {
        setSubmitError(error.message);
        notifications.show({ title: 'Error', message: error.message, color: 'red', icon: <IconAlertCircle/> });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (authStatus === 'loading') {
    return <AdminLayout><LoadingOverlay visible={true} /></AdminLayout>;
  }
  if (!canManageCustomers && authStatus === 'authenticated') {
     return <AdminLayout><Paper p="xl"><Title order={3}>Access Denied</Title><Text>You do not have permission to create customers.</Text></Paper></AdminLayout>;
  }


  return (
    <AdminLayout>
      <Title order={2} mb="xl">Create New Customer</Title>
      <Paper component="form" onSubmit={form.onSubmit(handleSubmit)} shadow="sm" p="xl" radius="md" withBorder>
        <LoadingOverlay visible={isSubmitting} />

        <Title order={4} mb="md">Personal Information</Title>
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}><TextInput label="First Name" required {...form.getInputProps('firstName')} /></Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}><TextInput label="Last Name" required {...form.getInputProps('lastName')} /></Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}><TextInput label="Email" required type="email" {...form.getInputProps('email')} /></Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}><TextInput label="Phone Number (Optional)" placeholder="01xxxxxxxxx" {...form.getInputProps('phoneNumber')} /></Grid.Col>
        </Grid>

        <Title order={4} mt="lg" mb="md">Credentials</Title>
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}><PasswordInput label="Password" required {...form.getInputProps('password')} /></Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}><PasswordInput label="Confirm Password" required {...form.getInputProps('confirmPassword')} /></Grid.Col>
        </Grid>

        <Title order={4} mt="lg" mb="md">Shipping Address</Title>
        <Textarea label="Street Address" placeholder="House no, Road, Area" {...form.getInputProps('shipping_street')} />
        <Grid mt="xs">
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}><TextInput label="City" placeholder="e.g., Dhaka" {...form.getInputProps('shipping_city')} /></Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}><TextInput label="District" placeholder="e.g., Gulshan" {...form.getInputProps('shipping_district')} /></Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}><TextInput label="Postal Code" placeholder="e.g., 1212" {...form.getInputProps('shipping_postalCode')} /></Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}><TextInput label="Country" readOnly {...form.getInputProps('shipping_country')} /></Grid.Col>
        </Grid>

        <Checkbox
            mt="md"
            label="Billing address is the same as shipping address"
            checked={form.values.useShippingAsBilling}
            onChange={(event) => form.setFieldValue('useShippingAsBilling', event.currentTarget.checked)}
        />

        {!form.values.useShippingAsBilling && (
            <>
                <Title order={4} mt="lg" mb="md">Billing Address</Title>
                <Textarea label="Street Address" placeholder="House no, Road, Area" {...form.getInputProps('billing_street')} />
                <Grid mt="xs">
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}><TextInput label="City" placeholder="e.g., Dhaka" {...form.getInputProps('billing_city')} /></Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}><TextInput label="District" placeholder="e.g., Gulshan" {...form.getInputProps('billing_district')} /></Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}><TextInput label="Postal Code" placeholder="e.g., 1212" {...form.getInputProps('billing_postalCode')} /></Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}><TextInput label="Country" readOnly {...form.getInputProps('billing_country')} /></Grid.Col>
                </Grid>
            </>
        )}

        <Title order={4} mt="lg" mb="md">Account Status</Title>
        <Switch label="Activate Customer Account" defaultChecked {...form.getInputProps('isActive', { type: 'checkbox' })} />

        {submitError && (
          <Alert title="Creation Failed" color="red" icon={<IconAlertCircle />} mt="lg" withCloseButton onClose={() => setSubmitError(null)}>
            {submitError}
          </Alert>
        )}

        <Group justify="flex-end" mt="xl">
          <Button variant="outline" color="gray" onClick={() => router.push('/admin/customers')} leftSection={<IconX size={16}/>} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting} leftSection={<IconDeviceFloppy size={16}/>}>
            Create Customer
          </Button>
        </Group>
        <Space h="xl"/>
      </Paper>
    </AdminLayout>
  );
}
