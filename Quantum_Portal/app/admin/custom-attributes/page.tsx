'use client';

import AdminLayout from '../../../components/admin/AdminLayout';
import { Title, Text, Paper, Table, Group, Button, ActionIcon, LoadingOverlay, Alert, Badge, ScrollArea, Space } from '@mantine/core';
import { IconPencil, IconTrash, IconPlus, IconAlertCircle, IconEye } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { modals } from '@mantine/modals'; // Import modals
import { notifications } from '@mantine/notifications'; // Import notifications

interface CustomAttribute {
  _id: string;
  name: string;
  values: string[];
  createdAt?: string;
  updatedAt?: string;
}

export default function CustomAttributesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [attributes, setAttributes] = useState<CustomAttribute[]>([]);
  const [isLoading, setIsLoading] = useState(true); // General loading for fetch
  const [isDeleting, setIsDeleting] = useState<string | null>(null); // To indicate which item is being deleted
  const [error, setError] = useState<string | null>(null);

  const fetchAttributes = async () => { // Extracted fetch logic
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/attribute-definitions');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: CustomAttribute[] = await response.json();
      setAttributes(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch custom attributes.');
      notifications.show({
        title: 'Error Fetching Attributes',
        message: err.message || 'Could not load attributes.',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/admin/login');
    }
    if (status === 'authenticated') {
      fetchAttributes();
    }
  }, [status, router]);


  const handleDeleteAttribute = (attributeId: string, attributeName: string) => {
    modals.openConfirmModal({
      title: `Delete Attribute: ${attributeName}`,
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete the attribute &quot;{attributeName}&quot;? This action is irreversible.
          Products using this attribute will have it cleared.
        </Text>
      ),
      labels: { confirm: 'Delete Attribute', cancel: "Cancel" },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        setIsDeleting(attributeId); // Set deleting state for this specific attribute
        try {
          const response = await fetch(`/api/admin/attribute-definitions/${attributeId}`, {
            method: 'DELETE',
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.message || 'Failed to delete attribute.');
          }
          setAttributes((prevAttributes) => prevAttributes.filter((attr) => attr._id !== attributeId));
          notifications.show({
            title: 'Attribute Deleted',
            message: `Attribute "${attributeName}" and its references in products have been successfully deleted.`,
            color: 'green',
          });
        } catch (err: any) {
          notifications.show({
            title: 'Error Deleting Attribute',
            message: err.message || 'An unexpected error occurred.',
            color: 'red',
          });
        } finally {
          setIsDeleting(null); // Clear deleting state
        }
      },
    });
  };


  if (status === 'loading' || (isLoading && status === 'authenticated' && attributes.length === 0 && !error)) {
     return (
         <AdminLayout>
             <LoadingOverlay visible={true} overlayProps={{ radius: 'sm', blur: 2, fixed: true }} />
         </AdminLayout>
     );
  }
  if (status === 'unauthenticated') {
     return <Text p="xl">Redirecting to login...</Text>;
  }

  const rows = attributes.map((attribute) => (
    <Table.Tr key={attribute._id}>
      <Table.Td>{attribute.name}</Table.Td>
      <Table.Td>
        <Group gap="xs" wrap="wrap">
          {attribute.values.slice(0, 5).map((val, index) => (
            <Badge key={`${attribute._id}-val-${index}`} variant="light" color="blue">{val}</Badge>
          ))}
          {attribute.values.length > 5 && (
             <Text size="xs" c="dimmed">+{attribute.values.length - 5} more</Text>
          )}
          {attribute.values.length === 0 && (
             <Text size="xs" c="dimmed">No values defined</Text>
          )}
        </Group>
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <ActionIcon
             variant="subtle"
             color="green"
             component={Link}
             href={`/admin/custom-attributes/${attribute._id}`}
             aria-label={`View products using ${attribute.name}`}
           >
            <IconEye size={18} />
          </ActionIcon>
          <ActionIcon
             variant="subtle"
             color="blue"
             component={Link}
             href={`/admin/custom-attributes/edit/${attribute._id}`}
             aria-label={`Edit ${attribute.name}`}
           >
            <IconPencil size={18} />
          </ActionIcon>
          <ActionIcon
             variant="subtle"
             color="red"
             onClick={() => handleDeleteAttribute(attribute._id, attribute.name)}
             loading={isDeleting === attribute._id} // Show loading on the icon being deleted
             aria-label={`Delete ${attribute.name}`}
           >
            <IconTrash size={18} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <AdminLayout>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Custom Attribute Definitions</Title>
        <Button
         leftSection={<IconPlus size={16} />}
         component={Link}
         href="/admin/custom-attributes/new"
        >
          Add New Attribute
        </Button>
      </Group>

      {error && !isLoading && ( // Show error only if not loading and error exists
         <Alert title="Error" color="red" icon={<IconAlertCircle />} withCloseButton onClose={() => setError(null)} mb="lg">
             {error} Please try <Button variant="subtle" size="xs" onClick={fetchAttributes}>reloading</Button>.
         </Alert>
      )}

      <Paper withBorder shadow="sm" radius="md">
         <ScrollArea>
             <LoadingOverlay visible={isLoading && attributes.length > 0} overlayProps={{ radius: 'sm', blur: 1 }} />
             {!isLoading && !error && attributes.length === 0 && (
                 <Text p="xl" ta="center" c="dimmed">No custom attributes defined yet. Click &quot;Add New Attribute&quot; to get started.</Text>
             )}
             {!error && attributes.length > 0 && (
                 <Table striped highlightOnHover verticalSpacing="sm" miw={700}>
                     <Table.Thead>
                     <Table.Tr>
                         <Table.Th>Attribute Name</Table.Th>
                         <Table.Th>Defined Values (Preview)</Table.Th>
                         <Table.Th>Actions</Table.Th>
                     </Table.Tr>
                     </Table.Thead>
                     <Table.Tbody>{rows}</Table.Tbody>
                 </Table>
             )}
         </ScrollArea>
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
