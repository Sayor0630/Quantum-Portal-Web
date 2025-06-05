'use client';

import AdminLayout from '../../../../../components/admin/AdminLayout';
import { Title, Paper, TextInput, Button, Group, LoadingOverlay, Alert, Select, Space, Text, Skeleton, Grid } from '@mantine/core'; // Added Skeleton, Grid
import { useForm, yupResolver } from '@mantine/form';
import * as Yup from 'yup';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation'; // Added useParams
import { IconDeviceFloppy, IconAlertCircle, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useSession } from 'next-auth/react';

interface CategoryOption {
  value: string;
  label: string;
}

interface CategoryDataFromAPI {
   _id: string;
   name: string;
   slug: string;
   parent?: { _id: string; name: string; } | string | null; // API might send populated or just ID
}

const generateSlug = (name: string) => {
    if (!name) return '';
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
};

const schema = Yup.object().shape({
  name: Yup.string().required('Category name is required'),
  slug: Yup.string().required('Slug is required').matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens.'),
  parent: Yup.string().nullable(),
});

export default function EditCategoryPage() {
  const router = useRouter();
  const params = useParams();
  const categoryId = params.categoryId as string;
  const { data: session, status: authStatus } = useSession();

  const [isLoading, setIsLoading] = useState(false); // For form submission
  const [isFetchingCategory, setIsFetchingCategory] = useState(true); // For initial data load
  const [apiError, setApiError] = useState<string | null>(null);
  const [categoriesForSelect, setCategoriesForSelect] = useState<CategoryOption[]>([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true); // For parent categories dropdown
  const [originalSlug, setOriginalSlug] = useState('');


  const form = useForm({
    initialValues: {
      name: '',
      slug: '',
      parent: null as string | null,
    },
    validate: yupResolver(schema),
  });

  const categoryName = form.values.name;
  useEffect(() => {
    // Auto-generate slug if:
    // 1. Name is changed by user AND
    // 2. Slug field is currently empty OR slug field matches the auto-generated slug of the *original* name (before edit)
    // OR if the slug field was not manually touched by the user after name change.
    // This is complex. Simpler: if name changes, and slug is empty, or slug was the original auto-slug, then update.
    if (categoryName && (!form.values.slug || (originalSlug && form.values.slug === generateSlug(form.values.name_before_edit_if_tracked)) || !form.DIRTY_FIELDS.slug )) {
        // form.values.name_before_edit_if_tracked would need to be stored if using that logic
        // For now, only generate if slug becomes empty or was not touched while name changed
        if (form.values.slug === '' || (form.DIRTY_FIELDS.name && !form.DIRTY_FIELDS.slug)) {
             form.setFieldValue('slug', generateSlug(categoryName));
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryName, originalSlug, form.DIRTY_FIELDS.name, form.DIRTY_FIELDS.slug]);


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
                     data
                        .filter((cat: any) => cat._id !== categoryId) // Filter out current category
                        .map((cat: any) => ({ value: cat._id, label: cat.name }))
                 );
             } catch (err: any) {
                 notifications.show({ title: 'Error', message: err.message || 'Could not load parent categories.', color: 'red' });
             } finally {
                 setIsCategoriesLoading(false);
             }
         };
         fetchParentCategories();
     }
  }, [authStatus, router, categoryId]);

  useEffect(() => {
    if (categoryId && authStatus === 'authenticated') {
        const fetchCategoryData = async () => {
            setIsFetchingCategory(true);
            setApiError(null);
            try {
                const response = await fetch(`/api/admin/categories/${categoryId}`);
                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.message || 'Failed to fetch category details.');
                }
                const data: CategoryDataFromAPI = await response.json();
                form.setValues({
                    name: data.name,
                    slug: data.slug,
                    parent: typeof data.parent === 'string' ? data.parent : data.parent?._id || null,
                });
                setOriginalSlug(data.slug); // Store original slug for auto-generation logic
            } catch (err: any) {
                setApiError(err.message);
                notifications.show({ title: 'Error', message: `Failed to load category: ${err.message}`, color: 'red' });
            } finally {
                setIsFetchingCategory(false);
            }
        };
        fetchCategoryData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, authStatus]); // form.setValues removed


  const handleSubmit = async (values: typeof form.values) => {
    setIsLoading(true);
    setApiError(null);
    try {
      const payload = {
        name: values.name,
        slug: values.slug,
        parent: values.parent || null,
      };
      const response = await fetch(`/api/admin/categories/${categoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      notifications.show({
         title: 'Category Updated',
         message: `Category "${data.name}" has been successfully updated.`,
         color: 'green',
         icon: <IconDeviceFloppy />,
      });
      router.push('/admin/categories');
    } catch (err: any) {
      setApiError(err.message || 'An unexpected error occurred.');
      notifications.show({
         title: 'Error Updating Category',
         message: err.message || 'An unexpected error occurred.',
         color: 'red',
         icon: <IconAlertCircle />,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authStatus === 'loading' || (isCategoriesLoading && authStatus === 'authenticated') || (isFetchingCategory && authStatus === 'authenticated')) {
     return (
         <AdminLayout>
            <Title order={2} mb="xl">Edit Category</Title>
             <Paper withBorder shadow="md" p={30} radius="md">
                 <Skeleton height={36} mb="md" /> {/* Name */}
                 <Skeleton height={36} mb="md" /> {/* Slug */}
                 <Skeleton height={36} mb="xl" /> {/* Parent Category */}
                 <Group justify="flex-end" mt="xl">
                    <Skeleton height={36} width={100} />
                    <Skeleton height={36} width={150} />
                 </Group>
             </Paper>
         </AdminLayout>
     );
  }
   if (authStatus === 'unauthenticated') {
     return <Text p="xl">Redirecting to login...</Text>;
  }
   if (apiError && !isFetchingCategory && !isLoading) { // Show error if initial fetch failed
    return (
        <AdminLayout>
            <Title order={2} mb="xl">Edit Category</Title>
            <Alert icon={<IconAlertCircle size="1rem" />} title="Failed to load category data" color="red">
                {apiError} Please try <Button variant="subtle" size="xs" onClick={() => window.location.reload()}>reloading</Button>.
            </Alert>
        </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Title order={2} mb="xl">Edit Category: {form.values.name || 'Loading...'}</Title>
      <Paper component="form" onSubmit={form.onSubmit(handleSubmit)} withBorder shadow="md" p={30} radius="md" pos="relative">
        <LoadingOverlay visible={isLoading} overlayProps={{ radius: 'sm', blur: 2 }} />

        {apiError && !isLoading && ( // Show submit error if not loading
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
          description="URL-friendly identifier. Auto-updated if name changes and slug was not manually set."
          {...form.getInputProps('slug')}
           onChange={(event) => {
            form.setFieldValue('slug', generateSlug(event.currentTarget.value));
            form.setDirty({ slug: true });
          }}
          mb="md"
        />
        <Select
          label="Parent Category (Optional)"
          placeholder="Select a parent category"
          data={categoriesForSelect}
          searchable
          clearable
          disabled={isCategoriesLoading || isFetchingCategory}
          {...form.getInputProps('parent')}
          mb="xl"
        />

        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={() => router.push('/admin/categories')} leftSection={<IconX size={16}/>} disabled={isLoading || isFetchingCategory}>
             Cancel
          </Button>
          <Button type="submit" leftSection={<IconDeviceFloppy size={16}/>} disabled={isLoading || isCategoriesLoading || isFetchingCategory || !form.isDirty()}>
             Save Changes
          </Button>
        </Group>
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
