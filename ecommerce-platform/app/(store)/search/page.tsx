// app/(store)/search/page.tsx
import { Title, Text, Container, SimpleGrid, Paper, Group, Pagination, Alert, Space, Button } from '@mantine/core'; // Removed TextInput as it's in client component
import ProductCard from '../_components/ProductCard';
// StoreLayout is applied by app/(store)/layout.tsx
import { IconSearch, IconAlertCircle } from '@tabler/icons-react';
import { Metadata } from 'next';
import SearchInputForm from './_components/SearchInputForm';
import Link from 'next/link'; // For pagination links

// Define Product and Paginated response types
interface Product {
    _id: string; name: string; price: number; images?: string[]; slug?: string; sku?: string;
    // Ensure this matches ProductCardProps and API response
}
interface PaginatedProductsResponse {
    products: Product[];
    currentPage: number;
    totalPages: number;
    totalItems: number; // Changed from totalProducts for consistency with other APIs
    error?: string; // Optional error message from searchProducts
}

async function searchProducts(query?: string | null, page = 1, limit = 12): Promise<PaginatedProductsResponse> {
  const defaultEmptyResponse = { products: [], currentPage: page, totalPages: 0, totalItems: 0 };
  if (!query || query.trim() === "") {
    return defaultEmptyResponse;
  }
  const queryParams = new URLSearchParams({
    search: query,
    page: String(page),
    limit: String(limit),
    // isPublished: 'true' // API /api/public/products already filters by isPublished:true
  });
  try {
     const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/public/products?${queryParams.toString()}`, { cache: 'no-store' });
     if (!res.ok) {
         const errorText = await res.text();
         console.error(`Search API error: ${res.status} - ${errorText}`);
         let errorMessage = `Search failed (status ${res.status})`;
         try {
            const errorData = JSON.parse(errorText); // Try to parse if JSON error was sent
            errorMessage = errorData.message || errorMessage;
         } catch(e) { /* Ignore if not JSON */ }
         return { ...defaultEmptyResponse, currentPage: page, error: errorMessage };
     }
     const data = await res.json();
     // Ensure API response matches PaginatedProductsResponse, especially totalItems
     return { ...data, totalItems: data.totalItems || data.totalProducts || 0 };
  } catch (e: any) {
     console.error(`Search fetch error: ${e}`);
     return { ...defaultEmptyResponse, currentPage: page, error: e.message || "Failed to connect to search service." };
  }
}

export async function generateMetadata({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }): Promise<Metadata> {
  const query = typeof searchParams?.q === 'string' ? searchParams.q : '';
  const siteName = process.env.SITE_NAME || "E-commerce Platform";
  if (query) {
    return { title: `Search Results for "${query}" | ${siteName}` };
  }
  return { title: `Search Products | ${siteName}` };
}

// Helper to render pagination links for Server Component
const ServerPagination = ({ totalPages, currentPage, currentQuery }: { totalPages: number, currentPage: number, currentQuery: string }) => {
    if (totalPages <= 1) return null;

    const pageNumbers = [];
    // Simple pagination: Prev, 1, ..., current-1, current, current+1, ..., total, Next
    // More complex logic can be added for more page numbers.

    // Prev
    if (currentPage > 1) {
        pageNumbers.push({label: '« Prev', href: `/search?q=${encodeURIComponent(currentQuery)}&page=${currentPage - 1}`});
    }

    // Page numbers (simplified)
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage || (i >= currentPage -1 && i <= currentPage + 1) || i === 1 || i === totalPages ) {
            pageNumbers.push({label: String(i), href: `/search?q=${encodeURIComponent(currentQuery)}&page=${i}`, active: i === currentPage});
        } else if (pageNumbers[pageNumbers.length-1].label !== '...') {
            pageNumbers.push({label: '...'});
        }
    }

    // Next
    if (currentPage < totalPages) {
        pageNumbers.push({label: 'Next »', href: `/search?q=${encodeURIComponent(currentQuery)}&page=${currentPage + 1}`});
    }

    return (
        <Group justify="center" mt="xl">
            {pageNumbers.map((page, index) =>
                page.href ? (
                    <Button key={`${page.label}-${index}`} component={Link} href={page.href} variant={page.active ? "filled" : "default"} size="sm">
                        {page.label}
                    </Button>
                ) : (
                    <Text key={`${page.label}-${index}`} p="xs" size="sm">...</Text>
                )
            )}
        </Group>
    );
};


export default async function SearchResultsPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const query = typeof searchParams?.q === 'string' ? searchParams.q.trim() : '';
  const page = typeof searchParams?.page === 'string' && parseInt(searchParams.page, 10) > 0 ? parseInt(searchParams.page, 10) : 1;

  // Fetch results only if there's a query, or show prompt to search
  const searchResults = query ? await searchProducts(query, page) : { products: [], currentPage: 1, totalPages: 0, totalItems: 0 };

  return (
    <Container fluid px="lg" py="md" mt="var(--header-height, 70px)">
      <Title order={1} mb="xl">
        {query ? `Search Results for "&quot;${query}&quot;"` : 'Search Our Products'}
      </Title>

      <Paper p="md" mb="xl" withBorder radius="sm" shadow="xs">
         <SearchInputForm initialQuery={query} />
      </Paper>

      {searchResults.error && (
         <Alert title="Search Error" color="red" icon={<IconAlertCircle />} radius="sm">
             <Text>There was an issue performing the search: {searchResults.error}</Text>
             <Text size="sm" mt="xs">Please try again or contact support if the problem persists.</Text>
         </Alert>
      )}

      {!searchResults.error && !query && searchResults.products.length === 0 && (
         <Paper p="xl" withBorder radius="sm" ta="center" mt="xl">
             <IconSearch size={52} stroke={1.5} style={{ opacity: 0.6 }} />
             <Title order={3} mt="md">Search for Products</Title>
             <Text c="dimmed" mt="xs">Enter a term in the search bar above to find products in our catalog.</Text>
         </Paper>
      )}

      {!searchResults.error && query && searchResults.products.length === 0 && (
        <Paper p="xl" withBorder radius="sm" ta="center" mt="xl">
          <IconSearch size={52} stroke={1.5} style={{ opacity: 0.6 }} />
          <Title order={3} mt="md">No Products Found</Title>
          <Text c="dimmed" mt="xs">No products matched your search term &quot;<strong>{query}</strong>&quot;.</Text>
          <Text c="dimmed" size="sm">Try a different search term or check your spelling.</Text>
        </Paper>
      )}

      {!searchResults.error && searchResults.products.length > 0 && (
        <>
          <Text mb="md" fw={500}>{searchResults.totalItems} product(s) found for &quot;{query}&quot; (Page {searchResults.currentPage} of {searchResults.totalPages})</Text>
          <SimpleGrid cols={{ base: 1, xs:2, sm: 2, md: 3, lg: 4 }} spacing="lg">
            {searchResults.products.map(product => <ProductCard key={product._id} product={product} />)}
          </SimpleGrid>
          <ServerPagination totalPages={searchResults.totalPages} currentPage={searchResults.currentPage} currentQuery={query} />
        </>
      )}
      <Space h="xl" />
    </Container>
  );
}
