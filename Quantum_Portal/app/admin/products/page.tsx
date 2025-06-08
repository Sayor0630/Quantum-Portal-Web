'use client';

import AdminLayout from '../../../components/admin/AdminLayout';
import FilterPanel, { type FilterOption } from '../../../components/admin/FilterPanel';
import { Title, Text, Paper, Table, Group, Button, ActionIcon, LoadingOverlay, Alert, Badge, ScrollArea, Pagination, Image, Space, Stack, MultiSelect } from '@mantine/core';
import { IconPencil, IconTrash, IconPlus, IconAlertCircle, IconEye } from '@tabler/icons-react';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDebouncedValue } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';

interface ProductCategory {
   _id: string;
   name: string;
   slug: string;
}

interface ProductBrand {
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
  brand?: ProductBrand;
  images?: string[];
  isPublished?: boolean;
  hasVariants?: boolean;
  createdAt?: string;
  variants?: Array<{
    _id?: string;
    attributeCombination: { [key: string]: string };
    sku?: string;
    price?: number;
    stockQuantity: number;
    isActive: boolean;
  }>;
}

interface Category {
  _id: string;
  name: string;
}

interface Brand {
  _id: string;
  name: string;
}

interface AttributeDefinition {
  _id: string;
  name: string;
  values: string[];
}

interface AttributeFilter {
  attributeId: string;
  attributeName: string;
  selectedValues: string[];
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 500);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [attributeDefinitions, setAttributeDefinitions] = useState<AttributeDefinition[]>([]);
  
  // Simple two-step attribute filtering
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<string[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, string[]>>({});
  
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [isBrandsLoading, setIsBrandsLoading] = useState(true);
  const [isAttributesLoading, setIsAttributesLoading] = useState(true);

  const fetchProducts = useCallback(async (
    page: number, 
    search: string, 
    categoryId: string | null, 
    brandId: string | null, 
    attributeFilters: Record<string, string[]>
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '10',
      });
      if (search) queryParams.append('search', search);
      if (categoryId) queryParams.append('categoryId', categoryId);
      if (brandId) queryParams.append('brandId', brandId);
      
      // Add attribute filters using attribute names
      Object.entries(attributeFilters).forEach(([attributeId, values]) => {
        const attributeDefinition = attributeDefinitions.find(attr => attr._id === attributeId);
        if (attributeDefinition) {
          if (values && values.length > 0) {
            // Filter by specific attribute values
            queryParams.append(`attribute.${attributeDefinition.name}`, values.join(','));
          } else {
            // Filter by attribute existence (any value)
            queryParams.append(`hasAttribute.${attributeDefinition.name}`, 'true');
          }
        }
      });

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
  }, [attributeDefinitions]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/admin/login');
    }
    if (authStatus === 'authenticated') {
      fetchProducts(currentPage, debouncedSearchTerm, selectedCategory, selectedBrand, attributeValues);
    }
  }, [authStatus, router, currentPage, debouncedSearchTerm, selectedCategory, selectedBrand, attributeValues, fetchProducts]);

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

     const fetchBrands = async () => {
         if (authStatus !== 'authenticated') return;
         setIsBrandsLoading(true);
         try {
             const response = await fetch('/api/admin/brands?limit=100');
             if (!response.ok) throw new Error('Failed to fetch brands');
             const data = await response.json();
             setBrands(data.brands.map((brand: any) => ({ _id: brand._id, name: brand.name })));
         } catch (e) {
             console.error("Failed to load brands for filter:", e);
             notifications.show({ title: 'Error', message: 'Could not load brands for filtering.', color: 'red' });
         } finally {
             setIsBrandsLoading(false);
         }
     };

     const fetchAttributeDefinitions = async () => {
         if (authStatus !== 'authenticated') return;
         setIsAttributesLoading(true);
         try {
             const response = await fetch('/api/admin/attribute-definitions');
             if (!response.ok) throw new Error('Failed to fetch attribute definitions');
             const data = await response.json();
             setAttributeDefinitions(data);
         } catch (e) {
             console.error("Failed to load attribute definitions for filter:", e);
             notifications.show({ title: 'Error', message: 'Could not load attribute definitions for filtering.', color: 'red' });
         } finally {
             setIsAttributesLoading(false);
         }
     };

     fetchCategories();
     fetchBrands();
     fetchAttributeDefinitions();
  }, [authStatus]);

  const handleCategoryChange = (value: string | null) => {
    setSelectedCategory(value);
    setCurrentPage(1);
  };

  const handleBrandChange = (value: string | null) => {
    setSelectedBrand(value);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleAttributeChange = (attributeId: string, selectedValues: string[]) => {
    setAttributeValues(prev => ({
      ...prev,
      [attributeId]: selectedValues
    }));
    setCurrentPage(1);
  };

  const handleSelectedAttributeIdsChange = (attributeIds: string[]) => {
    setSelectedAttributeIds(attributeIds);
    
    // Update attribute values: add empty arrays for new attributes, remove unselected ones
    setAttributeValues(prev => {
      const newValues = { ...prev };
      
      // Remove values for attributes that are no longer selected
      Object.keys(newValues).forEach(attrId => {
        if (!attributeIds.includes(attrId)) {
          delete newValues[attrId];
        }
      });
      
      // Add empty arrays for newly selected attributes (this will trigger filtering by attribute existence)
      attributeIds.forEach(attrId => {
        if (!(attrId in newValues)) {
          newValues[attrId] = [];
        }
      });
      
      return newValues;
    });
    
    setCurrentPage(1);
  };

  const handleAttributeValueChange = (attributeId: string, selectedValues: string[]) => {
    setAttributeValues(prev => ({
      ...prev,
      [attributeId]: selectedValues
    }));
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCategory(null);
    setSelectedBrand(null);
    setSelectedAttributeIds([]);
    setAttributeValues({});
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleDeleteProduct = (productId: string, productName: string) => {
    modals.openConfirmModal({
        title: 'Delete Product',
        centered: true,
        children: (
            <Text size="sm">
            Are you sure you want to delete the product &quot;<strong>{productName}</strong>&quot;?
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
                if (products.length === 1 && currentPage > 1) {
                    setCurrentPage(currentPage - 1);
                } else {
                    fetchProducts(currentPage, debouncedSearchTerm, selectedCategory, selectedBrand, attributeValues);
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

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
      <Table.Td>
        {product.hasVariants && product.variants && product.variants.length > 0 ? (() => {
          const variantPrices = product.variants
            .filter(v => v.price && v.price > 0 && v.isActive)
            .map(v => v.price!);
          
          if (variantPrices.length === 0) {
            return `$${typeof product.price === 'number' ? product.price.toFixed(2) : '0.00'} (base)`;
          }
          
          const minPrice = Math.min(...variantPrices);
          const maxPrice = Math.max(...variantPrices);
          
          if (minPrice === maxPrice) {
            return `$${minPrice.toFixed(2)}`;
          }
          
          return `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;
        })() : `$${typeof product.price === 'number' ? product.price.toFixed(2) : 'N/A'}`}
      </Table.Td>
      <Table.Td>{product.stockQuantity !== undefined ? product.stockQuantity : 'N/A'}</Table.Td>
      <Table.Td>{product.category?.name || 'Uncategorized'}</Table.Td>
      <Table.Td>{product.brand?.name || 'No Brand'}</Table.Td>
      <Table.Td>{formatDate(product.createdAt)}</Table.Td>
      <Table.Td>
        <Group gap="xs">
          <ActionIcon variant="subtle" color="green" component={Link} href={`/admin/products/${product._id}`} aria-label={`View ${product.name} details`}>
            <IconEye size={18} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="blue" component={Link} href={`/admin/products/edit/${product._id}`} aria-label={`Edit ${product.name}`}>
            <IconPencil size={18} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => handleDeleteProduct(product._id, product.name)}
            loading={deletingProductId === product._id}
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

      <FilterPanel
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search by name, SKU, description..."
        
        showCategoryFilter={true}
        categories={categories.map(cat => ({ value: cat._id, label: cat.name }))}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
        isCategoriesLoading={isCategoriesLoading}
        
        showBrandFilter={true}
        brands={brands.map(brand => ({ value: brand._id, label: brand.name }))}
        selectedBrand={selectedBrand}
        onBrandChange={handleBrandChange}
        isBrandsLoading={isBrandsLoading}
        
        useTwoStepAttributeFiltering={true}
        availableAttributes={attributeDefinitions.map(attr => ({
          id: attr._id,
          name: attr.name,
          values: attr.values
        }))}
        selectedAttributeIds={selectedAttributeIds}
        onSelectedAttributeIdsChange={handleSelectedAttributeIdsChange}
        twoStepAttributeValues={attributeValues}
        onTwoStepAttributeValueChange={handleAttributeValueChange}
        isTwoStepAttributesLoading={isAttributesLoading}
        
        onClearFilters={handleClearFilters}
      />

      {error && !isLoading && (
         <Alert title="Error Fetching Products" color="red" icon={<IconAlertCircle />} withCloseButton onClose={() => setError(null)} mb="lg">
             {error} Please try <Button variant="subtle" size="xs" onClick={() => fetchProducts(currentPage, debouncedSearchTerm, selectedCategory, selectedBrand, attributeValues)}>reloading</Button>.
         </Alert>
      )}

      <Paper withBorder shadow="sm" radius="md">
         <ScrollArea>
             <LoadingOverlay visible={isLoading && authStatus === 'authenticated'} overlayProps={{ radius: 'sm', blur: 1 }} />
             {!isLoading && !error && products.length === 0 && (
                 <Text p="xl" ta="center" c="dimmed">No products found matching your criteria.</Text>
             )}
             {!error && products.length > 0 && (
                 <Table striped highlightOnHover verticalSpacing="sm" miw={900}>
                     <Table.Thead>
                     <Table.Tr>
                         <Table.Th>Image</Table.Th>
                         <Table.Th>Name</Table.Th>
                         <Table.Th>SKU</Table.Th>
                         <Table.Th>Price</Table.Th>
                         <Table.Th>Stock</Table.Th>
                         <Table.Th>Category</Table.Th>
                         <Table.Th>Brand</Table.Th>
                         <Table.Th>Date Created</Table.Th>
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
