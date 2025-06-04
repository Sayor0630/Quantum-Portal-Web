'use client';

import AdminLayout from '../../../../../components/admin/AdminLayout';
import { Title, Paper, TextInput, Button, Group, LoadingOverlay, Alert, Select, Switch, Textarea, MultiSelect, Space, JsonInput, Text, Divider } from '@mantine/core'; // Added Text
import { useForm, yupResolver } from '@mantine/form';
import * as Yup from 'yup';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconAlertCircle, IconX, IconPlus } from '@tabler/icons-react';

const SECTION_TYPES = [
  { value: 'hero', label: 'Hero Section' },
  { value: 'banner', label: 'Banner' },
  { value: 'productCarousel', label: 'Product Carousel (Select Products)' },
  { value: 'categoryList', label: 'Category List (Select Categories)' },
  { value: 'promotionalBlock', label: 'Promotional Block' },
  { value: 'customHtml', label: 'Custom HTML' },
  { value: 'featuredProducts', label: 'Featured Products (Manual Select)' }, // Similar to productCarousel
];

interface ProductSelectItem { value: string; label: string; }
interface CategorySelectItem { value: string; label: string; }

const commonSchema = Yup.object({
  name: Yup.string().required('Admin name for this section is required'),
  type: Yup.string().required('Section type is required').oneOf(SECTION_TYPES.map(t => t.value)),
  isVisible: Yup.boolean(),
  content: Yup.object().shape({ // Basic content structure, specific fields validated contextually or in handleSubmit
    title: Yup.string().optional().trim(),
    subtitle: Yup.string().optional().trim(),
    text: Yup.string().optional().trim(),
    imageUrl: Yup.string().url('Must be a valid URL for Image URL').nullable().transform(v => v === "" ? null : v),
    videoUrl: Yup.string().url('Must be a valid URL for Video URL').nullable().transform(v => v === "" ? null : v),
    buttonText: Yup.string().optional().trim(),
    buttonLink: Yup.string().url('Must be a valid URL for Button Link').nullable().transform(v => v === "" ? null : v),
    items: Yup.array().of(Yup.string()).optional(), // Array of IDs for product/category items
    htmlContent: Yup.string().optional(),
  })
});

export default function NewHomepageSectionPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [productsForSelect, setProductsForSelect] = useState<ProductSelectItem[]>([]);
  const [categoriesForSelect, setCategoriesForSelect] = useState<CategorySelectItem[]>([]);
  const [isMetaLoading, setIsMetaLoading] = useState(false);

  const form = useForm({
    initialValues: {
      name: '',
      type: '',
      isVisible: true,
      content: {
        title: '',
        subtitle: '',
        text: '',
        imageUrl: '',
        videoUrl: '',
        buttonText: '',
        buttonLink: '',
        items: [] as string[], // Store array of selected IDs
        htmlContent: '',
      },
    },
    validate: yupResolver(commonSchema),
  });

  const selectedType = form.values.type;

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.replace('/admin/login');
  }, [authStatus, router]);

  useEffect(() => {
    const fetchSelectData = async () => {
      if (authStatus !== 'authenticated') return;

      if (selectedType === 'productCarousel' || selectedType === 'featuredProducts') {
        if (productsForSelect.length === 0) { // Fetch only if not already fetched
            setIsMetaLoading(true);
            try {
              const prodRes = await fetch('/api/admin/products?limit=1000&fields=name,_id'); // Fetch a good number for selection, only needed fields
              if (!prodRes.ok) throw new Error('Failed to fetch products for selection');
              const prodData = await prodRes.json();
              setProductsForSelect(prodData.products.map((p: any) => ({ value: p._id, label: p.name })));
            } catch (err) {
              notifications.show({ title: 'Error loading products', message: (err as Error).message, color: 'red' });
            } finally {
              setIsMetaLoading(false);
            }
        }
      } else if (selectedType === 'categoryList') {
        if (categoriesForSelect.length === 0) { // Fetch only if not already fetched
            setIsMetaLoading(true);
            try {
              const catRes = await fetch('/api/admin/categories');
              if (!catRes.ok) throw new Error('Failed to fetch categories for selection');
              const catData = await catRes.json();
              setCategoriesForSelect(catData.map((c: any) => ({ value: c._id, label: c.name })));
            } catch (err) {
              notifications.show({ title: 'Error loading categories', message: (err as Error).message, color: 'red' });
            } finally {
              setIsMetaLoading(false);
            }
        }
      }
    };
    fetchSelectData();
  }, [authStatus, selectedType, productsForSelect.length, categoriesForSelect.length]);


  const handleSubmit = async (values: typeof form.values) => {
    setIsLoading(true); setApiError(null);

    let specificContent: any = {};
    switch (values.type) {
      case 'hero':
      case 'banner':
      case 'promotionalBlock':
        specificContent = {
          title: values.content.title || undefined,
          subtitle: values.content.subtitle || undefined,
          text: values.content.text || undefined,
          imageUrl: values.content.imageUrl || undefined,
          buttonText: values.content.buttonText || undefined,
          buttonLink: values.content.buttonLink || undefined,
        };
        break;
      case 'productCarousel':
      case 'featuredProducts':
        specificContent = {
          title: values.content.title || undefined,
          items: values.content.items?.map(id => ({ itemId: id, itemType: 'Product' })) || [],
        };
        break;
      case 'categoryList':
        specificContent = {
          title: values.content.title || undefined,
          items: values.content.items?.map(id => ({ itemId: id, itemType: 'Category' })) || [],
        };
        break;
      case 'customHtml':
        specificContent = { htmlContent: values.content.htmlContent || '' };
        break;
      default:
        specificContent = {};
    }

    const payload = {
      name: values.name,
      type: values.type,
      isVisible: values.isVisible,
      content: specificContent,
      order: 0, // API (Subtask 19) sets order on creation if not provided, or handles reorder
    };

    try {
      const response = await fetch('/api/admin/homepage-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);

      notifications.show({ title: 'Section Created', message: `Section "${data.name}" created successfully.`, color: 'green', icon: <IconPlus/> });
      router.push('/admin/homepage-builder');
    } catch (err: any) {
      setApiError(err.message);
      notifications.show({ title: 'Error Creating Section', message: err.message, color: 'red', icon: <IconAlertCircle/> });
    } finally { setIsLoading(false); }
  };

  const handleTypeChange = (value: string | null) => {
    form.setFieldValue('type', value || '');
    // Reset content when type changes to avoid carrying over irrelevant fields
    form.setFieldValue('content', { title: '', subtitle: '', text: '', imageUrl: '', videoUrl: '', buttonText: '', buttonLink: '', items: [], htmlContent: '' });
  };

  if (authStatus === 'loading') return <AdminLayout><LoadingOverlay visible={true} overlayProps={{radius:'sm', blur:2, fixed:true}} /></AdminLayout>;
  if (authStatus === 'unauthenticated') return <Text p="xl">Redirecting to login...</Text>;

  const renderContentFields = () => {
     switch (selectedType) {
         case 'hero':
         case 'banner':
         case 'promotionalBlock':
             return (<>
                 <TextInput label="Title" placeholder="Main heading" {...form.getInputProps('content.title')} mb="sm" />
                 <Textarea label="Subtitle / Text" placeholder="Supporting text or details" {...form.getInputProps('content.text')} mb="sm" autosize minRows={2}/>
                 <TextInput label="Image URL" placeholder="https://example.com/image.jpg" {...form.getInputProps('content.imageUrl')} mb="sm" />
                 <TextInput label="Button Text" placeholder="e.g., Shop Now, Learn More" {...form.getInputProps('content.buttonText')} mb="sm" />
                 <TextInput label="Button Link (URL)" placeholder="/category/some-product or external link" {...form.getInputProps('content.buttonLink')} mb="sm" />
             </>);
         case 'productCarousel':
         case 'featuredProducts':
             return (<>
                 <TextInput label="Section Title" placeholder="e.g., Top Picks, New Arrivals" {...form.getInputProps('content.title')} mb="sm" required={selectedType === 'productCarousel'}/>
                 <MultiSelect
                     label={selectedType === 'productCarousel' ? "Select Products for Carousel" : "Select Featured Products"}
                     data={productsForSelect}
                     searchable
                     nothingFoundMessage={isMetaLoading ? "Loading products..." : "No products found or type not selected"}
                     disabled={isMetaLoading || productsForSelect.length === 0}
                     placeholder="Search and select products"
                     limit={20} // For performance with large lists
                     {...form.getInputProps('content.items')}
                     mb="sm"
                 />
             </>);
         case 'categoryList':
              return (<>
                 <TextInput label="Section Title" placeholder="e.g., Shop by Category" {...form.getInputProps('content.title')} mb="sm" />
                 <MultiSelect
                     label="Select Categories to Display"
                     data={categoriesForSelect}
                     searchable
                     nothingFoundMessage={isMetaLoading ? "Loading categories..." : "No categories found or type not selected"}
                     disabled={isMetaLoading || categoriesForSelect.length === 0}
                     placeholder="Search and select categories"
                     limit={20}
                     {...form.getInputProps('content.items')}
                     mb="sm"
                 />
             </>);
         case 'customHtml':
             return <Textarea
                         label="Custom HTML Content"
                         placeholder='<div>\n  <h2>Custom Title</h2>\n  <p>Your HTML content here.</p>\n</div>'
                         autosize
                         minRows={8}
                         {...form.getInputProps('content.htmlContent')}
                         mb="sm"
                         styles={{ input: { fontFamily: 'monospace' }}}
                     />;
         default:
             return <Text c="dimmed" fs="italic" mt="md">Select a section type to see its specific content fields.</Text>;
     }
  };

  return (
    <AdminLayout>
      <Title order={2} mb="xl">Add New Homepage Section</Title>
      <Paper component="form" onSubmit={form.onSubmit(handleSubmit)} withBorder shadow="md" p="xl" radius="md" pos="relative"> {/* Increased padding */}
        <LoadingOverlay visible={isLoading || (isMetaLoading && (selectedType === 'productCarousel' || selectedType === 'featuredProducts' || selectedType === 'categoryList'))} overlayProps={{radius:'sm', blur:1}} />
        {apiError && <Alert icon={<IconAlertCircle/>} title="API Error!" color="red" withCloseButton onClose={() => setApiError(null)} mb="md">{apiError}</Alert>}

        <TextInput label="Admin Section Name" placeholder="Internal name, e.g., Summer Hero Banner" required {...form.getInputProps('name')} mb="md" />
        <Select label="Section Type" placeholder="Choose a type" data={SECTION_TYPES} required {...form.getInputProps('type')} mb="md" onChange={handleTypeChange} />
        <Switch label="Make this section visible on homepage?" {...form.getInputProps('isVisible', { type: 'checkbox' })} mb="xl" />

        {selectedType && <Divider my="lg" label={<Text fw={500}>Content for: {SECTION_TYPES.find(t=>t.value === selectedType)?.label || 'Selected Type'}</Text>} labelPosition="center" />}

        {renderContentFields()}

        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={() => router.push('/admin/homepage-builder')} leftSection={<IconX size={16}/>} disabled={isLoading}>Cancel</Button>
          <Button
            type="submit"
            leftSection={<IconDeviceFloppy size={16}/>}
            disabled={isLoading || !selectedType || (isMetaLoading && (selectedType === 'productCarousel' || selectedType === 'featuredProducts' || selectedType === 'categoryList'))}
          >
            Save Section
          </Button>
        </Group>
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
