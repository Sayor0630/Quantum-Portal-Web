// app/(store)/brands/page.tsx
import { Title, Text, Container, SimpleGrid, Card, Group, Avatar, Anchor, Space } from '@mantine/core';
import { Metadata } from 'next';
import Link from 'next/link';
import BreadcrumbsDisplay from '../_components/BreadcrumbsDisplay';

interface Brand {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  isActive: boolean;
}

interface BrandsResponse {
  brands: Brand[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

async function getBrands(): Promise<Brand[]> {
  const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/public/brands?limit=100`;
  
  try {
    const res = await fetch(apiUrl, { cache: 'no-store' });
    if (!res.ok) {
      console.error(`Failed to fetch brands: ${res.status}`);
      return [];
    }
    const data: BrandsResponse = await res.json();
    return data.brands || [];
  } catch (error) {
    console.error('Error in getBrands:', error);
    return [];
  }
}

export const metadata: Metadata = {
  title: `Brands | ${process.env.SITE_NAME || "E-commerce Platform"}`,
  description: 'Explore all brands available in our store.',
  openGraph: {
    title: 'Brands',
    description: 'Explore all brands available in our store.',
    type: 'website',
    url: `${process.env.NEXT_PUBLIC_APP_URL}/brands`
  },
};

export default async function BrandsPage() {
  const brands = await getBrands();

  const breadcrumbItems = [
    { title: 'Home', href: '/' },
    { title: 'Brands', href: '/brands' }
  ];

  return (
    <Container size="xl" py="xl">
      <BreadcrumbsDisplay items={breadcrumbItems} />
      
      <Space h="lg" />
      
      <Title order={1} mb="md">All Brands</Title>
      <Text size="lg" c="dimmed" mb="xl">
        Discover products from our trusted brand partners
      </Text>

      {brands.length > 0 ? (
        <SimpleGrid 
          cols={{ base: 1, sm: 2, md: 3, lg: 4 }} 
          spacing="lg"
        >
          {brands.map((brand) => (
            <Card key={brand._id} shadow="sm" padding="lg" radius="md" withBorder component={Link} href={`/brands/${brand.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Card.Section p="md">
                <Group align="center" gap="md">
                  {brand.logoUrl ? (
                    <Avatar src={brand.logoUrl} size={60} radius="sm" />
                  ) : (
                    <Avatar size={60} radius="sm">{brand.name.charAt(0)}</Avatar>
                  )}
                  <div style={{ flex: 1 }}>
                    <Title order={3} size="h4" lineClamp={1}>
                      {brand.name}
                    </Title>
                    {brand.description && (
                      <Text size="sm" c="dimmed" lineClamp={2} mt="xs">
                        {brand.description}
                      </Text>
                    )}
                  </div>
                </Group>
              </Card.Section>
              
              {brand.website && (
                <Card.Section p="md" pt={0}>
                  <Anchor 
                    href={brand.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    size="sm"
                    onClick={(e) => e.stopPropagation()} // Prevent card link from triggering
                  >
                    Visit Website
                  </Anchor>
                </Card.Section>
              )}
            </Card>
          ))}
        </SimpleGrid>
      ) : (
        <Text size="lg" c="dimmed" ta="center" py="xl">
          No brands available at the moment.
        </Text>
      )}
    </Container>
  );
}
