'use client';

import AdminLayout from '../../../../../components/admin/AdminLayout';
import { Title, Paper, TextInput, Button, Group, LoadingOverlay, Alert, Select, Switch, Textarea, MultiSelect, Space, JsonInput, Text, Skeleton, Grid, Divider } from '@mantine/core'; // Added Skeleton, Grid, Divider
import { useForm, yupResolver } from '@mantine/form';
import * as Yup from 'yup';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation'; // Added useParams
import Link from 'next/link';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconAlertCircle, IconX, IconArrowLeft } from '@tabler/icons-react'; // Added IconArrowLeft

const SECTION_TYPES = [
  { value: 'hero', label: 'Hero Section' },
  { value: 'banner', label: 'Banner' },
  { value: 'productCarousel', label: 'Product Carousel (Select Products)' },
  { value: 'categoryList', label: 'Category List (Select Categories)' },
  { value: 'promotionalBlock', label: 'Promotional Block' },
  { value: 'customHtml', label: 'Custom HTML' },
  { value: 'featuredProducts', label: 'Featured Products (Manual Select)' },
];

interface ProductSelectItem { value: string; label: string; }
interface CategorySelectItem { value: string; label: string; }

// For fetched data
interface FetchedSectionContentItem {
    itemId?: { _id: string; name: string; } | string; // API might populate or just give ID
    itemType?: 'Product' | 'Category' | 'CustomLink';
    // other fields like imageUrl, title, subtitle, link if they are part of the item itself
}
interface FetchedSectionContent {
    title?: string; subtitle?: string; text?: string; imageUrl?: string; videoUrl?: string;
    buttonText?: string; buttonLink?: string; items?: FetchedSectionContentItem[]; htmlContent?: string;
}
interface HomepageSectionData {
    _id: string; name: string; type: string; isVisible: boolean; content: FetchedSectionContent; order: number;
}

// For form state
interface FormContent {
    title: string; subtitle: string; text: string; imageUrl: string; videoUrl: string;
    buttonText: string; buttonLink: string; items: string[]; htmlContent: string;
}
interface FormValues {
    name: string; type: string; isVisible: boolean; content: FormContent;
}


const commonSchema = Yup.object({
  name: Yup.string().required('Admin name for this section is required'),
  type: Yup.string().required('Section type is required').oneOf(SECTION_TYPES.map(t => t.value)),
  isVisible: Yup.boolean(),
  content: Yup.object().shape({
    title: Yup.string().optional().trim(),
    subtitle: Yup.string().optional().trim(),
    text: Yup.string().optional().trim(),
    imageUrl: Yup.string().url('Must be a valid URL for Image URL').nullable().transform(v => v === "" ? null : v),
    videoUrl: Yup.string().url('Must be a valid URL for Video URL').nullable().transform(v => v === "" ? null : v),
    buttonText: Yup.string().optional().trim(),
    buttonLink: Yup.string().url('Must be a valid URL for Button Link').nullable().transform(v => v === "" ? null : v),
    items: Yup.array().of(Yup.string()).optional(),
    htmlContent: Yup.string().optional(),
  })
});

export default function EditHomepageSectionPage() {
  const router = useRouter();
  const params = useParams();
  const sectionId = params?.sectionId as string;
  const { data: session, status: authStatus } = useSession();

  const [isLoading, setIsLoading] = useState(false); // For form submission
  const [isFetchingSection, setIsFetchingSection] = useState(true); // For initial section data load
  const [apiError, setApiError] = useState<string | null>(null);

  const [productsForSelect, setProductsForSelect] = useState<ProductSelectItem[]>([]);
  const [categoriesForSelect, setCategoriesForSelect] = useState<CategorySelectItem[]>([]);
  const [isMetaLoading, setIsMetaLoading] = useState(false); // For loading products/categories for selects

  const form = useForm<FormValues>({
    initialValues: {
      name: '', type: '', isVisible: true,
      content: {
        title: '', subtitle: '', text: '', imageUrl: '', videoUrl: '',
        buttonText: '', buttonLink: '', items: [], htmlContent: ''
      },
    },
    validate: yupResolver(commonSchema),
  });

  const selectedType = form.values.type; // This will be set after initial data fetch

  // Fetch existing section data
  useEffect(() => {
    if (sectionId && authStatus === 'authenticated') {
      const fetchSectionData = async () => {
        setIsFetchingSection(true); setApiError(null);
        try {
          const response = await fetch(`/api/admin/homepage-sections/${sectionId}`);
          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || 'Failed to fetch section details.');
          }
          const data: HomepageSectionData = await response.json();
          form.setValues({
            name: data.name,
            type: data.type,
            isVisible: data.isVisible,
            content: { // Map fetched content to form's content structure
              title: data.content?.title || '',
              subtitle: data.content?.subtitle || '',
              text: data.content?.text || '',
              imageUrl: data.content?.imageUrl || '',
              videoUrl: data.content?.videoUrl || '',
              buttonText: data.content?.buttonText || '',
              buttonLink: data.content?.buttonLink || '',
              items: data.content?.items?.map(item => typeof item.itemId === 'string' ? item.itemId : item.itemId?._id).filter(id => id) as string[] || [],
              htmlContent: data.content?.htmlContent || '',
            }
          });
        } catch (err: any) {
          setApiError(err.message);
          notifications.show({ title: 'Error Loading Section', message: `Failed to load section data: ${err.message}`, color: 'red' });
        } finally {
          setIsFetchingSection(false);
        }
      };
      fetchSectionData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, authStatus]); // form.setValues removed

  // Fetch products and categories for select inputs based on fetched section type
  useEffect(() => {
    if (authStatus === 'authenticated' && selectedType && !isFetchingSection) { // Ensure type is known and initial fetch is done
      const fetchMeta = async () => {
        setIsMetaLoading(true);
        try {
          if (selectedType === 'productCarousel' || selectedType === 'featuredProducts') {
            if(productsForSelect.length === 0) { // Fetch only if not already loaded
              const prodRes = await fetch('/api/admin/products?limit=1000&fields=name,_id');
              if (!prodRes.ok) throw new Error('Failed to fetch products for selection');
              const prodData = await prodRes.json();
              setProductsForSelect(prodData.products.map((p: any) => ({ value: p._id, label: p.name })));
            }
          }
          if (selectedType === 'categoryList') {
             if(categoriesForSelect.length === 0) { // Fetch only if not already loaded
              const catRes = await fetch('/api/admin/categories');
              if (!catRes.ok) throw new Error('Failed to fetch categories for selection');
              const catData = await catRes.json();
              setCategoriesForSelect(catData.map((c: any) => ({ value: c._id, label: c.name })));
            }
          }
        } catch (err) {
          notifications.show({ title: 'Error Loading Select Data', message: (err as Error).message, color: 'red' });
        } finally {
          setIsMetaLoading(false);
        }
      };
      fetchMeta();
    }
  }, [authStatus, selectedType, isFetchingSection, productsForSelect.length, categoriesForSelect.length]);


  const handleSubmit = async (values: FormValues) => {
    setIsLoading(true); setApiError(null);
    let specificContent: any = {};
    // Construct content payload (same as in new/page.tsx)
    switch (values.type) {
        case 'hero': case 'banner': case 'promotionalBlock':
            specificContent = { title: values.content.title, subtitle: values.content.subtitle, text: values.content.text, imageUrl: values.content.imageUrl, buttonText: values.content.buttonText, buttonLink: values.content.buttonLink };
            break;
        case 'productCarousel': case 'featuredProducts':
            specificContent = { title: values.content.title, items: values.content.items?.map(id => ({ itemId: id, itemType: 'Product' })) || [] };
            break;
        case 'categoryList':
            specificContent = { title: values.content.title, items: values.content.items?.map(id => ({ itemId: id, itemType: 'Category' })) || [] };
            break;
        case 'customHtml':
            specificContent = { htmlContent: values.content.htmlContent };
            break;
    }
    const payload = { name: values.name, type: values.type, isVisible: values.isVisible, content: specificContent };
    // Note: 'order' is not managed by this form.

    try {
      const response = await fetch(`/api/admin/homepage-sections/${sectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);

      notifications.show({ title: 'Section Updated', message: `Section "${data.name}" updated.`, color: 'green', icon: <IconDeviceFloppy /> });
      form.resetDirty(data); // Reset dirty state with new values
      // router.push('/admin/homepage-builder'); // Optional: redirect or stay
    } catch (err: any) {
      setApiError(err.message);
      notifications.show({ title: 'Error Updating Section', message: err.message, color: 'red' });
    } finally { setIsLoading(false); }
  };

  const renderContentFields = () => { /* Same as new/page.tsx, ensure form.getInputProps paths are correct */
    switch (selectedType) { // Uses selectedType (which is form.values.type)
        case 'hero': case 'banner': case 'promotionalBlock':
            return (<>
                <TextInput label="Title" placeholder="Main heading" {...form.getInputProps('content.title')} mb="sm" />
                <Textarea label="Subtitle / Text" placeholder="Supporting text or details" {...form.getInputProps('content.text')} mb="sm" autosize minRows={2}/>
                <TextInput label="Image URL" placeholder="https://example.com/image.jpg" {...form.getInputProps('content.imageUrl')} mb="sm" />
                <TextInput label="Button Text" placeholder="e.g., Shop Now, Learn More" {...form.getInputProps('content.buttonText')} mb="sm" />
                <TextInput label="Button Link (URL)" placeholder="/category/some-product or external link" {...form.getInputProps('content.buttonLink')} mb="sm" />
            </>);
        case 'productCarousel': case 'featuredProducts':
            return (<>
                <TextInput label="Section Title (e.g., Top Picks)" {...form.getInputProps('content.title')} mb="sm" required={selectedType === 'productCarousel'}/>
                <MultiSelect label={selectedType === 'productCarousel' ? "Products for Carousel" : "Featured Products"} data={productsForSelect} searchable
                    nothingFoundMessage={isMetaLoading ? "Loading products..." : "No products found"} disabled={isMetaLoading} placeholder="Search and select products" limit={20}
                    {...form.getInputProps('content.items')} mb="sm" />
            </>);
        case 'categoryList':
             return (<>
                <TextInput label="Section Title (e.g., Shop by Category)" {...form.getInputProps('content.title')} mb="sm" />
                <MultiSelect label="Categories to Display" data={categoriesForSelect} searchable
                    nothingFoundMessage={isMetaLoading ? "Loading categories..." : "No categories found"} disabled={isMetaLoading} placeholder="Search and select categories" limit={20}
                    {...form.getInputProps('content.items')} mb="sm" />
            </>);
        case 'customHtml':
            return <Textarea label="Custom HTML Content" placeholder='<div>Your HTML here</div>' autosize minRows={8} {...form.getInputProps('content.htmlContent')} mb="sm" styles={{ input: { fontFamily: 'monospace' }}}/>;
        default:
            return !isFetchingSection && <Text c="dimmed" fs="italic" mt="md">Section type "{selectedType}" might not require specific content fields beyond Name/Visibility, or it's loading.</Text>;
    }
  };

  if (authStatus === 'loading' || (isFetchingSection && authStatus === 'authenticated')) {
    return (
        <AdminLayout>
            <Title order={2} mb="xl">Edit Homepage Section</Title>
            <Paper withBorder shadow="md" p="xl" radius="md">
                <Skeleton height={36} mb="md" /> <Skeleton height={36} mb="md" /> <Skeleton height={24} mb="md" width="50%"/>
                <Divider my="lg" label={<Text fw={500}>Content</Text>} labelPosition="center" />
                <Skeleton height={40} mb="sm" /> <Skeleton height={60} mb="sm" /> <Skeleton height={40} mb="sm" />
                <Group justify="flex-end" mt="xl"><Skeleton height={36} width={100}/><Skeleton height={36} width={150}/></Group>
            </Paper>
        </AdminLayout>
    );
  }
  if (authStatus === 'unauthenticated') return <Text p="xl">Redirecting to login...</Text>;
  if (apiError && !isFetchingSection && !isLoading) { // Show critical fetch error
    return (
        <AdminLayout>
            <Group justify="space-between" mb="xl"><Title order={2}>Edit Homepage Section</Title><Button variant="outline" component={Link} href="/admin/homepage-builder" leftSection={<IconArrowLeft size={16}/>}>Back</Button></Group>
            <Alert icon={<IconAlertCircle />} title="Failed to load section data" color="red">{apiError}</Alert>
        </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Edit Homepage Section: {form.values.name || "Loading..."}</Title>
        <Button variant="outline" component={Link} href="/admin/homepage-builder" leftSection={<IconArrowLeft size={16}/>}>
            Back to Builder
        </Button>
      </Group>
      <Paper component="form" onSubmit={form.onSubmit(handleSubmit)} withBorder shadow="md" p="xl" radius="md" pos="relative">
        <LoadingOverlay visible={isLoading || isFetchingSection || (isMetaLoading && (selectedType === 'productCarousel' || selectedType === 'featuredProducts' || selectedType === 'categoryList'))} overlayProps={{radius:'sm', blur:1}} />
        {apiError && !isLoading && <Alert icon={<IconAlertCircle/>} title="Save Error!" color="red" withCloseButton onClose={() => setApiError(null)} mb="md">{apiError}</Alert>}

        <TextInput label="Admin Section Name" placeholder="Internal name" required {...form.getInputProps('name')} mb="md" />
        <Select label="Section Type" data={SECTION_TYPES} required {...form.getInputProps('type')} mb="md" readOnly disabled /> {/* Type is read-only */}
        <Switch label="Make this section visible on homepage?" {...form.getInputProps('isVisible', { type: 'checkbox' })} mb="xl" />

        <Divider my="lg" label={<Text fw={500}>Content for: {SECTION_TYPES.find(t=>t.value === selectedType)?.label || 'Selected Type'}</Text>} labelPosition="center" />

        {selectedType ? renderContentFields() : <Text c="dimmed" ta="center" p="md">Loading content fields based on type...</Text>}

        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={() => router.push('/admin/homepage-builder')} leftSection={<IconX size={16}/>} disabled={isLoading || isFetchingSection}>Cancel</Button>
          <Button
            type="submit"
            leftSection={<IconDeviceFloppy size={16}/>}
            loading={isLoading}
            disabled={isFetchingSection || isLoading || (isMetaLoading && (selectedType === 'productCarousel' || selectedType === 'featuredProducts' || selectedType === 'categoryList')) || !form.isDirty()}
          >
            Save Changes
          </Button>
        </Group>
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
