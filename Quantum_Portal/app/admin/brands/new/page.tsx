'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Title, Paper, Button, TextInput, Textarea, Switch, Group, 
  Stack, Alert, LoadingOverlay, Breadcrumbs, Anchor, Text
} from '@mantine/core';
import { IconArrowLeft, IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';
import AdminLayout from '../../../../components/admin/AdminLayout';
import CloudinaryImageUpload from '../../../../components/admin/CloudinaryImageUpload';
import Link from 'next/link';

// Helper function to generate a slug from name
const generateSlugFromName = (name: string): string => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

interface BrandFormData {
  name: string;
  slug: string;
  description: string;
  logo: string;
  website: string;
  isActive: boolean;
}

export default function NewBrandPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSlugManuallySet, setIsSlugManuallySet] = useState(false);

  const form = useForm<BrandFormData>({
    initialValues: {
      name: '',
      slug: '',
      description: '',
      logo: '',
      website: '',
      isActive: true,
    },
    validate: {
      name: (value) => (!value?.trim() ? 'Brand name is required' : null),
      slug: (value) => {
        if (!value?.trim()) return 'Slug is required';
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
          return 'Slug must be lowercase alphanumeric with hyphens, and no leading/trailing hyphens';
        }
        return null;
      },
      website: (value) => {
        if (!value?.trim()) return null;
        try {
          new URL(value);
          return null;
        } catch {
          return 'Please enter a valid URL';
        }
      },
    },
  });

  // Auto-generate slug from name
  const brandName = form.values.name;
  useEffect(() => {
    if (brandName && (!form.values.slug || !isSlugManuallySet)) {
      form.setFieldValue('slug', generateSlugFromName(brandName));
    }
  }, [brandName, isSlugManuallySet]);

  const handleSubmit = async (values: BrandFormData) => {
    if (authStatus !== 'authenticated') return;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create brand');
      }

      const newBrand = await response.json();
      
      notifications.show({
        title: 'Success',
        message: 'Brand created successfully',
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      router.push('/admin/brands');
    } catch (err: any) {
      setError(err.message);
      notifications.show({
        title: 'Error',
        message: err.message,
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authStatus === 'loading') {
    return (
      <AdminLayout>
        <LoadingOverlay visible />
      </AdminLayout>
    );
  }

  if (authStatus === 'unauthenticated') {
    router.replace('/admin/login');
    return null;
  }

  const breadcrumbItems = [
    { title: 'Admin', href: '/admin' },
    { title: 'Brands', href: '/admin/brands' },
    { title: 'New Brand', href: '/admin/brands/new' },
  ].map((item, index) => (
    <Anchor component={Link} href={item.href} key={index}>
      {item.title}
    </Anchor>
  ));

  return (
    <AdminLayout>
      <Stack gap="lg">
        <Breadcrumbs>{breadcrumbItems}</Breadcrumbs>
        
        <Group justify="space-between">
          <Title order={2}>Add New Brand</Title>
          <Button 
            variant="subtle" 
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => router.back()}
          >
            Back
          </Button>
        </Group>

        {error && (
          <Alert 
            title="Error Creating Brand" 
            color="red" 
            icon={<IconAlertCircle />} 
            withCloseButton 
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        )}

        <Paper withBorder shadow="sm" radius="md" p="lg">
          <LoadingOverlay visible={isLoading} overlayProps={{ radius: 'sm', blur: 1 }} />
          
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
              <TextInput
                label="Brand Name"
                description="Enter the name of the brand"
                placeholder="e.g., Nike, Apple, Samsung"
                required
                {...form.getInputProps('name')}
              />

              <TextInput
                label="Slug"
                description="URL-friendly identifier. Auto-generated from name if left empty, or you can customize it."
                placeholder="e.g., nike, apple, samsung"
                required
                {...form.getInputProps('slug')}
                onChange={(event) => {
                  form.setFieldValue('slug', generateSlugFromName(event.currentTarget.value));
                  setIsSlugManuallySet(true);
                }}
              />

              <Textarea
                label="Description"
                description="Brief description of the brand (optional)"
                placeholder="Enter a description for this brand..."
                minRows={3}
                maxRows={6}
                autosize
                {...form.getInputProps('description')}
              />

              <div>
                <Text size="sm" fw={500} mb="xs">Brand Logo</Text>
                <Text size="xs" c="dimmed" mb="sm">Upload a logo image for this brand (optional)</Text>
                <CloudinaryImageUpload
                  value={form.values.logo}
                  onChange={(url) => form.setFieldValue('logo', url)}
                  onClear={() => form.setFieldValue('logo', '')}
                  placeholder="Upload brand logo"
                  folder="brands/logos"
                  tags={['brand', 'logo']}
                  disabled={isLoading}
                />
              </div>

              <TextInput
                label="Website URL"
                description="Official website of the brand (optional)"
                placeholder="https://example.com"
                {...form.getInputProps('website')}
              />

              <Switch
                label="Active Status"
                description="Set whether this brand should be active and visible"
                {...form.getInputProps('isActive', { type: 'checkbox' })}
              />

              <Group justify="flex-end" mt="xl">
                <Button 
                  variant="subtle" 
                  onClick={() => router.back()}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  loading={isLoading}
                  disabled={!form.isValid()}
                >
                  Create Brand
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>
      </Stack>
    </AdminLayout>
  );
}
