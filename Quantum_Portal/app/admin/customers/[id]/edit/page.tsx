'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '../../../../../components/admin/AdminLayout';
import {
    Paper, Title, TextInput, PasswordInput, Button, Switch, Grid, Textarea,
    Group, LoadingOverlay, Checkbox, Alert, Space, Text
} from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { z } from 'zod';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconX, IconAlertCircle, IconArrowLeft } from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import { hasPermission, Permission, Role } from '../../../../../lib/permissions';
import Link from 'next/link';

// Zod schema for validation
const customerEditSchema = z.object({
    firstName: z.string().min(1, { message: 'First name is required' }),
    lastName: z.string().min(1, { message: 'Last name is required' }),
    email: z.string().email({ message: 'Invalid email address' }),
    password: z.string().optional(), // Optional on edit
    confirmPassword: z.string().optional(),
    phoneNumber: z.string().optional().refine(val => !val || (/^01\d{9}$/.test(val)), {
        message: 'Phone number must be 11 digits starting with "01" or empty',
    }),
    shipping_street: z.string().optional(),
    shipping_city: z.string().optional(),
    shipping_district: z.string().optional(), // Will be mapped to 'state' in Address model
    shipping_postalCode: z.string().optional(),
    shipping_country: z.string().default('Bangladesh'),
    useShippingAsBilling: z.boolean().default(true),
    billing_street: z.string().optional(),
    billing_city: z.string().optional(),
    billing_district: z.string().optional(), // Will be mapped to 'state'
    billing_postalCode: z.string().optional(),
    billing_country: z.string().default('Bangladesh'),
    isActive: z.boolean().default(true),
}).refine(data => {
    if (data.password && data.password.length > 0) { // If password is being changed
        if (data.password.length < 8) return false; // Check min length
        return data.password === data.confirmPassword; // Check match
    }
    return true; // Pass if password is not being changed
}, {
    message: "Passwords must match and be at least 8 characters long, or leave blank to keep current password.",
    path: ['confirmPassword'],
});

// Interface for address from Customer model
interface ICustomerAddress {
    street: string;
    city: string;
    state: string; // This is where 'district' from form maps to
    zipCode: string;
    country: string;
    isDefaultShipping?: boolean;
    isDefaultBilling?: boolean;
    // Add other fields if your IAddress has them, like 'phone'
}

interface FetchedCustomerData {
    _id: string;
    firstName?: string;
    lastName?: string;
    email: string;
    isActive: boolean;
    addresses?: ICustomerAddress[];
    phoneNumber?: string; // If API ever returns this from a non-standard place
    createdAt?: string;
    updatedAt?: string;
}


export default function EditCustomerPage() {
  const router = useRouter();
  const params = useParams();
  const customerId = params?.id as string;

  const { data: session, status: authStatus } = useSession();
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [customerInitialEmail, setCustomerInitialEmail] = useState<string>('');


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
    validate: zodResolver(customerEditSchema),
  });

  const userRole = session?.user?.role as Role | undefined;
  const canManageCustomers = userRole ? hasPermission(userRole, Permission.MANAGE_CUSTOMERS) : false;

  useEffect(() => {
    if (authStatus === 'authenticated' && !canManageCustomers) {
      notifications.show({ color: 'red', title: 'Access Denied', message: 'You do not have permission to edit customers.' });
      router.replace('/admin/customers');
    }
  }, [authStatus, canManageCustomers, router]);

  const fetchCustomerData = useCallback(async () => {
    if (!customerId || authStatus !== 'authenticated' || !canManageCustomers) {
        setIsLoadingData(false);
        if(authStatus === 'authenticated' && customerId) setError("No permission to fetch customer.");
        return;
    }
    setIsLoadingData(true);
    try {
      // Assume GET /api/admin/customers/[id] returns { success: true, customer: data }
      const response = await fetch(`/api/admin/customers/${customerId}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch customer data.');
      }
      const customer: FetchedCustomerData = result.customer;
      setCustomerInitialEmail(customer.email);

      let shippingAddr: ICustomerAddress | undefined = customer.addresses?.find(a => a.isDefaultShipping);
      if (!shippingAddr && customer.addresses && customer.addresses.length > 0) {
          shippingAddr = customer.addresses[0]; // Fallback to first address if no default shipping
      }

      let billingAddr: ICustomerAddress | undefined = customer.addresses?.find(a => a.isDefaultBilling);
      let useShippingAsBilling = true;
      if (shippingAddr && billingAddr && JSON.stringify(shippingAddr) !== JSON.stringify(billingAddr)) {
          useShippingAsBilling = false;
      } else if (!billingAddr && shippingAddr) { // Billing is same as shipping if only shipping exists or default billing not found
          billingAddr = shippingAddr;
          useShippingAsBilling = true;
      } else if (!shippingAddr && billingAddr) { // Only billing exists, use it for shipping too if form needs it
          shippingAddr = billingAddr; // This might not be ideal logic, depends on requirements
          useShippingAsBilling = false; // Or true if shipping should also be populated
      }


      form.setValues({
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        email: customer.email || '',
        password: '', // Keep password blank by default on edit
        confirmPassword: '',
        phoneNumber: customer.phoneNumber || '', // Assuming phoneNumber might be returned by API
        shipping_street: shippingAddr?.street || '',
        shipping_city: shippingAddr?.city || '',
        shipping_district: shippingAddr?.state || '', // Map 'state' from model to 'district' in form
        shipping_postalCode: shippingAddr?.zipCode || '',
        shipping_country: shippingAddr?.country || 'Bangladesh',
        useShippingAsBilling: useShippingAsBilling,
        billing_street: useShippingAsBilling ? '' : (billingAddr?.street || ''),
        billing_city: useShippingAsBilling ? '' : (billingAddr?.city || ''),
        billing_district: useShippingAsBilling ? '' : (billingAddr?.state || ''),
        billing_postalCode: useShippingAsBilling ? '' : (billingAddr?.zipCode || ''),
        billing_country: useShippingAsBilling ? 'Bangladesh' : (billingAddr?.country || 'Bangladesh'),
        isActive: customer.isActive !== undefined ? customer.isActive : true,
      });
    } catch (err: any) {
      setError(err.message);
      notifications.show({ title: 'Error Fetching Customer', message: err.message, color: 'red' });
    } finally {
      setIsLoadingData(false);
    }
  }, [customerId, authStatus, canManageCustomers, form.setValues]); // form.setValues added

  useEffect(() => {
    if (customerId) {
      fetchCustomerData();
    } else {
      setIsLoadingData(false);
      setError("No Customer ID provided.");
    }
  }, [customerId, fetchCustomerData]);


  const handleSubmit = async (values: typeof form.values) => {
    setIsSubmitting(true);
    setSubmitError(null);

    const payload: any = {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        // Only include password if it's changed (not empty)
        ...(values.password && { password: values.password }),
        phoneNumber: values.phoneNumber || undefined,
        isActive: values.isActive,
        addresses: [],
    };

    // Logic for constructing addresses array, similar to create page
    const hasShippingAddress = values.shipping_street && values.shipping_city && values.shipping_district && values.shipping_postalCode;
    if (hasShippingAddress) {
        const shippingPayloadAddress = {
            street: values.shipping_street,
            city: values.shipping_city,
            state: values.shipping_district, // Map form's district to model's state
            zipCode: values.shipping_postalCode,
            country: values.shipping_country,
            isDefaultShipping: true,
            isDefaultBilling: values.useShippingAsBilling,
        };
        payload.addresses.push(shippingPayloadAddress);
    }

    if (!values.useShippingAsBilling) {
        const hasBillingAddress = values.billing_street && values.billing_city && values.billing_district && values.billing_postalCode;
        if (hasBillingAddress) {
            payload.addresses.push({
                street: values.billing_street,
                city: values.billing_city,
                state: values.billing_district, // Map form's district to model's state
                zipCode: values.billing_postalCode,
                country: values.billing_country,
                isDefaultShipping: false, // A separate billing address cannot be default shipping if a shipping address exists
                isDefaultBilling: true,
            });
        } else if (hasShippingAddress && payload.addresses[0]?.isDefaultBilling) {
             payload.addresses[0].isDefaultBilling = false;
        }
    }
     // If no specific shipping address but billing address is provided (and useShippingAsBilling is false), mark billing as default shipping too.
    if (!hasShippingAddress && payload.addresses.length > 0 && !values.useShippingAsBilling) {
        payload.addresses[0].isDefaultShipping = true;
    }


    console.log('Submitting update payload (simulated):', payload);
    // Simulate API Call
    try {
        // const response = await fetch(`/api/admin/customers/${customerId}`, {
        //     method: 'PUT',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(payload),
        // });
        // const result = await response.json();
        // if (!response.ok || !result.success) {
        //     throw new Error(result.message || 'Failed to update customer.');
        // }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
        notifications.show({ title: 'Customer Updated (Simulated)', message: `Customer ${payload.firstName} ${payload.lastName} updated.`, color: 'green', icon: <IconDeviceFloppy/> });
        router.push('/admin/customers'); // Or to customer details: `/admin/customers/${customerId}`
    } catch (error: any) {
        setSubmitError(error.message);
        notifications.show({ title: 'Error', message: error.message, color: 'red', icon: <IconAlertCircle/> });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (authStatus === 'loading' || isLoadingData) {
    return <AdminLayout><LoadingOverlay visible={true} /></AdminLayout>;
  }

  if (!canManageCustomers && authStatus === 'authenticated') {
     return <AdminLayout><Paper p="xl"><Title order={3}>Access Denied</Title><Text>You do not have permission to edit customers.</Text></Paper></AdminLayout>;
  }

  if (error && !isSubmitting) {
    return <AdminLayout><Alert title="Error Loading Customer" color="red" icon={<IconAlertCircle />}>{error} <Button component={Link} href="/admin/customers" mt="sm">Back to List</Button></Alert></AdminLayout>;
  }
  if (!form.values && !isLoadingData) { // Should ideally check if initial population failed
      return <AdminLayout><Text>Customer data could not be loaded.</Text></AdminLayout>;
  }


  return (
    <AdminLayout>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Edit Customer: {form.values.firstName} {form.values.lastName}</Title>
        <Button component={Link} href="/admin/customers" variant="outline" leftSection={<IconArrowLeft size={16} />}>
          Back to Customer List
        </Button>
      </Group>

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
        <Text size="sm" c="dimmed" mb="xs">Leave password fields blank to keep the current password.</Text>
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}><PasswordInput label="New Password" {...form.getInputProps('password')} /></Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}><PasswordInput label="Confirm New Password" {...form.getInputProps('confirmPassword')} /></Grid.Col>
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
            onChange={(event) => {
                form.setFieldValue('useShippingAsBilling', event.currentTarget.checked);
                if (event.currentTarget.checked) { // if checked, clear billing fields
                    form.setFieldValue('billing_street', '');
                    form.setFieldValue('billing_city', '');
                    form.setFieldValue('billing_district', '');
                    form.setFieldValue('billing_postalCode', '');
                }
            }}
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
        <Switch label="Activate Customer Account" {...form.getInputProps('isActive', { type: 'checkbox' })} />

        {submitError && (
          <Alert title="Update Failed" color="red" icon={<IconAlertCircle />} mt="lg" withCloseButton onClose={() => setSubmitError(null)}>
            {submitError}
          </Alert>
        )}

        <Group justify="flex-end" mt="xl">
          <Button variant="default" color="gray" component={Link} href="/admin/customers" leftSection={<IconX size={16}/>} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting} leftSection={<IconDeviceFloppy size={16}/>}>
            Save Changes
          </Button>
        </Group>
        <Space h="xl"/>
      </Paper>
    </AdminLayout>
  );
}
