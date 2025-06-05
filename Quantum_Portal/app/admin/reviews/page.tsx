'use client';

import AdminLayout from '../../../components/admin/AdminLayout';
import { Title, Text, Paper, Table, Group, Button, ActionIcon, LoadingOverlay, Alert, ScrollArea, Pagination, TextInput, Select, Badge, Menu, Rating, Textarea, Space, Grid } from '@mantine/core'; // Added Space
import { IconAlertCircle, IconSearch, IconFilter, IconTrash, IconCheck, IconX, IconClockHour4, IconDotsVertical, IconMessageCircleQuestion, IconStar } from '@tabler/icons-react'; // Added IconStar
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDebouncedValue } from '@mantine/hooks';
import dayjs from 'dayjs';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';

interface ReviewProduct {
     _id: string;
     name: string;
     sku?: string;
     images?: string[];
}
interface ReviewCustomer {
     _id: string;
     firstName?: string;
     lastName?: string;
     email: string;
}
interface Review {
  _id: string;
  product: ReviewProduct | null;
  customer: ReviewCustomer | null;
  rating: number;
  comment: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}
interface PaginatedReviewsResponse {
     reviews: Review[];
     currentPage: number;
     totalPages: number;
     totalItems: number;
}

const getStatusColor = (status: string) => {
     switch (status?.toLowerCase()) {
     case 'pending': return 'yellow';
     case 'approved': return 'green';
     case 'rejected': return 'red';
     default: return 'gray';
     }
 };
 const REVIEW_STATUSES = ['pending', 'approved', 'rejected'];
 const RATING_OPTIONS = [
    { label: 'All Ratings', value: '' },
    { label: '5 Stars', value: '5' },
    { label: '4 Stars', value: '4' },
    { label: '3 Stars', value: '3' },
    { label: '2 Stars', value: '2' },
    { label: '1 Star', value: '1' },
 ];

export default function ReviewsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<{[key: string]: boolean}>({});

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 500);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState<string | null>(null);


  const fetchReviews = useCallback(async (page: number, search: string, statusFilter: string | null, ratingFilter: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({ page: String(page), limit: '10' });
      if (search) queryParams.append('search', search);
      if (statusFilter) queryParams.append('status', statusFilter);
      if (ratingFilter) queryParams.append('rating', ratingFilter);

      const response = await fetch(`/api/admin/reviews?${queryParams.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: PaginatedReviewsResponse = await response.json();
      setReviews(data.reviews);
      setCurrentPage(data.currentPage);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch reviews.');
      setReviews([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/admin/login');
    if (authStatus === 'authenticated') {
      fetchReviews(currentPage, debouncedSearchTerm, selectedStatus, selectedRating);
    }
  }, [authStatus, router, currentPage, debouncedSearchTerm, selectedStatus, selectedRating, fetchReviews]);

  const handleUpdateStatus = async (reviewId: string, newStatus: Review['status']) => {
     setActionLoading(prev => ({ ...prev, [reviewId]: true }));
     try {
         const response = await fetch(`/api/admin/reviews/${reviewId}`, {
             method: 'PUT',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ status: newStatus }),
         });
         const updatedReview = await response.json();
         if (!response.ok) throw new Error(updatedReview.message || 'Failed to update review status.');

         setReviews(prev => prev.map(r => r._id === reviewId ? { ...r, status: updatedReview.status } : r));
         notifications.show({ title: 'Status Updated', message: `Review status changed to ${newStatus}.`, color: 'green', icon: <IconCheck /> });
     } catch (err: any) {
         notifications.show({ title: 'Error Updating Status', message: err.message, color: 'red', icon: <IconAlertCircle /> });
     } finally {
         setActionLoading(prev => ({ ...prev, [reviewId]: false }));
     }
  };

  const handleDeleteReview = (reviewId: string, reviewCommentPreview: string) => {
     modals.openConfirmModal({
         title: 'Delete Review', centered: true,
         children: (<Text size="sm">Are you sure you want to delete this review: &quot;<em>{reviewCommentPreview.substring(0,50)}...</em>&quot;? This action is permanent.</Text>),
         labels: { confirm: 'Delete Review', cancel: 'Cancel' }, confirmProps: { color: 'red' },
         onConfirm: async () => {
             setActionLoading(prev => ({ ...prev, [reviewId]: true }));
             try {
                 const response = await fetch(`/api/admin/reviews/${reviewId}`, { method: 'DELETE' });
                 if (!response.ok) {
                      const errorData = await response.json();
                      throw new Error(errorData.message || 'Failed to delete review.');
                 }
                 setReviews(prev => prev.filter(r => r._id !== reviewId));
                 // Optional: Refetch to update pagination if needed, e.g. if last item on page deleted
                 if(reviews.length === 1 && currentPage > 1) {
                    fetchReviews(currentPage - 1, debouncedSearchTerm, selectedStatus, selectedRating);
                 } else {
                    // fetchReviews(currentPage, debouncedSearchTerm, selectedStatus, selectedRating); // Or simply rely on local removal
                 }

                 notifications.show({ title: 'Review Deleted', message: 'Review successfully deleted.', color: 'green', icon: <IconTrash /> });
             } catch (err: any) {
                 notifications.show({ title: 'Error Deleting Review', message: err.message, color: 'red', icon: <IconAlertCircle /> });
             } finally {
                 setActionLoading(prev => ({ ...prev, [reviewId]: false }));
             }
         },
     });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.currentTarget.value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value: string | null) => {
    setSelectedStatus(value);
    setCurrentPage(1);
  };

  const handleRatingFilterChange = (value: string | null) => {
    setSelectedRating(value);
    setCurrentPage(1);
  };


  if (authStatus === 'loading' || (isLoading && authStatus === 'authenticated' && reviews.length === 0 && !error) ) {
     return <AdminLayout><LoadingOverlay visible={true} overlayProps={{radius:'sm', blur:2, fixed: true}} /></AdminLayout>;
  }
  if (authStatus === 'unauthenticated') return <Text p="xl">Redirecting to login...</Text>;

  const rows = reviews.map((review) => {
    const customerName = review.customer
        ? `${review.customer.firstName || ''} ${review.customer.lastName || ''}`.trim() || review.customer.email
        : 'N/A';
    const productName = review.product?.name || 'Product Not Available';
    const productLink = review.product ? `/admin/products/edit/${review.product._id}` : '#';

    return (
    <Table.Tr key={review._id}>
      <Table.Td>
         <Link href={productLink} passHref legacyBehavior>
             <Text component="a" c="blue.6" size="sm" title={productName}>
                {productName.substring(0,30)}{productName.length > 30 ? '...' : ''}
             </Text>
         </Link>
      </Table.Td>
      <Table.Td>{customerName}</Table.Td>
      <Table.Td><Rating value={review.rating} fractions={2} readOnly size="xs" /></Table.Td>
      <Table.Td><Text size="xs" lineClamp={2} title={review.comment}>{review.comment}</Text></Table.Td>
      <Table.Td>{dayjs(review.createdAt).format('MMM D, YYYY')}</Table.Td>
      <Table.Td>
         <Badge color={getStatusColor(review.status)} variant="light" radius="sm">
             {review.status.charAt(0).toUpperCase() + review.status.slice(1)}
         </Badge>
      </Table.Td>
      <Table.Td>
        <Menu shadow="md" width={200} disabled={actionLoading[review._id] || isLoading}>
          <Menu.Target><ActionIcon variant="subtle" color="gray" loading={actionLoading[review._id]}><IconDotsVertical size={18} /></ActionIcon></Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Quick Actions</Menu.Label>
            <Menu.Item leftSection={<IconCheck size={14} />} onClick={() => handleUpdateStatus(review._id, 'approved')} disabled={review.status === 'approved'}>Approve</Menu.Item>
            <Menu.Item leftSection={<IconClockHour4 size={14} />} onClick={() => handleUpdateStatus(review._id, 'pending')} disabled={review.status === 'pending'}>Set to Pending</Menu.Item>
            <Menu.Item leftSection={<IconX size={14} />} color="orange" onClick={() => handleUpdateStatus(review._id, 'rejected')} disabled={review.status === 'rejected'}>Reject</Menu.Item>
            <Menu.Divider />
            {/* <Menu.Item leftSection={<IconPencil size={14} />}>Edit Comment (TBD)</Menu.Item> */}
            <Menu.Item color="red" leftSection={<IconTrash size={14} />} onClick={() => handleDeleteReview(review._id, review.comment)}>Delete Review</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Table.Td>
    </Table.Tr>
  )});

  return (
    <AdminLayout>
      <Title order={2} mb="xl">Review & Rating Management</Title>
      <Paper withBorder shadow="sm" radius="md" p="md" mb="xl">
         <Grid grow gutter="md">
            <Grid.Col span={{base:12, md:4}}>
                <TextInput placeholder="Search Product Name, Customer Email..." leftSection={<IconSearch size={16}/>} value={searchTerm} onChange={handleSearchChange} />
            </Grid.Col>
            <Grid.Col span={{base:12, sm:6, md:4}}>
                <Select label="Status" placeholder="Filter by status" data={[{label: 'All Statuses', value: ''}, ...REVIEW_STATUSES.map(s => ({label: s.charAt(0).toUpperCase() + s.slice(1), value: s}))]} value={selectedStatus} onChange={handleStatusFilterChange} clearable />
            </Grid.Col>
            <Grid.Col span={{base:12, sm:6, md:4}}>
                <Select label="Rating" placeholder="Filter by rating" data={RATING_OPTIONS} value={selectedRating} onChange={handleRatingFilterChange} clearable leftSection={<IconStar size={16}/>} />
            </Grid.Col>
         </Grid>
      </Paper>
      {error && !isLoading && <Alert title="Error Fetching Reviews" color="red" icon={<IconAlertCircle/>} withCloseButton onClose={() => setError(null)} mb="lg">{error} Please try <Button variant="subtle" size="xs" onClick={() => fetchReviews(currentPage, debouncedSearchTerm, selectedStatus, selectedRating)}>reloading</Button>.</Alert>}
      <Paper withBorder shadow="sm" radius="md">
         <ScrollArea>
             <LoadingOverlay visible={isLoading && authStatus==='authenticated'} />
             {!isLoading && !error && reviews.length === 0 && <Text p="xl" ta="center" c="dimmed">No reviews found matching your criteria.</Text>}
             {!isLoading && !error && reviews.length > 0 && (
                 <Table striped highlightOnHover verticalSpacing="sm" miw={1000}>
                     <Table.Thead><Table.Tr><Table.Th>Product</Table.Th><Table.Th>Customer</Table.Th><Table.Th>Rating</Table.Th><Table.Th style={{maxWidth: 300}}>Comment (Preview)</Table.Th><Table.Th>Date</Table.Th><Table.Th>Status</Table.Th><Table.Th>Actions</Table.Th></Table.Tr></Table.Thead>
                     <Table.Tbody>{rows}</Table.Tbody>
                 </Table>
             )}
         </ScrollArea>
      </Paper>
      {totalPages > 1 && !isLoading && !error && reviews.length > 0 && <Group justify="center" mt="xl"><Pagination total={totalPages} value={currentPage} onChange={handlePageChange} /></Group>}
      <Space h="xl" />
    </AdminLayout>
  );
}
