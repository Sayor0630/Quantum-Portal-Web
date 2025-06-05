'use client';

import AdminLayout from '../../../../../components/admin/AdminLayout';
import { Title, Paper, TextInput, Button, Group, LoadingOverlay, Alert, Select, Space, Text, Skeleton, Grid, Switch } from '@mantine/core'; // Added Switch
import { useForm, yupResolver } from '@mantine/form';
import * as Yup from 'yup';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { IconDeviceFloppy, IconAlertCircle, IconX, IconArrowLeft } from '@tabler/icons-react'; // Added IconArrowLeft
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
   parent?: { _id: string; name: string; } | string | null;
   isPublished?: boolean; // Added
}

// Renamed for clarity from the model's generateSlugFromName
const generateSlugForCategory = (name: string) => {
    if (!name) return '';
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
};

const schema = Yup.object().shape({
  name: Yup.string().required('Category name is required'),
  slug: Yup.string().required('Slug is required').matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens.'),
  parent: Yup.string().nullable(),
  isPublished: Yup.boolean(), // Added
});

export default function EditCategoryPage() {
  const router = useRouter();
  const params = useParams();
  const categoryId = params?.categoryId as string;
  const { data: session, status: authStatus } = useSession();

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingCategory, setIsFetchingCategory] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [categoriesForSelect, setCategoriesForSelect] = useState<CategoryOption[]>([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [isSlugManuallySet, setIsSlugManuallySet] = useState(false);

  const form = useForm({
    initialValues: {
      name: '',
      slug: '',
      parent: null as string | null,
      isPublished: false, // Added
    },
    validate: yupResolver(schema),
  });
  // Slug auto-generation logic using product edit pattern
  const currentCategoryName = form.values.name;
  useEffect(() => {
    if (currentCategoryName && (!form.values.slug || !isSlugManuallySet)) {
      form.setFieldValue('slug', generateSlugForCategory(currentCategoryName));
    }
  }, [currentCategoryName, isSlugManuallySet]);

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
                        .filter((cat: any) => cat._id !== categoryId)
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
                    isPublished: data.isPublished || false, // Populate isPublished
                });
                form.resetDirty(); // Reset dirty state after initial population
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
  }, [categoryId, authStatus]);


  const handleSubmit = async (values: typeof form.values) => {
    setIsLoading(true);
    setApiError(null);
    try {
      const payload = {
        name: values.name,
        slug: values.slug,
        parent: values.parent || null,
        isPublished: values.isPublished, // Added
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
      form.resetDirty(data); // Reset dirty state with new values
      // router.push('/admin/categories'); // Optional: redirect or stay
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

  if (authStatus === 'loading' || ((isCategoriesLoading || isFetchingCategory) && authStatus === 'authenticated')) {
     return (
         <AdminLayout>
            <Title order={2} mb="xl">Edit Category</Title>
             <Paper withBorder shadow="md" p="xl" radius="md"> {/* Increased padding */}
                 <Skeleton height={36} mb="md" />
                 <Skeleton height={36} mb="md" />
                 <Skeleton height={36} mb="md" /> {/* Parent Category */}
                 <Skeleton height={24} mb="xl" width="60%"/> {/* isPublished Switch */}
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
   if (apiError && !isFetchingCategory && !isLoading && !form.isDirty()) {
    return (
        <AdminLayout>
            <Group justify="space-between" mb="xl"><Title order={2}>Edit Category</Title><Button variant="outline" component={Link} href="/admin/categories" leftSection={<IconArrowLeft size={16}/>}>Back</Button></Group>
            <Alert icon={<IconAlertCircle size="1rem" />} title="Failed to load category data" color="red">{apiError}</Alert>
        </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Edit Category: {form.values.name || "Loading..."}</Title>
        <Button variant="outline" component={Link} href="/admin/categories" leftSection={<IconArrowLeft size={16}/>}>
            Back to Categories
        </Button>
      </Group>
      <Paper component="form" onSubmit={form.onSubmit(handleSubmit)} withBorder shadow="md" p="xl" radius="md" pos="relative" maw={700}> {/* Increased padding */}
        <LoadingOverlay visible={isLoading} overlayProps={{ radius: 'sm', blur: 2 }} />

        {apiError && !isLoading && (
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
          description="URL-friendly identifier. Auto-updates if name changes and slug was not manually set, or customize it."
          {...form.getInputProps('slug')}
           onChange={(event) => {
            form.setFieldValue('slug', generateSlugForCategory(event.currentTarget.value)); // Use renamed helper
            setIsSlugManuallySet(true);
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
          mb="md" // Changed from mb="xl"
        />
        <Switch
            label="Publish Category (Visible on storefront)"
            {...form.getInputProps('isPublished', { type: 'checkbox' })}
            mb="xl"
        />

        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={() => router.push('/admin/categories')} leftSection={<IconX size={16}/>} disabled={isLoading || isFetchingCategory}>
             Cancel
          </Button>
          <Button type="submit" leftSection={<IconDeviceFloppy size={16}/>} loading={isLoading} disabled={isLoading || isCategoriesLoading || isFetchingCategory || !form.isDirty()}>
             Save Changes
          </Button>
        </Group>
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
