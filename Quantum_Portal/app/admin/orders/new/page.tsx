'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminLayout from '../../../../components/admin/AdminLayout';
import { Title, Paper, TextInput, Textarea, Button, Group, Space, Text, Box, Select, LoadingOverlay, Grid, Loader, Alert, Autocomplete, ThemeIcon, Badge, Image, NumberInput, Modal, Stack, Divider, Card } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useDebouncedCallback } from '@mantine/hooks';
import { IconAlertCircle, IconSearch, IconUserCheck, IconPlus, IconTrash, IconShoppingCart, IconPackage, IconClock, IconCheck, IconAlertTriangle } from '@tabler/icons-react';

interface PaymentMethodOption {
  value: string;
  label: string;
}

interface FetchedPaymentMethod {
    _id: string;
    name: string;
    isEnabled: boolean;
    details?: string;
}

// Interface for Customer Address (matching Customer model)
interface ICustomerAddress {
    street: string;
    city: string;
    state?: string; // Equivalent to district for our form
    zipCode?: string; // Not directly used in form, but part of customer data
    country: string;
    isDefaultShipping?: boolean;
    isDefaultBilling?: boolean;
}

// Interface for the customer data returned by the search API
interface SearchCustomerData {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    fullName: string;
    displayText: string;
    addresses: ICustomerAddress[];
    isActive: boolean;
}

// Interface for product search results
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

// Interface for order items
interface OrderItem {
    productId: string;
    name: string;
    sku: string;
    price: number;
    quantity: number;
    image?: string;
    selectedAttributes: { [key: string]: string };
    subtotal: number;
    // Variant-specific fields
    variantId?: string;
    isVariantProduct: boolean;
}


export default function CreateOrderPage() {
  const router = useRouter();
  const [paymentMethodOptions, setPaymentMethodOptions] = useState<PaymentMethodOption[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(true);

  // State for customer search and selection
  const [customerSearchResults, setCustomerSearchResults] = useState<SearchCustomerData[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<SearchCustomerData | null>(null);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerSearchValue, setCustomerSearchValue] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // State for product search and selection
  const [productSearchResults, setProductSearchResults] = useState<SearchProductData[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [productSearchValue, setProductSearchValue] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [selectedProductForAttributes, setSelectedProductForAttributes] = useState<SearchProductData | null>(null);
  const [tempAttributes, setTempAttributes] = useState<{ [key: string]: string }>({});
  const [tempQuantity, setTempQuantity] = useState(1);
  
  // New state for variant selection
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [variantPrice, setVariantPrice] = useState<number>(0);
  const [variantSku, setVariantSku] = useState<string>('');
  const [variantStock, setVariantStock] = useState<number>(0);
  const [variantImage, setVariantImage] = useState<string>('');


  const form = useForm({
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
      selectedCustomerId: null as string | null, // To store ID if a looked-up customer is used
    },
    validate: {
      fullName: (value) => (value.trim().length > 0 ? null : 'Full name is required'),
      phoneNumber: (value) => {
        if (!value) return 'Phone number is required';
        if (!/^\d{11}$/.test(value)) return 'Phone number must be exactly 11 digits';
        if (!/^01/.test(value)) return 'Phone number must start with "01"';
        return null;
      },
      email: (value) => {
        // Email is optional unless used for lookup and a customer is not found,
        // then if user proceeds, it might become "required" in a sense or auto-filled.
        // For now, just format validation if provided.
        if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Invalid email address';
        }
        return null;
      },
      deliveryAddress: (value) => (value.trim().length > 0 ? null : 'Delivery address is required'),
      city: (value) => (value.trim().length > 0 ? null : 'City is required'),
      district: (value) => (value.trim().length > 0 ? null : 'District is required'),
      paymentMethod: (value) => (value ? null : 'Payment method is required'),
    },
  });

  // Live customer search with debouncing
  const handleCustomerSearch = useDebouncedCallback(async (searchValue: string) => {
    if (!searchValue.trim()) {
      setCustomerSearchResults([]);
      setCustomerSearchLoading(false);
      return;
    }

    if (searchValue.length < 3) {
      setCustomerSearchResults([]);
      return;
    }

    setCustomerSearchLoading(true);
    try {
      const response = await fetch(`/api/admin/customers/search?q=${encodeURIComponent(searchValue)}&limit=5`);
      const result = await response.json();

      if (response.ok && result.success) {
        setCustomerSearchResults(result.data || []);
      } else {
        console.error('Customer search failed:', result.message);
        setCustomerSearchResults([]);
      }
    } catch (error: any) {
      console.error('Customer search error:', error);
      setCustomerSearchResults([]);
    } finally {
      setCustomerSearchLoading(false);
    }
  }, 300);

  // Live product search with debouncing
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


  const fetchEnabledPaymentMethods = useCallback(async () => {
    setIsLoadingPaymentMethods(true);
    try {
      const response = await fetch('/api/admin/payment-methods');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch payment methods');
      }
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        const enabledMethods = result.data
          .filter((method: FetchedPaymentMethod) => method.isEnabled)
          .map((method: FetchedPaymentMethod) => ({
            value: method.name, // Using name as per Order model's paymentMethod field (string)
            label: method.name,
          }));
        setPaymentMethodOptions(enabledMethods);
        if (enabledMethods.length === 0) {
            notifications.show({
                title: 'No Payment Methods',
                message: 'There are no enabled payment methods configured. Please configure them in settings.',
                color: 'yellow',
            });
        }
      } else {
        throw new Error(result.message || 'Received invalid data for payment methods');
      }
    } catch (error: any) {
      console.error("Error fetching payment methods:", error);
      notifications.show({
        title: 'Error Fetching Payment Methods',
        message: error.message || 'Could not load payment options.',
        color: 'red',
      });
      setPaymentMethodOptions([]);
    } finally {
      setIsLoadingPaymentMethods(false);
    }
  }, []);

  useEffect(() => {
    fetchEnabledPaymentMethods();
  }, [fetchEnabledPaymentMethods]);

  const handleUseCustomerDetails = (customer: SearchCustomerData) => {
    form.setValues({
      ...form.values, // Preserve other form values like paymentMethod
      fullName: customer.fullName,
      email: customer.email,
      phoneNumber: customer.phoneNumber || form.values.phoneNumber,
      selectedCustomerId: customer._id, // Store the customer ID
    });

    if (customer.addresses && customer.addresses.length > 0) {
      // Use the first address, or try to find a default shipping address
      const addressToUse = customer.addresses.find(addr => addr.isDefaultShipping) || customer.addresses[0];
      if (addressToUse) {
        form.setValues({
          ...form.values, // Preserve again, setValues might overwrite if not careful
          fullName: customer.fullName,
          email: customer.email,
          phoneNumber: customer.phoneNumber || form.values.phoneNumber,
          selectedCustomerId: customer._id,
          deliveryAddress: addressToUse.street,
          city: addressToUse.city,
          district: addressToUse.state || '', // Map state to district
          country: addressToUse.country || 'Bangladesh', // Default if not present
          // postalCode: addressToUse.zipCode || '', // If we add postal code to form
        });
      }
    }
    setSelectedCustomer(customer);
    setSelectedCustomerId(customer._id); // Explicitly track selected customer
    setCustomerSearchValue(customer.displayText);
    setCustomerSearchResults([]); // Clear search results
    notifications.show({ 
      title: 'Details Applied', 
      message: 'Customer details have been populated into the form.', 
      color: 'teal',
      icon: <IconUserCheck size={18} />
    });
  };

  // Find matching variant based on selected attributes
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
      setShowAttributeModal(true);
    } else {
      // Product has no attributes or variants, add directly
      addProductToOrder(product, {}, 1);
    }
    // Clear search after selecting a product for clean interface
    setProductSearchValue('');
    setProductSearchResults([]);
  };

  // Add product to order items with smart duplicate detection
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
    const existingItemIndex = orderItems.findIndex(item => 
      item.productId === product._id && 
      JSON.stringify(item.selectedAttributes) === JSON.stringify(selectedAttributes) &&
      item.variantId === variantId
    );

    if (existingItemIndex >= 0) {
      const existingItem = orderItems[existingItemIndex];
      
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
          subtotal: finalPrice * quantity,
          isVariantProduct: product.hasVariants,
          variantId
        };
        setOrderItems([...orderItems, newItem]);
        notifications.show({
          title: 'Product Added',
          message: `${product.name} added as new item due to price/details changes`,
          color: 'blue'
        });
      } else {
        // Nothing changed, merge quantities
        const updatedItems = [...orderItems];
        updatedItems[existingItemIndex].quantity += quantity;
        updatedItems[existingItemIndex].subtotal = updatedItems[existingItemIndex].quantity * updatedItems[existingItemIndex].price;
        setOrderItems(updatedItems);
        notifications.show({
          title: 'Quantity Updated',
          message: `Increased quantity for ${product.name} (${updatedItems[existingItemIndex].quantity} total)`,
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
        subtotal: finalPrice * quantity,
        isVariantProduct: product.hasVariants,
        variantId
      };
      setOrderItems([...orderItems, newItem]);
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

    addProductToOrder(selectedProductForAttributes, tempAttributes, tempQuantity);
    setShowAttributeModal(false);
    setSelectedProductForAttributes(null);
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
    const updatedItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(updatedItems);
    notifications.show({
      title: 'Item Removed',
      message: 'Product removed from order',
      color: 'orange'
    });
  };

  // Update item quantity
  const updateItemQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeOrderItem(index);
      return;
    }

    const updatedItems = [...orderItems];
    updatedItems[index].quantity = newQuantity;
    updatedItems[index].subtotal = updatedItems[index].price * newQuantity;
    setOrderItems(updatedItems);
  };

  // Calculate total amount
  const calculateTotalAmount = () => {
    return orderItems.reduce((total, item) => total + item.subtotal, 0);
  };


  const handleSubmit = async (values: typeof form.values) => {
    // Validate that we have at least one order item
    if (orderItems.length === 0) {
      notifications.show({
        title: 'No Products',
        message: 'Please add at least one product to the order.',
        color: 'red'
      });
      return;
    }

    const totalAmount = calculateTotalAmount();

    // Create address object for both shipping and billing with all required fields
    const addressInfo = {
      fullName: values.fullName,
      phone: values.phoneNumber,
      email: values.email,
      street: values.deliveryAddress,
      city: values.city,
      district: values.district, 
      state: values.district, // Use district as state as well for compatibility
      postalCode: '0000', // Default postal code since it's not in the form
      country: values.country,
    };

    // Split full name into first and last name
    const nameParts = values.fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const apiPayload = {
      // Customer identification - use customerId if available, otherwise create new customer
      customerId: selectedCustomerId,
      customerFirstName: firstName,
      customerLastName: lastName,
      customerEmail: values.email,
      customerPhone: values.phoneNumber,
      
      // Address information - API requires both shipping and billing
      shippingAddress: addressInfo,
      billingAddress: addressInfo, // Use same address for billing
      
      paymentMethod: values.paymentMethod,
      notes: values.deliveryNote,
      
      orderItems: orderItems.map(item => ({
        product: item.productId, // API expects 'product' field
        name: item.name,
        sku: item.sku,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        selectedAttributes: item.selectedAttributes,
        isVariantProduct: item.isVariantProduct,
        variantId: item.variantId
      })),
      
      status: 'pending', // Default status
    };

    try {
      console.log('Order creation payload:', JSON.stringify(apiPayload, null, 2));
      
      const response = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
      });

      const result = await response.json();

      if (response.ok) {
        notifications.show({
          title: 'Order Created',
          message: 'Order has been successfully created.',
          color: 'green'
        });
        router.push('/admin/orders');
      } else {
        throw new Error(result.message || 'Failed to create order');
      }
    } catch (error: any) {
      console.error('Order creation error:', error);
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create order.',
        color: 'red'
      });
    }
  };

  return (
    <AdminLayout>
      <Title order={2} mb="xl">
        Create New Order
      </Title>

      <Paper component="form" onSubmit={form.onSubmit(handleSubmit)} shadow="sm" p="xl" radius="md" withBorder pos="relative">
        <LoadingOverlay visible={isLoadingPaymentMethods} overlayProps={{ blur: 2 }} />
        <Title order={4} mb="md">
          Customer Information
        </Title>

        <Autocomplete
          label="Customer Search"
          placeholder="Search by name, email, or phone..."
          value={customerSearchValue}
          onChange={(value) => {
            setCustomerSearchValue(value);
            handleCustomerSearch(value);
          }}
          data={customerSearchResults.map(customer => customer.displayText)}
          onOptionSubmit={(value) => {
            const customer = customerSearchResults.find(c => c.displayText === value);
            if (customer) {
              handleUseCustomerDetails(customer);
            }
          }}
          rightSection={customerSearchLoading ? <Loader size="xs" /> : <IconSearch size="1rem" />}
          comboboxProps={{ withinPortal: false }}
          maxDropdownHeight={200}
          limit={5}
          mb="sm"
          description="Search for existing customers to auto-fill their details"
        />

        {/* Show selected customer info */}
        {selectedCustomer && (
          <Paper withBorder shadow="sm" p="md" radius="md" my="sm">
            <Group gap="xs" mb="sm" align="center">
              <ThemeIcon variant="light" color="green" size="lg" radius="md">
                <IconUserCheck size="1.2rem" />
              </ThemeIcon>
              <div>
                <Text fw={700} size="sm" c="green.7">
                  Customer Selected
                </Text>
                <Text size="xs" c="dimmed">
                  Details have been applied to the form
                </Text>
              </div>
            </Group>
            
            <Group gap="xs" mb="xs">
              <Text size="sm" fw={500}>
                {selectedCustomer.fullName}
              </Text>
              <Text size="sm" c="dimmed">
                ({selectedCustomer.email})
              </Text>
            </Group>
            
            {selectedCustomer.phoneNumber && (
              <Text size="xs" c="dimmed" mb="xs">
                Phone: {selectedCustomer.phoneNumber}
              </Text>
            )}
            
            {selectedCustomer.addresses && selectedCustomer.addresses.length > 0 && (
              <Text size="xs" c="dimmed" mb="sm">
                Address: {selectedCustomer.addresses[0].street}, {selectedCustomer.addresses[0].city}
              </Text>
            )}
            
            <Button
              size="xs"
              variant="outline"
              color="red"
              onClick={() => {
                setSelectedCustomer(null);
                setSelectedCustomerId(null);
                setCustomerSearchValue('');
                // Clear form fields that were populated from customer
                form.setValues({
                  ...form.values,
                  fullName: '',
                  email: '',
                  phoneNumber: '',
                  deliveryAddress: '',
                  city: '',
                  district: '',
                  country: 'Bangladesh',
                  selectedCustomerId: null,
                });
              }}
            >
              Clear Selection
            </Button>
          </Paper>
        )}

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

        <Select
          label="Payment Method"
          placeholder="Select payment method"
          data={paymentMethodOptions}
          required
          mb="xl"
          {...form.getInputProps('paymentMethod')}
          disabled={isLoadingPaymentMethods || paymentMethodOptions.length === 0}
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
        {orderItems.length > 0 && (
          <Card withBorder shadow="sm" p="md" radius="md" mb="md">
            <Group gap="xs" mb="md" align="center">
              <ThemeIcon variant="light" color="blue" size="lg" radius="md">
                <IconShoppingCart size="1.2rem" />
              </ThemeIcon>
              <div>
                <Text fw={700} size="sm" c="blue.7">
                  Order Items ({orderItems.length})
                </Text>
                <Text size="xs" c="dimmed">
                  Total: ${calculateTotalAmount().toFixed(2)}
                </Text>
              </div>
            </Group>

            <Stack gap="sm">
              {orderItems.map((item, index) => (
                <Paper key={`${item.productId}-${JSON.stringify(item.selectedAttributes)}`} withBorder p="sm" radius="sm">
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
                      <Text size="xs" c="dimmed">SKU: {item.sku}</Text>
                      {item.isVariantProduct && item.variantId && (
                        <Badge size="xs" variant="light" color="blue" mt={2}>
                          Variant Product
                        </Badge>
                      )}
                      {Object.keys(item.selectedAttributes).length > 0 && (
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
                        onChange={(value) => updateItemQuantity(index, Number(value) || 1)}
                        min={1}
                        max={99}
                        size="xs"
                        styles={{ input: { textAlign: 'center' } }}
                      />
                    </Grid.Col>

                    <Grid.Col span={{ base: 6, sm: 1.5 }}>
                      <Text size="sm" fw={600}>${item.subtotal.toFixed(2)}</Text>
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
              <Text fw={700} size="lg" c="blue">${calculateTotalAmount().toFixed(2)}</Text>
            </Group>
          </Card>
        )}

        {orderItems.length === 0 && (
          <Alert icon={<IconAlertCircle size="1rem" />} color="yellow" mb="md">
            No products added yet. Search and select products above to add them to this order.
          </Alert>
        )}

        <Group justify="flex-end" mt="xl">
          <Button type="button" variant="default" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={orderItems.length === 0}>
            Create Order {orderItems.length > 0 && `($${calculateTotalAmount().toFixed(2)})`}
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
                        <ThemeIcon size="sm" variant="light" color="orange" radius="xl">
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
                      <ThemeIcon size="sm" variant="light" color="green" radius="xl">
                        <IconCheck size="0.8rem" />
                      </ThemeIcon>
                      <Text size="sm" c="var(--mantine-color-green-7)" fw={500}>Variant Available</Text>
                      <Text size="sm" c="var(--mantine-color-gray-6)">
                        Stock: {variantStock} | Price: ${variantPrice.toFixed(2)}
                      </Text>
                    </Group>
                  ) : (
                    <Group gap="xs" align="center">
                      <ThemeIcon size="sm" variant="light" color="red" radius="xl">
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
                Add to Order
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      <Space h="xl" />
    </AdminLayout>
  );
}
