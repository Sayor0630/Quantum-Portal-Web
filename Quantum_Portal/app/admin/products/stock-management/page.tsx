'use client';

import React, { useState, useEffect } from 'react';
import {
  Paper, Title, Text, Group, Stack, Grid, Alert, Badge,
  TextInput, NumberInput, Button, Select, Table, ScrollArea,
  Modal, ActionIcon, Switch, Box, Card, Divider, LoadingOverlay,
  Tabs
} from '@mantine/core';
import {
  IconSearch, IconPackage, IconEdit, IconCurrency, IconAlertCircle,
  IconCheck, IconBoxMultiple, IconFilter, IconRefresh, IconDownload
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useDebouncedValue } from '@mantine/hooks';
import AdminLayout from '../../../../components/admin/AdminLayout';
import BulkStockManager from '../_components/BulkStockManager';
import StockAlerts from '../_components/StockAlerts';
import FilterPanel, { type FilterOption } from '../../../../components/admin/FilterPanel';

// Interfaces
interface ProductVariant {
  _id?: string;
  attributeCombination: { [key: string]: string };
  sku?: string;
  price?: number;
  stockQuantity: number;
  isActive: boolean;
  images?: Array<{ url: string; public_id: string }>;
}

interface Product {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  sku?: string;
  stockQuantity: number;
  hasVariants: boolean;
  attributeDefinitions?: { [key: string]: string[] };
  variants: ProductVariant[];
  brand?: { _id: string; name: string };
  category?: { _id: string; name: string };
  brandId?: string;
  categoryId?: string;
  attributes?: Array<{ attributeId: string; value: string }>;
  isPublished: boolean;
}

interface StockUpdateData {
  productId: string;
  variantId?: string;
  stockQuantity: number;
  price?: number;
  sku?: string;
}

interface Category {
  _id: string;
  name: string;
  slug: string;
}

interface Brand {
  _id: string;
  name: string;
  slug: string;
}

interface AttributeDefinition {
  _id: string;
  name: string;
  values: string[];
}

export default function StockManagementPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm] = useDebouncedValue(searchTerm, 300);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [filterOption, setFilterOption] = useState<string>('all');
  const [sortOption, setSortOption] = useState<string>('name');
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(new Set());
  
  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [attributeDefinitions, setAttributeDefinitions] = useState<AttributeDefinition[]>([]);
  
  // Attribute filtering
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<string[]>([]);
  const [attributeValues, setAttributeValues] = useState<Record<string, string[]>>({});
  
  // Loading states for filters
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [isBrandsLoading, setIsBrandsLoading] = useState(true);
  const [isAttributesLoading, setIsAttributesLoading] = useState(true);
  
  // Temporary state for editing
  const [editingData, setEditingData] = useState<{ [key: string]: any }>({});

  // Fetch products
  const fetchProducts = async (isFilterChange = false) => {
    try {
      // Set appropriate loading state based on the type of fetch
      if (isFilterChange) {
        setFilterLoading(true);
      } else {
        setLoading(true);
      }
      
      const params = new URLSearchParams({
        search: debouncedSearchTerm,
        page: '1',
        limit: '100',
        includeVariants: 'true'
      });

      // Note: We're doing all filtering client-side now, so we only send basic search
      // If you want to enable server-side filtering, uncomment the lines below:
      
      // Add filter parameters
      // if (selectedCategory) {
      //   params.append('category', selectedCategory);
      // }
      // if (selectedBrand) {
      //   params.append('brand', selectedBrand);
      // }
      
      // Add attribute filters
      // Object.entries(attributeValues).forEach(([attributeId, values]) => {
      //   if (values.length > 0) {
      //     params.append(`attribute_${attributeId}`, values.join(','));
      //   }
      // });

      const response = await fetch(`/api/admin/products?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch products');
      }

      console.log('📦 Fetched products sample:', data.products?.slice(0, 2));
      
      // Debug: Check the actual structure of products
      if (data.products && data.products.length > 0) {
        console.log('🔍 First product structure:', JSON.stringify(data.products[0], null, 2));
        console.log('🔍 Product attributes field:', data.products[0].attributes);
        console.log('🔍 Product attributeDefinitions field:', data.products[0].attributeDefinitions);
        console.log('🔍 Product variants field:', data.products[0].variants);
      }
      
      setProducts(data.products || []);
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to fetch products',
        color: 'red'
      });
    } finally {
      if (isFilterChange) {
        setFilterLoading(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []); // Initial load only

  useEffect(() => {
    // Handle filter changes - use filterLoading state
    if (products.length > 0) { // Only trigger if we have initial data
      fetchProducts(true);
    }
  }, [debouncedSearchTerm, selectedCategory, selectedBrand, attributeValues]);

  // Handle stock update from StockAlerts component
  const handleEditStock = async (productId: string, variantId: string | undefined, newStock: number, newPrice?: number) => {
    try {
      const updateItem: any = {
        productId,
        variantId,
        stockQuantity: newStock
      };

      // Add price if provided
      if (newPrice !== undefined) {
        updateItem.price = newPrice;
      }

      const updateData = {
        updates: [updateItem]
      };

      const response = await fetch('/api/admin/products/bulk-stock-update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update product');
      }

      // Check if there were any errors in the bulk update
      if (data.errors && data.errors.length > 0) {
        const errorMessage = data.errors[0].error || 'Failed to update product';
        throw new Error(errorMessage);
      }

      notifications.show({
        title: 'Success',
        message: newPrice !== undefined ? 'Stock and price updated successfully' : 'Stock updated successfully',
        color: 'green'
      });

      // Refresh the products list to show updated stock
      await fetchProducts(false);

      return true; // Indicate success
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update product',
        color: 'red'
      });
      throw error; // Re-throw for the component to handle
    }
  };

  // Fetch categories
  const fetchCategories = async () => {
    try {
      setIsCategoriesLoading(true);
      const response = await fetch('/api/admin/categories');
      const data = await response.json();
      if (response.ok) {
        console.log('Categories fetched:', data);
        setCategories(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setIsCategoriesLoading(false);
    }
  };

  // Fetch brands
  const fetchBrands = async () => {
    try {
      setIsBrandsLoading(true);
      const response = await fetch('/api/admin/brands');
      const data = await response.json();
      if (response.ok) {
        console.log('Brands fetched:', data);
        setBrands(data.brands || []);
      }
    } catch (error) {
      console.error('Failed to fetch brands:', error);
    } finally {
      setIsBrandsLoading(false);
    }
  };

  // Fetch attribute definitions
  const fetchAttributeDefinitions = async () => {
    try {
      setIsAttributesLoading(true);
      const response = await fetch('/api/admin/attribute-definitions');
      const data = await response.json();
      if (response.ok) {
        console.log('Attributes fetched:', data);
        setAttributeDefinitions(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch attributes:', error);
    } finally {
      setIsAttributesLoading(false);
    }
  };

  // Initialize filter data
  useEffect(() => {
    fetchCategories();
    fetchBrands();
    fetchAttributeDefinitions();
  }, []);

  // Filter handlers
  const handleCategoryChange = (value: string | null) => {
    setSelectedCategory(value);
  };

  const handleBrandChange = (value: string | null) => {
    setSelectedBrand(value);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const handleSelectedAttributeIdsChange = (attributeIds: string[]) => {
    setSelectedAttributeIds(attributeIds);
    // Clear values for deselected attributes
    const newAttributeValues = { ...attributeValues };
    Object.keys(newAttributeValues).forEach(attributeId => {
      if (!attributeIds.includes(attributeId)) {
        delete newAttributeValues[attributeId];
      }
    });
    setAttributeValues(newAttributeValues);
  };

  const handleAttributeValueChange = (attributeId: string, selectedValues: string[]) => {
    setAttributeValues(prev => ({
      ...prev,
      [attributeId]: selectedValues
    }));
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCategory(null);
    setSelectedBrand(null);
    setSelectedAttributeIds([]);
    setAttributeValues({});
    setFilterOption('all');
    setSortOption('name'); // Reset to default sort by name
  };

  // Helper function to get total stock
  const getTotalStock = (product: Product): number => {
    if (product.hasVariants && product.variants?.length > 0) {
      return product.variants
        .filter(v => v.isActive)
        .reduce((total, v) => total + v.stockQuantity, 0);
    }
    return product.stockQuantity;
  };

  // Function to toggle variant expansion
  const toggleVariantExpansion = (productId: string) => {
    setExpandedVariants(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  // COMPREHENSIVE FILTERING LOGIC - Includes ALL FilterPanel filters
  const filteredProducts = React.useMemo(() => {
    console.log('🔄 Recalculating filtered products...', { 
      filterOption, 
      sortOption, 
      searchTerm, 
      selectedCategory, 
      selectedBrand, 
      selectedAttributeIds, 
      attributeValues,
      totalProducts: products.length 
    });
    
    // Debug: Show what attributes products actually have
    if (selectedAttributeIds.length > 0) {
      console.log('🔍 Debug: Checking product attributes...');
      console.log('Selected attribute IDs:', selectedAttributeIds);
      console.log('Selected attribute values:', attributeValues);
      
      products.slice(0, 3).forEach(product => {
        console.log(`Product "${product.name}" has attributes:`, product.attributes?.map(attr => `${attr.attributeId}:${attr.value}`) || 'none');
      });
      
      // Show how many products have each selected attribute
      selectedAttributeIds.forEach(attributeId => {
        const productsWithAttribute = products.filter(p => 
          p.attributes?.some(attr => attr.attributeId === attributeId)
        );
        console.log(`Attribute ${attributeId}: ${productsWithAttribute.length} products have this attribute`);
      });
    }
    
    // Step 1: Apply ALL filters
    let filtered = products.filter(product => {
      // Filter 1: Search term
      if (searchTerm && searchTerm.trim() !== '') {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          product.name.toLowerCase().includes(searchLower) ||
          (product.sku && product.sku.toLowerCase().includes(searchLower)) ||
          (product.description && product.description.toLowerCase().includes(searchLower));
        
        if (!matchesSearch) {
          console.log(`🔍 Search filter - ${product.name}: REJECTED (doesn't match "${searchTerm}")`);
          return false;
        }
      }

      // Filter 2: Category
      if (selectedCategory && selectedCategory !== '') {
        const productCategoryId = product.categoryId || product.category?._id;
        if (productCategoryId !== selectedCategory) {
          console.log(`🔍 Category filter - ${product.name}: REJECTED (category ${productCategoryId} !== ${selectedCategory})`);
          return false;
        }
      }

      // Filter 3: Brand
      if (selectedBrand && selectedBrand !== '') {
        const productBrandId = product.brandId || product.brand?._id;
        if (productBrandId !== selectedBrand) {
          console.log(`🔍 Brand filter - ${product.name}: REJECTED (brand ${productBrandId} !== ${selectedBrand})`);
          return false;
        }
      }

      // Filter 4: Attributes (Two-step filtering)
      if (selectedAttributeIds.length > 0) {
        console.log(`🔍 Checking attributes for product "${product.name}":`, {
          selectedAttributeIds,
          productAttributes: product.attributes,
          productAttributeDefinitions: product.attributeDefinitions,
          productVariants: product.variants?.length || 0,
          attributeValues
        });
        
        for (const attributeId of selectedAttributeIds) {
          let productHasAttribute = false;
          let productAttributeValue: string | null = null;
          
          // Check multiple possible attribute storage locations
          // 1. Direct attributes array
          if (product.attributes && Array.isArray(product.attributes)) {
            const attr = product.attributes.find(attr => attr.attributeId === attributeId);
            if (attr) {
              productHasAttribute = true;
              productAttributeValue = attr.value;
            }
          }
          
          // 2. Check attributeDefinitions (another possible location)
          if (!productHasAttribute && product.attributeDefinitions) {
            const attrDef = attributeDefinitions.find(def => def._id === attributeId);
            if (attrDef && product.attributeDefinitions[attrDef.name]) {
              productHasAttribute = true;
              const attrValue = product.attributeDefinitions[attrDef.name];
              // Handle both string and array values
              productAttributeValue = Array.isArray(attrValue) ? attrValue[0] : attrValue;
            }
          }
          
          // 3. Check variants for attribute combinations
          if (!productHasAttribute && product.variants && product.variants.length > 0) {
            const attrDef = attributeDefinitions.find(def => def._id === attributeId);
            if (attrDef) {
              for (const variant of product.variants) {
                if (variant.attributeCombination && variant.attributeCombination[attrDef.name]) {
                  productHasAttribute = true;
                  productAttributeValue = variant.attributeCombination[attrDef.name];
                  break; // Found at least one variant with this attribute
                }
              }
            }
          }
          
          console.log(`🔍 Product "${product.name}" attribute ${attributeId} check:`, {
            hasAttribute: productHasAttribute,
            value: productAttributeValue,
            checkMethods: {
              directAttributes: product.attributes?.length || 0,
              attributeDefinitions: Object.keys(product.attributeDefinitions || {}).length,
              variants: product.variants?.length || 0
            }
          });
          
          // Step 1: Product must have the selected attribute
          if (!productHasAttribute) {
            console.log(`🔍 Attribute filter - ${product.name}: REJECTED (doesn't have attribute ${attributeId})`);
            return false;
          }
          
          // Step 2: If specific values are selected for this attribute, check if product matches
          const selectedValues = attributeValues[attributeId];
          if (selectedValues && selectedValues.length > 0) {
            // For variant products, check if ANY variant matches the selected values
            if (product.variants && product.variants.length > 0) {
              const attrDef = attributeDefinitions.find(def => def._id === attributeId);
              if (attrDef) {
                const hasMatchingVariant = product.variants.some(variant => 
                  variant.attributeCombination && 
                  variant.attributeCombination[attrDef.name] &&
                  selectedValues.includes(variant.attributeCombination[attrDef.name])
                );
                
                if (!hasMatchingVariant) {
                  console.log(`🔍 Attribute filter - ${product.name}: REJECTED (no variants match selected values [${selectedValues.join(', ')}])`);
                  return false;
                }
              }
            } else if (productAttributeValue && !selectedValues.includes(productAttributeValue)) {
              console.log(`🔍 Attribute filter - ${product.name}: REJECTED (attribute ${attributeId} value "${productAttributeValue}" not in selected values [${selectedValues.join(', ')}])`);
              return false;
            }
          }
          
          console.log(`🔍 Attribute filter - ${product.name}: PASSED attribute ${attributeId} (value: "${productAttributeValue}")`);
        }
      }

      // Filter 5: Product type filter
      if (filterOption && filterOption !== 'all') {
        switch (filterOption) {
          case 'variants':
            if (product.hasVariants !== true) {
              console.log(`🔍 Product type filter - ${product.name}: REJECTED (not a variant product)`);
              return false;
            }
            break;
          
          case 'simple':
            if (product.hasVariants !== false) {
              console.log(`🔍 Product type filter - ${product.name}: REJECTED (not a simple product)`);
              return false;
            }
            break;
          
          case 'lowStock':
            let isLowStock = false;
            if (product.hasVariants && product.variants?.length > 0) {
              const activeVariants = product.variants.filter(v => v.isActive);
              isLowStock = activeVariants.some(v => v.stockQuantity > 0 && v.stockQuantity <= 10);
            } else {
              isLowStock = product.stockQuantity > 0 && product.stockQuantity <= 10;
            }
            if (!isLowStock) {
              console.log(`🔍 Product type filter - ${product.name}: REJECTED (not low stock)`);
              return false;
            }
            break;
          
          case 'outOfStock':
            let isOutOfStock = false;
            if (product.hasVariants && product.variants?.length > 0) {
              const activeVariants = product.variants.filter(v => v.isActive);
              isOutOfStock = activeVariants.some(v => v.stockQuantity === 0);
            } else {
              isOutOfStock = product.stockQuantity === 0;
            }
            if (!isOutOfStock) {
              console.log(`🔍 Product type filter - ${product.name}: REJECTED (not out of stock)`);
              return false;
            }
            break;
        }
      }

      console.log(`✅ Product ${product.name}: PASSED all filters`);
      return true;
    });

    console.log(`✅ After all filtering: ${filtered.length} products`);

    // Step 2: Apply sorting
    if (sortOption && sortOption !== 'name') {
      filtered = filtered.sort((a, b) => {
        switch (sortOption) {
          case 'stock':
            const stockA = getTotalStock(a);
            const stockB = getTotalStock(b);
            console.log(`📊 Stock sort - ${a.name}:${stockA} vs ${b.name}:${stockB}`);
            return stockA - stockB;
          
          case 'lowStock':
            const getLowestStock = (prod: Product) => {
              if (prod.hasVariants && prod.variants?.length > 0) {
                const activeVariants = prod.variants.filter(v => v.isActive);
                return activeVariants.length > 0 ? Math.min(...activeVariants.map(v => v.stockQuantity)) : 0;
              }
              return prod.stockQuantity;
            };
            return getLowestStock(a) - getLowestStock(b);
          
          case 'price':
            return a.price - b.price;
          
          default:
            return a.name.localeCompare(b.name);
        }
      });
    } else {
      // Default sort by name
      filtered = filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    console.log(`🎯 Final result: ${filtered.length} products after all filters and sort '${sortOption}'`);
    return filtered;
  }, [products, filterOption, sortOption, searchTerm, selectedCategory, selectedBrand, selectedAttributeIds, attributeValues]);

  const getStockStatus = (product: Product) => {
    if (product.hasVariants && product.variants?.length > 0) {
      const activeVariants = product.variants.filter(v => v.isActive);
      
      // Check if any variant is out of stock
      const hasOutOfStock = activeVariants.some(v => v.stockQuantity === 0);
      // Check if any variant is low stock
      const hasLowStock = activeVariants.some(v => v.stockQuantity <= 10 && v.stockQuantity > 0);
      
      if (hasOutOfStock && activeVariants.every(v => v.stockQuantity === 0)) {
        return { color: 'red', label: 'Out of Stock' };
      } else if (hasOutOfStock) {
        return { color: 'orange', label: 'Partial Stock' };
      } else if (hasLowStock) {
        return { color: 'orange', label: 'Low Stock' };
      } else {
        return { color: 'teal', label: 'In Stock' };
      }
    } else {
      // Simple product logic
      const stock = product.stockQuantity;
      if (stock === 0) return { color: 'red', label: 'Out of Stock' };
      if (stock <= 10) return { color: 'orange', label: 'Low Stock' };
      return { color: 'teal', label: 'In Stock' };
    }
  };

  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    
    // Initialize editing data
    const data: { [key: string]: any } = {
      baseSku: product.sku || '',
      baseStock: product.stockQuantity
    };

    // Only include base price for simple products
    if (!product.hasVariants) {
      data.basePrice = product.price;
    }

    // Add variant data if applicable
    if (product.hasVariants && product.variants) {
      product.variants.forEach((variant, index) => {
        data[`variant_${index}_price`] = variant.price || '';
        data[`variant_${index}_sku`] = variant.sku || '';
        data[`variant_${index}_stock`] = variant.stockQuantity;
        data[`variant_${index}_active`] = variant.isActive;
      });
    }

    setEditingData(data);
    setShowEditModal(true);
  };

  const handleUpdateProduct = async () => {
    if (!selectedProduct) return;

    try {
      setUpdating(true);

      // Prepare update data
      const updateData: any = {
        sku: editingData.baseSku,
        stockQuantity: editingData.baseStock
      };

      // Only include price for simple products
      if (!selectedProduct.hasVariants) {
        updateData.price = editingData.basePrice;
      }

      // Add variant updates if applicable
      if (selectedProduct.hasVariants && selectedProduct.variants) {
        const variantUpdates = selectedProduct.variants.map((variant, index) => ({
          _id: variant._id,
          attributeCombination: variant.attributeCombination,
          price: editingData[`variant_${index}_price`] || undefined,
          sku: editingData[`variant_${index}_sku`] || '',
          stockQuantity: editingData[`variant_${index}_stock`],
          isActive: editingData[`variant_${index}_active`],
          images: variant.images || []
        }));
        updateData.variants = variantUpdates;
      }

      const response = await fetch(`/api/admin/products/${selectedProduct._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update product');
      }

      notifications.show({
        title: 'Success',
        message: 'Product stock and pricing updated successfully',
        color: 'green'
      });

      setShowEditModal(false);
      setSelectedProduct(null);
      fetchProducts(false); // Refresh the list
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to update product',
        color: 'red'
      });
    } finally {
      setUpdating(false);
    }
  };

  const exportStockData = () => {
    const csvData = [
      ['Product Name', 'SKU', 'Price', 'Stock', 'Variant', 'Status']
    ];

    filteredProducts.forEach(product => {
      if (product.hasVariants && product.variants?.length > 0) {
        product.variants.forEach(variant => {
          const variantString = Object.entries(variant.attributeCombination)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
          
          csvData.push([
            product.name,
            variant.sku || '',
            (variant.price || product.price).toString(),
            variant.stockQuantity.toString(),
            variantString,
            variant.isActive ? 'Active' : 'Inactive'
          ]);
        });
      } else {
        csvData.push([
          product.name,
          product.sku || '',
          product.price.toString(),
          product.stockQuantity.toString(),
          'Simple Product',
          product.isPublished ? 'Published' : 'Draft'
        ]);
      }
    });

    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock-report.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Title order={2}>Stock & Price Management</Title>
            <Text c="dimmed">Manage inventory and pricing for all products and variants</Text>
          </div>
          <Group>
            <BulkStockManager 
              products={filteredProducts} 
              onUpdate={() => fetchProducts(false)}
            />
            <Button
              leftSection={<IconDownload size="1rem" />}
              variant="light"
              onClick={exportStockData}
            >
              Export CSV
            </Button>
            <Button
              leftSection={<IconRefresh size="1rem" />}
              variant="light"
              onClick={() => fetchProducts(false)}
              loading={loading || filterLoading}
            >
              Refresh
            </Button>
          </Group>
        </Group>

        {/* Stock Overview Cards */}
        <Group gap="lg" align="flex-start" wrap="nowrap">
          <Stack gap="md" style={{ flexShrink: 0, width: 'fit-content' }}>
            <Card withBorder p="md" style={{ minWidth: 'max-content', width: '100%' }}>
              <Text size="sm" c="dimmed">Total Products</Text>
              <Text size="xl" fw={700}>{products.length}</Text>
            </Card>
            
            <Card withBorder p="md" style={{ minWidth: 'max-content', width: '100%' }}>
              <Text size="sm" c="dimmed">With Variants</Text>
              <Text size="xl" fw={700}>
                {products.filter(p => p.hasVariants).length}
              </Text>
            </Card>
            
            <Card withBorder p="md" style={{ minWidth: 'max-content', width: '100%' }}>
              <Text size="sm" c="dimmed">Low Stock</Text>
              <Text size="xl" fw={700} c="orange">
                {products.filter(p => {
                  if (p.hasVariants && p.variants?.length > 0) {
                    const activeVariants = p.variants.filter(v => v.isActive);
                    return activeVariants.some(variant => 
                      variant.stockQuantity > 0 && variant.stockQuantity <= 10
                    );
                  } else {
                    return p.stockQuantity > 0 && p.stockQuantity <= 10;
                  }
                }).length}
              </Text>
            </Card>
            
            <Card withBorder p="md" style={{ minWidth: 'max-content', width: '100%' }}>
              <Text size="sm" c="dimmed">Out of Stock</Text>
              <Text size="xl" fw={700} c="red">
                {products.filter(p => {
                  if (p.hasVariants && p.variants?.length > 0) {
                    const activeVariants = p.variants.filter(v => v.isActive);
                    return activeVariants.some(variant => variant.stockQuantity === 0);
                  } else {
                    return p.stockQuantity === 0;
                  }
                }).length}
              </Text>
            </Card>
          </Stack>
          
          <Box style={{ flex: 1, minWidth: 0 }}>
            <StockAlerts products={products} onEditStock={handleEditStock} />
          </Box>
        </Group>

        {/* Search and Filters */}
        <FilterPanel
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search products by name, SKU..."
          
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
          
          showProductTypeFilter={true}
          productTypeOptions={[
            { value: 'all', label: 'All Products' },
            { value: 'variants', label: 'Products with Variants' },
            { value: 'simple', label: 'Simple Products' },
            { value: 'lowStock', label: 'Low Stock (≤10)' },
            { value: 'outOfStock', label: 'Out of Stock' }
          ]}
          selectedProductType={filterOption}
          onProductTypeChange={(value) => setFilterOption(value || 'all')}
          
          showSortFilter={true}
          sortOptions={[
            { value: 'name', label: 'Name (A-Z)' },
            { value: 'stock', label: 'Total Stock (Low to High)' },
            { value: 'lowStock', label: 'Lowest Stock First' },
            { value: 'price', label: 'Price (Low to High)' }
          ]}
          selectedSort={sortOption}
          onSortChange={(value) => setSortOption(value || 'name')}
          
          onClearFilters={handleClearFilters}
        />

        {/* Products Table */}
        <Paper withBorder>
          <LoadingOverlay visible={loading} />
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Product</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Price Range</Table.Th>
                  <Table.Th>
                    Stock Details
                    {sortOption === 'stock' && (
                      <Text size="xs" c="dimmed" style={{ display: 'inline', marginLeft: '4px' }}>
                        (Total: Low → High)
                      </Text>
                    )}
                    {sortOption === 'lowStock' && (
                      <Text size="xs" c="dimmed" style={{ display: 'inline', marginLeft: '4px' }}>
                        (Lowest First)
                      </Text>
                    )}
                    {sortOption === 'name' && (
                      <Text size="xs" c="dimmed" style={{ display: 'inline', marginLeft: '4px' }}>
                        (A-Z)
                      </Text>
                    )}
                    {sortOption === 'price' && (
                      <Text size="xs" c="dimmed" style={{ display: 'inline', marginLeft: '4px' }}>
                        (Price: Low → High)
                      </Text>
                    )}
                  </Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody style={{ position: 'relative' }}>
                <LoadingOverlay visible={filterLoading} />
                {filteredProducts.map((product) => {
                  const totalStock = getTotalStock(product);
                  const stockStatus = getStockStatus(product);
                  
                  return (
                    <Table.Tr key={product._id}>
                      <Table.Td>
                        <div>
                          <Text fw={500} size="sm">{product.name}</Text>
                          {product.sku && (
                            <Text size="xs" c="dimmed">SKU: {product.sku}</Text>
                          )}
                          {product.brand && (
                            <Text size="xs" c="dimmed">Brand: {product.brand.name}</Text>
                          )}
                          {product.category && (
                            <Text size="xs" c="dimmed">Category: {product.category.name}</Text>
                          )}
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          variant="light"
                          color={product.hasVariants ? "blue" : "gray"}
                          leftSection={product.hasVariants ? <IconBoxMultiple size="0.8rem" /> : <IconPackage size="0.8rem" />}
                        >
                          {product.hasVariants ? 'Variants' : 'Simple'}
                        </Badge>
                        {product.hasVariants && (
                          <Text size="xs" c="dimmed">
                            {product.variants?.length || 0} combinations
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {product.hasVariants && product.variants?.length > 0 ? (
                          (() => {
                            const prices = product.variants
                              .filter(v => v.isActive)
                              .map(v => v.price || product.price);
                            
                            if (prices.length === 0) {
                              return `$${product.price.toFixed(2)}`;
                            }
                            
                            const minPrice = Math.min(...prices);
                            const maxPrice = Math.max(...prices);
                            
                            return minPrice === maxPrice
                              ? `$${minPrice.toFixed(2)}`
                              : `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;
                          })()
                        ) : (
                          `$${product.price.toFixed(2)}`
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" align="center">
                          <Text 
                            fw={sortOption === 'stock' || sortOption === 'lowStock' ? 600 : 500}
                            size={sortOption === 'stock' || sortOption === 'lowStock' ? 'md' : 'sm'}
                            c={
                              totalStock === 0 ? 'red' : 
                              totalStock <= 10 ? 'orange' : 
                              undefined
                            }
                          >
                            {totalStock}
                          </Text>
                          <Badge
                            size="xs"
                            color={stockStatus.color}
                          >
                            {stockStatus.label}
                          </Badge>
                          {(sortOption === 'stock' || sortOption === 'lowStock') && (
                            <Text size="xs" c="dimmed">total</Text>
                          )}
                        </Group>
                        
                        {/* Show variant stock details */}
                        {product.hasVariants && product.variants?.length > 0 && (
                          <Stack gap={2} mt="xs">
                            {(() => {
                              const activeVariants = product.variants
                                .filter(v => v.isActive)
                                .sort((a, b) => a.stockQuantity - b.stockQuantity);
                              
                              const isExpanded = expandedVariants.has(product._id);
                              const variantsToShow = isExpanded ? activeVariants : activeVariants.slice(0, 4);
                              
                              return (
                                <>
                                  {variantsToShow.map((variant, idx) => {
                                    const variantLabel = Object.entries(variant.attributeCombination)
                                      .map(([key, value]) => `${value}`)
                                      .join(', ');
                                    
                                    let badgeColor = 'teal';
                                    let badgeVariant = 'light';
                                    if (variant.stockQuantity === 0) {
                                      badgeColor = 'red';
                                      badgeVariant = 'filled';
                                    } else if (variant.stockQuantity <= 10) {
                                      badgeColor = 'orange';
                                      badgeVariant = 'light';
                                    }
                                    
                                    return (
                                      <Group key={idx} gap="xs" align="center" wrap="nowrap">
                                        <Text 
                                          size="xs" 
                                          style={{ 
                                            maxWidth: '100px', 
                                            overflow: 'hidden', 
                                            textOverflow: 'ellipsis', 
                                            whiteSpace: 'nowrap',
                                            flexShrink: 0,
                                            opacity: 0.8
                                          }}
                                          title={variantLabel}
                                        >
                                          {variantLabel}:
                                        </Text>
                                        <Badge
                                          size="xs"
                                          color={badgeColor}
                                          variant={badgeVariant}
                                        >
                                          {variant.stockQuantity}
                                        </Badge>
                                      </Group>
                                    );
                                  })}
                                  
                                  {activeVariants.length > 4 && (
                                    <Text 
                                      size="xs" 
                                      c="blue.6" 
                                      fs="italic"
                                      style={{ 
                                        cursor: 'pointer',
                                        textDecoration: 'underline',
                                        opacity: 0.9
                                      }}
                                      onClick={() => toggleVariantExpansion(product._id)}
                                      title={isExpanded ? "Click to show less variants" : "Click to show all variants"}
                                    >
                                      {isExpanded 
                                        ? "Show less" 
                                        : `+${activeVariants.length - 4} more variants`
                                      }
                                    </Text>
                                  )}
                                </>
                              );
                            })()}
                          </Stack>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          variant="light"
                          color={product.isPublished ? "green" : "gray"}
                        >
                          {product.isPublished ? "Published" : "Draft"}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconEdit size="0.8rem" />}
                          onClick={() => openEditModal(product)}
                        >
                          Edit Stock & Price
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>

        {filteredProducts.length === 0 && !loading && (
          <Alert icon={<IconAlertCircle size="1rem" />} color="blue">
            No products found matching your search criteria.
          </Alert>
        )}

      </Stack>

      {/* Edit Modal */}
      <Modal
        opened={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={
          <Group gap="sm">
            <IconEdit size="1.2rem" />
            <div>
              <Text fw={500}>Edit Stock & Pricing</Text>
              <Text size="sm" c="dimmed">{selectedProduct?.name}</Text>
            </div>
          </Group>
        }
        size="xl"
        centered
      >
        {selectedProduct && (
          <Stack gap="lg">
            <LoadingOverlay visible={updating} />
            
            {!selectedProduct.hasVariants ? (
              // Simple Product Form
              <Stack gap="md">
                <Title order={5}>Product Information</Title>
                <Grid>
                  <Grid.Col span={6}>
                    <NumberInput
                      label="Price"
                      placeholder="0.00"
                      value={editingData.basePrice || ''}
                      onChange={(value) => setEditingData({...editingData, basePrice: value})}
                      decimalScale={2}
                      min={0}
                      leftSection="$"
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <NumberInput
                      label="Stock Quantity"
                      placeholder="0"
                      value={editingData.baseStock || ''}
                      onChange={(value) => setEditingData({...editingData, baseStock: value})}
                      min={0}
                      step={1}
                    />
                  </Grid.Col>
                  <Grid.Col span={12}>
                    <TextInput
                      label="SKU"
                      placeholder="Product SKU"
                      value={editingData.baseSku || ''}
                      onChange={(e) => setEditingData({...editingData, baseSku: e.target.value})}
                    />
                  </Grid.Col>
                </Grid>
              </Stack>
            ) : (
              // Variant Product Form
              <Stack gap="md">
                <div>
                  <Title order={5}>Base Product Information</Title>
                  <Text size="sm" c="dimmed">Base SKU for product identification</Text>
                </div>
                
                <Grid>
                  <Grid.Col span={12}>
                    <TextInput
                      label="Base SKU"
                      placeholder="Base product SKU"
                      value={editingData.baseSku || ''}
                      onChange={(e) => setEditingData({...editingData, baseSku: e.target.value})}
                    />
                  </Grid.Col>
                </Grid>

                <Divider />

                <div>
                  <Title order={5}>Variant Management</Title>
                  <Text size="sm" c="dimmed">Manage stock and pricing for each variant combination</Text>
                </div>

                <ScrollArea.Autosize mah={400}>
                  <Table striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Attributes</Table.Th>
                        <Table.Th>SKU</Table.Th>
                        <Table.Th>Price</Table.Th>
                        <Table.Th>Stock</Table.Th>
                        <Table.Th>Active</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {selectedProduct.variants?.map((variant, index) => (
                        <Table.Tr key={index}>
                          <Table.Td>
                            <Group gap={4}>
                              {Object.entries(variant.attributeCombination).map(([key, value]) => (
                                <Badge key={key} size="xs" variant="light">
                                  {key}: {value}
                                </Badge>
                              ))}
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <TextInput
                              size="xs"
                              placeholder="Variant SKU"
                              value={editingData[`variant_${index}_sku`] || ''}
                              onChange={(e) => setEditingData({
                                ...editingData,
                                [`variant_${index}_sku`]: e.target.value
                              })}
                            />
                          </Table.Td>
                          <Table.Td>
                            <NumberInput
                              size="xs"
                              placeholder={`$${selectedProduct.price.toFixed(2)}`}
                              value={editingData[`variant_${index}_price`] || ''}
                              onChange={(value) => setEditingData({
                                ...editingData,
                                [`variant_${index}_price`]: value
                              })}
                              decimalScale={2}
                              min={0}
                              leftSection="$"
                            />
                          </Table.Td>
                          <Table.Td>
                            <NumberInput
                              size="xs"
                              value={editingData[`variant_${index}_stock`] || 0}
                              onChange={(value) => setEditingData({
                                ...editingData,
                                [`variant_${index}_stock`]: value
                              })}
                              min={0}
                              step={1}
                            />
                          </Table.Td>
                          <Table.Td>
                            <Switch
                              size="sm"
                              checked={editingData[`variant_${index}_active`] ?? true}
                              onChange={(e) => setEditingData({
                                ...editingData,
                                [`variant_${index}_active`]: e.currentTarget.checked
                              })}
                            />
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea.Autosize>
              </Stack>
            )}

            <Group justify="flex-end" mt="lg">
              <Button
                variant="subtle"
                onClick={() => setShowEditModal(false)}
                disabled={updating}
              >
                Cancel
              </Button>
              <Button
                leftSection={<IconCheck size="1rem" />}
                onClick={handleUpdateProduct}
                loading={updating}
              >
                Save Changes
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </AdminLayout>
  );
}
