'use client';

import AdminLayout from '../../../../components/admin/AdminLayout';
import FilterPanel, { type FilterOption, type NestedAttributeFilter } from '../../../../components/admin/FilterPanel';
import { Title, Text, Paper, Table, Group, Button, ActionIcon, LoadingOverlay, Alert, ScrollArea, Space, Badge, TextInput, Select, Pagination, Image as MantineImage } from '@mantine/core';
import { IconPencil, IconEye, IconSearch, IconFilter, IconArrowLeft, IconTag } from '@tabler/icons-react';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { notifications } from '@mantine/notifications';
import { useDebouncedValue } from '@mantine/hooks';

interface Product {
  _id: string;
  name: string;
  sku?: string;
  price: number;
  stockQuantity: number;
  category?: {
    _id: string;
    name: string;
    slug: string;
  };
  brand?: {
    _id: string;
    name: string;
    slug: string;
  };
  images?: string[];
  isPublished?: boolean;
  hasVariants?: boolean;
  createdAt?: string;
  // For variant products that use this attribute
  variants?: Array<{
    _id?: string;
    attributeCombination: { [key: string]: string };
    sku?: string;
    price?: number;
    stockQuantity: number;
    isActive: boolean;
  }>;
}

interface AttributeDefinition {
  _id: string;
  name: string;
  values: string[];
  description?: string;
}

interface Category {
  _id: string;
  name: string;
}

interface Brand {
  _id: string;
  name: string;
}

interface PaginatedProductsResponse {
  products: Product[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

export default function AttributeDetailPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const attributeId = params?.attributeId as string;

  const [attribute, setAttribute] = useState<AttributeDefinition | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [isBrandsLoading, setIsBrandsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 500);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  
  // New state for attribute value filtering
  const [selectedAttributeValues, setSelectedAttributeValues] = useState<string[]>([]);

  // Authentication check
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/admin/login');
    }
  }, [authStatus, router]);

  // Fetch attribute details
  const fetchAttribute = useCallback(async () => {
    if (!attributeId || authStatus !== 'authenticated') return;

    try {
      const response = await fetch(`/api/admin/attribute-definitions/${attributeId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch attribute details');
      }
      const attributeData = await response.json();
      setAttribute(attributeData);
    } catch (err: any) {
      setError(err.message);
      notifications.show({
        title: 'Error',
        message: 'Failed to load attribute details',
        color: 'red'
      });
    }
  }, [attributeId, authStatus]);

  // Fetch categories for filter
  const fetchCategories = useCallback(async () => {
    if (authStatus !== 'authenticated') return;

    setIsCategoriesLoading(true);
    try {
      const response = await fetch('/api/admin/categories');
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      setCategories(data.map((cat: any) => ({ _id: cat._id, name: cat.name })));
    } catch (err) {
      console.error('Failed to load categories for filter:', err);
    } finally {
      setIsCategoriesLoading(false);
    }
  }, [authStatus]);

  // Fetch brands for filter
  const fetchBrands = useCallback(async () => {
    if (authStatus !== 'authenticated') return;

    setIsBrandsLoading(true);
    try {
      const response = await fetch('/api/admin/brands?limit=100');
      if (!response.ok) throw new Error('Failed to fetch brands');
      const data = await response.json();
      setBrands(data.brands.map((brand: any) => ({ _id: brand._id, name: brand.name })));
    } catch (err) {
      console.error('Failed to load brands for filter:', err);
    } finally {
      setIsBrandsLoading(false);
    }
  }, [authStatus]);

  // Fetch products that use this attribute
  const fetchProducts = useCallback(async () => {
    if (!attribute || authStatus !== 'authenticated') return;

    setIsProductsLoading(true);
    setError(null);

    try {
      // We need to search for products that have this attribute in their attributeDefinitions
      // This requires a custom API endpoint or modifying existing search
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        hasVariants: 'true', // Only variant products can use attributes
      });

      if (debouncedSearchTerm) {
        params.append('search', debouncedSearchTerm);
      }
      if (selectedCategory) {
        params.append('categoryId', selectedCategory);
      }
      if (selectedBrand) {
        params.append('brandId', selectedBrand);
      }

      const response = await fetch(`/api/admin/products?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const data: PaginatedProductsResponse = await response.json();
      
      // Filter products to only include those that use this specific attribute
      const filteredProducts = data.products.filter(product => {
        if (!product.hasVariants) return false;
        
        // Check if any variant uses this attribute in its combination
        if (product.variants && product.variants.length > 0) {
          const hasAttribute = product.variants.some(variant => 
            variant.attributeCombination && 
            Object.keys(variant.attributeCombination).includes(attribute.name)
          );
          
          if (!hasAttribute) return false;
          
          // If specific attribute values are selected, filter by those
          if (selectedAttributeValues.length > 0) {
            return product.variants.some(variant => 
              variant.attributeCombination && 
              variant.attributeCombination[attribute.name] &&
              selectedAttributeValues.includes(variant.attributeCombination[attribute.name])
            );
          }
          
          return true;
        }
        
        return false;
      });

      setProducts(filteredProducts);
      setTotalItems(filteredProducts.length);
      // Note: This is a simplified pagination, in a real scenario you'd need 
      // a dedicated API endpoint that properly handles attribute-based filtering
      const itemsPerPage = 10;
      setTotalPages(Math.ceil(filteredProducts.length / itemsPerPage));
      setCurrentPage(Math.min(currentPage, Math.ceil(filteredProducts.length / itemsPerPage) || 1));
    } catch (err: any) {
      setError(err.message);
      notifications.show({
        title: 'Error',
        message: 'Failed to load products',
        color: 'red'
      });
    } finally {
      setIsProductsLoading(false);
    }
  }, [attribute, currentPage, debouncedSearchTerm, selectedCategory, selectedBrand, selectedAttributeValues, authStatus]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchAttribute(), fetchCategories(), fetchBrands()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchAttribute, fetchCategories, fetchBrands]);

  // Fetch products when filters change or attribute is loaded
  useEffect(() => {
    if (attribute) {
      fetchProducts();
    }
  }, [fetchProducts, attribute]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (value: string | null) => {
    setSelectedCategory(value);
    setCurrentPage(1);
  };

  const handleBrandChange = (value: string | null) => {
    setSelectedBrand(value);
    setCurrentPage(1);
  };

  const handleAttributeValueChange = (selectedValues: string[]) => {
    setSelectedAttributeValues(selectedValues);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCategory(null);
    setSelectedBrand(null);
    setSelectedAttributeValues([]);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Get attribute value for a specific product
  const getAttributeValueForProduct = (product: Product): string[] => {
    if (!product.variants || !attribute) return [];
    
    const values = new Set<string>();
    product.variants.forEach(variant => {
      if (variant.attributeCombination && variant.attributeCombination[attribute.name]) {
        values.add(variant.attributeCombination[attribute.name]);
      }
    });
    
    return Array.from(values);
  };

  if (authStatus === 'loading' || isLoading) {
    return (
      <AdminLayout>
        <LoadingOverlay visible overlayProps={{ radius: 'sm', blur: 1 }} />
      </AdminLayout>
    );
  }

  if (error && !attribute) {
    return (
      <AdminLayout>
        <Alert title="Error" color="red" icon={<IconTag />}>
          {error}
        </Alert>
      </AdminLayout>
    );
  }

  const productRows = products.map((product) => {
    const attributeValues = getAttributeValueForProduct(product);
    
    return (
      <Table.Tr key={product._id}>
        <Table.Td>
          {product.images && product.images.length > 0 ? (
            <MantineImage
              src={product.images[0]}
              alt={product.name}
              w={50}
              h={50}
              radius="sm"
              fallbackSrc="/placeholder-image.png"
            />
          ) : (
            <div style={{ width: 50, height: 50, backgroundColor: '#f0f0f0', borderRadius: 4 }} />
          )}
        </Table.Td>
        <Table.Td>
          <Text fw={500}>{product.name}</Text>
          {product.hasVariants && (
            <Badge size="xs" variant="light" color="blue">
              Has Variants
            </Badge>
          )}
        </Table.Td>
        <Table.Td>{product.sku || 'N/A'}</Table.Td>
        <Table.Td>${product.price.toFixed(2)}</Table.Td>
        <Table.Td>{product.stockQuantity}</Table.Td>
        <Table.Td>{product.category?.name || 'No Category'}</Table.Td>
        <Table.Td>{product.brand?.name || 'No Brand'}</Table.Td>
        <Table.Td>
          <Group gap="xs">
            {attributeValues.map((value, index) => (
              <Badge key={index} size="sm" variant="light" color="purple">
                {value}
              </Badge>
            ))}
          </Group>
        </Table.Td>
        <Table.Td>
          <Badge color={product.isPublished ? 'green' : 'red'}>
            {product.isPublished ? 'Published' : 'Draft'}
          </Badge>
        </Table.Td>
        <Table.Td>
          <Group gap="xs">
            <ActionIcon
              variant="subtle"
              color="green"
              component={Link}
              href={`/admin/products/${product._id}`}
              aria-label={`View ${product.name} details`}
            >
              <IconEye size={18} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="blue"
              component={Link}
              href={`/admin/products/edit/${product._id}`}
              aria-label={`Edit ${product.name}`}
            >
              <IconPencil size={18} />
            </ActionIcon>
          </Group>
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
    <AdminLayout>
      <Group justify="space-between" mb="xl">
        <Group>
          <ActionIcon
            variant="subtle"
            component={Link}
            href="/admin/custom-attributes"
            aria-label="Back to attributes"
          >
            <IconArrowLeft size={20} />
          </ActionIcon>
          <div>
            <Title order={2}>Attribute: {attribute?.name}</Title>
            <Text c="dimmed" size="sm">
              {attribute?.description || 'No description available'}
            </Text>
          </div>
        </Group>
        <Group>
          <Button
            leftSection={<IconPencil size={16} />}
            component={Link}
            href={`/admin/custom-attributes/edit/${attributeId}`}
          >
            Edit Attribute
          </Button>
        </Group>
      </Group>

      {/* Attribute Values Display */}
      {attribute?.values && attribute.values.length > 0 && (
        <Paper p="md" mb="md" withBorder>
          <Text size="sm" fw={500} mb="xs">Available Values:</Text>
          <Group gap="xs">
            {attribute.values.map((value, index) => (
              <Badge key={index} variant="light" color="blue">
                {value}
              </Badge>
            ))}
          </Group>
        </Paper>
      )}

      {/* Filters */}
      <FilterPanel
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search products using this attribute..."
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
        showAttributeValueFilter={true}
        availableAttributeValues={attribute?.values || []}
        selectedAttributeValues={selectedAttributeValues}
        onAttributeValueChange={handleAttributeValueChange}
        attributeValueLabel={`${attribute?.name || 'Attribute'} Values`}
        onClearFilters={handleClearFilters}
      />

      {/* Products Table */}
      <Paper withBorder shadow="sm" radius="md">
        <Group justify="space-between" p="md" style={{ borderBottom: '1px solid #e9ecef' }}>
          <Text fw={500}>Products using this Attribute ({totalItems})</Text>
        </Group>

        <ScrollArea>
          <LoadingOverlay
            visible={isProductsLoading}
            overlayProps={{ radius: 'sm', blur: 1 }}
          />
          {!isProductsLoading && !error && products.length === 0 && (
            <Text p="xl" ta="center" c="dimmed">
              No products found using this attribute.
            </Text>
          )}
          {!error && products.length > 0 && (
            <Table striped highlightOnHover verticalSpacing="sm" miw={1000}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Image</Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>SKU</Table.Th>
                  <Table.Th>Price</Table.Th>
                  <Table.Th>Stock</Table.Th>
                  <Table.Th>Category</Table.Th>
                  <Table.Th>Brand</Table.Th>
                  <Table.Th>{attribute?.name} Values</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{productRows}</Table.Tbody>
            </Table>
          )}
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <Group justify="center" p="md">
            <Pagination
              total={totalPages}
              value={currentPage}
              onChange={handlePageChange}
              size="sm"
            />
          </Group>
        )}
      </Paper>

      <Space h="xl" />
    </AdminLayout>
  );
}
