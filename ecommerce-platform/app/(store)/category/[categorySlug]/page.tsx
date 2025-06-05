// app/(store)/category/[categorySlug]/page.tsx
import { Title, Text, Container, Paper, Alert, Space, Breadcrumbs as MantineBreadcrumbs, Anchor } from '@mantine/core'; // Renamed Breadcrumbs to MantineBreadcrumbs to avoid conflict
// StoreLayout is applied by app/(store)/layout.tsx
import CategoryProductList from './_components/CategoryProductList';
import Link from 'next/link';
import { IconAlertCircle } from '@tabler/icons-react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';

// Import new breadcrumb components and utilities
import BreadcrumbsDisplay from '../../_components/BreadcrumbsDisplay';
import { generateCategoryBreadcrumbs, BreadcrumbNestedCategory } from '../../../../lib/breadcrumbsUtils'; // Adjust path

// Updated Category interface to match BreadcrumbNestedCategory for consistency
interface Category extends BreadcrumbNestedCategory {
    description?: string;
    // Any other fields specific to the category page display beyond what breadcrumbs need
}
interface Product { // Kept Product interface as it was, specific to product list needs
    _id: string; name: string; price: number; images?: string[]; slug?: string; sku?: string;
}
interface PaginatedProductsResponse {
    products: Product[]; currentPage: number; totalPages: number; totalItems: number;
}

async function getCategoryDetails(slug: string): Promise<Category | null> {
  const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/public/categories?slug=${slug}`; // API from Subtask 29, Turn 126
  try {
    const res = await fetch(apiUrl, { cache: 'no-store' }); // Use no-store for dev, consider revalidate for prod
    if (!res.ok) {
        if (res.status === 404) return null;
        const errorText = await res.text();
        console.error(`Failed to fetch category "${slug}": ${res.status} ${errorText}`);
        // For client display, a generic error or allow specific messages if safe
        throw new Error(`API error fetching category: ${res.status}`);
    }
    const data = await res.json();
    // The API should return a single category object when queried by slug and it's found & published
    // Also, it should have `isPublished: true` due to API logic.
    // And parent chain should be populated as much as API supports.
    return data as Category;
  } catch (error) {
      console.error(`Error in getCategoryDetails for slug "${slug}":`, error);
      return null;
  }
}

async function getInitialProducts(categoryId?: string, page = 1, limit = 12): Promise<PaginatedProductsResponse> {
  // ... (getInitialProducts function remains the same as before)
  const defaultResponse = { products: [], currentPage: 1, totalPages: 0, totalItems: 0 };
  if (!categoryId) return defaultResponse;
  const queryParams = new URLSearchParams({ categoryId: categoryId, page: String(page), limit: String(limit) });
  const apiUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/public/products?${queryParams.toString()}`;
  try {
    const res = await fetch(apiUrl, { cache: 'no-store' });
    if (!res.ok) {
        console.error(`Failed to fetch products for category "${categoryId}": ${res.status} ${await res.text()}`);
        return defaultResponse;
    }
    return res.json();
  } catch (error) {
    console.error(`Error in getInitialProducts for category "${categoryId}":`, error);
    return defaultResponse;
  }
}

export async function generateMetadata({ params }: { params: { categorySlug: string } }): Promise<Metadata> {
  const category = await getCategoryDetails(params.categorySlug);
  if (!category) {
    return { title: 'Category Not Found', description: 'The category you are looking for could not be found or is not available.' };
  }
  const siteName = process.env.SITE_NAME || "E-commerce Platform";
  return {
    title: `${category.name} | ${siteName}`,
    description: category.description || `Browse products in the ${category.name} category.`,
    // Add openGraph images if category has an image
  };
}

export default async function CategoryPage({ params }: { params: { categorySlug: string } }) {
  const category = await getCategoryDetails(params.categorySlug);

  if (!category) {
    notFound();
  }

  const initialProductsData = await getInitialProducts(category._id);
  const breadcrumbItems = generateCategoryBreadcrumbs(category); // Use the new utility

  return (
    <Container fluid px="lg" py="md" mt="var(--header-height, 70px)">
      <BreadcrumbsDisplay items={breadcrumbItems} /> {/* Use the new component */}

      <Paper p="lg" shadow="xs" withBorder mb="xl" radius="md">
        <Title order={1} mb="xs">{category.name}</Title>
        {category.description && <Text c="dimmed">{category.description}</Text>}
      </Paper>

      <CategoryProductList
        categoryId={category._id}
        categoryName={category.name}
        initialProductsData={initialProductsData}
      />
      <Space h="xl" />
    </Container>
  );
}
