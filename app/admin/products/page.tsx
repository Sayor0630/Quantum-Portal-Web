'use client';

import AdminLayout from '../../../components/admin/AdminLayout';
import { Title, Text, Paper, Table, Group, Button, ActionIcon, LoadingOverlay, Alert, Badge, ScrollArea, Pagination, TextInput, Select, Image, Space } from '@mantine/core';
import { IconPencil, IconTrash, IconPlus, IconAlertCircle, IconSearch, IconFilter } from '@tabler/icons-react';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDebouncedValue } from '@mantine/hooks';
import { modals } from '@mantine/modals'; // Import Modals
import { notifications } from '@mantine/notifications'; // Import Notifications

interface ProductCategory {
   _id: string;
   name: string;
   slug: string;
}

interface Product {
  _id: string;
  name: string;
  sku?: string;
  price: number;
  stockQuantity: number;
  category?: ProductCategory;
  images?: string[];
  isPublished?: boolean;
}

interface Category {
  _id: string;
  name: string;
}

interface PaginatedProductsResponse {
     products: Product[];
     currentPage: number;
     totalPages: number;
     totalItems: number;
}

export default function ProductsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true); // General loading for fetch
  const [error, setError] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null); // For delete loading state

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 500);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);

  const fetchProducts = useCallback(async (page: number, search: string, categoryId: string | null) => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '10',
      });
      if (search) queryParams.append('search', search);
      if (categoryId) queryParams.append('categoryId', categoryId);

      const response = await fetch(`/api/admin/products?${queryParams.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      const data: PaginatedProductsResponse = await response.json();
      setProducts(data.products);
      setCurrentPage(data.currentPage);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch products.');
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/admin/login');
    }
    if (authStatus === 'authenticated') {
      // Initial fetch or refetch when page, search, or category changes
      fetchProducts(currentPage, debouncedSearchTerm, selectedCategory);
    }
  }, [authStatus, router, currentPage, debouncedSearchTerm, selectedCategory, fetchProducts]);

  useEffect(() => {
     const fetchCategories = async () => {
         if (authStatus !== 'authenticated') return;
         setIsCategoriesLoading(true);
         try {
             const response = await fetch('/api/admin/categories');
             if (!response.ok) throw new Error('Failed to fetch categories');
             const data = await response.json();
             setCategories(data.map((cat: any) => ({ _id: cat._id, name: cat.name })));
         } catch (e) {
             console.error("Failed to load categories for filter:", e);
             notifications.show({ title: 'Error', message: 'Could not load categories for filtering.', color: 'red' });
         } finally {
             setIsCategoriesLoading(false);
         }
     };
     fetchCategories();
  }, [authStatus]);

  const handleCategoryChange = (value: string | null) => {
    setSelectedCategory(value);
    setCurrentPage(1);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.currentTarget.value);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // fetchProducts will be called by the useEffect listening to currentPage
  };


  const handleDeleteProduct = (productId: string, productName: string) => {
    modals.openConfirmModal({
        title: 'Delete Product',
        centered: true,
        children: (
            <Text size="sm">
            Are you sure you want to delete the product "<strong>{productName}</strong>"?
            This action cannot be undone.
            </Text>
        ),
        labels: { confirm: 'Delete Product', cancel: 'Cancel' },
        confirmProps: { color: 'red' },
        onConfirm: async () => {
            setDeletingProductId(productId);
            try {
                const response = await fetch(`/api/admin/products/${productId}`, {
                    method: 'DELETE',
                });
                if (!response.ok) {
                    let errorMsg = 'Failed to delete product.';
                    try {
                        const errorData = await response.json();
                        errorMsg = errorData.message || errorMsg;
                    } catch (parseError) { /* Ignore */ }
                    throw new Error(errorMsg);
                }

                setProducts((prevProducts) => prevProducts.filter(p => p._id !== productId));
                // Optionally, refetch or adjust totalPages if on last page and it becomes empty
                if (products.length === 1 && currentPage > 1) {
                    setCurrentPage(currentPage - 1); // Go to previous page if current page becomes empty
                } else {
                    // If many items are on the page, or it's the first page, a refetch might be good
                    // or simply rely on the local state update. For now, local update is primary.
                    // To ensure data consistency after delete, especially with totalItems count for pagination:
                    fetchProducts(currentPage, debouncedSearchTerm, selectedCategory);
                }

                notifications.show({
                    title: 'Product Deleted',
                    message: `Product "${productName}" has been successfully deleted.`,
                    color: 'green',
                    icon: <IconTrash size={16} />,
                });
            } catch (err: any) {
                notifications.show({
                    title: 'Error Deleting Product',
                    message: err.message || 'An unexpected error occurred.',
                    color: 'red',
                    icon: <IconAlertCircle size={16} />,
                });
            } finally {
                setDeletingProductId(null);
            }
        },
    });
  };


  if (authStatus === 'loading' || (isLoading && authStatus === 'authenticated' && products.length === 0 && !error) ) {
     return (
         <AdminLayout>
             <LoadingOverlay visible={true} overlayProps={{ radius: 'sm', blur: 2, fixed: true }} />
         </AdminLayout>
     );
  }
  if (authStatus === 'unauthenticated') {
     return <Text p="xl">Redirecting to login...</Text>;
  }

  const rows = products.map((product) => (
    <Table.Tr key={product._id}>
      <Table.Td>
         <Image
             src={product.images && product.images.length > 0 ? product.images[0] : 'https://via.placeholder.com/50?text=No+Image'}
             alt={product.name}
             w={50} h={50} fit="contain" radius="sm"
         />
      </Table.Td>
      <Table.Td>{product.name}</Table.Td>
      <Table.Td>{product.sku || 'N/A'}</Table.Td>
      <Table.Td>${typeof product.price === 'number' ? product.price.toFixed(2) : 'N/A'}</Table.Td>
      <Table.Td>{product.stockQuantity !== undefined ? product.stockQuantity : 'N/A'}</Table.Td>
      <Table.Td>{product.category?.name || 'Uncategorized'}</Table.Td>
      {/* <Table.Td>{product.isPublished ? <Badge color="green">Published</Badge> : <Badge color="gray">Draft</Badge>}</Table.Td> */}
      <Table.Td>
        <Group gap="xs">
          <ActionIcon variant="subtle" color="blue" component={Link} href={`/admin/products/edit/${product._id}`} aria-label={`Edit ${product.name}`}>
            <IconPencil size={18} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => handleDeleteProduct(product._id, product.name)}
            loading={deletingProductId === product._id} // Use loading prop
            aria-label={`Delete ${product.name}`}
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
        <Title order={2}>Products</Title>
        <Button leftSection={<IconPlus size={16} />} component={Link} href="/admin/products/new">
          Add New Product
        </Button>
      </Group>

      <Paper withBorder shadow="sm" radius="md" p="md" mb="xl">
         <Group grow>
             <TextInput
                 placeholder="Search by name, SKU..."
                 leftSection={<IconSearch size={16} />}
                 value={searchTerm}
                 onChange={handleSearchChange}
             />
             <Select
                 placeholder="Filter by category"
                 leftSection={<IconFilter size={16} />}
                 data={[{ label: 'All Categories', value: '' }, ...categories.map(cat => ({ label: cat.name, value: cat._id }))]}
                 value={selectedCategory}
                 onChange={handleCategoryChange}
                 disabled={isCategoriesLoading || isLoading} // Disable if categories or products loading
                 clearable
             />
         </Group>
      </Paper>

      {error && !isLoading && ( // Show error only if not loading and error exists
         <Alert title="Error Fetching Products" color="red" icon={<IconAlertCircle />} withCloseButton onClose={() => setError(null)} mb="lg">
             {error} Please try <Button variant="subtle" size="xs" onClick={() => fetchProducts(currentPage, debouncedSearchTerm, selectedCategory)}>reloading</Button>.
         </Alert>
      )}

      <Paper withBorder shadow="sm" radius="md">
         <ScrollArea>
             <LoadingOverlay visible={isLoading && authStatus === 'authenticated'} overlayProps={{ radius: 'sm', blur: 1 }} />
             {!isLoading && !error && products.length === 0 && (
                 <Text p="xl" ta="center" c="dimmed">No products found matching your criteria.</Text>
             )}
             {!error && products.length > 0 && (
                 <Table striped highlightOnHover verticalSpacing="sm" miw={800}>
                     <Table.Thead>
                     <Table.Tr>
                         <Table.Th>Image</Table.Th>
                         <Table.Th>Name</Table.Th>
                         <Table.Th>SKU</Table.Th>
                         <Table.Th>Price</Table.Th>
                         <Table.Th>Stock</Table.Th>
                         <Table.Th>Category</Table.Th>
                         {/* <Table.Th>Status</Table.Th> */}
                         <Table.Th>Actions</Table.Th>
                     </Table.Tr>
                     </Table.Thead>
                     <Table.Tbody>{rows}</Table.Tbody>
                 </Table>
             )}
         </ScrollArea>
      </Paper>

      {totalPages > 1 && !error && products.length > 0 && (
         <Group justify="center" mt="xl">
             <Pagination total={totalPages} value={currentPage} onChange={handlePageChange} />
         </Group>
      )}
      <Space h="xl" />
    </AdminLayout>
  );
}
