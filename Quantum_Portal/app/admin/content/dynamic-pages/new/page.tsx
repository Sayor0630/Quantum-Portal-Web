'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Paper,
  Title,
  TextInput,
  Textarea,
  Select,
  Button,
  Stack,
  Group,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconPlus } from '@tabler/icons-react';
import AdminLayout from '../../../../../components/admin/AdminLayout';

export default function NewDynamicPagePage() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    pageType: 'custom' as 'landing' | 'content' | 'category' | 'brand' | 'custom',
  });

  // Auto-generate slug from title
  const handleTitleChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      title: value,
      slug: value
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, ''),
    }));
  };

  const handleCreatePage = async () => {
    // Validation
    if (!formData.title.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Page title is required',
        color: 'red',
      });
      return;
    }

    if (!formData.slug.trim()) {
      notifications.show({
        title: 'Validation Error',
        message: 'Page slug is required',
        color: 'red',
      });
      return;
    }

    setIsCreating(true);

    try {
      // Create minimal page with just basic info
      const response = await fetch('/api/admin/dynamic-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          slug: formData.slug,
          description: formData.description,
          pageType: formData.pageType,
          isPublished: false,
          segments: [],
          gridCells: [], // Empty initially
          pageSettings: {
            headerVisible: true,
            footerVisible: true,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create page');
      }

      const savedPage = await response.json();

      notifications.show({
        title: 'Success',
        message: 'Page created! Redirecting to page builder...',
        color: 'green',
      });

      // Redirect to edit page with the new page ID
      setTimeout(() => {
        router.push(`/admin/content/dynamic-pages/edit/${savedPage._id}`);
      }, 500);

    } catch (error: any) {
      console.error('Error creating page:', error);
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to create page',
        color: 'red',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <AdminLayout>
      <Container size="md" py="xl">
        <Paper shadow="sm" p="xl" withBorder>
          <Stack gap="lg">
            {/* Header */}
            <Group justify="space-between">
              <div>
                <Title order={2}>Create New Dynamic Page</Title>
                <Text size="sm" c="dimmed" mt={4}>
                  Fill in the basic information to create a new page
                </Text>
              </div>
              <Button
                variant="subtle"
                leftSection={<IconArrowLeft size={16} />}
                onClick={() => router.back()}
              >
                Back
              </Button>
            </Group>

            {/* Form Fields */}
            <TextInput
              label="Page Title"
              placeholder="e.g., About Us, Summer Sale 2024"
              required
              value={formData.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              description="The title will be displayed as the page heading"
            />

            <TextInput
              label="URL Slug"
              placeholder="e.g., about-us, summer-sale-2024"
              required
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              description="Used in the page URL. Auto-generated from title but can be customized."
              leftSection={<Text size="sm" c="dimmed">/</Text>}
            />

            <Select
              label="Page Type"
              required
              value={formData.pageType}
              onChange={(value) => setFormData({ ...formData, pageType: value as any })}
              data={[
                { value: 'landing', label: 'Landing Page' },
                { value: 'content', label: 'Content Page' },
                { value: 'category', label: 'Category Page' },
                { value: 'brand', label: 'Brand Page' },
                { value: 'custom', label: 'Custom Page' },
              ]}
              description="Determines the purpose and layout options for this page"
            />

            <Textarea
              label="Description (Optional)"
              placeholder="Brief description of this page..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              description="Internal description to help identify this page"
            />

            {/* Actions */}
            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                onClick={() => router.back()}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={handleCreatePage}
                loading={isCreating}
              >
                Create Page & Start Building
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Container>
    </AdminLayout>
  );
}
