'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import AdminLayout from '../../../../../components/admin/AdminLayout';
import {
  Title,
  Paper,
  Group,
  Button,
  LoadingOverlay,
  Alert,
  Table,
  Text,
  Badge,
  ActionIcon,
  Box,
  Space,
  Pagination
} from '@mantine/core';
import {
  IconArrowLeft,
  IconUsers,
  IconAlertCircle,
  IconUser,
  IconCalendarEvent,
  IconShoppingCart,
  IconReceipt
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';

// Interface for order data (matching recent orders structure)
interface CustomerOrder {
  _id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerId: string;
  status: string;
  createdAt: string;
  orderTotalAmount: number;
  variants: Array<{
    variantId?: string;
    isVariantProduct: boolean;
    selectedAttributes?: { [key: string]: string } | null;
    variantSku?: string;
    quantity: number;
    individualAmount: number;
  }>;
}

// Interface for product data
interface Product {
  _id: string;
  name: string;
  sku?: string;
}

// Interface for API response
interface CustomersResponse {
  customers: CustomerOrder[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

export default function ProductCustomersPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const productId = params?.productId as string;

  // State
  const [product, setProduct] = useState<Product | null>(null);
  const [customers, setCustomers] = useState<CustomerOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Fetch product details
  useEffect(() => {
    if (authStatus === 'authenticated' && productId) {
      const fetchProduct = async () => {
        setIsLoadingProduct(true);
        try {
          const response = await fetch(`/api/admin/products/${productId}`);
          if (!response.ok) {
            throw new Error('Failed to fetch product details');
          }
          const productData = await response.json();
          setProduct(productData);
        } catch (err: any) {
          console.error('Error fetching product:', err);
          notifications.show({
            title: 'Error',
            message: 'Failed to load product details',
            color: 'red',
          });
        } finally {
          setIsLoadingProduct(false);
        }
      };

      fetchProduct();
    }
  }, [authStatus, productId]);

  // Fetch customers who bought this product
  useEffect(() => {
    if (authStatus === 'authenticated' && productId) {
      const fetchCustomers = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch(
            `/api/admin/products/${productId}/customers?page=${currentPage}&limit=20`
          );
          
          if (!response.ok) {
            throw new Error('Failed to fetch customers');
          }
          
          const data: CustomersResponse = await response.json();
          setCustomers(data.customers);
          setCurrentPage(data.currentPage);
          setTotalPages(data.totalPages);
          setTotalItems(data.totalItems);
        } catch (err: any) {
          console.error('Error fetching customers:', err);
          setError(err.message || 'Failed to load customers');
          notifications.show({
            title: 'Error',
            message: 'Failed to load customers who bought this product',
            color: 'red',
          });
        } finally {
          setIsLoading(false);
        }
      };

      fetchCustomers();
    }
  }, [authStatus, productId, currentPage]);

  // Redirect if not authenticated
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/admin/login');
    }
  }, [authStatus, router]);

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Format customer name
  const formatCustomerName = (customerName: string) => {
    return customerName || 'Unknown Customer';
  };

  // Format variant attributes like in recent orders
  const formatVariantAttributes = (selectedAttributes: { [key: string]: string } | null) => {
    if (!selectedAttributes || Object.keys(selectedAttributes).length === 0) {
      return null;
    }
    
    return Object.entries(selectedAttributes).map(([key, value]) => (
      <Badge key={key} size="xs" variant="outline" style={{ margin: '1px' }}>
        {key}: {value}
      </Badge>
    ));
  };

  // Show loading state
  if (authStatus === 'loading' || isLoadingProduct) {
    return (
      <AdminLayout>
        <LoadingOverlay visible={true} overlayProps={{ radius: 'sm', blur: 2, fixed: true }} />
      </AdminLayout>
    );
  }

  // Show redirect message
  if (authStatus === 'unauthenticated') {
    return <Text p="xl">Redirecting to login...</Text>;
  }

  return (
    <AdminLayout>
      <Group justify="space-between" mb="xl">
        <Group>
          <Button
            variant="outline"
            component={Link}
            href={`/admin/products/${productId}`}
            leftSection={<IconArrowLeft size={16} />}
          >
            Back to Product
          </Button>
          <Title order={2}>Customers</Title>
        </Group>
      </Group>

      {product && (
        <Alert variant="light" color="blue" mb="lg">
          <Text size="sm">
            Showing customers who bought &quot;{product.name}&quot; {product.sku && `(${product.sku})`}
          </Text>
        </Alert>
      )}

      {error && !isLoading && (
        <Alert
          title="Error Loading Customers"
          color="red"
          icon={<IconAlertCircle />}
          withCloseButton
          onClose={() => setError(null)}
          mb="lg"
        >
          {error}
        </Alert>
      )}

      <Paper withBorder shadow="sm" p="md" radius="md">
        <Group justify="space-between" mb="md">
          <Group>
            <IconUsers size={20} />
            <Title order={4}>Customer Orders</Title>
          </Group>
          {totalItems > 0 && (
            <Text size="sm" c="dimmed">
              {totalItems} order{totalItems !== 1 ? 's' : ''} found
            </Text>
          )}
        </Group>

        {isLoading ? (
          <LoadingOverlay visible={true} overlayProps={{ radius: 'sm', blur: 1 }} />
        ) : customers.length > 0 ? (
          <>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Order #</Table.Th>
                  <Table.Th>Customer</Table.Th>
                  <Table.Th>Variant</Table.Th>
                  <Table.Th>Quantity</Table.Th>
                  <Table.Th>Total</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {customers.flatMap((order, orderIndex) => 
                  order.variants.map((variant, variantIndex) => (
                    <Table.Tr key={`${order._id}-${variant.variantId || 'base'}-${variantIndex}`}>
                      {variantIndex === 0 && (
                        <>
                          <Table.Td rowSpan={order.variants.length}>
                            <Text size="sm" ff="monospace" fw={500}>
                              #{order.orderNumber}
                            </Text>
                          </Table.Td>
                          <Table.Td rowSpan={order.variants.length}>
                            <Box>
                              <Text size="sm" fw={500}>{order.customerName}</Text>
                              <Text size="xs" c="dimmed">{order.customerEmail}</Text>
                            </Box>
                          </Table.Td>
                        </>
                      )}
                      <Table.Td>
                        {variant.isVariantProduct && variant.selectedAttributes ? (
                          <Group gap="xs" wrap="wrap">
                            {formatVariantAttributes(variant.selectedAttributes)}
                          </Group>
                        ) : (
                          <Text size="xs" c="dimmed">No variant</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" size="sm">
                          {variant.quantity} {variant.quantity === 1 ? 'unit' : 'units'}
                        </Badge>
                      </Table.Td>
                      {variantIndex === 0 && (
                        <Table.Td rowSpan={order.variants.length}>
                          <Text size="sm" fw={500}>${order.orderTotalAmount.toFixed(2)}</Text>
                        </Table.Td>
                      )}
                      {variantIndex === 0 && (
                        <>
                          <Table.Td rowSpan={order.variants.length}>
                            <Badge 
                              color={
                                order.status === 'delivered' ? 'green' :
                                order.status === 'shipped' ? 'blue' :
                                order.status === 'processing' ? 'yellow' :
                                order.status === 'cancelled' ? 'red' : 'gray'
                              }
                              variant="light"
                              size="sm"
                            >
                              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </Badge>
                          </Table.Td>
                          <Table.Td rowSpan={order.variants.length}>
                            <Text size="sm" c="dimmed">
                              {dayjs(order.createdAt).format('MMM D, YYYY')}
                            </Text>
                          </Table.Td>
                          <Table.Td rowSpan={order.variants.length}>
                            <Group gap="xs">
                              <ActionIcon
                                variant="subtle"
                                color="blue"
                                component={Link}
                                href={`/admin/customers/${order.customerId}`}
                                aria-label={`View ${order.customerName} profile`}
                              >
                                <IconUser size={16} />
                              </ActionIcon>
                              <ActionIcon
                                variant="subtle"
                                color="orange"
                                component={Link}
                                href={`/admin/orders?customerId=${order.customerId}`}
                                aria-label={`View all orders by ${order.customerName}`}
                              >
                                <IconShoppingCart size={16} />
                              </ActionIcon>
                              <ActionIcon
                                variant="subtle"
                                color="green"
                                component={Link}
                                href={`/admin/orders/${order._id}`}
                                aria-label={`View ${order.customerName} order receipt`}
                              >
                                <IconReceipt size={16} />
                              </ActionIcon>
                            </Group>
                          </Table.Td>
                        </>
                      )}
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>

            {totalPages > 1 && (
              <Group justify="center" mt="xl">
                <Pagination
                  total={totalPages}
                  value={currentPage}
                  onChange={handlePageChange}
                />
              </Group>
            )}
          </>
        ) : (
          <Box ta="center" py="xl">
            <IconUsers size={48} color="var(--mantine-color-gray-5)" style={{ margin: '0 auto 16px' }} />
            <Text c="dimmed" size="lg" fw={500}>No orders yet</Text>
            <Text c="dimmed" size="sm">This product hasn&apos;t been ordered yet</Text>
          </Box>
        )}
      </Paper>

      <Space h="xl" />
    </AdminLayout>
  );
}
