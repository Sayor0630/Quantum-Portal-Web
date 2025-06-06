'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import AdminLayout from '../../../../../components/admin/AdminLayout';
import { Title, Paper, TextInput, Textarea, Button, Group, Space, Text, Box, Select, LoadingOverlay, Grid, Loader, Alert, Autocomplete, ThemeIcon, Badge, Image, NumberInput, Modal, Stack, Divider, Card } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useDebouncedCallback } from '@mantine/hooks';
import { IconAlertCircle, IconSearch, IconUserCheck, IconPlus, IconTrash, IconShoppingCart, IconPackage, IconDeviceFloppy, IconEdit, IconClock, IconCheck, IconAlertTriangle } from '@tabler/icons-react';

// Interfaces (should align with Order model and previous page definitions)
interface PaymentMethodOption {
  value: string;
  label: string;
}
interface FetchedPaymentMethod {
    _id: string;
    name: string;
    isEnabled: boolean;
}
interface OrderItemProduct {
    _id: string;
    name: string;
    sku?: string;
    images?: Array<{url: string}> | string[]; // Support both formats
    customAttributes?: { [key: string]: string };
    availableAttributes?: { [key: string]: string[] };
}
interface OrderItem {
    _id?: string; // Existing items will have _id
    product?: OrderItemProduct | string | null; // string if product details not populated, or just ID
    productId: string; // Ensure we always have productId for submission
    name: string; // Denormalized name
    sku?: string; // Denormalized SKU (variant-specific)
    price: number; // Price at time of order
    quantity: number;
    image?: string; // Denormalized image (variant-specific)
    selectedAttributes?: { [key: string]: string }; // Selected attributes
    // Variant-specific fields for consistency with create order page
    isVariantProduct?: boolean;
    variantId?: string;
}

// Interface for product search results (same as create order)
interface SearchProductData {
    _id: string;
    name: string;
    sku: string;
    price: number;
    stockQuantity: number;
    images: string[];
    category: { _id: string; name: string; slug: string } | null;
    displayText: string;
    customAttributes: { [key: string]: string };
    availableAttributes: { [key: string]: string[] };
    hasAttributes: boolean;
    // New variant system fields
    hasVariants: boolean;
    priceRange: { min: number; max: number };
    variants: Array<{
        _id?: string;
        attributeCombination: { [key: string]: string };
        sku?: string;
        price?: number;
        stockQuantity: number;
        isActive: boolean;
        images?: Array<{ url: string; public_id: string }>;
    }>;
}
interface FormValues {
    fullName: string;
    phoneNumber: string;
    email?: string;
    deliveryAddress: string;
    city: string;
    district: string;
    country: string;
    deliveryNote?: string;
    paymentMethod: string;
    paymentStatus: 'unpaid' | 'paid';
    status: string; // Overall order status
    orderItems: OrderItem[];
    selectedCustomerId?: string | null; // From order.customer
}
// Interface for the fetched order data (align with Order model and API response)
interface FetchedOrder {
    _id: string;
    customer?: { _id: string; firstName?: string; lastName?: string; email: string; };
    orderItems: Array<{
        _id?: string;
        product: OrderItemProduct | string | null; // API might send populated or just ID
        name: string;
        price: number;
        quantity: number;
        image?: string;
        selectedAttributes?: { [key: string]: string } | Map<string, string>; // Add selectedAttributes support
    }>;
    totalAmount: number; // Though not directly edited in this form, it's part of order
    status: string;
    paymentStatus: 'unpaid' | 'paid';
    shippingAddress: {
        fullName: string;
        phone: string;
        email?: string;
        street: string;
        city: string;
        district: string;
        postalCode: string;
        country: string;
        state?: string; // Optional broader region
    };
    paymentMethod?: string;
    deliveryNote?: string;
    createdAt: string;
}


// Order statuses (consistent with list page)
const VALID_ORDER_STATUSES_FOR_DROPDOWN = [
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'refunded', label: 'Refunded' },
    { value: 'on-hold', label: 'On Hold' },
    { value: 'failed', label: 'Failed' },
];


export default function EditOrderPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params?.orderId as string;

  const [isLoading, setIsLoading] = useState(true); // For initial order fetch
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [paymentMethodOptions, setPaymentMethodOptions] = useState<PaymentMethodOption[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(true);

  // State for product search and management (same as create order)
  const [productSearchResults, setProductSearchResults] = useState<SearchProductData[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [productSearchValue, setProductSearchValue] = useState('');
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [selectedProductForAttributes, setSelectedProductForAttributes] = useState<SearchProductData | null>(null);
  const [tempAttributes, setTempAttributes] = useState<{ [key: string]: string }>({});
  const [tempQuantity, setTempQuantity] = useState(1);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  // New state for variant selection (matching create order page)
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [variantPrice, setVariantPrice] = useState<number>(0);
  const [variantSku, setVariantSku] = useState<string>('');
  const [variantStock, setVariantStock] = useState<number>(0);
  const [variantImage, setVariantImage] = useState<string>(''); // For editing existing items

  const form = useForm<FormValues>({
    initialValues: {
      fullName: '',
      phoneNumber: '',
      email: '',
      deliveryAddress: '',
      city: '',
      district: '',
      country: 'Bangladesh',
      deliveryNote: '',
      paymentMethod: '',
      paymentStatus: 'unpaid',
      status: 'pending',
      orderItems: [],
      selectedCustomerId: null,
    },
    validate: {
      fullName: (value) => (value.trim().length > 0 ? null : 'Full name is required'),
      phoneNumber: (value) => {
        if (!value) return 'Phone number is required';
        if (!/^\d{11}$/.test(value)) return 'Phone number must be exactly 11 digits';
        if (!/^01/.test(value)) return 'Phone number must start with "01"';
        return null;
      },
      email: (value) => (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? 'Invalid email address' : null),
      deliveryAddress: (value) => (value.trim().length > 0 ? null : 'Delivery address is required'),
      city: (value) => (value.trim().length > 0 ? null : 'City is required'),
      district: (value) => (value.trim().length > 0 ? null : 'District is required'),
      paymentMethod: (value) => (value ? null : 'Payment method is required'),
      status: (value) => (value ? null : 'Order status is required'),
      orderItems: {
        quantity: (value) => (value > 0 ? null : 'Quantity must be greater than 0'),
      }
    },
  });

  const fetchOrderData = useCallback(async () => {
    if (!orderId) return;
    setIsLoading(true);
    setError(null);
    try {
      // API endpoint for fetching single order needs to return all new fields
      const response = await fetch(`/api/admin/orders/${orderId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch order data. Status: ${response.status}`);
      }
      const result = await response.json(); // API returns {success: true, data: order}
      
      if (!result.success || !result.data) {
        throw new Error(result.message || 'Failed to fetch order data');
      }
      
      const orderData: FetchedOrder = result.data;

      form.setValues({
        fullName: orderData.shippingAddress.fullName || '',
        phoneNumber: orderData.shippingAddress.phone || '',
        email: orderData.shippingAddress.email || '',
        deliveryAddress: orderData.shippingAddress.street || '',
        city: orderData.shippingAddress.city || '',
        district: orderData.shippingAddress.district || '',
        country: orderData.shippingAddress.country || 'Bangladesh',
        deliveryNote: orderData.deliveryNote || '',
        paymentMethod: orderData.paymentMethod || '',
        paymentStatus: orderData.paymentStatus || 'unpaid',
        status: orderData.status || 'pending',
        orderItems: orderData.orderItems.map(item => {
            // Handle selectedAttributes - could be Map or plain object from API
            let selectedAttributes: { [key: string]: string } = {};
            if (item.selectedAttributes) {
                if (item.selectedAttributes instanceof Map) {
                    selectedAttributes = Object.fromEntries(item.selectedAttributes);
                } else {
                    selectedAttributes = item.selectedAttributes as Record<string, string>;
                }
            }

            return {
                _id: item._id,
                // Handle product being string (ID) or object
                productId: typeof item.product === 'string' ? item.product : (item.product?._id || ''),
                name: item.name || (typeof item.product !== 'string' && item.product?.name) || 'N/A',
                sku: (item as any).sku || (typeof item.product !== 'string' && item.product?.sku) || '',
                price: item.price,
                quantity: item.quantity,
                image: item.image || (typeof item.product !== 'string' && item.product?.images?.[0] as any)?.url || '',
                selectedAttributes, // Use the properly extracted attributes
                // Use stored isVariantProduct flag if available, otherwise detect based on attributes and variantId
                isVariantProduct: (item as any).isVariantProduct !== undefined 
                    ? (item as any).isVariantProduct 
                    : !!(selectedAttributes && Object.keys(selectedAttributes).length > 0 && (item as any).variantId),
                variantId: (item as any).variantId || undefined,
                product: item.product // Keep original product for display if needed
            };
        }),
        selectedCustomerId: orderData.customer?._id || null,
      });

    } catch (err: any) {
      setError(err.message);
      notifications.show({ title: 'Error fetching order', message: err.message, color: 'red' });
    } finally {
      setIsLoading(false);
    }
  }, [orderId, form.setValues]);

  const fetchEnabledPaymentMethods = useCallback(async () => {
    setIsLoadingPaymentMethods(true);
    try {
      const response = await fetch('/api/admin/payment-methods');
      if (!response.ok) throw new Error('Failed to fetch payment methods');
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        const enabledMethods = result.data
          .filter((method: FetchedPaymentMethod) => method.isEnabled)
          .map((method: FetchedPaymentMethod) => ({ value: method.name, label: method.name }));
        setPaymentMethodOptions(enabledMethods);
      } else {
        throw new Error(result.message || 'Invalid data for payment methods');
      }
    } catch (error: any) {
      notifications.show({ title: 'Error Fetching Payment Methods', message: error.message, color: 'red' });
    } finally {
      setIsLoadingPaymentMethods(false);
    }
  }, []);

  // Live product search with debouncing (same as create order)
  const handleProductSearch = useDebouncedCallback(async (searchValue: string) => {
    if (!searchValue.trim()) {
      setProductSearchResults([]);
      return;
    }

    if (searchValue.length < 2) {
      setProductSearchResults([]);
      return;
    }

    setProductSearchLoading(true);
    try {
      const response = await fetch(`/api/admin/products/search?q=${encodeURIComponent(searchValue)}&limit=8`);
      const result = await response.json();

      if (response.ok && result.success) {
        setProductSearchResults(result.data || []);
      } else {
        console.error('Product search failed:', result.message);
        setProductSearchResults([]);
      }
    } catch (error: any) {
      console.error('Product search error:', error);
      setProductSearchResults([]);
    } finally {
      setProductSearchLoading(false);
    }
  }, 300);

  // Find matching variant based on selected attributes (from create order page)
  const findMatchingVariant = (product: SearchProductData, selectedAttributes: { [key: string]: string }) => {
    if (!product.hasVariants || !product.variants) return null;
    
    return product.variants.find(variant => {
      const combination = variant.attributeCombination;
      return Object.keys(selectedAttributes).every(attr => 
        combination[attr] === selectedAttributes[attr]
      );
    });
  };

  // Update variant info when attributes change - only after ALL attributes are selected
  const updateVariantInfo = (product: SearchProductData, selectedAttributes: { [key: string]: string }) => {
    if (!product.hasVariants) return;
    
    // Check if all required attributes are selected
    const requiredAttributes = Object.keys(product.availableAttributes);
    const allAttributesSelected = requiredAttributes.every(attr => selectedAttributes[attr]);
    
    if (allAttributesSelected) {
      // All attributes selected, now find the variant
      const variant = findMatchingVariant(product, selectedAttributes);
      if (variant) {
        setSelectedVariant(variant);
        setVariantPrice(variant.price || product.price);
        setVariantSku(variant.sku || product.sku);
        setVariantStock(variant.stockQuantity);
        setVariantImage(variant.images?.[0]?.url || product.images?.[0] || '');
      } else {
        // All attributes selected but no matching variant found
        setSelectedVariant(null);
        setVariantPrice(0);
        setVariantSku('');
        setVariantStock(0);
        setVariantImage('');
      }
    } else {
      // Not all attributes selected yet, don't update variant details
      setSelectedVariant(null);
      setVariantPrice(0);
      setVariantSku('');
      setVariantStock(0);
      setVariantImage('');
    }
  };

  // Handle adding a product to the order
  const handleAddProduct = (product: SearchProductData) => {
    if (product.hasVariants) {
      // Product has variants, show modal for variant selection
      setSelectedProductForAttributes(product);
      setTempAttributes({});
      setTempQuantity(1);
      setEditingItemIndex(null); // Adding new item
      // Reset variant state - don't show any details until all attributes are selected
      setSelectedVariant(null);
      setVariantPrice(0);
      setVariantSku('');
      setVariantStock(0);
      setVariantImage('');
      setShowAttributeModal(true);
    } else if (product.hasAttributes) {
      // Product has legacy custom attributes, show modal for selection
      setSelectedProductForAttributes(product);
      setTempAttributes({});
      setTempQuantity(1);
      setEditingItemIndex(null); // Adding new item
      setShowAttributeModal(true);
    } else {
      // Product has no attributes or variants, add directly
      addProductToOrder(product, {}, 1);
    }
    // Clear search after selecting a product for clean interface
    setProductSearchValue('');
    setProductSearchResults([]);
  };

  // Handle editing existing item attributes
  const handleEditItemAttributes = (index: number) => {
    const item = form.values.orderItems[index];
    
    // Try to find the product details to get available attributes
    // For now, we'll create a mock product object
    const mockProduct: SearchProductData = {
      _id: item.productId,
      name: item.name,
      sku: item.product && typeof item.product !== 'string' ? item.product.sku || '' : '',
      price: item.price,
      stockQuantity: 99, // We don't have stock info in order, so use high number
      images: item.image ? [item.image] : [],
      category: null,
      displayText: item.name,
      customAttributes: item.product && typeof item.product !== 'string' ? item.product.customAttributes || {} : {},
      availableAttributes: item.product && typeof item.product !== 'string' ? item.product.availableAttributes || {} : {},
      hasAttributes: !!(item.selectedAttributes && Object.keys(item.selectedAttributes).length > 0),
      // Add missing variant fields for compatibility
      hasVariants: false,
      priceRange: { min: item.price, max: item.price },
      variants: []
    };

    setSelectedProductForAttributes(mockProduct);
    setTempAttributes(item.selectedAttributes || {});
    setTempQuantity(item.quantity);
    setEditingItemIndex(index);
    setShowAttributeModal(true);
  };

  // Add product to order items
  const addProductToOrder = (product: SearchProductData, selectedAttributes: { [key: string]: string }, quantity: number) => {
    let finalProduct = product;
    let finalPrice = product.price;
    let finalSku = product.sku;
    let finalImage = product.images?.[0];
    let variantId: string | undefined;
    let finalStock = product.stockQuantity;
    
    // Handle variant products
    if (product.hasVariants) {
      const variant = findMatchingVariant(product, selectedAttributes);
      if (variant) {
        finalPrice = variant.price || product.price;
        finalSku = variant.sku || product.sku;
        finalImage = variant.images?.[0]?.url || product.images?.[0];
        variantId = variant._id;
        finalStock = variant.stockQuantity;
      }
    }
    
    // Smart duplicate detection: Check if same product/variant exists
    const existingItemIndex = form.values.orderItems.findIndex(item => 
      item.productId === product._id && 
      JSON.stringify(item.selectedAttributes || {}) === JSON.stringify(selectedAttributes) &&
      item.variantId === variantId
    );

    if (existingItemIndex >= 0) {
      const existingItem = form.values.orderItems[existingItemIndex];
      
      // Check if anything has changed (price, sku, image)
      const hasChanges = 
        existingItem.price !== finalPrice ||
        existingItem.sku !== finalSku ||
        existingItem.image !== finalImage;

      if (hasChanges) {
        // Something has changed, add as new item
        const newItem: OrderItem = {
          productId: product._id,
          name: product.name,
          sku: finalSku,
          price: finalPrice,
          quantity,
          image: finalImage,
          selectedAttributes,
          isVariantProduct: product.hasVariants,
          variantId,
          product: {
            _id: product._id,
            name: product.name,
            sku: product.sku,
            images: product.images,
            customAttributes: product.customAttributes,
            availableAttributes: product.availableAttributes
          }
        };
        form.setFieldValue('orderItems', [...form.values.orderItems, newItem]);
        notifications.show({
          title: 'Product Added',
          message: `${product.name} added as new item due to price/details changes`,
          color: 'blue'
        });
      } else {
        // Nothing changed, merge quantities
        const currentItems = [...form.values.orderItems];
        const newQuantity = currentItems[existingItemIndex].quantity + quantity;
        currentItems[existingItemIndex].quantity = newQuantity;
        form.setFieldValue('orderItems', currentItems);
        notifications.show({
          title: 'Quantity Updated',
          message: `Increased quantity for ${product.name} (${newQuantity} total)`,
          color: 'green'
        });
      }
    } else {
      // Add new item
      const newItem: OrderItem = {
        productId: product._id,
        name: product.name,
        sku: finalSku,
        price: finalPrice,
        quantity,
        image: finalImage,
        selectedAttributes,
        isVariantProduct: product.hasVariants,
        variantId,
        product: {
          _id: product._id,
          name: product.name,
          sku: product.sku,
          images: product.images,
          customAttributes: product.customAttributes,
          availableAttributes: product.availableAttributes
        }
      };
      form.setFieldValue('orderItems', [...form.values.orderItems, newItem]);
      notifications.show({
        title: 'Product Added',
        message: `${product.name} added to order`,
        color: 'green'
      });
    }
  };

  // Handle attribute modal confirmation
  const handleAttributeModalConfirm = () => {
    if (!selectedProductForAttributes) return;

    if (selectedProductForAttributes.hasVariants) {
      // Validate that all required attributes are selected for variants
      const requiredAttributes = Object.keys(selectedProductForAttributes.availableAttributes);
      const missingAttributes = requiredAttributes.filter(attr => !tempAttributes[attr]);

      if (missingAttributes.length > 0) {
        notifications.show({
          title: 'Missing Attributes',
          message: `Please select: ${missingAttributes.join(', ')}`,
          color: 'red'
        });
        return;
      }

      // Check if variant exists and is active
      const variant = findMatchingVariant(selectedProductForAttributes, tempAttributes);
      if (!variant || !variant.isActive) {
        notifications.show({
          title: 'Variant Not Available',
          message: 'The selected attribute combination is not available',
          color: 'red'
        });
        return;
      }

      // Check stock availability
      if (tempQuantity > variant.stockQuantity) {
        notifications.show({
          title: 'Insufficient Stock',
          message: `Only ${variant.stockQuantity} items available`,
          color: 'red'
        });
        return;
      }
    } else {
      // Legacy custom attributes validation
      const requiredAttributes = Object.keys(selectedProductForAttributes.availableAttributes);
      const missingAttributes = requiredAttributes.filter(attr => !tempAttributes[attr]);

      if (missingAttributes.length > 0) {
        notifications.show({
          title: 'Missing Attributes',
          message: `Please select: ${missingAttributes.join(', ')}`,
          color: 'red'
        });
        return;
      }
    }

    if (editingItemIndex !== null) {
      // Editing existing item
      const currentItems = [...form.values.orderItems];
      currentItems[editingItemIndex].selectedAttributes = tempAttributes;
      currentItems[editingItemIndex].quantity = tempQuantity;
      
      // Update variant-specific data if applicable
      if (selectedProductForAttributes.hasVariants && selectedVariant) {
        currentItems[editingItemIndex].sku = variantSku;
        currentItems[editingItemIndex].price = variantPrice;
        currentItems[editingItemIndex].image = variantImage;
        currentItems[editingItemIndex].isVariantProduct = true;
        currentItems[editingItemIndex].variantId = selectedVariant._id;
      }
      
      form.setFieldValue('orderItems', currentItems);
      notifications.show({
        title: 'Item Updated',
        message: 'Product attributes and quantity updated',
        color: 'blue'
      });
    } else {
      // Adding new item
      addProductToOrder(selectedProductForAttributes, tempAttributes, tempQuantity);
    }
    
    setShowAttributeModal(false);
    setSelectedProductForAttributes(null);
    setEditingItemIndex(null);
    // Reset variant state
    setSelectedVariant(null);
    setVariantPrice(0);
    setVariantSku('');
    setVariantStock(0);
    setVariantImage('');
    // Clear search after successfully adding product with attributes
    setProductSearchValue('');
    setProductSearchResults([]);
  };

  // Remove item from order
  const removeOrderItem = (index: number) => {
    const currentItems = form.values.orderItems.filter((_, i) => i !== index);
    form.setFieldValue('orderItems', currentItems);
    notifications.show({
      title: 'Item Removed',
      message: 'Product removed from order',
      color: 'orange'
    });
  };

  useEffect(() => {
    fetchEnabledPaymentMethods();
    if (orderId) {
      fetchOrderData();
    } else {
      setIsLoading(false); // No orderId, so not loading
      setError("No Order ID provided.");
    }
  }, [orderId, fetchOrderData, fetchEnabledPaymentMethods]);

  const handleSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    setError(null);

    const orderUpdatePayload = {
        shippingAddress: {
            fullName: values.fullName,
            phone: values.phoneNumber,
            email: values.email,
            street: values.deliveryAddress,
            city: values.city,
            district: values.district,
            postalCode: form.values.country === 'Bangladesh' ? (values.city.substring(0,2) + values.district.substring(0,2) + "00").toUpperCase() : 'N/A', // Example for postal code, might need actual input
            country: values.country,
        },
        deliveryNote: values.deliveryNote,
        paymentMethod: values.paymentMethod,
        paymentStatus: values.paymentStatus,
        status: values.status,
        orderItems: values.orderItems.map(item => ({
            productId: item.productId, // Ensure this is just the ID string
            name: item.name, // Denormalized name
            sku: item.sku, // Include denormalized SKU
            price: item.price, // Price at time of order
            quantity: item.quantity,
            image: item.image, // Denormalized image
            selectedAttributes: item.selectedAttributes || {}, // Include selectedAttributes
            isVariantProduct: item.isVariantProduct || false, // Include variant product flag
            variantId: item.variantId, // Include variant ID if applicable
            _id: item._id // Keep _id for existing items if backend needs it to identify them
        })),
        // customerId is not typically changed during order edit.
        // totalAmount might be recalculated on backend based on items.
    };

    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, { // General update endpoint
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderUpdatePayload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) { // Assuming API returns {success: boolean, ...}
        throw new Error(result.message || 'Failed to update order.');
      }
      notifications.show({ title: 'Order Updated', message: 'Order saved successfully.', color: 'green', icon: <IconDeviceFloppy/> });
      router.push(`/admin/orders/${orderId}`); // Redirect to details page
    } catch (err: any) {
      setError(err.message);
      notifications.show({ title: 'Error updating order', message: err.message, color: 'red' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleItemQuantityChange = (index: number, quantity: number | string) => {
    const newQuantity = typeof quantity === 'string' ? parseInt(quantity, 10) : quantity;
    if (isNaN(newQuantity) || newQuantity < 0) return; // Or set to 0 or 1
    form.setFieldValue(`orderItems.${index}.quantity`, newQuantity);
  };


  if (isLoading || !orderId) {
    return <AdminLayout><LoadingOverlay visible={true} /></AdminLayout>;
  }

  if (error && !isSubmitting) { // Don't show page error if it's a submission error shown on form
    return <AdminLayout><Paper p="xl"><Text c="red">{error}</Text></Paper></AdminLayout>;
  }

  return (
    <AdminLayout>
      <Title order={2} mb="xl">
        Edit Order {orderId?.substring(0,8)}...
      </Title>

      <Paper component="form" onSubmit={form.onSubmit(handleSubmit)} shadow="sm" p="xl" radius="md" withBorder pos="relative">
        <LoadingOverlay visible={isLoadingPaymentMethods || isSubmitting} overlayProps={{ blur: 2 }} />
        <Title order={4} mb="md">
          Customer Information
        </Title>

        <TextInput
          label="Full Name"
          placeholder="Enter customer's full name"
          required
          mb="sm"
          {...form.getInputProps('fullName')}
        />

        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <TextInput
              label="Phone Number"
              placeholder="01xxxxxxxxx"
              required
              mb="sm"
              {...form.getInputProps('phoneNumber')}
              description="11 digits, starting with 01"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <TextInput
              label="Email (Optional)"
              placeholder="customer@example.com"
              mb="sm"
              {...form.getInputProps('email')}
            />
          </Grid.Col>
        </Grid>

        <Title order={4} mt="lg" mb="md">
          Delivery Information
        </Title>

        <Textarea
          label="Delivery Address (Street/Area)"
          placeholder="Enter street address, area details"
          required
          minRows={2}
          mb="sm"
          {...form.getInputProps('deliveryAddress')}
        />
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <TextInput
              label="City"
              placeholder="Enter city"
              required
              mb="sm"
              {...form.getInputProps('city')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <TextInput
              label="District"
              placeholder="Enter district"
              required
              mb="sm"
              {...form.getInputProps('district')}
            />
          </Grid.Col>
        </Grid>
        <TextInput
          label="Country"
          readOnly
          mb="sm"
          {...form.getInputProps('country')}
        />
         <Textarea
          label="Delivery Note (Optional)"
          placeholder="Any special instructions for delivery"
          minRows={2}
          mb="md"
          {...form.getInputProps('deliveryNote')}
        />

        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Select
              label="Payment Method"
              placeholder="Select payment method"
              data={paymentMethodOptions}
              required
              mb="md"
              {...form.getInputProps('paymentMethod')}
              disabled={isLoadingPaymentMethods || paymentMethodOptions.length === 0}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Select
              label="Payment Status"
              placeholder="Select payment status"
              data={[{value: 'unpaid', label: 'Unpaid'}, {value: 'paid', label: 'Paid'}]}
              required
              mb="md"
              {...form.getInputProps('paymentStatus')}
            />
          </Grid.Col>
        </Grid>

        <Select
          label="Order Status"
          placeholder="Select order status"
          data={VALID_ORDER_STATUSES_FOR_DROPDOWN}
          required
          mb="xl"
          {...form.getInputProps('status')}
        />

        <Title order={4} mb="md" mt="xl">
          Product Selection
        </Title>

        <Group align="flex-end" gap="sm" mb="md">
          <Box style={{ flex: 1 }}>
            <Autocomplete
              label="Search Products"
              placeholder="Search by name, SKU, or description..."
              value={productSearchValue}
              onChange={(value) => {
                setProductSearchValue(value);
                handleProductSearch(value);
              }}
              data={productSearchResults.map(product => product.displayText)}
              onOptionSubmit={(value) => {
                const product = productSearchResults.find(p => p.displayText === value);
                if (product) {
                  handleAddProduct(product);
                }
              }}
              rightSection={productSearchLoading ? <Loader size="xs" /> : <IconSearch size="1rem" />}
              comboboxProps={{ withinPortal: false }}
              maxDropdownHeight={300}
              limit={8}
              description="Search and select products to add to this order. Search again to add more products."
            />
          </Box>
          <Button
            variant="subtle"
            size="sm"
            onClick={() => {
              setProductSearchValue('');
              setProductSearchResults([]);
            }}
            disabled={!productSearchValue && productSearchResults.length === 0}
          >
            Clear Search
          </Button>
        </Group>

        {/* Order Items Display */}
        {form.values.orderItems.length > 0 && (
          <Card withBorder shadow="sm" p="md" radius="md" mb="md">
            <Group gap="xs" mb="md" align="center">
              <ThemeIcon variant="light" color="blue" size="lg" radius="md">
                <IconShoppingCart size="1.2rem" />
              </ThemeIcon>
              <div>
                <Text fw={700} size="sm" c="blue.7">
                  Order Items ({form.values.orderItems.length})
                </Text>
                <Text size="xs" c="dimmed">
                  Total: ${form.values.orderItems.reduce((total, item) => total + (item.price * item.quantity), 0).toFixed(2)}
                </Text>
              </div>
            </Group>

            <Stack gap="sm">
              {form.values.orderItems.map((item, index) => (
                <Paper key={item._id || item.productId || index} withBorder p="sm" radius="sm">
                  <Grid align="center">
                    <Grid.Col span={{ base: 12, sm: 2 }}>
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt={item.name}
                          radius="sm"
                          h={60}
                          w={60}
                          fit="cover"
                        />
                      ) : (
                        <Box
                          h={60}
                          w={60}
                          bg="gray.1"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                        >
                          <IconPackage size="1.5rem" color="gray" />
                        </Box>
                      )}
                    </Grid.Col>
                    
                    <Grid.Col span={{ base: 12, sm: 4 }}>
                      <Text fw={500} size="sm">{item.name}</Text>
                      <Text size="xs" c="dimmed">SKU: {item.sku || (typeof item.product !== 'string' && item.product?.sku) || 'N/A'}</Text>
                      {item.isVariantProduct && item.variantId && (
                        <Badge size="xs" variant="light" color="blue" mt={2}>
                          Variant Product
                        </Badge>
                      )}
                      {item.selectedAttributes && Object.keys(item.selectedAttributes).length > 0 && (
                        <Group gap={4} mt={2}>
                          {Object.entries(item.selectedAttributes).map(([key, value]) => (
                            <Badge key={key} size="xs" variant="outline">
                              {key}: {value}
                            </Badge>
                          ))}
                        </Group>
                      )}
                    </Grid.Col>

                    <Grid.Col span={{ base: 6, sm: 2 }}>
                      <Text size="sm" fw={500}>${item.price.toFixed(2)}</Text>
                    </Grid.Col>

                    <Grid.Col span={{ base: 4, sm: 2 }}>
                      <NumberInput
                        value={item.quantity}
                        onChange={(value) => handleItemQuantityChange(index, Number(value) || 1)}
                        min={1}
                        max={99}
                        size="xs"
                        styles={{ input: { textAlign: 'center' } }}
                      />
                    </Grid.Col>

                    <Grid.Col span={{ base: 6, sm: 1.5 }}>
                      <Text size="sm" fw={600}>${(item.price * item.quantity).toFixed(2)}</Text>
                    </Grid.Col>

                    <Grid.Col span={{ base: 6, sm: 0.5 }}>
                      <Button
                        variant="subtle"
                        color="red"
                        size="xs"
                        onClick={() => removeOrderItem(index)}
                      >
                        <IconTrash size="1rem" />
                      </Button>
                    </Grid.Col>
                  </Grid>
                </Paper>
              ))}
            </Stack>

            <Divider my="md" />
            <Group justify="space-between">
              <Text fw={600}>Total Amount:</Text>
              <Text fw={700} size="lg" c="blue">${form.values.orderItems.reduce((total, item) => total + (item.price * item.quantity), 0).toFixed(2)}</Text>
            </Group>
          </Card>
        )}

        {form.values.orderItems.length === 0 && (
          <Alert icon={<IconAlertCircle size="1rem" />} color="yellow" mb="md">
            No products added yet. Search and select products above to add them to this order.
          </Alert>
        )}

        <Group justify="flex-end" mt="xl">
          <Button type="button" variant="default" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting} disabled={form.values.orderItems.length === 0}>
            Update Order {form.values.orderItems.length > 0 && `($${form.values.orderItems.reduce((total, item) => total + (item.price * item.quantity), 0).toFixed(2)})`}
          </Button>
        </Group>
      </Paper>

      {/* Variant/Attribute Selection Modal */}
      <Modal
        opened={showAttributeModal}
        onClose={() => {
          setShowAttributeModal(false);
          setSelectedVariant(null);
          setVariantPrice(0);
          setVariantSku('');
          setVariantStock(0);
          setVariantImage('');
        }}
        title={selectedProductForAttributes?.hasVariants ? "Select Product Variant" : "Select Product Attributes"}
        size="lg"
        centered
      >
        {selectedProductForAttributes && (
          <Stack gap="md">
            {/* Product Info Section */}
            <Group gap="md">
              <Image
                src={selectedProductForAttributes.hasVariants && variantImage ? variantImage : selectedProductForAttributes.images?.[0]}
                alt={selectedProductForAttributes.name}
                radius="sm"
                h={80}
                w={80}
                fit="cover"
                fallbackSrc="/placeholder-image.png"
              />
              <div>
                <Text fw={600}>{selectedProductForAttributes.name}</Text>
                <Text size="sm" c="dimmed">
                  SKU: {selectedProductForAttributes.hasVariants && variantSku ? variantSku : selectedProductForAttributes.sku}
                </Text>
                {selectedProductForAttributes.hasVariants ? (
                  <Text size="sm" c="blue">
                    {selectedVariant ? (
                      `$${variantPrice.toFixed(2)}`
                    ) : (
                      `$${selectedProductForAttributes.priceRange.min.toFixed(2)} - $${selectedProductForAttributes.priceRange.max.toFixed(2)}`
                    )}
                  </Text>
                ) : (
                  <Text size="sm" c="blue">${selectedProductForAttributes.price.toFixed(2)}</Text>
                )}
              </div>
            </Group>

            <Divider />

            {/* Quantity Input */}
            <NumberInput
              label="Quantity"
              value={tempQuantity}
              onChange={(value) => setTempQuantity(Number(value) || 1)}
              min={1}
              max={selectedProductForAttributes.hasVariants ? 
                (selectedVariant ? variantStock : selectedProductForAttributes.stockQuantity) : 
                selectedProductForAttributes.stockQuantity
              }
              description={
                selectedProductForAttributes.hasVariants ? (
                  (() => {
                    const requiredAttributes = Object.keys(selectedProductForAttributes.availableAttributes);
                    const allAttributesSelected = requiredAttributes.every(attr => tempAttributes[attr]);
                    
                    if (!allAttributesSelected) {
                      return `Please select all attributes to see variant stock`;
                    }
                    
                    return selectedVariant ? 
                      `Available: ${variantStock}` : 
                      `Selected combination not available`;
                  })()
                ) : 
                `Available: ${selectedProductForAttributes.stockQuantity}`
              }
              disabled={(() => {
                if (selectedProductForAttributes.hasVariants) {
                  const requiredAttributes = Object.keys(selectedProductForAttributes.availableAttributes);
                  const allAttributesSelected = requiredAttributes.every(attr => tempAttributes[attr]);
                  return !allAttributesSelected || !selectedVariant;
                }
                return false;
              })()}
              styles={{
                input: (() => {
                  if (selectedProductForAttributes.hasVariants) {
                    const requiredAttributes = Object.keys(selectedProductForAttributes.availableAttributes);
                    const allAttributesSelected = requiredAttributes.every(attr => tempAttributes[attr]);
                    if (!allAttributesSelected || !selectedVariant) {
                      return { 
                        backgroundColor: 'var(--mantine-color-gray-1)',
                        color: 'var(--mantine-color-gray-6)'
                      };
                    }
                  }
                  return {};
                })()
              }}
            />

            {/* Attribute Selection */}
            {Object.entries(selectedProductForAttributes.availableAttributes).map(([attrName, options]) => (
              <Select
                key={attrName}
                label={attrName}
                placeholder={`Select ${attrName.toLowerCase()}`}
                data={options.map(option => ({ value: option, label: option }))}
                value={tempAttributes[attrName] || ''}
                onChange={(value) => {
                  const newAttributes = { ...tempAttributes, [attrName]: value || '' };
                  setTempAttributes(newAttributes);
                  
                  // Update variant info if this is a variant product
                  if (selectedProductForAttributes.hasVariants) {
                    updateVariantInfo(selectedProductForAttributes, newAttributes);
                  }
                }}
                required
                withAsterisk
              />
            ))}

            {/* Variant Selection Feedback */}
            {selectedProductForAttributes.hasVariants && (
              <Paper withBorder p="sm" radius="sm">
                {(() => {
                  const requiredAttributes = Object.keys(selectedProductForAttributes.availableAttributes);
                  const selectedAttributeCount = Object.keys(tempAttributes).filter(attr => tempAttributes[attr]).length;
                  const allAttributesSelected = selectedAttributeCount === requiredAttributes.length;
                  
                  if (!allAttributesSelected) {
                    return (
                      <Group gap="xs" align="center">
                        <ThemeIcon size="sm" variant="light" radius="xl" color="orange">
                          <IconClock size="0.8rem" />
                        </ThemeIcon>
                        <Text size="sm" c="var(--mantine-color-orange-7)" fw={500}>
                          Please select all attributes ({selectedAttributeCount}/{requiredAttributes.length})
                        </Text>
                      </Group>
                    );
                  }
                  
                  return selectedVariant ? (
                    <Group gap="xs" align="center">
                      <ThemeIcon size="sm" variant="light" radius="xl" color="green">
                        <IconCheck size="0.8rem" />
                      </ThemeIcon>
                      <Text size="sm" c="var(--mantine-color-green-7)" fw={500}>Variant Available</Text>
                      <Text size="sm" c="var(--mantine-color-gray-6)">
                        Stock: {variantStock} | Price: ${variantPrice.toFixed(2)}
                      </Text>
                    </Group>
                  ) : (
                    <Group gap="xs" align="center">
                      <ThemeIcon size="sm" variant="light" radius="xl" color="red">
                        <IconAlertTriangle size="0.8rem" />
                      </ThemeIcon>
                      <Text size="sm" c="var(--mantine-color-red-7)" fw={500}>
                        Selected combination not available. Please try different attributes.
                      </Text>
                    </Group>
                  );
                })()}
              </Paper>
            )}

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => {
                setShowAttributeModal(false);
                setSelectedVariant(null);
                setVariantPrice(0);
                setVariantSku('');
                setVariantStock(0);
                setVariantImage('');
              }}>
                Cancel
              </Button>
              <Button 
                onClick={handleAttributeModalConfirm}
                disabled={(() => {
                  if (selectedProductForAttributes.hasVariants) {
                    const requiredAttributes = Object.keys(selectedProductForAttributes.availableAttributes);
                    const allAttributesSelected = requiredAttributes.every(attr => tempAttributes[attr]);
                    return !allAttributesSelected || !selectedVariant;
                  }
                  return false;
                })()}
              >
                {editingItemIndex !== null ? 'Update Item' : 'Add to Order'}
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Space h="xl" />
    </AdminLayout>
  );
}
