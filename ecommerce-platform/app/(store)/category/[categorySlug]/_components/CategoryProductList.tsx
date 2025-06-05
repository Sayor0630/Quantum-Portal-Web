'use client';
import { useState, useEffect, useCallback } from 'react';
import { SimpleGrid, Pagination, Group, Text, LoadingOverlay, Alert, Paper, Title, Space, Select, RangeSlider, Checkbox, Button, UnstyledButton, Collapse } from '@mantine/core';
import ProductCard from '../../../_components/ProductCard';
import { useDebouncedValue, useDisclosure } from '@mantine/hooks';
import { IconFilter, IconChevronDown, IconChevronUp, IconSortAscending, IconSortDescending, IconCalendarEvent, IconTag, IconCurrencyDollar } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useRouter, usePathname, useSearchParams } from 'next/navigation'; // For URL updates

// Interfaces
interface Product { _id: string; name: string; price: number; images?: string[]; slug?: string; sku?: string; /* Add other fields if needed by ProductCard */ }
interface PaginatedProductsResponse { products: Product[]; currentPage: number; totalPages: number; totalItems: number; }

// Example: Available Attribute Facets (would be fetched based on category)
interface AttributeFacetValue { label: string; value: string; count: number; }
interface AttributeFacet { name: string; // e.g., Color
    values: AttributeFacetValue[];
}

const SORT_OPTIONS = [
    { value: 'createdAt_desc', label: 'Newest' },
    { value: 'price_asc', label: 'Price: Low to High' },
    { value: 'price_desc', label: 'Price: High to Low' },
    { value: 'name_asc', label: 'Name: A-Z' },
    { value: 'name_desc', label: 'Name: Z-A' },
    // Add more like 'popularity_desc' if API supports
];

const PRICE_MARKS = [ { value: 0, label: '$0' }, { value: 250, label: '$250' }, { value: 500, label: '$500' }, { value: 750, label: '$750' }, { value: 1000, label: '$1k+' }];

export default function CategoryProductList({
    categoryId,
    categoryName,
    initialProductsData
}: {
    categoryId: string,
    categoryName: string,
    initialProductsData: PaginatedProductsResponse
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>(initialProductsData.products);
  const [currentPage, setCurrentPage] = useState(initialProductsData.currentPage);
  const [totalPages, setTotalPages] = useState(initialProductsData.totalPages);
  const [totalItems, setTotalItems] = useState(initialProductsData.totalItems);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter & Sort State - Initialize from URL or defaults
  const [sortBy, setSortBy] = useState<string | null>(searchParams.get('sortBy') || SORT_OPTIONS[0].value);
  const [priceRange, setPriceRange] = useState<[number, number]>([
    Number(searchParams.get('minPrice')) || 0,
    Number(searchParams.get('maxPrice')) || 1000 // Default max, adjust based on product range
  ]);
  const [debouncedPriceRange] = useDebouncedValue(priceRange, 600);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string[]>>(() => {
    const attrs: Record<string, string[]> = {};
    searchParams.forEach((value, key) => {
        if (key.startsWith('attr_')) {
            attrs[key.substring(5)] = value.split(',');
        }
    });
    return attrs;
  });

  // Placeholder for dynamic attribute facets fetched from API
  const [attributeFacets, setAttributeFacets] = useState<AttributeFacet[]>([]);
  const [filtersOpened, { toggle: toggleFilters }] = useDisclosure(false);


  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    params.set('limit', '12'); // Configurable
    if (sortBy) params.set('sortBy', sortBy);
    if (debouncedPriceRange[0] > 0) params.set('minPrice', String(debouncedPriceRange[0]));
    if (debouncedPriceRange[1] < 1000) params.set('maxPrice', String(debouncedPriceRange[1])); // Only if not default max

    Object.entries(selectedAttributes).forEach(([key, values]) => {
        if (values.length > 0) params.set(`customAttributes.${key}`, values.join(','));
    });
    return params.toString();
  }, [currentPage, sortBy, debouncedPriceRange, selectedAttributes]);


  const fetchProducts = useCallback(async () => {
    setIsLoading(true); setError(null);
    const queryString = buildQueryString();
    // Update URL
    router.replace(`${pathname}?${queryString}`, { scroll: false });

    try {
      const res = await fetch(`/api/public/products?categoryId=${categoryId}&${queryString}`);
      if (!res.ok) { const errData = await res.json(); throw new Error(errData.message || 'Failed to fetch products'); }
      const data: PaginatedProductsResponse = await res.json();
      setProducts(data.products);
      setCurrentPage(data.currentPage); // API should confirm the page
      setTotalPages(data.totalPages);
      setTotalItems(data.totalItems);
    } catch (err: any) {
        setError(err.message);
        notifications.show({title: "Error", message: `Could not load products: ${err.message}`, color: "red"});
    }
    finally { setIsLoading(false); }
  }, [categoryId, buildQueryString, router, pathname]);

  // Effect to fetch when currentPage, sortBy, debouncedPriceRange, or selectedAttributes change
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]); // buildQueryString is memoized, so fetchProducts is stable if its deps are.

  // Placeholder: Fetch attribute facets based on categoryId (or current product list)
  // useEffect(() => { /* fetch facets and setAttributeFacets */ }, [categoryId]);


  const handleAttributeFilterChange = (attributeName: string, value: string, checked: boolean) => {
    setSelectedAttributes(prev => {
        const currentValues = prev[attributeName] || [];
        const newValues = checked
            ? [...currentValues, value]
            : currentValues.filter(v => v !== value);
        if (newValues.length === 0) {
            const { [attributeName]: _, ...rest } = prev; // Remove key if no values selected
            return rest;
        }
        return { ...prev, [attributeName]: newValues };
    });
    setCurrentPage(1); // Reset page when filters change
  };


  return (
    <Grid gutter="xl">
        <Grid.Col span={{ base: 12, lg: 3 }}> {/* Filters Sidebar */}
            <Paper p="md" withBorder radius="sm" shadow="xs">
                <Group justify="space-between" mb="md">
                    <Title order={4}><Group gap="xs"><IconFilter size={20}/> Filters</Group></Title>
                    <Button variant="subtle" size="xs" onClick={toggleFilters}>
                        {filtersOpened ? 'Hide' : 'Show'} Filters
                    </Button>
                </Group>
                <Collapse in={filtersOpened}>
                    <Text size="sm" mb="xs" fw={500}>Price Range</Text>
                    <RangeSlider
                        min={0} max={1000} step={10} // Max should be dynamic
                        value={priceRange}
                        onChange={setPriceRange}
                        label={(value) => `$${value}`}
                        thumbSize={16}
                        mb="xl"
                        marks={PRICE_MARKS}
                    />
                    <Text size="sm" mb="xs" fw={500}>Attributes (Example)</Text>
                    {/* Dynamic attribute filters would be rendered here based on attributeFacets */}
                    <Checkbox.Group label="Color (Example)" mb="md" value={selectedAttributes['Color'] || []} onChange={(values) => handleAttributeFilterChange('Color', '', false /* This needs rework for checkbox group */)}>
                         {/* This needs to be individual checkboxes to use handleAttributeFilterChange correctly */}
                        <Checkbox value="Red" label="Red" onChange={(e) => handleAttributeFilterChange('Color', 'Red', e.currentTarget.checked)} checked={selectedAttributes['Color']?.includes('Red')}/>
                        <Checkbox value="Blue" label="Blue" onChange={(e) => handleAttributeFilterChange('Color', 'Blue', e.currentTarget.checked)} checked={selectedAttributes['Color']?.includes('Blue')}/>
                    </Checkbox.Group>
                    <Text c="dimmed" fs="italic" size="sm">More dynamic attribute filters coming soon.</Text>
                </Collapse>
            </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 9 }}> {/* Products List & Sort */}
            <Group justify="space-between" mb="md">
                <Text c="dimmed" size="sm">{totalItems} products found</Text>
                <Select
                    placeholder="Sort by"
                    data={SORT_OPTIONS}
                    value={sortBy}
                    onChange={(val) => { setSortBy(val); setCurrentPage(1); }}
                    style={{width: 220}}
                    leftSection={sortBy?.includes('_asc') ? <IconSortAscending size={16}/> : <IconSortDescending size={16}/>}
                    allowDeselect={false}
                />
            </Group>
            <Paper pos="relative">
                <LoadingOverlay visible={isLoading} overlayProps={{blur:0.5, color: 'var(--mantine-color-body)'}} loaderProps={{type: 'bars'}} />
                {error && <Alert color="red" title="Error Loading Products" icon={<IconAlertCircle/>}>{error}</Alert>}
                {!isLoading && !error && products.length === 0 && <Text p="xl" ta="center">No products found matching your criteria. Try adjusting your filters.</Text>}

                <SimpleGrid cols={{ base: 1, xs:2, sm: 2, md: 3 }} spacing="lg">
                    {products.map(product => <ProductCard key={product._id} product={product} />)}
                </SimpleGrid>
            </Paper>
            {totalPages > 1 && (
                <Group justify="center" mt="xl">
                    <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} />
                </Group>
            )}
        </Grid.Col>
    </Grid>
  );
}
