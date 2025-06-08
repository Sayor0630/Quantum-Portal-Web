'use client';

import AdminLayout from '../../../../components/admin/AdminLayout';
import { 
  Title, Text, Paper, Group, Button, LoadingOverlay, Alert, Badge, 
  SimpleGrid, Image, Stack, Divider, Table, Tabs, Space, Box,
  ActionIcon, Tooltip, CopyButton, Modal, Card, ScrollArea
} from '@mantine/core';
import { 
  IconArrowLeft, IconEdit, IconEye, IconAlertCircle, IconCalendar, 
  IconTag, IconPackage, IconCoin, IconCheck, IconCopy, IconX,
  IconStar, IconShoppingCart, IconCategory, IconBrandProducthunt,
  IconPhoto, IconExternalLink, IconChevronLeft, IconChevronRight,
  IconShoppingCart as IconOrders, IconUser, IconReceipt
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

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

interface ProductVariant {
  _id?: string;
  attributeCombination: { [key: string]: string };
  sku?: string;
  price?: number;
  stockQuantity: number;
  isActive: boolean;
  images?: Array<{ url: string; public_id: string }>;
}

interface RecentOrder {
  _id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerId: string;
  status: string;
  createdAt: string;
  variants: Array<{
    variantId?: string;
    isVariantProduct: boolean;
    selectedAttributes?: { [key: string]: string } | null;
    variantSku?: string;
    quantity: number;
    totalAmount: number;
  }>;
}

interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  sku?: string;
  stockQuantity: number;
  category?: ProductCategory;
  brand: ProductBrand;
  images?: string[];
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  isPublished: boolean;
  hasVariants?: boolean;
  attributeDefinitions?: { [key: string]: string[] };
  variants?: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export default function ProductDetailsPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const productId = params?.productId as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageModalOpened, setImageModalOpened] = useState(false);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/admin/login');
      return;
    }

    if (authStatus === 'authenticated' && productId) {
      fetchProductDetails();
    }
  }, [authStatus, productId, router]);

  const fetchProductDetails = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/admin/products/${productId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch product details');
      }
      
      const productData = await response.json();
      setProduct(productData);
      
      // Fetch recent orders for this product
      fetchRecentOrders();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecentOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const response = await fetch(`/api/admin/products/${productId}/orders?limit=5`);
      if (response.ok) {
        const ordersData = await response.json();
        setRecentOrders(ordersData.orders || []);
      }
    } catch (err) {
      console.error('Failed to fetch recent orders:', err);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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

  const calculateTotalStock = () => {
    if (!product) return 0;
    
    if (product.hasVariants && product.variants) {
      return product.variants
        .filter(variant => variant.isActive)
        .reduce((total, variant) => total + variant.stockQuantity, 0);
    }
    
    return product.stockQuantity;
  };

  const getPriceRange = () => {
    if (!product || !product.hasVariants || !product.variants) {
      return product ? `$${product.price.toFixed(2)}` : '$0.00';
    }

    const prices = product.variants
      .filter(variant => variant.isActive)
      .map(variant => variant.price || product.price);
    
    if (prices.length === 0) return `$${product.price.toFixed(2)}`;
    
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    if (minPrice === maxPrice) {
      return `$${minPrice.toFixed(2)}`;
    }
    
    return `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;
  };

  // Get all images (base product + variant images)
  const getAllProductImages = () => {
    const allImages: Array<{ url: string; type: 'base' | 'variant'; variantInfo?: string }> = [];
    
    // Add base product images
    if (product?.images && product.images.length > 0) {
      allImages.push(...product.images.map(url => ({ url, type: 'base' as const })));
    }
    
    // Add variant images
    if (product?.hasVariants && product.variants) {
      product.variants.forEach(variant => {
        if (variant.images && variant.images.length > 0 && variant.isActive) {
          const variantInfo = Object.entries(variant.attributeCombination)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
          
          allImages.push(...variant.images.map(image => ({
            url: image.url,
            type: 'variant' as const,
            variantInfo
          })));
        }
      });
    }
    
    return allImages;
  };

  if (authStatus === 'loading' || (isLoading && authStatus === 'authenticated')) {
    return (
      <AdminLayout>
        <LoadingOverlay visible={true} overlayProps={{ radius: 'sm', blur: 2, fixed: true }} />
      </AdminLayout>
    );
  }

  if (authStatus === 'unauthenticated') {
    return <Text p="xl">Redirecting to login...</Text>;
  }

  if (error && !product) {
    return (
      <AdminLayout>
        <Alert title="Error Loading Product" color="red" icon={<IconAlertCircle />}>
          {error}
        </Alert>
      </AdminLayout>
    );
  }

  if (!product) {
    return (
      <AdminLayout>
        <Text p="xl" ta="center">Product not found or still loading...</Text>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Group justify="space-between" mb="xl">
        <Group>
          <Button 
            variant="outline" 
            onClick={() => router.push('/admin/products')} 
            leftSection={<IconArrowLeft size={16}/>}
          >
            Back to Products
          </Button>
          <Title order={2}>Product Details</Title>
        </Group>
        <Group>
          <Button 
            component={Link} 
            href={`/admin/products/edit/${product._id}`}
            leftSection={<IconEdit size={16}/>}
          >
            Edit Product
          </Button>
          <Button 
            variant="light"
            component={Link} 
            href={`/product/${product.slug}`}
            leftSection={<IconEye size={16}/>}
            target="_blank"
          >
            View on Store
          </Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
        {/* Basic Information */}
        <Paper withBorder shadow="sm" p="md" radius="md">
          <Group justify="space-between" mb="md">
            <Title order={4}>Basic Information</Title>
            <Badge 
              color={product.isPublished ? 'green' : 'red'} 
              variant="light"
              leftSection={product.isPublished ? <IconCheck size={14} /> : <IconX size={14} />}
            >
              {product.isPublished ? 'Published' : 'Draft'}
            </Badge>
          </Group>
          
          <Stack gap="sm">
            <Box>
              <Text size="sm" fw={500} c="dimmed">Product Name</Text>
              <Text size="lg" fw={600}>{product.name}</Text>
            </Box>
            
            <Box>
              <Text size="sm" fw={500} c="dimmed">Slug</Text>
              <Group gap="xs">
                <Text size="sm" ff="monospace">{product.slug}</Text>
                <CopyButton value={product.slug}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? 'Copied' : 'Copy slug'}>
                      <ActionIcon
                        color={copied ? 'teal' : 'gray'}
                        variant="subtle"
                        onClick={copy}
                        size="sm"
                      >
                        {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
            </Box>

            <Box>
              <Text size="sm" fw={500} c="dimmed">Description</Text>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{product.description}</Text>
            </Box>

            <SimpleGrid cols={2} spacing="sm">
              <Box>
                <Text size="sm" fw={500} c="dimmed">Price</Text>
                <Text size="lg" fw={600} c="blue">{getPriceRange()}</Text>
              </Box>
              <Box>
                <Text size="sm" fw={500} c="dimmed">Stock</Text>
                <Text size="lg" fw={600} c={calculateTotalStock() > 0 ? 'green' : 'red'}>
                  {calculateTotalStock()} units
                </Text>
              </Box>
            </SimpleGrid>

            {product.sku && (
              <Box>
                <Text size="sm" fw={500} c="dimmed">SKU</Text>
                <Group gap="xs">
                  <Text size="sm" ff="monospace">{product.sku}</Text>
                  <CopyButton value={product.sku}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? 'Copied' : 'Copy SKU'}>
                        <ActionIcon
                          color={copied ? 'teal' : 'gray'}
                          variant="subtle"
                          onClick={copy}
                          size="sm"
                        >
                          {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                </Group>
              </Box>
            )}
          </Stack>
        </Paper>

        {/* Product Images */}
        <Paper withBorder shadow="sm" p="md" radius="md">
          <Group justify="space-between" mb="md">
            <Group>
              <IconPhoto size={20} />
              <Title order={4}>Product Images</Title>
            </Group>
            <Badge variant="light" size="sm">
              {(() => {
                const allImages = getAllProductImages();
                return `${allImages.length} ${allImages.length === 1 ? 'image' : 'images'}`;
              })()}
            </Badge>
          </Group>
          
          {(() => {
            const allImages = getAllProductImages();
            
            if (allImages.length > 0) {
              return (
                <Box>
                  {/* Main Featured Image */}
                  <Card 
                    withBorder 
                    mb="md" 
                    style={{ cursor: 'pointer' }}
                    onClick={() => setImageModalOpened(true)}
                  >
                    <Card.Section>
                      <Image
                        src={allImages[selectedImageIndex]?.url}
                        alt={`${product.name} - Main view`}
                        h={300}
                        fit="contain"
                        style={{ background: 'linear-gradient(45deg, #f8f9fa 25%, transparent 25%), linear-gradient(-45deg, #f8f9fa 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f8f9fa 75%), linear-gradient(-45deg, transparent 75%, #f8f9fa 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px' }}
                      />
                    </Card.Section>
                    <Card.Section p="xs" bg="gray.0">
                      <Group justify="space-between">
                        <Box>
                          <Text size="sm" c="dimmed">
                            Image {selectedImageIndex + 1} of {allImages.length}
                          </Text>
                          {allImages[selectedImageIndex]?.type === 'variant' && (
                            <Text size="xs" c="blue" fw={500}>
                              Variant: {allImages[selectedImageIndex]?.variantInfo}
                            </Text>
                          )}
                          {allImages[selectedImageIndex]?.type === 'base' && (
                            <Text size="xs" c="green" fw={500}>
                              Base Product Image
                            </Text>
                          )}
                        </Box>
                        <Group gap="xs">
                          <ActionIcon 
                            size="sm" 
                            variant="subtle"
                            disabled={selectedImageIndex === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedImageIndex(Math.max(0, selectedImageIndex - 1));
                            }}
                          >
                            <IconChevronLeft size={16} />
                          </ActionIcon>
                          <ActionIcon 
                            size="sm" 
                            variant="subtle"
                            disabled={selectedImageIndex === allImages.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedImageIndex(Math.min(allImages.length - 1, selectedImageIndex + 1));
                            }}
                          >
                            <IconChevronRight size={16} />
                          </ActionIcon>
                        </Group>
                      </Group>
                    </Card.Section>
                  </Card>

                  {/* Thumbnail Gallery */}
                  {allImages.length > 1 && (
                    <ScrollArea>
                      <Group gap="xs" wrap="nowrap" pb="xs">
                        {allImages.map((image, index) => (
                          <Card
                            key={`${image.type}-${index}`}
                            withBorder={selectedImageIndex === index}
                            style={{ 
                              cursor: 'pointer', 
                              minWidth: '80px',
                              border: selectedImageIndex === index ? '2px solid var(--mantine-color-blue-6)' : '1px solid var(--mantine-color-gray-3)',
                              position: 'relative'
                            }}
                            onClick={() => setSelectedImageIndex(index)}
                          >
                            <Image
                              src={image.url}
                              alt={`${product.name} thumbnail ${index + 1}`}
                              h={60}
                              w={60}
                              fit="cover"
                            />
                            {/* Image type indicator */}
                            <Badge
                              size="xs"
                              color={image.type === 'base' ? 'green' : 'blue'}
                              style={{
                                position: 'absolute',
                                top: 2,
                                right: 2,
                                fontSize: '8px',
                                padding: '2px 4px'
                              }}
                            >
                              {image.type === 'base' ? 'Base' : 'Var'}
                            </Badge>
                          </Card>
                        ))}
                      </Group>
                    </ScrollArea>
                  )}
                </Box>
              );
            } else {
              return (
                <Card withBorder style={{ textAlign: 'center' }} p="xl">
                  <IconPhoto size={48} color="var(--mantine-color-gray-5)" style={{ margin: '0 auto 16px' }} />
                  <Text c="dimmed" size="lg" fw={500}>No images uploaded</Text>
                  <Text c="dimmed" size="sm">Add images in the edit product page</Text>
                </Card>
              );
            }
          })()}
        </Paper>
      </SimpleGrid>

      <Space h="xl" />

      {/* Category and Brand Information */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl">
        <Paper withBorder shadow="sm" p="md" radius="md">
          <Group mb="md">
            <IconCategory size={20} />
            <Title order={4}>Category</Title>
          </Group>
          {product.category ? (
            <Box>
              <Text fw={500}>{product.category.name}</Text>
              <Text size="sm" c="dimmed" ff="monospace">/{product.category.slug}</Text>
            </Box>
          ) : (
            <Text c="dimmed">No category assigned</Text>
          )}
        </Paper>

        <Paper withBorder shadow="sm" p="md" radius="md">
          <Group mb="md">
            <IconBrandProducthunt size={20} />
            <Title order={4}>Brand</Title>
          </Group>
          <Box>
            <Text fw={500}>{product.brand.name}</Text>
            <Text size="sm" c="dimmed" ff="monospace">/{product.brand.slug}</Text>
          </Box>
        </Paper>
      </SimpleGrid>

      <Space h="xl" />

      {/* Tags */}
      {product.tags && product.tags.length > 0 && (
        <>
          <Paper withBorder shadow="sm" p="md" radius="md">
            <Group mb="md">
              <IconTag size={20} />
              <Title order={4}>Tags</Title>
            </Group>
            <Group gap="xs">
              {product.tags.map((tag, index) => (
                <Badge key={index} variant="light" size="sm">
                  {tag}
                </Badge>
              ))}
            </Group>
          </Paper>
          <Space h="xl" />
        </>
      )}

      {/* Variants Section */}
      {product.hasVariants && (
        <>
          <Paper withBorder shadow="sm" p="md" radius="md">
            <Title order={4} mb="md">Product Variants</Title>
            
            {/* Attribute Definitions */}
            {product.attributeDefinitions && Object.keys(product.attributeDefinitions).length > 0 && (
              <Box mb="lg">
                <Text fw={500} mb="sm">Available Attributes:</Text>
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
                  {Object.entries(product.attributeDefinitions).map(([attrName, values]) => (
                    <Box key={attrName}>
                      <Text size="sm" fw={500} c="dimmed">{attrName}</Text>
                      <Group gap="xs">
                        {values.map((value, index) => (
                          <Badge key={index} size="xs" variant="outline">
                            {value}
                          </Badge>
                        ))}
                      </Group>
                    </Box>
                  ))}
                </SimpleGrid>
              </Box>
            )}

            {/* Variants Table */}
            {product.variants && product.variants.length > 0 ? (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Attributes</Table.Th>
                    <Table.Th>SKU</Table.Th>
                    <Table.Th>Price</Table.Th>
                    <Table.Th>Stock</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {product.variants.map((variant, index) => (
                    <Table.Tr key={variant._id || index}>
                      <Table.Td>
                        <Group gap="xs">
                          {Object.entries(variant.attributeCombination).map(([key, value]) => (
                            <Badge key={key} size="xs" variant="light">
                              {key}: {value}
                            </Badge>
                          ))}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" ff="monospace">{variant.sku || '-'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">${(variant.price || product.price).toFixed(2)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c={variant.stockQuantity > 0 ? 'green' : 'red'}>
                          {variant.stockQuantity}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge 
                          color={variant.isActive ? 'green' : 'red'} 
                          size="sm"
                          variant="light"
                        >
                          {variant.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text c="dimmed" ta="center" py="md">No variants configured</Text>
            )}
          </Paper>
          <Space h="xl" />
        </>
      )}

      {/* SEO Information */}
      <Paper withBorder shadow="sm" p="md" radius="md">
        <Title order={4} mb="md">SEO Information</Title>
        <Stack gap="sm">
          <Box>
            <Text size="sm" fw={500} c="dimmed">SEO Title</Text>
            <Text size="sm">{product.seoTitle || product.name}</Text>
          </Box>
          <Box>
            <Text size="sm" fw={500} c="dimmed">SEO Description</Text>
            <Text size="sm">{product.seoDescription || product.description.substring(0, 160) + '...'}</Text>
          </Box>
        </Stack>
      </Paper>

      <Space h="xl" />

      {/* Recent Orders Section */}
      <Paper withBorder shadow="sm" p="md" radius="md">
        <Group justify="space-between" mb="md">
          <Group>
            <IconOrders size={20} />
            <Title order={4}>Recent Orders</Title>
          </Group>
          <Button
            variant="light"
            size="sm"
            component={Link}
            href={`/admin/products/${product._id}/customers`}
            rightSection={<IconExternalLink size={14} />}
          >
            View Customers
          </Button>
        </Group>
        
        {isLoadingOrders ? (
          <LoadingOverlay visible={true} overlayProps={{ radius: 'sm', blur: 1 }} />
        ) : recentOrders.length > 0 ? (
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
              {recentOrders.flatMap((order, orderIndex) => 
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
                    <Table.Td>
                      <Text size="sm" fw={500}>${variant.totalAmount.toFixed(2)}</Text>
                    </Table.Td>
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
                            {new Date(order.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
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
                              aria-label={`View order ${order.orderNumber}`}
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
        ) : (
          <Box ta="center" py="xl">
            <IconOrders size={48} color="var(--mantine-color-gray-5)" style={{ margin: '0 auto 16px' }} />
            <Text c="dimmed" size="lg" fw={500}>No orders yet</Text>
            <Text c="dimmed" size="sm">This product hasn&apos;t been ordered yet</Text>
          </Box>
        )}
      </Paper>

      <Space h="xl" />

      {/* Timestamps */}
      <Paper withBorder shadow="sm" p="md" radius="md">
        <Group mb="md">
          <IconCalendar size={20} />
          <Title order={4}>Timeline</Title>
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Box>
            <Text size="sm" fw={500} c="dimmed">Created</Text>
            <Text size="sm">{formatDate(product.createdAt)}</Text>
          </Box>
          <Box>
            <Text size="sm" fw={500} c="dimmed">Last Updated</Text>
            <Text size="sm">{formatDate(product.updatedAt)}</Text>
          </Box>
        </SimpleGrid>
      </Paper>

      <Space h="xl" />

      {/* Image Modal */}
      <Modal
        opened={imageModalOpened}
        onClose={() => setImageModalOpened(false)}
        size="xl"
        title={(() => {
          const allImages = getAllProductImages();
          const currentImage = allImages[selectedImageIndex];
          return (
            <Group gap="xs">
              <Text fw={500}>{product.name} - Image {selectedImageIndex + 1} of {allImages.length}</Text>
              {currentImage?.type === 'variant' && (
                <Badge size="sm" color="blue" variant="light">
                  Variant: {currentImage.variantInfo}
                </Badge>
              )}
              {currentImage?.type === 'base' && (
                <Badge size="sm" color="green" variant="light">
                  Base Product
                </Badge>
              )}
            </Group>
          );
        })()}
        centered
      >
        {(() => {
          const allImages = getAllProductImages();
          if (allImages.length > 0) {
            return (
              <Box>
                <Image
                  src={allImages[selectedImageIndex]?.url}
                  alt={`${product.name} - Full size view`}
                  fit="contain"
                  style={{ maxHeight: '70vh' }}
                />
                {allImages.length > 1 && (
                  <Group justify="center" mt="md">
                    <ActionIcon
                      variant="light"
                      disabled={selectedImageIndex === 0}
                      onClick={() => setSelectedImageIndex(Math.max(0, selectedImageIndex - 1))}
                    >
                      <IconChevronLeft size={16} />
                    </ActionIcon>
                    <Text size="sm" c="dimmed">
                      {selectedImageIndex + 1} / {allImages.length}
                    </Text>
                    <ActionIcon
                      variant="light"
                      disabled={selectedImageIndex === allImages.length - 1}
                      onClick={() => setSelectedImageIndex(Math.min(allImages.length - 1, selectedImageIndex + 1))}
                    >
                      <IconChevronRight size={16} />
                    </ActionIcon>
                  </Group>
                )}
              </Box>
            );
          }
          return null;
        })()}
      </Modal>
    </AdminLayout>
  );
}
