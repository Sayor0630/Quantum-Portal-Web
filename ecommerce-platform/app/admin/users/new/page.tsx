'use client';

import AdminLayout from '../../../../../components/admin/AdminLayout';
import { Title, Paper, TextInput, Button, Group, LoadingOverlay, Alert, Select, Switch, Space, Text, PasswordInput } from '@mantine/core'; // Added PasswordInput, Text
import { useForm, yupResolver } from '@mantine/form';
import * as Yup from 'yup';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { notifications } from '@mantine/notifications';
import { useSession } from 'next-auth/react';
import { IconDeviceFloppy, IconAlertCircle, IconX, IconUserPlus, IconShieldLock } from '@tabler/icons-react';

const ALLOWED_ADMIN_ROLES = ['admin', 'contentManager', 'orderManager', 'superadmin'];

const schema = Yup.object().shape({
  email: Yup.string().email('Invalid email').required('Email is required'),
  password: Yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Confirm password is required'),
  role: Yup.string().required('Role is required').oneOf(ALLOWED_ADMIN_ROLES, 'Invalid role selected'),
  isActive: Yup.boolean(),
});

export default function NewAdminUserPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const form = useForm({
    initialValues: {
      email: '',
      password: '',
      confirmPassword: '',
      role: 'admin',
      isActive: true,
    },
    validate: yupResolver(schema),
  });

  useEffect(() => {
     if (authStatus === 'unauthenticated') {
         router.replace('/admin/login');
     }
     // No explicit redirect for non-superadmin here, UI below handles it.
  }, [authStatus, router]);


  const handleSubmit = async (values: typeof form.values) => {
    setIsLoading(true);
    setApiError(null);

    // We don't send confirmPassword to the backend
    const { confirmPassword, ...payloadToSend } = values;

    try {
      const response = await fetch('/api/admin/manage-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadToSend),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);

      notifications.show({
         title: 'Admin User Created',
         message: `Admin user ${data.email} created successfully with role: ${data.role}.`,
         color: 'green', icon: <IconUserPlus />,
      });
      router.push('/admin/users');
    } catch (err: any) {
      setApiError(err.message);
      notifications.show({ title: 'Error Creating Admin User', message: err.message, color: 'red', icon: <IconAlertCircle /> });
    } finally {
      setIsLoading(false);
    }
  };

  if (authStatus === 'loading') {
     return <AdminLayout><LoadingOverlay visible={true} overlayProps={{radius:'sm', blur:2, fixed:true}} /></AdminLayout>;
  }
  if (authStatus === 'unauthenticated') return <Text p="xl">Redirecting to login...</Text>;

  if ((session?.user as any)?.role !== 'superadmin') {
     return (
         <AdminLayout>
             <Title order={2} mb="xl"><Group gap="xs"><IconUserPlus />Add New Admin User</Group></Title>
             <Alert color="red" title="Access Denied" icon={<IconShieldLock />}>
                 You do not have permission to create new admin users. This action is for superadmins only.
             </Alert>
         </AdminLayout>
     );
  }

  return (
    <AdminLayout>
      <Title order={2} mb="xl"><Group gap="xs"><IconUserPlus />Add New Admin User</Group></Title>
      <Paper component="form" onSubmit={form.onSubmit(handleSubmit)} withBorder shadow="md" p="xl" radius="md" pos="relative" maw={700}> {/* Increased padding and max-width */}
        <LoadingOverlay visible={isLoading} overlayProps={{radius:'sm', blur:2}} />
        {apiError && <Alert icon={<IconAlertCircle size="1rem" />} title="Error!" color="red" withCloseButton onClose={() => setApiError(null)} mb="md">{apiError}</Alert>}

        <TextInput label="Email Address" placeholder="user@example.com" required {...form.getInputProps('email')} mb="sm" />
        <PasswordInput label="Password" placeholder="Min. 8 characters" required {...form.getInputProps('password')} mb="sm" />
        <PasswordInput label="Confirm Password" placeholder="Re-type password" required {...form.getInputProps('confirmPassword')} mb="md" />

        <Select
          label="Role"
          placeholder="Select role for this admin"
          data={ALLOWED_ADMIN_ROLES
            .filter(role => role !== 'superadmin' || (session?.user as any)?.email === form.values.email) // Allow superadmin to assign self as superadmin if re-creating own, though API might block
            .map(role => ({
                value: role,
                label: role.charAt(0).toUpperCase() + role.slice(1).replace(/([A-Z])/g, ' $1').trim()
            }))
          }
          required
          {...form.getInputProps('role')}
          mb="md"
          description={(session?.user as any)?.email === form.values.email && form.values.role === 'superadmin' ? "Assigning 'superadmin' to self." : "Note: 'superadmin' role grants all permissions."}
        />
        <Switch
            labelPosition="left"
            label="Account is Active?"
            description="Inactive accounts cannot log in."
            {...form.getInputProps('isActive', { type: 'checkbox' })}
            mb="xl"
            styles={{ root: { display: 'flex', justifyContent: 'space-between'}, label: { fontWeight: 500 } }}
        />

        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={() => router.push('/admin/users')} leftSection={<IconX size={16}/>} disabled={isLoading}>Cancel</Button>
          <Button type="submit" leftSection={<IconDeviceFloppy size={16}/>} loading={isLoading} disabled={isLoading || !form.isDirty()}>Create Admin User</Button>
        </Group>
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
