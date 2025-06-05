'use client';
import AdminLayout from '../../../../../components/admin/AdminLayout'; // Adjusted path
import { Title, Paper, TextInput, Button, Group, LoadingOverlay, Alert, Space, Text } from '@mantine/core';
import { useForm, yupResolver } from '@mantine/form';
import * as Yup from 'yup';
import { useState, useEffect } from 'react'; // Added useEffect
import { useRouter } from 'next/navigation';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconAlertCircle, IconX } from '@tabler/icons-react'; // Changed IconPlus to IconX for cancel
import { useSession } from 'next-auth/react';

const schema = Yup.object().shape({ name: Yup.string().required('Menu name is required') });

export default function NewMenuPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const form = useForm({
    initialValues: { name: '' },
    validate: yupResolver(schema)
  });

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/admin/login');
    }
  }, [authStatus, router]);

  const handleSubmit = async (values: { name: string }) => {
    setIsLoading(true); setApiError(null);
    try {
      const response = await fetch('/api/admin/navigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: values.name, items: [] }), // Create with empty items array
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create menu.');

      notifications.show({
        title: 'Menu Created',
        message: `Menu "${data.name}" created. You can now add items to it.`,
        color: 'green',
        icon: <IconDeviceFloppy />
      });
      router.push(`/admin/settings/navigation/edit/${data._id}`); // Redirect to edit items page
    } catch (err: any) {
      setApiError(err.message);
      notifications.show({ title: 'Error Creating Menu', message: err.message, color: 'red', icon: <IconAlertCircle /> });
    } finally {
      setIsLoading(false);
    }
  };

  if (authStatus === 'loading') {
    return <AdminLayout><LoadingOverlay visible={true} overlayProps={{ radius: 'sm', blur: 2, fixed: true }} /></AdminLayout>;
  }
  if (authStatus === 'unauthenticated') {
    return <Text p="xl">Redirecting to login...</Text>;
  }

  return (
    <AdminLayout>
      <Title order={2} mb="xl">Create New Navigation Menu</Title>
      <Paper component="form" onSubmit={form.onSubmit(handleSubmit)} withBorder shadow="md" p={30} radius="md" pos="relative" maw={600}> {/* Added max width */}
        <LoadingOverlay visible={isLoading} overlayProps={{ radius: 'sm', blur: 2 }}/>
        {apiError && (
            <Alert title="Error" color="red" mb="md" icon={<IconAlertCircle />} withCloseButton onClose={() => setApiError(null)}>
                {apiError}
            </Alert>
        )}
        <TextInput
            label="Menu Name"
            placeholder="e.g., Main Header, Footer Links"
            required
            {...form.getInputProps('name')}
            mb="xl"
        />
        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={() => router.push('/admin/settings/navigation')} leftSection={<IconX size={16} />} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" leftSection={<IconDeviceFloppy size={16} />} loading={isLoading}>
            Save & Add Items
          </Button>
        </Group>
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
