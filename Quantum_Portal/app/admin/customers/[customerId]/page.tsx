'use client';

import AdminLayout from '../../../../components/admin/AdminLayout';
import { Title, Text, Paper, Group, Button, LoadingOverlay, Alert, Divider, Grid, Card, Badge, Space, ThemeIcon, Switch } from '@mantine/core';
import { IconAlertCircle, IconDeviceFloppy, IconUserCircle, IconMapPin, IconCalendarEvent, IconMail, IconUserCheck, IconUserOff, IconArrowLeft } from '@tabler/icons-react'; // Added IconArrowLeft
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
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
interface Customer {
    _id: string;
    firstName?: string;
    lastName?: string;
    email: string;
    isActive: boolean;
    addresses?: Address[];
    createdAt: string;
    updatedAt: string;
    // orderCount?: number;
}

const getStatusColor = (isActive: boolean) => isActive ? 'green' : 'gray';

export default function CustomerDetailsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const customerId = params?.customerId as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true); // For initial data load
  const [isUpdating, setIsUpdating] = useState(false); // For status update
  const [error, setError] = useState<string | null>(null);

  const [currentIsActive, setCurrentIsActive] = useState<boolean>(false);

  const fetchCustomerDetails = useCallback(async () => {
    if (!customerId || authStatus !== 'authenticated') return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/customers/${customerId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: Customer = await response.json();
      setCustomer(data);
      setCurrentIsActive(data.isActive);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch customer details.');
      setCustomer(null);
      notifications.show({ title: 'Error Loading Customer', message: err.message, color: 'red' });
    } finally {
      setIsLoading(false);
    }
  }, [customerId, authStatus]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/admin/login');
    } else if (customerId) {
      fetchCustomerDetails();
    }
  }, [authStatus, router, customerId, fetchCustomerDetails]);

  const handleStatusUpdate = async () => {
     if (customer === null || currentIsActive === customer.isActive) {
         notifications.show({ title: 'No Change', message: 'Status is already the same.', color: 'blue' });
         return;
     }
     setIsUpdating(true);
     setError(null);
     try {
         const response = await fetch(`/api/admin/customers/${customerId}`, {
             method: 'PUT',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ isActive: currentIsActive }),
         });
         const data = await response.json();
         if (!response.ok) {
             throw new Error(data.message || 'Failed to update customer status.');
         }
         setCustomer(data);
         setCurrentIsActive(data.isActive);
         notifications.show({
             title: 'Status Updated',
             message: `Customer account is now ${data.isActive ? 'Active' : 'Inactive'}.`,
             color: 'green',
             icon: <IconDeviceFloppy />,
         });
     } catch (err: any) {
         setError(err.message);
         notifications.show({ title: 'Update Error', message: err.message, color: 'red' });
         if(customer) setCurrentIsActive(customer.isActive); // Revert UI change
     } finally {
         setIsUpdating(false);
     }
  };

  if (authStatus === 'loading' || (isLoading && authStatus === 'authenticated')) {
     return <AdminLayout><LoadingOverlay visible={true} overlayProps={{ radius: 'sm', blur: 2, fixed: true }} /></AdminLayout>;
  }
  if (authStatus === 'unauthenticated') {
     return <Text p="xl">Redirecting to login...</Text>;
  }
  if (error && !customer && !isLoading) {
     return (
        <AdminLayout>
            <Group justify="space-between" mb="xl"><Title order={2}>Customer Details</Title><Button variant="outline" onClick={() => router.push('/admin/customers')} leftSection={<IconArrowLeft size={16}/>}>Back</Button></Group>
            <Alert title="Error Loading Customer" color="red" icon={<IconAlertCircle />}>{error}</Alert>
        </AdminLayout>
    );
  }
  if (!customer) {
     return (
        <AdminLayout>
             <Group justify="space-between" mb="xl"><Title order={2}>Customer Details</Title><Button variant="outline" onClick={() => router.push('/admin/customers')} leftSection={<IconArrowLeft size={16}/>}>Back</Button></Group>
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
        <Title order={2}>Customer Details: {customer.firstName || ''} {customer.lastName || customer.email}</Title>
        <Button variant="outline" onClick={() => router.push('/admin/customers')} leftSection={<IconArrowLeft size={16}/>}>Back to Customers</Button>
      </Group>

      {error && !isUpdating && (
         <Alert title="Page Error" color="red" icon={<IconAlertCircle />} withCloseButton onClose={() => setError(null)} mb="lg">
             {error}
         </Alert>
      )}

     <Grid gutter="lg">
         <Grid.Col span={{ base: 12, md: 7 }}>
             <Paper withBorder shadow="sm" p="md" radius="md" mb="lg">
                 <Group gap="xs" mb="sm">
                     <ThemeIcon variant="light" size="lg" radius="md"><IconUserCircle size="1.5rem" /></ThemeIcon>
                     <Title order={4}>Profile Information</Title>
                 </Group>
                 <Text><strong>Name:</strong> {`${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'N/A'}</Text>
                 <Text><strong>Email:</strong> <a href={`mailto:${customer.email}`}>{customer.email}</a></Text>
                 <Text mt="xs"><strong>Registered:</strong> {dayjs(customer.createdAt).format('MMM D, YYYY h:mm A')}</Text>
                 <Text size="xs" c="dimmed"><strong>Last Updated:</strong> {dayjs(customer.updatedAt).format('MMM D, YYYY h:mm A')}</Text>
             </Paper>

             <Paper withBorder shadow="sm" p="md" radius="md" mb="lg">
                 <Group gap="xs" mb="sm">
                      <ThemeIcon variant="light" size="lg" radius="md"><IconMapPin size="1.5rem" /></ThemeIcon>
                      <Title order={4}>Addresses</Title>
                 </Group>
                 {customer.addresses && customer.addresses.length > 0
                    ? customer.addresses.map((addr, index) => renderAddressCard(addr, index))
                    : <Text c="dimmed">No addresses on file for this customer.</Text>
                 }
             </Paper>
         </Grid.Col>

         <Grid.Col span={{ base: 12, md: 5 }}>
              <Card withBorder p="md" radius="md" mb="lg">
                 <Group gap="xs" mb="sm" align="center">
                     <ThemeIcon variant="light" color={getStatusColor(currentIsActive)} size="xl" radius="md">
                         {currentIsActive ? <IconUserCheck size="1.5rem" /> : <IconUserOff size="1.5rem" />}
                     </ThemeIcon>
                     <div>
                         <Text fw={700}>Account Status</Text>
                         <Badge color={getStatusColor(currentIsActive)} size="lg" radius="sm" variant="filled">
                             {currentIsActive ? 'Active' : 'Inactive'}
                         </Badge>
                     </div>
                 </Group>
                 <Divider my="sm" />
                 <Switch
                     labelPosition='left'
                     label={currentIsActive ? "Account is Active" : "Account is Inactive"}
                     checked={currentIsActive}
                     onChange={(event) => setCurrentIsActive(event.currentTarget.checked)}
                     color={currentIsActive ? "green" : "red"}
                     size="md"
                     disabled={isUpdating || isLoading}
                     mb="sm"
                     styles={{ root: { display: 'flex', justifyContent: 'space-between'}, label: { fontWeight: 500 } }}
                 />
                 <Button
                     fullWidth
                     onClick={handleStatusUpdate}
                     loading={isUpdating}
                     leftSection={<IconDeviceFloppy size={16}/>}
                     disabled={customer.isActive === currentIsActive || isLoading}
                 >
                     Save Status Change
                 </Button>
             </Card>
             <Paper withBorder shadow="sm" p="md" radius="md">
                 <Title order={4} mb="sm">Order History (Placeholder)</Title>
                 <Text c="dimmed">Customer's order history summary will be displayed here.</Text>
                 {/* <Button variant="outline" size="xs" mt="sm" component={Link} href={`/admin/orders?customerId=${customer._id}`}>View All Orders</Button> */}
             </Paper>
         </Grid.Col>
     </Grid>
      <Space h="xl" />
    </AdminLayout>
  );
}
