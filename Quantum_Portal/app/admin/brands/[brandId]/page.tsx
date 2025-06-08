'use client';

import AdminLayout from '../../../../components/admin/AdminLayout';
import FilterPanel, { type FilterOption, type NestedAttributeFilter } from '../../../../components/admin/FilterPanel';
import { Title, Text, Paper, Table, Group, Button, ActionIcon, LoadingOverlay, Alert, ScrollArea, Space, Badge, TextInput, Select, Pagination, Image as MantineImage } from '@mantine/core';
import { IconPencil, IconEye, IconSearch, IconFilter, IconArrowLeft, IconBrandApple } from '@tabler/icons-react';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { notifications } from '@mantine/notifications';
import { useDebouncedValue } from '@mantine/hooks';
import Image from 'next/image';

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
  images?: string[];
  isPublished?: boolean;
  hasVariants?: boolean;
  variants?: Array<{
    _id?: string;
    attributeCombination: { [key: string]: string };
    sku?: string;
    price?: number;
    stockQuantity: number;
    isActive: boolean;
  }>;
  createdAt?: string;
}

interface Brand {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  isActive?: boolean;
}

interface Category {
  _id: string;
  name: string;
}

interface AttributeDefinition {
  _id: string;
  name: string;
  values: string[];
}

interface PaginatedProductsResponse {
  products: Product[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

export default function BrandDetailPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const brandId = params?.brandId as string;

  const [brand, setBrand] = useState<Brand | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [attributeDefinitions, setAttributeDefinitions] = useState<AttributeDefinition[]>([]);
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<string[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [isAttributesLoading, setIsAttributesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 500);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Authentication check
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/admin/login');
    }
  }, [authStatus, router]);

  // Fetch brand details
  const fetchBrand = useCallback(async () => {
    if (!brandId || authStatus !== 'authenticated') return;

    try {
      const response = await fetch(`/api/admin/brands/${brandId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch brand details');
      }
      const brandData = await response.json();
      setBrand(brandData);
    } catch (err: any) {
      setError(err.message);
      notifications.show({
        title: 'Error',
        message: 'Failed to load brand details',
        color: 'red'
      });
    }
  }, [brandId, authStatus]);

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

  // Fetch attribute definitions for filter
  const fetchAttributeDefinitions = useCallback(async () => {
    if (authStatus !== 'authenticated') return;

    setIsAttributesLoading(true);
    try {
      const response = await fetch('/api/admin/attribute-definitions');
      if (!response.ok) throw new Error('Failed to fetch attributes');
      const data = await response.json();
      setAttributeDefinitions(data);
    } catch (err) {
      console.error('Failed to load attributes for filter:', err);
    } finally {
      setIsAttributesLoading(false);
    }
  }, [authStatus]);

  // Fetch products by this brand
  const fetchProducts = useCallback(async (attributeFilters?: Record<string, string[]>) => {
    if (!brandId || authStatus !== 'authenticated') return;

    setIsProductsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        brandId: brandId,
      });

      if (debouncedSearchTerm) {
        params.append('search', debouncedSearchTerm);
      }
      if (selectedCategory) {
        params.append('categoryId', selectedCategory);
      }

      // Add attribute filters using attribute names
      const currentAttributeFilters = attributeFilters || attributeValues;
      Object.entries(currentAttributeFilters).forEach(([attributeId, values]) => {
        const attributeDefinition = attributeDefinitions.find(attr => attr._id === attributeId);
        if (attributeDefinition) {
          if (values && values.length > 0) {
            // Filter by specific attribute values
            params.append(`attribute.${attributeDefinition.name}`, values.join(','));
          } else {
            // Filter by attribute existence (any value)
            params.append(`hasAttribute.${attributeDefinition.name}`, 'true');
          }
        }
      });

      const response = await fetch(`/api/admin/products?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const data: PaginatedProductsResponse = await response.json();
      setProducts(data.products);
      setCurrentPage(data.currentPage);
      setTotalPages(data.totalPages);
      setTotalItems(data.totalItems);
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
  }, [brandId, currentPage, debouncedSearchTerm, selectedCategory, attributeValues, authStatus, attributeDefinitions]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchBrand(), fetchCategories(), fetchAttributeDefinitions()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchBrand, fetchCategories, fetchAttributeDefinitions]);

  // Fetch products when filters change
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleCategoryChange = (value: string | null) => {
    setSelectedCategory(value);
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
    setSelectedAttributeIds([]);
    setAttributeValues({});
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (authStatus === 'loading' || isLoading) {
    return (
      <AdminLayout>
        <LoadingOverlay visible overlayProps={{ radius: 'sm', blur: 1 }} />
      </AdminLayout>
    );
  }

  if (error && !brand) {
    return (
      <AdminLayout>
        <Alert title="Error" color="red" icon={<IconBrandApple />}>
          {error}
        </Alert>
      </AdminLayout>
    );
  }

  const productRows = products.map((product) => (
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
      <Table.Td>{product.stockQuantity}</Table.Td>
      <Table.Td>{product.category?.name || 'No Category'}</Table.Td>
      <Table.Td>
        <Badge color={product.isPublished ? 'green' : 'red'}>
          {product.isPublished ? 'Published' : 'Draft'}
        </Badge>
      </Table.Td>
      <Table.Td>{product.createdAt ? formatDate(product.createdAt) : 'N/A'}</Table.Td>
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
  ));

  return (
    <AdminLayout>
      <Group justify="space-between" mb="xl">
        <Group>
          <ActionIcon
            variant="subtle"
            component={Link}
            href="/admin/brands"
            aria-label="Back to brands"
          >
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Group align="center">
            {brand?.logoUrl && (
              <Image
                src={brand.logoUrl}
                alt={`${brand.name} logo`}
                width={60}
                height={60}
                style={{ objectFit: 'contain' }}
              />
            )}
            <div>
              <Title order={2}>Brand: {brand?.name}</Title>
              <Text c="dimmed" size="sm">
                {brand?.description || 'No description available'}
              </Text>
            </div>
          </Group>
        </Group>
        <Group>
          <Badge color={brand?.isActive ? 'green' : 'red'}>
            {brand?.isActive ? 'Active' : 'Inactive'}
          </Badge>
          <Button
            leftSection={<IconPencil size={16} />}
            component={Link}
            href={`/admin/brands/${brandId}/edit`}
          >
            Edit Brand
          </Button>
        </Group>
      </Group>

      {/* Filters */}
      <FilterPanel
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search products by this brand..."
        
        showCategoryFilter={true}
        categories={categories.map(cat => ({ value: cat._id, label: cat.name }))}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
        isCategoriesLoading={isCategoriesLoading}
        
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

      {/* Products Table */}
      <Paper withBorder shadow="sm" radius="md">
        <Group justify="space-between" p="md" style={{ borderBottom: '1px solid #e9ecef' }}>
          <Text fw={500}>Products by this Brand ({totalItems})</Text>
        </Group>

        <ScrollArea>
          <LoadingOverlay
            visible={isProductsLoading}
            overlayProps={{ radius: 'sm', blur: 1 }}
          />
          {!isProductsLoading && !error && products.length === 0 && (
            <Text p="xl" ta="center" c="dimmed">
              No products found for this brand.
            </Text>
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
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Date Created</Table.Th>
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
