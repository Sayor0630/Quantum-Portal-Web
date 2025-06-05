// app/(store)/page.tsx
import { Title, Text, Container, Space, Paper, Group, Button, Image, SimpleGrid, Box, Alert } from '@mantine/core';
import Link from 'next/link';
import { IconAlertCircle } from '@tabler/icons-react';

// Define interfaces for Homepage Sections and their content (should align with models)
interface SectionContentItem {
    itemId?: { _id: string; name: string; slug?: string; price?: number; images?: (string | {url: string})[] } | string; // Product/Category object or ID
    itemType?: 'Product' | 'Category' | 'CustomLink';
    imageUrl?: string;
    title?: string;
    subtitle?: string;
    link?: string;
    price?: number; // If directly on item, e.g. for Product items
}
interface SectionContent {
    title?: string; subtitle?: string; text?: string; imageUrl?: string; videoUrl?: string;
    buttonText?: string; buttonLink?: string; items?: SectionContentItem[]; htmlContent?: string;
}
interface HomepageSection {
    _id: string; name: string; type: string; isVisible: boolean; order: number; content: SectionContent;
}

async function getHomepageSections(): Promise<HomepageSection[]> {
    const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/public/homepage-sections`;
    try {
        const res = await fetch(apiUrl, { cache: 'no-store' }); // No cache for dynamic content
        if (!res.ok) {
            console.error(`Failed to fetch homepage sections: ${res.status} ${await res.text()}`);
            return [];
        }
        return res.json();
    } catch (error) {
        console.error('Error in getHomepageSections:', error);
        return [];
    }
}

// Helper to render individual section based on type
const RenderSection = ({ section }: { section: HomepageSection }) => {
    const { type, content } = section;

    // Common styles
    const sectionPaperStyle = { mb: 'xl', p: 'xl', shadow: 'sm', withBorder: true, radius: 'md' };

    switch (type) {
        case 'hero':
        case 'banner':
        case 'promotionalBlock':
            return (
                <Paper {...sectionPaperStyle}>
                    {content.imageUrl && <Image src={content.imageUrl} alt={content.title || 'Section Image'} mb="md" radius="sm" />}
                    {content.title && <Title order={2} ta="center">{content.title}</Title>}
                    {content.subtitle && <Text ta="center" c="dimmed" size="lg" mt="xs">{content.subtitle}</Text>}
                    {content.text && <Text mt="md">{content.text}</Text>}
                    {content.buttonText && content.buttonLink && (
                        <Group justify="center" mt="lg">
                            <Button component={Link} href={content.buttonLink} size="lg">
                                {content.buttonText}
                            </Button>
                        </Group>
                    )}
                </Paper>
            );

        case 'productCarousel':
        case 'featuredProducts':
            return (
                <Paper {...sectionPaperStyle}>
                    {content.title && <Title order={3} mb="md">{content.title}</Title>}
                    {content.items && content.items.length > 0 ? (
                        <SimpleGrid cols={{ base: 1, xs: 2, sm:3, md: 4 }} spacing="md">
                            {content.items.map((item, index) => {
                                const product = typeof item.itemId === 'object' ? item.itemId : null;
                                const image = item.imageUrl || (product?.images?.[0] ? (typeof product.images[0] === 'string' ? product.images[0] : product.images[0].url) : '/placeholder-image.png');
                                const link = item.link || (product?.slug ? `/products/${product.slug}` : (product?._id ? `/products/${product._id}` : '#'));
                                const itemKey = (typeof item.itemId === 'object' && item.itemId._id) ? item.itemId._id : (typeof item.itemId === 'string' ? item.itemId : `item-${index}`);

                                return (
                                    <Paper key={itemKey} p="md" withBorder radius="sm">
                                        <Link href={link} style={{ textDecoration: 'none', color: 'inherit' }}>
                                            <Image src={image} alt={item.title || product?.name || 'Product'} height={160} fit="contain" mb="sm"/>
                                            <Text fw={500} lineClamp={2}>{item.title || product?.name}</Text>
                                            {product?.price !== undefined && <Text c="blue.6" fw={700}>${product.price.toFixed(2)}</Text>}
                                            {item.subtitle && <Text size="sm" c="dimmed">{item.subtitle}</Text>}
                                        </Link>
                                    </Paper>
                                );
                            })}
                        </SimpleGrid>
                    ) : <Text c="dimmed">No products to display in this section.</Text>}
                </Paper>
            );

        case 'categoryList':
            return (
                <Paper {...sectionPaperStyle}>
                    {content.title && <Title order={3} mb="md">{content.title}</Title>}
                    {content.items && content.items.length > 0 ? (
                         <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="lg">
                            {content.items.map((item, index) => {
                                const category = typeof item.itemId === 'object' ? item.itemId : null;
                                const image = item.imageUrl || '/placeholder-category.png'; // Placeholder for category image
                                const link = item.link || (category?.slug ? `/categories/${category.slug}` : (category?._id ? `/categories/${category._id}` : '#'));
                                const itemKey = (typeof item.itemId === 'object' && item.itemId._id) ? item.itemId._id : (typeof item.itemId === 'string' ? item.itemId : `cat-${index}`);

                                return (
                                    <Link href={link} key={itemKey} style={{ textDecoration: 'none' }}>
                                        <Paper p="md" withBorder radius="md" style={{ textAlign: 'center' }}>
                                            {/* <Image src={image} alt={item.title || category?.name} height={80} fit="contain" mb="sm" /> */}
                                            <Text fw={500}>{item.title || category?.name}</Text>
                                        </Paper>
                                    </Link>
                                );
                            })}
                        </SimpleGrid>
                    ) : <Text c="dimmed">No categories to display.</Text>}
                </Paper>
            );

        case 'customHtml':
            return (
                <Paper {...sectionPaperStyle} p={0}> {/* Padding might conflict with user's HTML */}
                    {content.htmlContent ? (
                        <Box dangerouslySetInnerHTML={{ __html: content.htmlContent }} />
                    ) : (
                        <Text c="dimmed" p="md">No HTML content provided for this section.</Text>
                    )}
                </Paper>
            );

        default:
            return (
                <Paper {...sectionPaperStyle}>
                    <Text c="dimmed">Unsupported section type: {type}</Text>
                </Paper>
            );
    }
};


export default async function StoreHomePage() {
  const sections = await getHomepageSections();

  if (!sections || sections.length === 0) {
    // Fallback to the original placeholder content if no sections are defined or fetch fails
    return (
      <Container size="md" py="xl" style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Paper p="xl" shadow="xs" withBorder radius="md">
          <Title order={1} ta="center" mb="lg">
            Welcome to Our Store!
          </Title>
          <Text ta="center" size="lg" c="dimmed">
            Our e-commerce experience is currently under construction.
          </Text>
          <Text ta="center" mt="md">
            Please check back soon for exciting products and offers!
          </Text>
          <Space h="xl" />
           <Group justify="center" mt="xl">
                <Button component={Link} href="/admin" variant="light" size="xs">
                    Admin Panel
                </Button>
            </Group>
        </Paper>
      </Container>
    );
  }

  return (
    <Container fluid p={0}> {/* Use fluid container for full-width sections if desired, or 'xl' etc. */}
        {sections.map(section => (
            <Box key={section._id}
                 // Example: Add top/bottom margin to sections, but might be better handled by section type specific styling
                 // my="xl"
                 // Example: Full width for hero, constrained for others
                 // style={section.type === 'hero' ? {} : { maxWidth: 'var(--mantine-breakpoint-xl)', margin: 'auto', paddingLeft: 'var(--mantine-spacing-md)', paddingRight: 'var(--mantine-spacing-md)'}}
            >
                <RenderSection section={section} />
            </Box>
        ))}
         <Space h="xl" />
         {/* Fallback link to admin if sections are rendered */}
         <Container size="md" py="xl">
             <Group justify="center" mt="xl">
                <Button component={Link} href="/admin" variant="subtle" size="xs">
                    Admin Panel
                </Button>
            </Group>
        </Container>
    </Container>
  );
}
