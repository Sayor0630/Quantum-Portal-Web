'use client';

import AdminLayout from '../../../../components/admin/AdminLayout'; // Adjust path
import { Title, Paper, TextInput, Button, Group, ActionIcon, Text, LoadingOverlay, Alert, Box, Space } from '@mantine/core';
import { useForm } from '@mantine/form'; // Removed yupResolver as it's not used with current simplified validation
import { useState, useEffect } from 'react'; // Added useEffect for useSession status check
import { useRouter } from 'next/navigation';
import { IconPlus, IconTrash, IconAlertCircle, IconDeviceFloppy } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useSession } from 'next-auth/react'; // For session check

export default function NewCustomAttributePage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [isLoading, setIsLoading] = useState(false);
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

    // Additional client-side validation if needed, e.g., for values
    if (processedValues.length === 0) {
        // Optional: require at least one value. The API allows empty values array.
        // setApiError("Please define at least one value for the attribute, or ensure the API handles empty values array if intended.");
        // setIsLoading(false);
        // return;
    }

    try {
      const response = await fetch('/api/admin/attribute-definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formValues.name, values: processedValues }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      notifications.show({
         title: 'Attribute Created',
         message: `Attribute "${data.name}" has been successfully created.`,
         color: 'green',
         icon: <IconDeviceFloppy />,
      });
      router.push('/admin/custom-attributes');

    } catch (err: any) {
      setApiError(err.message || 'An unexpected error occurred.');
      notifications.show({
         title: 'Error Creating Attribute',
         message: err.message || 'An unexpected error occurred.',
         color: 'red',
         icon: <IconAlertCircle />,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (sessionStatus === 'loading') {
    return (
        <AdminLayout>
            <LoadingOverlay visible={true} overlayProps={{ radius: 'sm', blur: 2, fixed: true }} />
        </AdminLayout>
    );
  }
  if (sessionStatus === 'unauthenticated') {
    return <Text p="xl">Redirecting to login...</Text>;
  }


  return (
    <AdminLayout>
      <Title order={2} mb="xl">Add New Custom Attribute</Title>
      <Paper withBorder shadow="md" p={30} radius="md" pos="relative">
        <LoadingOverlay visible={isLoading} overlayProps={{ radius: 'sm', blur: 2 }} />
        <form onSubmit={form.onSubmit(handleSubmit)}>
          {apiError && (
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
              <ActionIcon
                color="red"
                onClick={() => removeValueField(index)}
                disabled={valueFields.length === 1 && valueFields[0] === '' && index === 0} // Disable if it's the only empty field
                aria-label="Remove value field"
              >
                <IconTrash size={18} />
              </ActionIcon>
            </Group>
          ))}
          <Button
            leftSection={<IconPlus size={16} />}
            variant="outline"
            onClick={addValueField}
            mt="xs"
            mb="xl"
          >
            Add Value
          </Button>

          <Group justify="flex-end" mt="xl">
            <Button variant="default" onClick={() => router.push('/admin/custom-attributes')} disabled={isLoading}>Cancel</Button>
            <Button type="submit" leftSection={<IconDeviceFloppy size={16}/>} disabled={isLoading || !form.isDirty()}>Save Attribute</Button>
          </Group>
        </form>
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
