'use client';

import { useState, useEffect } from 'react';
import AdminLayout from '../../../../components/admin/AdminLayout';
import { Title, Paper, Select, Button, Alert, LoadingOverlay, Text, Group } from '@mantine/core';
import { IconAlertCircle, IconCheck, IconDeviceFloppy } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function DefaultProductPageSettings() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<{_id: string; title: string; pageType: string; displayLabel: string}[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedPageType, setSelectedPageType] = useState<'static' | 'dynamic' | null>(null);
  const [initialPageId, setInitialPageId] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/admin/login');
    }
  }, [authStatus, router]);

  useEffect(() => {
    const fetchData = async () => {
      setIsFetching(true);
      setError(null);
      
      try {
        // Fetch all pages
        const pagesRes = await fetch('/api/admin/content/static-pages');
        if (!pagesRes.ok) throw new Error('Failed to fetch pages');
        const pagesData = await pagesRes.json();
        setPages(pagesData.pages || []);
        
        // Fetch current default product page
        const configRes = await fetch('/api/admin/default-product-page');
        if (!configRes.ok) throw new Error('Failed to fetch configuration');
        const configData = await configRes.json();
        const pageId = configData.defaultProductPageId?._id || configData.defaultProductPageId || null;
        const pageType = configData.defaultProductPageType || null;
        setSelectedPageId(pageId);
        setSelectedPageType(pageType);
        setInitialPageId(pageId);
      } catch (err: any) {
        setError(err.message);
        notifications.show({
          title: 'Error',
          message: err.message,
          color: 'red',
        });
      } finally {
        setIsFetching(false);
      }
    };
    
    if (authStatus === 'authenticated') {
      fetchData();
    }
  }, [authStatus]);

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/admin/default-product-page', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          defaultProductPageId: selectedPageId,
          defaultProductPageType: selectedPageType
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }
      
      setInitialPageId(selectedPageId);
      
      notifications.show({
        title: 'Success',
        message: 'Default product page template updated successfully',
        color: 'green',
        icon: <IconCheck />,
      });
    } catch (err: any) {
      setError(err.message);
      notifications.show({
        title: 'Error',
        message: err.message,
        color: 'red',
        icon: <IconAlertCircle />,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authStatus === 'loading' || isFetching) {
    return (
      <AdminLayout>
        <LoadingOverlay visible overlayProps={{ radius: 'sm', blur: 2 }} />
      </AdminLayout>
    );
  }

  const hasChanges = selectedPageId !== initialPageId;

  return (
    <AdminLayout>
      <Title order={2} mb="xl">Default Product Page Template</Title>
      
      <Paper withBorder shadow="md" p="xl" radius="md" pos="relative">
        <LoadingOverlay visible={isLoading} overlayProps={{ radius: 'sm', blur: 2 }} />
        
        {error && (
          <Alert icon={<IconAlertCircle />} title="Error" color="red" mb="md" withCloseButton onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        <Text size="sm" c="dimmed" mb="md">
          Select a custom page template that will be used for all product pages by default. 
          Individual products can override this with their own custom template.
        </Text>
        
        <Select
          label="Default Product Page Template"
          placeholder="Select a page template"
          data={pages.map(page => ({ value: page._id, label: page.displayLabel }))}
          value={selectedPageId}
          onChange={(value) => {
            setSelectedPageId(value);
            // Find and set the page type
            const selectedPage = pages.find(p => p._id === value);
            setSelectedPageType(selectedPage?.pageType as 'static' | 'dynamic' || null);
          }}
          searchable
          clearable
          mb="xl"
          description="This page will be used for all product URLs (e.g., /product-slug)"
        />
        
        {!selectedPageId && (
          <Alert color="yellow" mb="md">
            No default product page template is set. Products will not be accessible on the frontend until a template is configured.
          </Alert>
        )}
        
        <Group justify="flex-end">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isLoading}
            leftSection={<IconDeviceFloppy size={16} />}
          >
            Save Settings
          </Button>
        </Group>
      </Paper>
      
      <Paper withBorder shadow="sm" p="md" radius="md" mt="xl">
        <Title order={4} mb="sm">How It Works</Title>
        <Text size="sm" mb="xs">
          1. Create a custom page using the <strong>Visual Page Builder</strong>
        </Text>
        <Text size="sm" mb="xs">
          2. Enable <strong>Data Binding Mode</strong> and use <strong>Product</strong> as the data source
        </Text>
        <Text size="sm" mb="xs">
          3. Add text blocks with bindings like: <code>{'{{product.name}}'}</code>, <code>{'{{product.price}}'}</code>, etc.
        </Text>
        <Text size="sm" mb="xs">
          4. Set that page as the default product template here
        </Text>
        <Text size="sm">
          5. All published products will now use this template at <code>/product-slug</code>
        </Text>
      </Paper>
    </AdminLayout>
  );
}
