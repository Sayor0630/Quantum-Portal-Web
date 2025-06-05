'use client';

import AdminLayout from '../../../../components/admin/AdminLayout';
import { Title, Paper, TextInput, Button, Group, LoadingOverlay, Alert, Select, Space, Text } from '@mantine/core';
import { useForm, yupResolver } from '@mantine/form';
import * as Yup from 'yup';
import { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { useRouter } from 'next/navigation';
import { IconDeviceFloppy, IconAlertCircle, IconX, IconPlus } from '@tabler/icons-react'; // IconPlus is already imported by other pages, can keep for consistency
import { notifications } from '@mantine/notifications';
import { useSession } from 'next-auth/react';

interface CategoryOption {
  value: string;
  label: string;
}

const generateSlug = (name: string) => {
    if (!name) return '';
    return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

const schema = Yup.object().shape({
  name: Yup.string().required('Category name is required'),
  slug: Yup.string()
    .required('Slug is required')
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens, and no leading/trailing hyphens.'),
  parent: Yup.string().nullable(),
});

export default function NewCategoryPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [isLoading, setIsLoading] = useState(false); // For form submission
  const [apiError, setApiError] = useState<string | null>(null);
  const [categoriesForSelect, setCategoriesForSelect] = useState<CategoryOption[]>([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true); // For parent categories dropdown

  const form = useForm({
    initialValues: {
      name: '',
      slug: '',
      parent: null as string | null, // Explicitly type as string | null
    },
    validate: yupResolver(schema),
  });

  // Auto-generate slug from name, only if slug field hasn't been manually touched or is empty
  const categoryName = form.values.name;
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  useEffect(() => {
    // Auto-generate slug if name exists and slug hasn't been manually edited
    if (categoryName && !slugManuallyEdited) {
      const newSlug = generateSlug(categoryName);
      if (form.values.slug !== newSlug) {
        form.setFieldValue('slug', newSlug);
      }
    }
  }, [categoryName, slugManuallyEdited, form]);

  useEffect(() => {
     if (authStatus === 'unauthenticated') {
         router.replace('/admin/login');
     }
     if (authStatus === 'authenticated') {
         const fetchParentCategories = async () => {
             setIsCategoriesLoading(true);
             try {
                 const response = await fetch('/api/admin/categories');
                 if (!response.ok) throw new Error('Failed to fetch categories for parent selection');
                 const data = await response.json();
                 setCategoriesForSelect(
                     data.map((cat: any) => ({ value: cat._id, label: cat.name }))
                 );
             } catch (err: any) { // Catch any type
                 notifications.show({ title: 'Error', message: err.message || 'Could not load parent categories.', color: 'red' });
             } finally {
                 setIsCategoriesLoading(false);
             }
         };
         fetchParentCategories();
     }
  }, [authStatus, router]);


  const handleSubmit = async (values: typeof form.values) => {
    setIsLoading(true);
    setApiError(null);

    try {
      const payload = {
        name: values.name,
        slug: values.slug, // Slug is now required and validated by Yup
        parent: values.parent || null,
      };

      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      notifications.show({
         title: 'Category Created',
         message: `Category "${data.name}" has been successfully created.`,
         color: 'green',
         icon: <IconDeviceFloppy />, // Changed icon to floppy for save/create
      });
      router.push('/admin/categories');

    } catch (err: any) { // Catch any type
      setApiError(err.message || 'An unexpected error occurred.');
      notifications.show({
         title: 'Error Creating Category',
         message: err.message || 'An unexpected error occurred.',
         color: 'red',
         icon: <IconAlertCircle />,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authStatus === 'loading' || (isCategoriesLoading && authStatus === 'authenticated')) {
     return (
         <AdminLayout>
             <LoadingOverlay visible={true} overlayProps={{ radius: 'sm', blur: 2, fixed: true }} />
         </AdminLayout>
     );
  }
   if (authStatus === 'unauthenticated') {
     return <Text p="xl">Redirecting to login...</Text>;
  }

  return (
    <AdminLayout>
      <Title order={2} mb="xl">Add New Category</Title>
      <Paper component="form" onSubmit={form.onSubmit(handleSubmit)} withBorder shadow="md" p={30} radius="md" pos="relative">
        <LoadingOverlay visible={isLoading} overlayProps={{ radius: 'sm', blur: 2 }} />

        {apiError && (
          <Alert icon={<IconAlertCircle size="1rem" />} title="API Error!" color="red" withCloseButton onClose={() => setApiError(null)} mb="md">
            {apiError}
          </Alert>
        )}

        <TextInput
          label="Category Name"
          placeholder="e.g., Electronics, Books"
          required
          {...form.getInputProps('name')}
          mb="md"
        />
        <TextInput
          label="Slug"
          placeholder="e.g., electronics, books"
          required
          description="URL-friendly identifier. Auto-generated from name if left empty, or you can customize it."
          {...form.getInputProps('slug')}
          onChange={(event) => {
            form.setFieldValue('slug', generateSlug(event.currentTarget.value));
            setSlugManuallyEdited(true);
          }}
          mb="md"
        />
        <Select
          label="Parent Category (Optional)"
          placeholder="Select a parent category"
          data={categoriesForSelect}
          searchable
          clearable
          disabled={isCategoriesLoading}
          {...form.getInputProps('parent')}
          mb="xl"
        />

        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={() => router.push('/admin/categories')} leftSection={<IconX size={16}/>} disabled={isLoading}>
             Cancel
          </Button>
          <Button type="submit" leftSection={<IconDeviceFloppy size={16}/>} disabled={isLoading || isCategoriesLoading}>
             Save Category
          </Button>
        </Group>
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
