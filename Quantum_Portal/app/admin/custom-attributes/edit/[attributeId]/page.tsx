'use client';

import AdminLayout from '../../../../../components/admin/AdminLayout'; // Adjusted path
import { Title, Paper, TextInput, Button, Group, ActionIcon, Text, LoadingOverlay, Alert, Box, Space, Skeleton } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { IconPlus, IconTrash, IconAlertCircle, IconDeviceFloppy } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useSession } from 'next-auth/react';

interface CustomAttribute {
  _id: string;
  name: string;
  values: string[];
}

export default function EditCustomAttributePage() {
  const router = useRouter();
  const params = useParams();
  const attributeId = params?.attributeId as string; // Get ID from URL
  const { data: session, status: sessionStatus } = useSession();

  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true); // For initial data load
  const [apiError, setApiError] = useState<string | null>(null);
  const [valueFields, setValueFields] = useState<string[]>(['']);

  const form = useForm({
    initialValues: {
      name: '',
    },
    validate: {
      name: (value) => (value.trim().length > 0 ? null : 'Attribute name is required'),
    },
  });

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.replace('/admin/login');
    }
  }, [sessionStatus, router]);

  useEffect(() => {
    if (attributeId && sessionStatus === 'authenticated') {
      setIsFetching(true);
      const fetchAttribute = async () => {
        try {
          const response = await fetch(`/api/admin/attribute-definitions/${attributeId}`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to fetch attribute details.');
          }
          const data: CustomAttribute = await response.json();
          form.setValues({ name: data.name });
          setValueFields(data.values.length > 0 ? data.values : ['']); // Ensure at least one field
        } catch (err: any) {
          setApiError(err.message);
          notifications.show({
            title: 'Error Fetching Data',
            message: err.message || 'Could not load attribute details.',
            color: 'red',
          });
        } finally {
          setIsFetching(false);
        }
      };
      fetchAttribute();
    }
  }, [attributeId, sessionStatus, form.setValues]);


  const addValueField = () => setValueFields([...valueFields, '']);
  const removeValueField = (index: number) => {
    if (valueFields.length > 1) {
      setValueFields(valueFields.filter((_, i) => i !== index));
    } else {
      setValueFields(['']);
    }
  };
  const updateValueField = (index: number, value: string) => {
    const newValues = [...valueFields];
    newValues[index] = value;
    setValueFields(newValues);
  };

  const handleSubmit = async (formValues: { name: string }) => {
    setIsLoading(true);
    setApiError(null);
    const processedValues = valueFields.map(v => v.trim()).filter(v => v !== '');

    try {
      const response = await fetch(`/api/admin/attribute-definitions/${attributeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formValues.name, values: processedValues }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      notifications.show({
        title: 'Attribute Updated',
        message: `Attribute "${data.name}" has been successfully updated.`,
        color: 'green',
        icon: <IconDeviceFloppy />,
      });
      router.push('/admin/custom-attributes');
    } catch (err: any) {
      setApiError(err.message);
      notifications.show({
        title: 'Error Updating Attribute',
        message: err.message || 'An unexpected error occurred.',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (sessionStatus === 'loading' || isFetching) {
    return (
      <AdminLayout>
        <Title order={2} mb="xl">Edit Custom Attribute</Title>
        <Paper withBorder shadow="md" p={30} radius="md">
          <Skeleton height={40} mb="md" />
          <Skeleton height={20} mb="xs" />
          <Skeleton height={40} mb="xs" />
          <Skeleton height={40} mb="xs" />
          <Skeleton height={36} mt="xs" width={100} />
          <Group justify="flex-end" mt="xl">
            <Skeleton height={36} width={100} />
            <Skeleton height={36} width={150} />
          </Group>
        </Paper>
      </AdminLayout>
    );
  }
   if (sessionStatus === 'unauthenticated') {
    return <Text p="xl">Redirecting to login...</Text>;
  }
  if (apiError && !isFetching) { // Show error prominently if fetch failed and not just a submit error
    return (
        <AdminLayout>
            <Title order={2} mb="xl">Edit Custom Attribute</Title>
            <Alert icon={<IconAlertCircle size="1rem" />} title="Failed to load attribute data" color="red">
                {apiError} Please try refreshing or go back.
            </Alert>
        </AdminLayout>
    );
  }


  return (
    <AdminLayout>
      <Title order={2} mb="xl">Edit Custom Attribute: {form.values.name || 'Loading...'}</Title>
      <Paper withBorder shadow="md" p={30} radius="md" pos="relative">
        <LoadingOverlay visible={isLoading} overlayProps={{ radius: 'sm', blur: 2 }} />
        <form onSubmit={form.onSubmit(handleSubmit)}>
          {apiError && !isLoading && ( // Show submit error if not loading
            <Alert icon={<IconAlertCircle size="1rem" />} title="API Error!" color="red" withCloseButton onClose={() => setApiError(null)} mb="md">
              {apiError}
            </Alert>
          )}
          <TextInput
            label="Attribute Name"
            placeholder="e.g., Color, Size, Material"
            required
            {...form.getInputProps('name')}
            mb="md"
          />
          <Text fw={500} size="sm" mb="xs">Attribute Values</Text>
          {valueFields.map((value, index) => (
            <Group key={index} mb="xs" grow>
              <TextInput
                placeholder={`Value ${index + 1}`}
                value={value}
                onChange={(event) => updateValueField(index, event.currentTarget.value)}
                style={{ flexGrow: 1 }}
              />
              <ActionIcon color="red" onClick={() => removeValueField(index)} disabled={valueFields.length === 1 && valueFields[0] === '' && index === 0}>
                <IconTrash size={18} />
              </ActionIcon>
            </Group>
          ))}
          <Button leftSection={<IconPlus size={16} />} variant="outline" onClick={addValueField} mt="xs" mb="xl">
            Add Value
          </Button>
          <Group justify="flex-end" mt="xl">
            <Button variant="default" onClick={() => router.push('/admin/custom-attributes')} disabled={isLoading || isFetching}>Cancel</Button>
            <Button type="submit" leftSection={<IconDeviceFloppy size={16}/>} disabled={isFetching || isLoading || !form.isDirty()}>Save Changes</Button>
          </Group>
        </form>
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
