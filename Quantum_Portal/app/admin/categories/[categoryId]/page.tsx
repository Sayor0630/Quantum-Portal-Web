'use client';

import AdminLayout from '../../../../components/admin/AdminLayout';
import FilterPanel, { type FilterOption, type NestedAttributeFilter } from '../../../../components/admin/FilterPanel';
import { Title, Text, Paper, Table, Group, Button, ActionIcon, LoadingOverlay, Alert, ScrollArea, Space, Badge, Pagination, Image as MantineImage, Switch, Checkbox, Collapse, Box, Accordion, TextInput, Select } from '@mantine/core';
import { IconPencil, IconEye, IconArrowLeft, IconPackage, IconChevronDown, IconChevronRight, IconSearch, IconFilter } from '@tabler/icons-react';
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
  brand?: {
    _id: string;
    name: string;
    slug: string;
  };
  category?: {
    _id: string;
    name: string;
    slug: string;
    parent?: {
      _id: string;
      name: string;
      slug: string;
    };
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

interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  isPublished?: boolean;
  parent?: {
    _id: string;
    name: string;
  } | null;
  children?: Category[];
}

interface CategoryTreeNode {
  _id: string;
  name: string;
  slug: string;
  level: number;
  path: string[];
  children: CategoryTreeNode[];
  productCount?: number;
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

interface PaginatedProductsResponse {
  products: Product[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

export default function CategoryDetailPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const categoryId = params?.categoryId as string;

  const [category, setCategory] = useState<Category | null>(null);
  const [categoryTree, setCategoryTree] = useState<CategoryTreeNode | null>(null);
  const [flattenedCategories, setFlattenedCategories] = useState<CategoryTreeNode[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [isTreeLoading, setIsTreeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 500);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [attributeDefinitions, setAttributeDefinitions] = useState<AttributeDefinition[]>([]);
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<string[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, string[]>>({});
  const [isBrandsLoading, setIsBrandsLoading] = useState(true);
  const [isAttributesLoading, setIsAttributesLoading] = useState(true);
  const [includeSubcategories, setIncludeSubcategories] = useState(false);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [showSubcategorySelector, setShowSubcategorySelector] = useState(false);

  // Authentication check
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/admin/login');
    }
  }, [authStatus, router]);

  // Fetch category details
  const fetchCategory = useCallback(async () => {
    if (!categoryId || authStatus !== 'authenticated') return;

    try {
      const response = await fetch(`/api/admin/categories/${categoryId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch category details');
      }
      const categoryData = await response.json();
      setCategory(categoryData);
    } catch (err: any) {
      setError(err.message);
      notifications.show({
        title: 'Error',
        message: 'Failed to load category details',
        color: 'red'
      });
    }
  }, [categoryId, authStatus]);

  // Fetch category tree for subcategory selection
  const fetchCategoryTree = useCallback(async () => {
    if (!categoryId || authStatus !== 'authenticated') return;

    setIsTreeLoading(true);
    try {
      const response = await fetch(`/api/admin/categories/${categoryId}/tree?includeProductCounts=true`);
      if (!response.ok) {
        throw new Error('Failed to fetch category tree');
      }
      const data = await response.json();
      setCategoryTree(data.tree);
      setFlattenedCategories(data.flattened);
    } catch (err) {
      console.error('Failed to load category tree:', err);
    } finally {
      setIsTreeLoading(false);
    }
  }, [categoryId, authStatus]);

  // Fetch brands for filtering
  const fetchBrands = useCallback(async () => {
    if (authStatus !== 'authenticated') return;
    setIsBrandsLoading(true);
    try {
      const response = await fetch('/api/admin/brands');
      if (!response.ok) throw new Error('Failed to fetch brands');
      const data = await response.json();
      setBrands(data.brands || []);
    } catch (err: any) {
      console.error('Error fetching brands:', err);
    } finally {
      setIsBrandsLoading(false);
    }
  }, [authStatus]);

  // Fetch attribute definitions for filtering
  const fetchAttributeDefinitions = useCallback(async () => {
    if (authStatus !== 'authenticated') return;
    setIsAttributesLoading(true);
    try {
      const response = await fetch('/api/admin/attribute-definitions');
      if (!response.ok) throw new Error('Failed to fetch attributes');
      const data = await response.json();
      setAttributeDefinitions(data || []);
    } catch (err: any) {
      console.error('Error fetching attributes:', err);
    } finally {
      setIsAttributesLoading(false);
    }
  }, [authStatus]);

  // Fetch products in this category
  const fetchProducts = useCallback(async (attributeFilters?: Record<string, string[]>) => {
    if (!categoryId || authStatus !== 'authenticated') return;

    setIsProductsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        categoryId: categoryId,
      });

      if (debouncedSearchTerm) {
        params.append('search', debouncedSearchTerm);
      }
      if (selectedBrand) {
        params.append('brandId', selectedBrand);
      }
      if (selectedSubcategories.length > 0) {
        params.append('selectedSubcategories', selectedSubcategories.join(','));
      } else if (includeSubcategories) {
        params.append('includeSubcategories', 'true');
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
  }, [categoryId, currentPage, debouncedSearchTerm, selectedBrand, includeSubcategories, selectedSubcategories, attributeValues, authStatus, attributeDefinitions]);

  // Reset filters and selected subcategories
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedBrand(null);
    setSelectedAttributeIds([]);
    setAttributeValues({});
    setIncludeSubcategories(false);
    setSelectedSubcategories([]);
    setShowSubcategorySelector(false);
    setCurrentPage(1);
  };

  // Handle subcategory selection
  const handleSubcategoryToggle = (subcategoryId: string) => {
    setSelectedSubcategories(prev => {
      if (prev.includes(subcategoryId)) {
        return prev.filter(id => id !== subcategoryId);
      } else {
        return [...prev, subcategoryId];
      }
    });
  };

  // Handle "include all subcategories" toggle
  const handleIncludeAllSubcategories = (checked: boolean) => {
    setIncludeSubcategories(checked);
    if (checked) {
      setSelectedSubcategories([]);
      setShowSubcategorySelector(false);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchCategory(), fetchBrands(), fetchCategoryTree(), fetchAttributeDefinitions()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchCategory, fetchBrands, fetchCategoryTree, fetchAttributeDefinitions]);

  // Fetch products when filters change
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleBrandChange = (value: string | null) => {
    setSelectedBrand(value);
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
    setSelectedBrand(null);
    setSelectedAttributeIds([]);
    setAttributeValues({});
    setCurrentPage(1);
  };

  const handleIncludeSubcategoriesChange = (value: boolean) => {
    setIncludeSubcategories(value);
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

  if (error && !category) {
    return (
      <AdminLayout>
        <Alert title="Error" color="red" icon={<IconPackage />}>
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
        {product.hasVariants && product.variants && product.variants.length > 0 ? (
          (() => {
            const activeVariants = product.variants.filter((v: any) => v.isActive);
            if (activeVariants.length > 0) {
              const prices = activeVariants.map((v: any) => v.price || product.price);
              const minPrice = Math.min(...prices);
              const maxPrice = Math.max(...prices);
              return minPrice === maxPrice 
                ? `$${minPrice.toFixed(2)}`
                : `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;
            }
            return `$${product.price.toFixed(2)}`;
          })()
        ) : (
          `$${product.price.toFixed(2)}`
        )}
      </Table.Td>
      <Table.Td>
        {product.hasVariants && product.variants && product.variants.length > 0 ? (
          (() => {
            const activeVariants = product.variants.filter((v: any) => v.isActive);
            const totalStock = activeVariants.reduce((sum: number, v: any) => sum + (v.stockQuantity || 0), 0);
            return totalStock;
          })()
        ) : (
          product.stockQuantity
        )}
      </Table.Td>
      <Table.Td>{product.brand?.name || 'No Brand'}</Table.Td>
      <Table.Td>
        <Group gap="xs" align="flex-start">
          <Badge 
            variant="light" 
            color="blue" 
            size="sm"
            component={Link}
            href={`/admin/categories/${product.category?._id}`}
            style={{ cursor: 'pointer', textDecoration: 'none' }}
          >
            {product.category?.name || 'Uncategorized'}
          </Badge>
          {product.category?.parent && (
            <Text size="xs" c="dimmed">
              in {product.category.parent.name}
            </Text>
          )}
        </Group>
      </Table.Td>
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
            href="/admin/categories"
            aria-label="Back to categories"
          >
            <IconArrowLeft size={20} />
          </ActionIcon>
          <div>
            <Title order={2}>Category: {category?.name}</Title>
            <Text c="dimmed" size="sm">
              {category?.description || 'No description available'}
            </Text>
          </div>
        </Group>
        <Group>
          <Badge color={category?.isPublished ? 'green' : 'red'}>
            {category?.isPublished ? 'Published' : 'Draft'}
          </Badge>
          <Button
            leftSection={<IconPencil size={16} />}
            component={Link}
            href={`/admin/categories/edit/${categoryId}`}
          >
            Edit Category
          </Button>
        </Group>
      </Group>

      {category?.parent && (
        <Paper p="sm" mb="md" withBorder>
          <Text size="sm" c="dimmed">
            Parent Category: <Text span fw={500}>{category.parent.name}</Text>
          </Text>
        </Paper>
      )}

      {/* Show Subcategories if any */}
      {category?.children && category.children.length > 0 && (
        <Paper p="md" mb="md" withBorder>
          <Text fw={500} mb="sm">Subcategories ({category.children.length})</Text>
          <Group gap="xs">
            {category.children.map((child) => (
              <Badge 
                key={child._id} 
                variant="light" 
                color="blue"
                component={Link}
                href={`/admin/categories/${child._id}`}
                style={{ cursor: 'pointer' }}
              >
                {child.name}
              </Badge>
            ))}
          </Group>
        </Paper>
      )}

      {/* Filters */}
      <FilterPanel
        searchTerm={searchTerm}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search products in this category..."
        
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

      {/* Enhanced Subcategory Controls */}
      {flattenedCategories.length > 0 && (
        <Paper withBorder shadow="sm" radius="md" p="md" mb="xl">
          <Group mb="md" align="flex-start">
            <Switch
              label="Include all subcategories"
              description="Show products from all child categories"
              checked={includeSubcategories}
              onChange={(event) => handleIncludeAllSubcategories(event.currentTarget.checked)}
              size="sm"
              color="blue"
            />
            <Button
              variant="outline"
              size="sm"
              leftSection={showSubcategorySelector ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
              onClick={() => setShowSubcategorySelector(!showSubcategorySelector)}
              disabled={includeSubcategories}
              color="blue"
              style={{ fontWeight: 400 }}
            >
              Select Specific Subcategories ({selectedSubcategories.length})
            </Button>
          </Group>

          <Collapse in={showSubcategorySelector && !includeSubcategories}>
            <Box mt="sm">
              <Paper withBorder p="md" radius="md">
                <Text size="sm" fw={500} mb="md" c="dimmed">
                  Choose subcategories to include:
                </Text>
                <LoadingOverlay visible={isTreeLoading} />
                <Box style={{ maxHeight: flattenedCategories.length > 8 ? '240px' : 'auto', overflowY: flattenedCategories.length > 8 ? 'auto' : 'visible' }}>
                  {flattenedCategories.map((cat) => (
                    <Group key={cat._id} mb="sm" pl={cat.level * 20} align="flex-start">
                      <Checkbox
                        checked={selectedSubcategories.includes(cat._id)}
                        onChange={() => handleSubcategoryToggle(cat._id)}
                        size="sm"
                        label={
                          <Group gap="sm" wrap="nowrap">
                            <Text size="sm" style={{ fontWeight: cat.level === 0 ? 500 : 400 }}>
                              {cat.name}
                            </Text>
                            {cat.productCount !== undefined && (
                              <Badge size="xs" variant="light" color="blue">
                                {cat.productCount}
                              </Badge>
                            )}
                          </Group>
                        }
                      />
                    </Group>
                  ))}
                </Box>
                {selectedSubcategories.length > 0 && (
                  <Group mt="md" justify="space-between" pt="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
                    <Text size="xs" c="dimmed">
                      {selectedSubcategories.length} subcategories selected
                    </Text>
                    <Button
                      size="xs"
                      variant="subtle"
                      color="gray"
                      onClick={() => setSelectedSubcategories([])}
                    >
                      Clear Selection
                    </Button>
                  </Group>
                )}
              </Paper>
            </Box>
          </Collapse>

          {/* Display selected subcategories */}
          {selectedSubcategories.length > 0 && (
            <Box mt="md">
              <Text size="sm" fw={500} mb="sm" c="dimmed">
                Including products from:
              </Text>
              <Group gap="sm">
                <Badge variant="filled" color="blue" size="md">
                  {category?.name} (main)
                </Badge>
                {selectedSubcategories.map((subId) => {
                  const subcat = flattenedCategories.find(c => c._id === subId);
                  return subcat ? (
                    <Badge
                      key={subId}
                      variant="light"
                      color="blue"
                      size="md"
                      style={{ cursor: 'pointer' }}
                      rightSection={
                        <ActionIcon
                          size="xs"
                          variant="transparent"
                          onClick={() => handleSubcategoryToggle(subId)}
                          color="blue"
                        >
                          ×
                        </ActionIcon>
                      }
                    >
                      {subcat.name}
                    </Badge>
                  ) : null;
                })}
              </Group>
            </Box>
          )}
        </Paper>
      )}

      {/* Products Table */}
      <Paper withBorder shadow="sm" radius="md">
        <Group justify="space-between" p="md" style={{ borderBottom: '1px solid #e9ecef' }}>
          <Text fw={500}>Products in this Category ({totalItems})</Text>
        </Group>

        <ScrollArea>
          <LoadingOverlay
            visible={isProductsLoading}
            overlayProps={{ radius: 'sm', blur: 1 }}
          />
          {!isProductsLoading && !error && products.length === 0 && (
            <Text p="xl" ta="center" c="dimmed">
              No products found in this category.
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
                  <Table.Th>Brand</Table.Th>
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
