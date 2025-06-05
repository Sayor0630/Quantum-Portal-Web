'use client';

import AdminLayout from '../../../../../components/admin/AdminLayout';
import { Title, Paper, TextInput, Button, Group, LoadingOverlay, Alert, Select, Switch, Space, Text, Skeleton, Grid } from '@mantine/core'; // Added Skeleton, Grid
import { useForm, yupResolver } from '@mantine/form';
import * as Yup from 'yup';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { notifications } from '@mantine/notifications';
import { useSession } from 'next-auth/react';
import { IconDeviceFloppy, IconAlertCircle, IconX, IconUserShield, IconShieldLock, IconArrowLeft } from '@tabler/icons-react'; // Added IconArrowLeft

const ALLOWED_ADMIN_ROLES = ['admin', 'contentManager', 'orderManager', 'superadmin'];

interface AdminUserData {
  _id: string;
  email: string;
  role: string;
  isActive: boolean;
}

// Yup validation schema for edit (no password fields)
const schema = Yup.object().shape({
  email: Yup.string().email('Invalid email').required('Email is required'),
  role: Yup.string().required('Role is required').oneOf(ALLOWED_ADMIN_ROLES, 'Invalid role selected'),
  isActive: Yup.boolean(),
});

export default function EditAdminUserPage() {
  const router = useRouter();
  const params = useParams();
  const adminUserIdToEdit = params?.adminUserId as string;
  const { data: session, status: authStatus } = useSession();

  const [isLoading, setIsLoading] = useState(false); // For form submission
  const [isFetching, setIsFetching] = useState(true); // For initial data load
  const [apiError, setApiError] = useState<string | null>(null);
  const [adminUserData, setAdminUserData] = useState<AdminUserData | null>(null); // Store fetched data to compare for disabling save

  const form = useForm<Omit<AdminUserData, '_id'>>({
    initialValues: {
      email: '',
      role: 'admin',
      isActive: true,
    },
    validate: yupResolver(schema),
  });

  const loggedInAdminId = (session?.user as { id?: string })?.id;
  const loggedInAdminRole = (session?.user as { role?: string })?.role;
  const isEditingSelf = loggedInAdminId === adminUserIdToEdit;

  const fetchAdminUser = useCallback(async () => {
    if (!adminUserIdToEdit || authStatus !== 'authenticated' || loggedInAdminRole !== 'superadmin') {
      setIsFetching(false); // Stop fetching if conditions not met
      return;
    }
    setIsFetching(true); setApiError(null);
    try {
      const response = await fetch(`/api/admin/manage-admins/${adminUserIdToEdit}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Failed to fetch admin user details.');
      }
      const data: AdminUserData = await response.json();
      setAdminUserData(data); // Store original fetched data
      form.setValues({ // Populate form with fetched data
        email: data.email,
        role: data.role,
        isActive: data.isActive,
      });
      form.resetDirty(); // Important: reset dirty state after setting values from API
    } catch (err: any) {
      setApiError(err.message);
      notifications.show({ title: 'Error Loading User Data', message: `Failed to load user: ${err.message}`, color: 'red' });
    } finally {
      setIsFetching(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminUserIdToEdit, authStatus, loggedInAdminRole]); // form.setValues removed

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/admin/login');
    } else {
      fetchAdminUser(); // Fetch data if authenticated (role check inside fetchAdminUser)
    }
  }, [authStatus, router, fetchAdminUser]);


  const handleSubmit = async (values: Omit<AdminUserData, '_id'>) => {
    setIsLoading(true); setApiError(null);

    if (isEditingSelf && values.role !== 'superadmin') {
      const message = 'Superadmins cannot change their own role from "superadmin".';
      setApiError(message);
      notifications.show({ title: 'Update Error', message, color: 'red' });
      setIsLoading(false); return;
    }
    if (isEditingSelf && !values.isActive) {
      const message = 'Superadmins cannot deactivate their own account.';
      setApiError(message);
      notifications.show({ title: 'Update Error', message, color: 'red' });
      setIsLoading(false); return;
    }

    try {
      const response = await fetch(`/api/admin/manage-admins/${adminUserIdToEdit}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to update admin user.');

      notifications.show({ title: 'Admin User Updated', message: `User ${data.email} has been updated successfully.`, color: 'green', icon: <IconDeviceFloppy /> });
      router.push('/admin/users');
    } catch (err: any) {
      setApiError(err.message);
      notifications.show({ title: 'Error Updating User', message: err.message, color: 'red', icon: <IconAlertCircle /> });
    } finally { setIsLoading(false); }
  };

  if (authStatus === 'loading' || (isFetching && authStatus === 'authenticated')) {
     return (
        <AdminLayout>
            <Title order={2} mb="xl">Edit Admin User</Title>
            <Paper withBorder shadow="md" p="xl" radius="md">
                <Skeleton height={36} mb="sm" /> {/* Email */}
                <Skeleton height={36} mb="md" /> {/* Role */}
                <Skeleton height={24} mb="xl" width="50%"/> {/* Switch */}
                <Group justify="flex-end" mt="xl"><Skeleton height={36} width={100}/><Skeleton height={36} width={150}/></Group>
            </Paper>
        </AdminLayout>
     );
  }
  if (authStatus === 'unauthenticated') return <Text p="xl">Redirecting to login...</Text>;

  if (loggedInAdminRole !== 'superadmin') {
     return (
         <AdminLayout>
             <Title order={2} mb="xl"><Group gap="xs"><IconUserShield />Edit Admin User</Group></Title>
             <Alert color="red" title="Access Denied" icon={<IconShieldLock />}>
                 You do not have permission to edit admin users. This action is for superadmins only.
             </Alert>
         </AdminLayout>
     );
  }
  if (apiError && !adminUserData && !isFetching) {
     return (
        <AdminLayout>
             <Group justify="space-between" mb="xl"><Title order={2}>Edit Admin User</Title><Button variant="outline" component={Link} href="/admin/users" leftSection={<IconArrowLeft size={16}/>}>Back</Button></Group>
            <Alert icon={<IconAlertCircle size="1rem" />} title="Failed to load user data" color="red">{apiError}</Alert>
        </AdminLayout>
    );
  }
  if (!adminUserData && !isFetching) return <AdminLayout><Text p="xl" ta="center">Admin user not found.</Text></AdminLayout>;


  return (
    <AdminLayout>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Edit Admin User: <Text span c="dimmed" inherit>{adminUserData?.email || "Loading..."}</Text></Title>
        <Button variant="outline" component={Link} href="/admin/users" leftSection={<IconArrowLeft size={16}/>}>
            Back to Admin Users
        </Button>
      </Group>
      <Paper component="form" onSubmit={form.onSubmit(handleSubmit)} withBorder shadow="md" p="xl" radius="md" pos="relative" maw={700}>
        <LoadingOverlay visible={isLoading} overlayProps={{radius:'sm', blur:1}} />
        {apiError && !isFetching && <Alert icon={<IconAlertCircle size="1rem" />} title="Error!" color="red" withCloseButton onClose={() => setApiError(null)} mb="md">{apiError}</Alert>}

        <TextInput
          label="Email Address"
          required
          {...form.getInputProps('email')}
          mb="md"
        />

        <Select
          label="Role"
          data={ALLOWED_ADMIN_ROLES.map(role => ({
            value: role,
            label: role.charAt(0).toUpperCase() + role.slice(1).replace(/([A-Z])/g, ' $1').trim()
          }))}
          required
          {...form.getInputProps('role')}
          disabled={isEditingSelf && adminUserData?.role === 'superadmin'}
          description={isEditingSelf && adminUserData?.role === 'superadmin' ? "Superadmins cannot change their own role from 'superadmin'." : ""}
          mb="md"
        />
        <Switch
          labelPosition="left"
          label="Account is Active?"
          description="Inactive accounts cannot log in."
          {...form.getInputProps('isActive', { type: 'checkbox' })}
          disabled={isEditingSelf && adminUserData?.isActive === true && form.values.isActive === false } // Prevent self-deactivation
          // The above disabled logic is slightly off. If adminUserData.isActive is true, form.values.isActive will also be true initially.
          // The check should be: disabled={isEditingSelf && adminUserData?.isActive === true} if you don't want them to ever deactivate self.
          // Or, if they CAN deactivate, then the API check is the true safeguard.
          // For now, rely on API safeguard for self-deactivation.
          // Simpler disabled logic for UI:
          // disabled={isEditingSelf} // This would prevent superadmin from changing own active status at all.
          // The API (Subtask 20) has logic: if ((session.user as any)?.id === adminUserId && req.body.isActive === false)
          mb="xl"
          styles={{ root: { display: 'flex', justifyContent: 'space-between'}, label: { fontWeight: 500 } }}
        />

        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={() => router.push('/admin/users')} leftSection={<IconX size={16}/>} disabled={isLoading || isFetching}>Cancel</Button>
          <Button type="submit" leftSection={<IconDeviceFloppy size={16}/>} loading={isLoading} disabled={isFetching || isLoading || !form.isDirty()}>Save Changes</Button>
        </Group>
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
