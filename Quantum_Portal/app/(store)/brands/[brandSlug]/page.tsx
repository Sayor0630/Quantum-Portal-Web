import { Title, Text, Container, Paper, Group, SimpleGrid, Alert, Space } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Image from 'next/image';
import ProductCard from '../../_components/ProductCard';
import BreadcrumbsDisplay from '../../_components/BreadcrumbsDisplay';

interface Brand {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  isActive: boolean;
}

interface Product {
  _id: string;
  name: string;
  price: number;
  images?: string[];
  slug?: string;
  sku?: string;
  brand?: { _id: string; name: string; slug: string };
  category?: { _id: string; name: string; slug: string };
}

interface BrandPageData {
  brand: Brand | null;
  products: Product[];
}

async function getBrandData(brandSlug: string): Promise<BrandPageData> {
  const brandApiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/public/brands/${brandSlug}`;
  const productsApiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/public/products?brandSlug=${brandSlug}&limit=50`;

  try {
    const [brandRes, productsRes] = await Promise.all([
      fetch(brandApiUrl, { cache: 'no-store' }),
      fetch(productsApiUrl, { cache: 'no-store' })
    ]);

    let brand: Brand | null = null;
    if (brandRes.ok) {
      brand = await brandRes.json();
      if (!brand?.isActive) brand = null;
    }

    let products: Product[] = [];
    if (productsRes.ok) {
      const productsData = await productsRes.json();
      products = productsData.products || [];
    }

    return { brand, products };
  } catch (error) {
    console.error(`Error in getBrandData for slug "${brandSlug}":`, error);
    return { brand: null, products: [] };
  }
}

export async function generateMetadata({ params }: { params: { brandSlug: string } }): Promise<Metadata> {
  const { brand } = await getBrandData(params.brandSlug);
  if (!brand) return { title: 'Brand Not Found', description: 'The brand you are looking for could not be found.' };

  const siteName = process.env.SITE_NAME || "E-commerce Platform";
  const title = brand.name;
  const description = brand.description || `Explore products from ${brand.name} at ${siteName}.`;

  return {
    title: `${title} | ${siteName}`,
    description: description,
    openGraph: {
      title: title,
      description: description,
      type: 'website',
      url: `${process.env.NEXT_PUBLIC_APP_URL}/brands/${brand.slug}`
    },
  };
}

export default async function BrandPage({ params }: { params: { brandSlug: string } }) {
  const { brand, products } = await getBrandData(params.brandSlug);

  if (!brand) {
    notFound();
  }

  const breadcrumbItems = [
    { title: 'Home', href: '/' },
    { title: 'Brands', href: '/brands' },
    { title: brand.name, href: `/brands/${brand.slug}` }
  ];

  return (
    <Container size="xl" py="xl">
      <BreadcrumbsDisplay items={breadcrumbItems} />
      
      <Paper p="xl" mt="lg" radius="md" withBorder>
        <Group align="center" mb="xl">
          {brand.logoUrl && (
            <Image 
              src={brand.logoUrl} 
              alt={`${brand.name} logo`}
              width={80}
              height={80}
              style={{ objectFit: 'contain' }}
            />
          )}
          <div>
            <Title order={1}>{brand.name}</Title>
            {brand.description && (
              <Text size="lg" c="dimmed" mt="sm">
                {brand.description}
              </Text>
            )}
          </div>
        </Group>

        {products.length > 0 ? (
          <>
            <Title order={2} mb="lg">Products from {brand.name}</Title>
            <SimpleGrid 
              cols={{ base: 1, sm: 2, md: 3, lg: 4 }} 
              spacing="lg"
            >
              {products.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </SimpleGrid>
          </>
        ) : (
          <Alert 
            icon={<IconAlertCircle size="1rem" />} 
            title="No Products Available" 
            color="blue"
            mt="xl"
          >
            <Text>
              There are currently no products available from {brand.name}. 
              Please check back later for new arrivals!
            </Text>
          </Alert>
        )}
      </Paper>
      
      <Space h="xl" />
    </Container>
  );
}
