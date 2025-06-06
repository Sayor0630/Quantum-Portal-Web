'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AdminLayout from '../../../components/admin/AdminLayout';
import { Title, Text, Paper, Table, Group, Button, ActionIcon, LoadingOverlay, Alert, Modal, TextInput, Space, Switch, Textarea } from '@mantine/core';
import { IconPlus, IconEdit, IconTrash, IconAlertCircle, IconDeviceFloppy } from '@tabler/icons-react';
import { hasPermission, Role, Permission } from '../../../lib/permissions'; // Adjusted path
import { notifications } from '@mantine/notifications'; // For showing success/error messages

// Interface matching the backend model IPaymentMethod
interface PaymentMethod {
  _id: string;
  name: string;
  isEnabled: boolean;
  details?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export default function PaymentMethodsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for Add/Edit Modal
  const [modalOpened, setModalOpened] = useState(false);
  const [currentMethod, setCurrentMethod] = useState<PaymentMethod | null>(null); // For editing
  const [methodName, setMethodName] = useState('');
  const [methodDetails, setMethodDetails] = useState('');
  const [methodIsEnabled, setMethodIsEnabled] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Delete Handler state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [methodToDelete, setMethodToDelete] = useState<PaymentMethod | null>(null);

  const userRole = (session?.user as any)?.role as Role | undefined;
  const canManagePaymentMethods = userRole ? hasPermission(userRole, Permission.MANAGE_PAYMENT_METHODS) : false;

  const fetchPaymentMethods = useCallback(async () => {
    if (!canManagePaymentMethods) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/payment-methods');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch payment methods. Status: ${response.status}`);
      }
      const result = await response.json();
      if (result.success) {
        setPaymentMethods(result.data);
      } else {
        throw new Error(result.message || 'Failed to fetch payment methods.');
      }
    } catch (err: any) {
      setError(err.message);
      setPaymentMethods([]); // Clear previous data on error
    } finally {
      setIsLoading(false);
    }
  }, [canManagePaymentMethods]);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      if (canManagePaymentMethods) {
        fetchPaymentMethods();
      }
    } else if (authStatus === 'unauthenticated') {
      router.replace('/admin/login');
    }
  }, [authStatus, router, canManagePaymentMethods, fetchPaymentMethods]);

  const openModal = (method: PaymentMethod | null = null) => {
    setCurrentMethod(method);
    if (method) {
      setMethodName(method.name);
      setMethodDetails(method.details || '');
      setMethodIsEnabled(method.isEnabled);
    } else {
      setMethodName('');
      setMethodDetails('');
      setMethodIsEnabled(true);
    }
    setSubmissionError(null);
    setModalOpened(true);
  };

  const handleFormSubmit = async () => {
    if (!methodName.trim()) {
      setSubmissionError('Payment method name cannot be empty.');
      return;
    }
    setIsSubmitting(true);
    setSubmissionError(null);

    const methodData = {
      name: methodName,
      details: methodDetails,
      isEnabled: methodIsEnabled,
    };

    const url = currentMethod ? `/api/admin/payment-methods/${currentMethod._id}` : '/api/admin/payment-methods';
    const httpMethod = currentMethod ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: httpMethod,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(methodData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || `Failed to ${currentMethod ? 'update' : 'save'} payment method. Status: ${response.status}`);
      }

      notifications.show({
        title: `Payment Method ${currentMethod ? 'Updated' : 'Added'}`,
        message: `Successfully ${currentMethod ? 'updated' : 'added'} "${methodData.name}".`,
        color: 'green',
      });

      setModalOpened(false);
      fetchPaymentMethods(); // Refresh list
    } catch (apiError: any) {
      setSubmissionError(apiError.message);
      notifications.show({
        title: 'Error',
        message: apiError.message || `Failed to ${currentMethod ? 'update' : 'add'} method.`,
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authStatus === 'loading') {
    return <AdminLayout><LoadingOverlay visible={true} overlayProps={{radius: "sm", blur: 2, fixed: true}} /></AdminLayout>;
  }

  if (!canManagePaymentMethods && authStatus === 'authenticated') {
    return (
      <AdminLayout>
        <Paper p="xl" shadow="sm" withBorder>
          <Title order={3}>Access Denied</Title>
          <Text>You do not have permission to manage payment methods.</Text>
          <Button mt="md" onClick={() => router.push('/admin')}>Go to Dashboard</Button>
        </Paper>
      </AdminLayout>
    );
  }

  const rows = paymentMethods.map((method) => (
    <Table.Tr key={method._id}>
      <Table.Td>{method.name}</Table.Td>
      <Table.Td>
        <Switch
          checked={method.isEnabled}
          onChange={async (event) => {
            const newIsEnabled = event.currentTarget.checked;
            try {
              const response = await fetch(`/api/admin/payment-methods/${method._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isEnabled: newIsEnabled }),
              });
              const result = await response.json();
              if (!response.ok || !result.success) {
                throw new Error(result.message || 'Failed to update status');
              }
              notifications.show({
                title: 'Status Updated',
                message: `Payment method "${method.name}" ${newIsEnabled ? 'enabled' : 'disabled'}.`,
                color: 'blue',
              });
              fetchPaymentMethods(); // Refresh list
            } catch (err: any) {
              notifications.show({
                title: 'Error Updating Status',
                message: err.message,
                color: 'red',
              });
            }
          }}
          label={method.isEnabled ? 'Enabled' : 'Disabled'}
        />
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <ActionIcon variant="subtle" color="blue" onClick={() => openModal(method)}>
            <IconEdit size={18} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(method)}>
            <IconTrash size={18} />
          </ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  const handleDelete = (method: PaymentMethod) => {
    setMethodToDelete(method);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!methodToDelete) return;
    setIsSubmitting(true); // Can reuse for delete operation status
    try {
      const response = await fetch(`/api/admin/payment-methods/${methodToDelete._id}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to delete payment method.');
      }
      notifications.show({
        title: 'Payment Method Deleted',
        message: `Successfully deleted "${methodToDelete.name}".`,
        color: 'green',
      });
      setShowDeleteConfirm(false);
      setMethodToDelete(null);
      fetchPaymentMethods(); // Refresh list
    } catch (err: any) {
      notifications.show({
        title: 'Error Deleting Method',
        message: err.message,
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <AdminLayout>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Payment Methods</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => openModal()}>
          Add New Method
        </Button>
      </Group>

      {/* Add/Edit Modal - already exists from previous step */}
      <Modal
        opened={modalOpened}
        onClose={() => {
          if (isSubmitting) return;
          setModalOpened(false);
        }}
        title={currentMethod ? 'Edit Payment Method' : 'Add New Payment Method'}
        centered
        size="md"
      >
        <TextInput
          label="Payment Method Name"
          placeholder="e.g., Stripe, PayPal, Cash on Delivery"
          required
          value={methodName}
          onChange={(event) => setMethodName(event.currentTarget.value)}
          error={submissionError && !methodName.trim() ? 'Name cannot be empty' : null}
          disabled={isSubmitting}
          mb="sm"
        />
        <Textarea
          label="Details (Optional)"
          placeholder="Enter any relevant details or instructions"
          value={methodDetails}
          onChange={(event) => setMethodDetails(event.currentTarget.value)}
          disabled={isSubmitting}
          minRows={3}
          mb="sm"
        />
        <Switch
          label="Enabled"
          checked={methodIsEnabled}
          onChange={(event) => setMethodIsEnabled(event.currentTarget.checked)}
          disabled={isSubmitting}
          mb="lg"
        />
        {submissionError && methodName.trim() && <Text c="red" size="sm" mt="xs" mb="sm">{submissionError}</Text>} {/* Show general submission error if name is filled */}
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setModalOpened(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleFormSubmit} loading={isSubmitting} leftSection={<IconDeviceFloppy size={16} />}>
            {currentMethod ? 'Save Changes' : 'Add Method'}
          </Button>
        </Group>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={showDeleteConfirm}
        onClose={() => {
          if (isSubmitting) return;
          setShowDeleteConfirm(false);
          setMethodToDelete(null);
        }}
        title="Confirm Deletion"
        centered
        size="sm"
        padding="lg"
      >
        <Text>Are you sure you want to delete the payment method: <strong>{methodToDelete?.name}</strong>?</Text>
        <Text c="dimmed" size="sm">This action cannot be undone.</Text>
        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={() => setShowDeleteConfirm(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button color="red" onClick={confirmDelete} loading={isSubmitting} leftSection={<IconTrash size={16} />}>
            Delete
          </Button>
        </Group>
      </Modal>

      <Paper withBorder shadow="sm" radius="md">
        {isLoading && paymentMethods.length === 0 && !error && <LoadingOverlay visible={true} overlayProps={{radius: "sm", blur: 1}} />}
        {!isLoading && error && (
          <Alert title="Error" color="red" icon={<IconAlertCircle />} m="md" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {!isLoading && !error && paymentMethods.length === 0 && (
          <Text p="xl" ta="center" c="dimmed">
            No payment methods have been configured yet.
            <Space h="xs"/>
            <Button size="xs" variant="outline" onClick={() => openModal()}>Add Your First Payment Method</Button>
          </Text>
        )}
        {!error && paymentMethods.length > 0 && (
          <Table striped highlightOnHover verticalSpacing="md" miw={600}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        )}
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
