'use client';

import AdminLayout from '../../../components/admin/AdminLayout';
import { Title, Text, Paper, Table, Group, Button, ActionIcon, LoadingOverlay, Alert, ScrollArea, Badge, Space } from '@mantine/core';
import { IconPencil, IconTrash, IconPlus, IconAlertCircle, IconUsersGroup, IconUserCheck, IconUserOff, IconShieldLock } from '@tabler/icons-react';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dayjs from 'dayjs';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals'; // Import Modals

interface AdminUser {
  _id: string;
  email: string;
  role: 'admin' | 'superadmin' | 'contentManager' | 'orderManager';
  isActive: boolean;
  createdAt: string;
}

const getRoleColor = (role: string) => {
     switch (role?.toLowerCase()) {
     case 'superadmin': return 'pink';
     case 'admin': return 'blue';
     case 'contentmanager': return 'cyan';
     case 'ordermanager': return 'grape';
     default: return 'gray';
     }
 };
 const getStatusColor = (isActive: boolean) => isActive ? 'green' : 'gray';


export default function ManageAdminUsersPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true); // For initial list fetch
  const [error, setError] = useState<string | null>(null);
  const [deletingAdminUserId, setDeletingAdminUserId] = useState<string | null>(null); // For delete loading state

  const fetchAdminUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/manage-admins');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: AdminUser[] = await response.json();
      setAdminUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch admin users.');
      if (!err.message.toLowerCase().includes('forbidden')) {
         notifications.show({ title: 'Error Fetching Users', message: err.message, color: 'red', icon: <IconAlertCircle /> });
      }
      setAdminUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/admin/login');
    }
    if (authStatus === 'authenticated' && (session?.user as any)?.role === 'superadmin') {
      fetchAdminUsers();
    } else if (authStatus === 'authenticated' && (session?.user as any)?.role !== 'superadmin') {
      setIsLoading(false);
    }
  }, [authStatus, router, session, fetchAdminUsers]);

  const handleDeleteAdminUser = (userId: string, userEmail: string) => {
    const loggedInUserId = (session?.user as any)?.id;
    if (loggedInUserId === userId) {
        notifications.show({ title: 'Action Denied', message: 'You cannot delete your own account.', color: 'red', icon: <IconAlertCircle /> });
        return;
    }
    modals.openConfirmModal({
        title: 'Delete Admin User', centered: true,
        children: (<Text size="sm">Are you sure you want to delete the admin user &quot;<strong>{userEmail}</strong>&quot;? This action is permanent.</Text>),
        labels: { confirm: 'Delete User', cancel: 'Cancel' }, confirmProps: { color: 'red' },
        onConfirm: async () => {
            setDeletingAdminUserId(userId);
            try {
                const response = await fetch(`/api/admin/manage-admins/${userId}`, { method: 'DELETE' });
                const data = await response.json(); // API returns a message or error
                if (!response.ok) throw new Error(data.message || 'Failed to delete user.');

                setAdminUsers(prev => prev.filter(u => u._id !== userId));
                notifications.show({ title: 'Admin User Deleted', message: `User "${userEmail}" deleted successfully.`, color: 'green', icon: <IconTrash /> });
            } catch (err: any) {
                notifications.show({ title: 'Error Deleting User', message: err.message, color: 'red', icon: <IconAlertCircle /> });
            } finally {
                setDeletingAdminUserId(null);
            }
        },
    });
  };


  if (authStatus === 'loading' || (isLoading && authStatus === 'authenticated' && (session?.user as any)?.role === 'superadmin')) {
     return <AdminLayout><LoadingOverlay visible={true} overlayProps={{radius:'sm', blur:2, fixed:true}} /></AdminLayout>;
  }
  if (authStatus === 'unauthenticated') return <Text p="xl">Redirecting to login...</Text>;

  if ((session?.user as any)?.role !== 'superadmin') {
     return (
         <AdminLayout>
             <Title order={2} mb="xl"><Group gap="xs"><IconUsersGroup />Manage Admin Users</Group></Title>
             <Alert color="red" title="Access Denied" icon={<IconShieldLock />}>
                 You do not have permission to view or manage admin users. This section is for superadmins only.
             </Alert>
         </AdminLayout>
     );
  }

  const rows = adminUsers.map((user) => (
    <Table.Tr key={user._id}>
      <Table.Td>{user.email}</Table.Td>
      <Table.Td>
         <Badge color={getRoleColor(user.role)} variant="light" radius="sm">
             {user.role.charAt(0).toUpperCase() + user.role.slice(1).replace(/([A-Z])/g, ' $1')}
         </Badge>
      </Table.Td>
      <Table.Td>
         <Badge
             color={getStatusColor(user.isActive)}
             variant="light"
             radius="sm"
             leftSection={user.isActive ? <IconUserCheck size={14} /> : <IconUserOff size={14} />}
         >
             {user.isActive ? 'Active' : 'Inactive'}
         </Badge>
      </Table.Td>
      <Table.Td>{dayjs(user.createdAt).format('MMM D, YYYY')}</Table.Td>
      <Table.Td>
        <Group gap="xs">
          <ActionIcon
             variant="subtle"
             color="blue"
             component={Link}
             href={`/admin/users/edit/${user._id}`}
             aria-label={`Edit ${user.email}`}
             title={`Edit ${user.email}`}
           >
            <IconPencil size={18} />
          </ActionIcon>
          <ActionIcon
             variant="subtle"
             color="red"
             onClick={() => handleDeleteAdminUser(user._id, user.email)}
             loading={deletingAdminUserId === user._id}
             aria-label={`Delete ${user.email}`}
             title={`Delete ${user.email}`}
             disabled={(session?.user as any)?.id === user._id}
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
        <Title order={2}><Group gap="xs"><IconUsersGroup />Manage Admin Users</Group></Title>
        <Button leftSection={<IconPlus size={16} />} component={Link} href="/admin/users/new">
          Add New Admin User
        </Button>
      </Group>

      {error && !isLoading && (
         <Alert title="Error Fetching Admin Users" color="red" icon={<IconAlertCircle />} withCloseButton onClose={() => setError(null)} mb="lg">
             {error} Please try <Button variant="subtle" size="xs" onClick={fetchAdminUsers}>reloading</Button>.
         </Alert>
      )}

      <Paper withBorder shadow="sm" radius="md">
         <ScrollArea>
             {/* Show main loading overlay only if it's the initial data load for superadmin */}
             <LoadingOverlay visible={isLoading && adminUsers.length === 0 && authStatus === 'authenticated' && (session?.user as any)?.role === 'superadmin'} />
             {!isLoading && !error && adminUsers.length === 0 && (
                 <Text p="xl" ta="center" c="dimmed">No other admin users found. You might be the only superadmin, or you can add more.</Text>
             )}
             {!error && adminUsers.length > 0 && (
                 <Table striped highlightOnHover verticalSpacing="sm" miw={700}>
                     <Table.Thead>
                     <Table.Tr>
                         <Table.Th>Email</Table.Th>
                         <Table.Th>Role</Table.Th>
                         <Table.Th>Status</Table.Th>
                         <Table.Th>Created At</Table.Th>
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
