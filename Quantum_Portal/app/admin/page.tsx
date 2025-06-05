'use client';

import AdminLayout from '../../components/admin/AdminLayout';
import { Title, Text, Paper, SimpleGrid, Group, ThemeIcon, LoadingOverlay, Alert, Select, SegmentedControl, Box, Table, Image, NumberInput } from '@mantine/core'; // Added Table, Image, NumberInput
import { IconShoppingCart, IconUsers, IconCash, IconPackage, IconAlertCircle, IconClockHour4 } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from 'recharts';

interface SummaryMetrics {
  totalRevenue: number;
  newOrdersCountLast7Days: number;
  totalProductsCount: number;
  newCustomersCountLast7Days: number;
  monthlyRevenue?: number;
  pendingOrdersCount?: number;
}

interface SalesChartDataItem {
  periodLabel: string;
  totalSales: number;
  orderCount: number;
}

interface PopularProduct { // New interface for popular products
  productId: string;
  name: string;
  sku?: string;
  thumbnail?: string | null;
  totalSold: number;
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [metrics, setMetrics] = useState<SummaryMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const [salesChartData, setSalesChartData] = useState<SalesChartDataItem[]>([]);
  const [salesChartLoading, setSalesChartLoading] = useState(true);
  const [salesChartError, setSalesChartError] = useState<string | null>(null);
  const [salesPeriod, setSalesPeriod] = useState('last30days');
  const [salesGranularity, setSalesGranularity] = useState('daily');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  // New state for popular products
  const [popularProducts, setPopularProducts] = useState<PopularProduct[]>([]);
  const [popularProductsLoading, setPopularProductsLoading] = useState(true);
  const [popularProductsError, setPopularProductsError] = useState<string | null>(null);
  const [popularProductsLimit, setPopularProductsLimit] = useState(5);

  // useEffect for fetching summary metrics
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/admin/login');
    }
    if (status === 'authenticated') {
      const fetchMetrics = async () => {
        setMetricsLoading(true);
        setMetricsError(null);
        try {
          const response = await fetch('/api/admin/dashboard/summary-metrics');
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
          }
          const data: SummaryMetrics = await response.json();
          setMetrics(data);
        } catch (err: any) {
          setMetricsError(err.message || 'Failed to fetch summary metrics.');
        } finally {
          setMetricsLoading(false);
        }
      };
      fetchMetrics();
    }
  }, [status, router]);

  // useEffect for fetching sales chart data
  useEffect(() => {
    if (status === 'authenticated') {
      const fetchSalesChartData = async () => {
        setSalesChartLoading(true);
        setSalesChartError(null);
        try {
          const response = await fetch(`/api/admin/dashboard/sales-over-time?period=${salesPeriod}&granularity=${salesGranularity}`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          setSalesChartData(data);
        } catch (err: any) {
          setSalesChartError(err.message || 'Failed to fetch sales chart data.');
        } finally {
          setSalesChartLoading(false);
        }
      };
      fetchSalesChartData();
    }
  }, [status, salesPeriod, salesGranularity]);

  // useEffect for fetching popular products data
  useEffect(() => {
    if (status === 'authenticated') {
      const fetchPopularProducts = async () => {
        setPopularProductsLoading(true);
        setPopularProductsError(null);
        try {
          const response = await fetch(`/api/admin/dashboard/popular-products?limit=${popularProductsLimit}`);
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          setPopularProducts(data);
        } catch (err: any) {
          setPopularProductsError(err.message || 'Failed to fetch popular products.');
        } finally {
          setPopularProductsLoading(false);
        }
      };
      fetchPopularProducts();
    }
  }, [status, popularProductsLimit]);


  if (status === 'loading' || (status === 'authenticated' && metricsLoading && !metrics && !metricsError)) {
    return (
        <AdminLayout>
            <LoadingOverlay visible={true} overlayProps={{ radius: 'sm', blur: 2, fixed: true }} />
        </AdminLayout>
    );
  }

  if (status === 'unauthenticated') {
    return <Text>Redirecting to login...</Text>;
  }

  const statItems = metrics ? [
    { title: 'Total Revenue', value: `$${metrics.totalRevenue?.toFixed(2) || '0.00'}`, icon: IconCash, color: 'teal' },
    { title: 'Monthly Revenue', value: `$${metrics.monthlyRevenue?.toFixed(2) || '0.00'}`, icon: IconCash, color: 'green' },
    { title: 'New Orders (Last 7d)', value: metrics.newOrdersCountLast7Days?.toString() || '0', icon: IconShoppingCart, color: 'blue' },
    { title: 'New Customers (Last 7d)', value: metrics.newCustomersCountLast7Days?.toString() || '0', icon: IconUsers, color: 'grape' },
    { title: 'Total Products', value: metrics.totalProductsCount?.toString() || '0', icon: IconPackage, color: 'orange' },
    { title: 'Pending Orders', value: metrics.pendingOrdersCount?.toString() || '0', icon: IconClockHour4, color: 'yellow' },
  ].filter(item => item.value !== undefined && !item.value.includes('undefined') && !item.value.includes('NaN'))
  : [];

  return (
    <AdminLayout>
      <Title order={2} mb="xl">Admin Dashboard</Title>

      {metricsError && (
         <Alert title="Error Fetching Metrics" color="red" icon={<IconAlertCircle />} withCloseButton onClose={() => setMetricsError(null)} mb="lg">
             {metricsError}
         </Alert>
      )}

      <LoadingOverlay visible={status === 'authenticated' && metricsLoading && !salesChartLoading && !popularProductsLoading} overlayProps={{ radius: 'sm', blur: 2 }} />

      {metrics && !metricsLoading && !metricsError && (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
          {statItems.map((stat) => (
            <Paper withBorder p="md" radius="md" key={stat.title}>
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  {stat.title}
                </Text>
                <ThemeIcon color={stat.color} variant="light" size={38} radius="md">
                  <stat.icon stroke={1.5} size="1.5rem" />
                </ThemeIcon>
              </Group>
              <Text fw={700} size="xl" mt="sm">
                {stat.value}
              </Text>
            </Paper>
          ))}
        </SimpleGrid>
      )}

      {!metrics && !metricsLoading && !metricsError && status === 'authenticated' && (
        <Text>No summary metrics data available at the moment.</Text>
      )}

      {/* Sales Trends Chart Section */}
      <Paper withBorder p="md" radius="md" mt="xl">
        <Title order={4} mb="md">Sales Trends</Title>
        <Group mb="md" justify="space-between">
            <Group>
                <Select
                    label="Period"
                    value={salesPeriod}
                    onChange={(value) => setSalesPeriod(value || 'last30days')}
                    data={[
                        { value: 'last7days', label: 'Last 7 Days' },
                        { value: 'last30days', label: 'Last 30 Days' },
                        { value: 'last90days', label: 'Last 90 Days' },
                        { value: 'last12months', label: 'Last 12 Months' },
                    ]}
                    disabled={salesChartLoading}
                    allowDeselect={false}
                />
                <Select
                    label="Granularity"
                    value={salesGranularity}
                    onChange={(value) => setSalesGranularity(value || 'daily')}
                    data={[
                        { value: 'daily', label: 'Daily' },
                        { value: 'weekly', label: 'Weekly' },
                        { value: 'monthly', label: 'Monthly' },
                    ]}
                    disabled={salesChartLoading}
                    allowDeselect={false}
                />
            </Group>
            <SegmentedControl
                value={chartType}
                onChange={(value) => setChartType(value as 'line' | 'bar')}
                data={[
                    { label: 'Line', value: 'line' },
                    { label: 'Bar', value: 'bar' },
                ]}
                disabled={salesChartLoading}
            />
        </Group>

        <Box style={{ width: '100%', height: 350, position: 'relative' }}>
          <LoadingOverlay visible={salesChartLoading} overlayProps={{ radius: 'sm', blur: 1 }} />
          {salesChartError && (
            <Alert title="Error Fetching Chart Data" color="red" icon={<IconAlertCircle />} withCloseButton onClose={() => setSalesChartError(null)}>
              {salesChartError}
            </Alert>
          )}
          {!salesChartLoading && !salesChartError && salesChartData.length === 0 && (
            <Text>No sales data available for the selected period/granularity.</Text>
          )}
          {!salesChartLoading && !salesChartError && salesChartData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <LineChart data={salesChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periodLabel" />
                  <YAxis yAxisId="left" dataKey="totalSales" name="Sales" unit="$" allowDecimals={false} />
                  <YAxis yAxisId="right" dataKey="orderCount" name="Orders" orientation="right" allowDecimals={false} />
                  <Tooltip formatter={(value: number, name: string) => name === 'Sales' ? `$${value.toFixed(0)}` : value.toFixed(0)} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="totalSales" stroke="#8884d8" activeDot={{ r: 6 }} name="Total Sales" />
                  <Line yAxisId="right" type="monotone" dataKey="orderCount" stroke="#82ca9d" name="Order Count" />
                </LineChart>
              ) : (
                <BarChart data={salesChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periodLabel" />
                  <YAxis yAxisId="left" dataKey="totalSales" name="Sales" unit="$" allowDecimals={false} />
                  <YAxis yAxisId="right" dataKey="orderCount" name="Orders" orientation="right" allowDecimals={false} />
                  <Tooltip formatter={(value: number, name: string) => name === 'Sales' ? `$${value.toFixed(0)}` : value.toFixed(0)} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="totalSales" fill="#8884d8" name="Total Sales" />
                  <Bar yAxisId="right" dataKey="orderCount" fill="#82ca9d" name="Order Count" />
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </Box>
      </Paper>

      {/* Popular Products Table Section */}
      <Paper withBorder p="md" radius="md" mt="xl">
        <Group justify="space-between" mb="md">
            <Title order={4}>Popular Products</Title>
            <NumberInput
                label="Show top"
                value={popularProductsLimit}
                onChange={(value) => setPopularProductsLimit(Number(value) || 5)}
                min={3}
                max={20}
                step={1}
                size="xs"
                style={{ width: 100 }}
                disabled={popularProductsLoading}
            />
        </Group>
        <Box style={{ position: 'relative' }}>
            <LoadingOverlay visible={popularProductsLoading} overlayProps={{ radius: 'sm', blur: 1 }} />
            {popularProductsError && (
                <Alert title="Error Fetching Popular Products" color="red" icon={<IconAlertCircle />} withCloseButton onClose={() => setPopularProductsError(null)}>
                {popularProductsError}
                </Alert>
            )}
            {!popularProductsLoading && !popularProductsError && popularProducts.length === 0 && (
                <Text>No popular products data available.</Text>
            )}
            {!popularProductsLoading && !popularProductsError && popularProducts.length > 0 && (
                <Table striped highlightOnHover withTableBorder withColumnBorders>
                    <Table.Thead>
                        <Table.Tr>
                        <Table.Th>Thumbnail</Table.Th>
                        <Table.Th>Product Name</Table.Th>
                        <Table.Th>SKU</Table.Th>
                        <Table.Th>Total Sold</Table.Th>
                        </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                        {popularProducts.map((product) => (
                        <Table.Tr key={product.productId}>
                            <Table.Td>
                            <Image
                                src={product.thumbnail || 'https://via.placeholder.com/50?text=No+Image'} // Fallback image
                                alt={product.name}
                                w={50}
                                h={50}
                                fit="contain"
                                radius="sm"
                            />
                            </Table.Td>
                            <Table.Td>{product.name}</Table.Td>
                            <Table.Td>{product.sku || 'N/A'}</Table.Td>
                            <Table.Td>{product.totalSold}</Table.Td>
                        </Table.Tr>
                        ))}
                    </Table.Tbody>
                </Table>
            )}
        </Box>
      </Paper>

    </AdminLayout>
  );
}
