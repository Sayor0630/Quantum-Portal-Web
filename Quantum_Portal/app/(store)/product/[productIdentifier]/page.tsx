// app/(store)/product/[productIdentifier]/page.tsx
import { Title, Text, Container, Paper, Group, Button, Badge, SimpleGrid, Image as MantineImage, Accordion, Space, Divider, Box, Alert, Rating, NumberInput, Grid, Table } from '@mantine/core'; // Removed Mantine Breadcrumbs, Anchor
import { IconShoppingCartPlus, IconStarFilled, IconAlertCircle } from '@tabler/icons-react'; // Removed IconHome
// StoreLayout is applied by app/(store)/layout.tsx
import { notFound } from 'next/navigation';
import Link from 'next/link'; // Still needed if BreadcrumbsDisplay uses it, or for other links
import { Metadata } from 'next';

// Import new breadcrumb components and utilities
import BreadcrumbsDisplay from '../../_components/BreadcrumbsDisplay';
import { generateProductBreadcrumbs, BreadcrumbProductData, BreadcrumbNestedCategory } from '../../../../lib/breadcrumbsUtils'; // Adjust path
import VariantSelector from '../_components/VariantSelector';
import AddToCartClient from '../_components/AddToCartClient';

// Product Variant Interface
interface ProductVariant {
    _id?: string;
    attributeCombination: { [key: string]: string };
    sku?: string;
    price?: number;
    stockQuantity: number;
    isActive: boolean;
}

// Updated Interfaces to use/align with Breadcrumb types
interface ProductImage { url: string; public_id?: string; }
// Use BreadcrumbNestedCategory for product.category
interface Product extends BreadcrumbProductData { // Extends BreadcrumbProductData
    _id: string;
    // name: string; // from BreadcrumbProductData
    // category?: BreadcrumbNestedCategory | null; // from BreadcrumbProductData
    brand?: { _id: string; name: string; slug: string } | null;
    description?: string;
    price: number;
    sku?: string;
    images?: string[];
    customAttributes?: Record<string, string>;
    tags?: string[];
    seoTitle?: string; seoDescription?: string;
    isPublished?: boolean;
    stockQuantity?: number;
    slug?: string; // For generateMetadata URL
    hasVariants?: boolean;
    attributeDefinitions?: { [key: string]: string[] };
    variants?: ProductVariant[];
}
interface PageSectionLayout { sectionId: string; name: string; }
interface ProductPageData { product: Product | null; layout: { sections: PageSectionLayout[] } | null; }

async function getProductData(identifier: string): Promise<ProductPageData> {
    const productApiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/public/products/${identifier}`;
    const layoutApiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/public/product-page-layout`;

    try {
        const [productRes, layoutRes] = await Promise.all([
            fetch(productApiUrl, { cache: 'no-store' }),
            fetch(layoutApiUrl, { next: { revalidate: 3600 } })
        ]);

        let product: Product | null = null;
        if (productRes.ok) {
            product = await productRes.json();
            if (!product?.isPublished) product = null;
            if (product?.category && product.category.isPublished === false) {
                // If main category is unpublished, we might still show the product but not its category path
                // Or treat product as not found. For now, let's nullify category for breadcrumbs.
                if (product) product.category = undefined;
            }
        } else if (productRes.status === 404) {
            product = null;
        } else {
            console.error(`Failed to fetch product "${identifier}": ${productRes.status}`);
        }

        const layoutData = layoutRes.ok ? await layoutRes.json() : null;
        const layoutSections = (layoutData?.sections && layoutData.sections.length > 0) ? layoutData.sections : getDefaultProductPageLayout();

        return { product, layout: { sections: layoutSections } };
    } catch (error) {
        console.error(`Error in getProductData for identifier "${identifier}":`, error);
        return { product: null, layout: { sections: getDefaultProductPageLayout() } };
    }
}

export async function generateMetadata({ params }: { params: { productIdentifier: string } }): Promise<Metadata> {
  const { product } = await getProductData(params.productIdentifier);
  if (!product) return { title: 'Product Not Found', description: 'The product you are looking for could not be found.' };

  const siteName = process.env.SITE_NAME || "E-commerce Platform";
  const title = product.seoTitle || product.name;
  const description = product.seoDescription || product.description?.substring(0, 160) || `Check out ${product.name} at ${siteName}.`;
  const imageUrl = product.images && product.images.length > 0 ? product.images[0] : undefined;
  const productUrlPath = product.slug || product._id; // Prefer slug for canonical URL

  return {
    title: `${title} | ${siteName}`,
    description: description,
    openGraph: imageUrl ? {
        title: title,
        description: description,
        images: [{ url: imageUrl, width: 800, height: 600, alt: product.name }],
        type: 'website',
        url: `${process.env.NEXT_PUBLIC_APP_URL}/product/${productUrlPath}`
     } : undefined,
  };
}

// Section Components (remain the same)
const ProductImagesSection = ({ product }: { product: Product }) => (
    <Paper p="md" radius="sm" mb="lg" withBorder={false}>
        {product.images && product.images.length > 0 ? (
            <SimpleGrid cols={1} spacing="sm">
                <MantineImage src={product.images[0]} alt={`Main image of ${product.name}`} radius="md" style={{ border: '1px solid var(--mantine-color-gray-2)' }}/>
                {product.images.length > 1 && (
                    <Group gap="xs" mt="xs">
                        {product.images.slice(1, 5).map((imgUrl, idx) => (
                            <MantineImage key={idx} src={imgUrl} alt={`Thumbnail ${idx+1} of ${product.name}`} width={80} height={80} fit="contain" radius="sm" style={{border: '1px solid var(--mantine-color-gray-3)', cursor: 'pointer'}} />
                        ))}
                    </Group>
                )}
            </SimpleGrid>
        ) : <Box style={{height: 300, display:'flex', alignItems:'center', justifyContent:'center', background: 'var(--mantine-color-gray-1)', borderRadius:'var(--mantine-radius-md)'}}><Text c="dimmed">No images available.</Text></Box>}
    </Paper>
);
const ProductHeaderSection = ({ product }: { product: Product }) => {
  const getDisplayPrice = () => {
    if (product.hasVariants && product.variants && product.variants.length > 0) {
      const activePrices = product.variants
        .filter(v => v.isActive && v.stockQuantity > 0)
        .map(v => v.price || product.price);
      
      if (activePrices.length === 0) return `$${product.price.toFixed(2)}`;
      
      const minPrice = Math.min(...activePrices);
      const maxPrice = Math.max(...activePrices);
      
      if (minPrice === maxPrice) {
        return `$${minPrice.toFixed(2)}`;
      } else {
        return `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;
      }
    }
    return `$${product.price.toFixed(2)}`;
  };

  const getStockStatus = () => {
    if (product.hasVariants && product.variants) {
      const totalStock = product.variants
        .filter(v => v.isActive)
        .reduce((sum, v) => sum + v.stockQuantity, 0);
      return totalStock;
    }
    return product.stockQuantity || 0;
  };

  return (
    <Box mb="lg">
      <Title order={1} lineClamp={2}>{product.name}</Title>
      {product.brand && (
        <Text size="sm" c="dimmed" mt={4}>
          by <Text component="span" fw={500}>{product.brand.name}</Text>
        </Text>
      )}
      {!product.hasVariants && product.sku && <Text size="xs" c="dimmed" mt={4}>SKU: {product.sku}</Text>}
      <Group justify="space-between" align="center" mt="md">
          <Text size="xl" fw={700} c="blue.7">{getDisplayPrice()}</Text>
          <Group gap="xs" align="center">
              <Rating value={0} fractions={2} readOnly />
              <Text size="sm" c="dimmed">(No reviews yet)</Text>
          </Group>
      </Group>
      {getStockStatus() === 0 && (
        <Badge color="red" variant="light" mt="xs">Out of Stock</Badge>
      )}
    </Box>
  );
};
const ProductDescriptionSection = ({ product }: { product: Product }) => (
  product.description ? <Paper p="md" mt="lg" withBorder radius="sm"><Title order={4} mb="sm">Description</Title><Text style={{whiteSpace: 'pre-line'}}>{product.description}</Text></Paper> : null
);
const CustomAttributesSection = ({ product }: { product: Product }) => {
    // Don't show custom attributes for variant products
    if (product.hasVariants) return null;
    
    if (!product.customAttributes || Object.keys(product.customAttributes).length === 0) return null;
    return (
        <Paper p="md" mt="lg" withBorder radius="sm">
            <Title order={4} mb="sm">Specifications</Title>
            <Table verticalSpacing="xs" striped>
                <Table.Tbody>
                {Object.entries(product.customAttributes).map(([key, value]) => (
                    <Table.Tr key={key}><Table.Td fw={500} style={{width: '30%'}}>{key}</Table.Td><Table.Td>{value}</Table.Td></Table.Tr>
                ))}
                </Table.Tbody>
            </Table>
        </Paper>
    );
};
const AddToCartSection = ({ product }: { product: Product }) => (
  <AddToCartClient product={product} />
);
const ReviewsSection = ({ product }: { product: Product }) => ( <Paper p="md" mt="lg" withBorder radius="sm"><Title order={4} mb="sm">Customer Reviews</Title><Text c="dimmed">Reviews section coming soon.</Text></Paper>);
const RelatedProductsSection = ({ product }: { product: Product }) => ( <Paper p="md" mt="xl" withBorder radius="sm"><Title order={4} mb="sm">Related Products</Title><Text c="dimmed">Related products coming soon.</Text></Paper>);

const getDefaultProductPageLayout = (): PageSectionLayout[] => [
    { sectionId: 'images', name: 'Product Images' }, { sectionId: 'titlePrice', name: 'Title & Price' },
    { sectionId: 'description', name: 'Product Description'}, { sectionId: 'attributes', name: 'Custom Attributes' },
    { sectionId: 'actions', name: 'Add to Cart Actions' }, { sectionId: 'reviews', name: 'Customer Reviews' },
    { sectionId: 'relatedProducts', name: 'Related Products' },
  ].map((s, i) => ({...s, order: i, isVisible: true}));


export default async function ProductDetailPage({ params }: { params: { productIdentifier: string } }) {
  const { product, layout } = await getProductData(params.productIdentifier);

  if (!product) notFound();

  const breadcrumbItems = generateProductBreadcrumbs(product); // Use the new utility
  const sections = layout?.sections || getDefaultProductPageLayout();

  const sectionComponents: Record<string, React.FC<{ product: Product }>> = {
    'images': ProductImagesSection, 'titlePrice': ProductHeaderSection,
    'description': ProductDescriptionSection, 'attributes': CustomAttributesSection,
    'actions': AddToCartSection, 'reviews': ReviewsSection, 'relatedProducts': RelatedProductsSection,
  };

  const mainContentSectionIds = ['images', 'description', 'attributes', 'reviews'];
  const sidebarSectionIds = ['titlePrice', 'actions'];

  return (
    <Container py="md" fluid px="lg" mt="var(--header-height, 70px)">
      <BreadcrumbsDisplay items={breadcrumbItems} /> {/* Use the new component */}
      <Space h="lg"/>

      <Grid gutter="xl">
        <Grid.Col span={{ base: 12, lg: 8 }}>
            {sections.filter(s => mainContentSectionIds.includes(s.sectionId)).map(section => {
                const Component = sectionComponents[section.sectionId];
                return Component ? <Component key={section.sectionId} product={product} /> : null;
            })}
            {!sections.find(s=>s.sectionId==='description') && product.description && <ProductDescriptionSection product={product} />}
            {!sections.find(s=>s.sectionId==='attributes') && product.customAttributes && Object.keys(product.customAttributes).length > 0 && <CustomAttributesSection product={product} />}
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
            {sections.filter(s => sidebarSectionIds.includes(s.sectionId)).map(section => {
                const Component = sectionComponents[section.sectionId];
                return Component ? <Component key={section.sectionId} product={product} /> : null;
            })}
            {!sections.find(s => s.sectionId === 'titlePrice') && <ProductHeaderSection product={product} />}
            {!sections.find(s => s.sectionId === 'actions') && <AddToCartSection product={product} />}
        </Grid.Col>
      </Grid>
      <Space h="xl"/>

      {sections.filter(s => !mainContentSectionIds.includes(s.sectionId) && !sidebarSectionIds.includes(s.sectionId)).map(section => {
            const Component = sectionComponents[section.sectionId];
            return Component ? <Component key={section.sectionId} product={product} /> : null;
      })}
      {!sections.find(s => s.sectionId === 'relatedProducts') && <RelatedProductsSection product={product} />}
      <Space h="xl" />
    </Container>
  );
}
