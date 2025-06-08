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
import AdminLayout from '../../../../../components/admin/AdminLayout';
import CloudinaryImageUpload from '../../../../../components/admin/CloudinaryImageUpload';
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

interface Brand {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  website?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BrandFormData {
  name: string;
  slug: string;
  description: string;
  logo: string;
  website: string;
  isActive: boolean;
}

interface EditBrandPageProps {
  params: {
    brandId: string;
  };
}

export default function EditBrandPage({ params }: EditBrandPageProps) {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBrand, setIsLoadingBrand] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
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

  // Auto-generate slug from name for edit page
  const brandName = form.values.name;
  useEffect(() => {
    if (brandName && !isSlugManuallySet) {
      form.setFieldValue('slug', generateSlugFromName(brandName));
    }
  }, [brandName, isSlugManuallySet]);

  const fetchBrand = async () => {
    if (authStatus !== 'authenticated') return;
    
    setIsLoadingBrand(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/brands/${params.brandId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch brand');
      }

      const brandData: Brand = await response.json();
      setBrand(brandData);
      
      // Populate form with brand data
      form.setValues({
        name: brandData.name,
        slug: brandData.slug,
        description: brandData.description || '',
        logo: brandData.logo || '',
        website: brandData.website || '',
        isActive: brandData.isActive,
      });
    } catch (err: any) {
      setError(err.message);
      notifications.show({
        title: 'Error',
        message: err.message,
        color: 'red',
      });
    } finally {
      setIsLoadingBrand(false);
    }
  };

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.replace('/admin/login');
    }
    if (authStatus === 'authenticated') {
      fetchBrand();
    }
  }, [authStatus, params.brandId]);

  const handleSubmit = async (values: BrandFormData) => {
    if (authStatus !== 'authenticated' || !brand) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/brands/${params.brandId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update brand');
      }

      const updatedBrand = await response.json();
      setBrand(updatedBrand);
      
      notifications.show({
        title: 'Success',
        message: 'Brand updated successfully',
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

  if (authStatus === 'loading' || isLoadingBrand) {
    return (
      <AdminLayout>
        <LoadingOverlay visible />
      </AdminLayout>
    );
  }

  if (authStatus === 'unauthenticated') {
    return null;
  }

  if (error && !brand) {
    return (
      <AdminLayout>
        <Stack gap="lg">
          <Group justify="space-between">
            <Title order={2}>Edit Brand</Title>
            <Button 
              variant="subtle" 
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => router.back()}
            >
              Back
            </Button>
          </Group>
          
          <Alert 
            title="Error Loading Brand" 
            color="red" 
            icon={<IconAlertCircle />}
          >
            {error}
          </Alert>
        </Stack>
      </AdminLayout>
    );
  }

  const breadcrumbItems = [
    { title: 'Admin', href: '/admin' },
    { title: 'Brands', href: '/admin/brands' },
    { title: brand?.name || 'Edit Brand', href: `/admin/brands/${params.brandId}/edit` },
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
          <Title order={2}>Edit Brand: {brand?.name}</Title>
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
            title="Error Updating Brand" 
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
                description="URL-friendly identifier. Auto-updates if name changes and slug was not manually set, or customize it."
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

              {brand && (
                <Stack gap="xs" mt="md">
                  <Text size="sm" c="dimmed">
                    Created: {new Date(brand.createdAt).toLocaleString()}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Last Updated: {new Date(brand.updatedAt).toLocaleString()}
                  </Text>
                  <Text size="sm" c="dimmed">
                    Slug: /{brand.slug}
                  </Text>
                </Stack>
              )}

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
                  Update Brand
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>
      </Stack>
    </AdminLayout>
  );
}
