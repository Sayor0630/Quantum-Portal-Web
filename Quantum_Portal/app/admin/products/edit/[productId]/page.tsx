'use client';

import AdminLayout from '../../../../../components/admin/AdminLayout';
import { Title, Paper, TextInput, Button, Group, LoadingOverlay, Alert, Textarea, NumberInput, Space, Select, TagsInput, Grid, Text, FileInput, Image as MantineImage, Progress, SimpleGrid, CloseButton, Box as MantineBox, Skeleton, Accordion, Divider, Switch } from '@mantine/core';
import { useForm, yupResolver } from '@mantine/form';
import * as Yup from 'yup';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { IconDeviceFloppy, IconAlertCircle, IconX, IconUpload, IconPhoto, IconSeo, IconArrowLeft } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useSession } from 'next-auth/react';

interface AttributeDefinition {
  _id: string;
  name: string;
  values: string[];
}

interface CategoryData {
  _id: string;
  name: string;
}

interface UploadedImageInfo {
  url: string;
  public_id: string;
}

interface ProductDataFromAPI { // For data fetched from API
    _id: string;
    name: string;
    slug: string; // Added
    description: string;
    price: number;
    sku: string;
    stockQuantity: number;
    category?: { _id: string; name: string; } | string;
    tags: string[];
    customAttributes: Record<string, string>;
    images: string[];
    seoTitle?: string;
    seoDescription?: string;
    isPublished: boolean; // Added
}

const generateSlugFromName = (name: string): string => {
    if (!name) return '';
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
};

// Yup validation schema
const schema = Yup.object().shape({
  name: Yup.string().required('Product name is required'),
  slug: Yup.string().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens.').required('Slug is required'), // Added
  description: Yup.string().required('Description is required'),
  price: Yup.number().min(0, 'Price must be non-negative').required('Price is required').typeError('Price must be a number'),
  sku: Yup.string().required('SKU is required'),
  stockQuantity: Yup.number().integer('Stock must be an integer').min(0, 'Stock must be non-negative').required('Stock quantity is required').typeError('Stock must be a number'),
  category: Yup.string().nullable(),
  tags: Yup.array().of(Yup.string()).ensure(),
  customAttributes: Yup.object().optional(),
  images: Yup.array().of(Yup.string().url("Each image must be a valid URL")).optional(),
  seoTitle: Yup.string().optional().trim().max(70, 'SEO Title should be 70 characters or less'),
  seoDescription: Yup.string().optional().trim().max(160, 'SEO Description should be 160 characters or less'),
  isPublished: Yup.boolean(), // Added
});

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.productId as string;
  const { data: session, status: authStatus } = useSession();

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingProduct, setIsFetchingProduct] = useState(true);
  const [isMetaLoading, setIsMetaLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const [originalProductName, setOriginalProductName] = useState(''); // To help with slug logic

  const [categoriesList, setCategoriesList] = useState<CategoryData[]>([]);
  const [attributeDefinitions, setAttributeDefinitions] = useState<AttributeDefinition[]>([]);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedImages, setUploadedImages] = useState<UploadedImageInfo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const form = useForm({
    initialValues: {
      name: '',
      slug: '', // Added
      description: '',
      price: 0.00,
      sku: '',
      stockQuantity: 0,
      category: '',
      tags: [] as string[],
      customAttributes: {} as Record<string, string | null>,
      images: [] as string[],
      seoTitle: '',
      seoDescription: '',
      isPublished: false, // Added
    },
    validate: yupResolver(schema),
  });

  // Slug auto-generation logic for edit page
  const currentName = form.values.name;
  const currentSlug = form.values.slug;

  useEffect(() => {
    if (currentName && !form.isDirty('slug')) { // If name changes and slug hasn't been manually touched
        if (generateSlugFromName(originalProductName) === currentSlug || currentSlug === '') {
            // If current slug was the auto-slug of original name, or if slug is now empty, regenerate
            form.setFieldValue('slug', generateSlugFromName(currentName));
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentName, originalProductName]); // form.setFieldValue removed, form.DIRTY_FIELDS.slug removed as it causes issues here


  useEffect(() => {
     if (authStatus === 'unauthenticated') {
         router.replace('/admin/login');
     }
     if (authStatus === 'authenticated') {
        const fetchMetaData = async () => { /* ... (metadata fetch logic remains same) ... */
            setIsMetaLoading(true);
            try {
                const [catRes, attrRes] = await Promise.all([ fetch('/api/admin/categories'), fetch('/api/admin/attribute-definitions'),]);
                if (!catRes.ok) throw new Error('Failed to fetch categories for form');
                if (!attrRes.ok) throw new Error('Failed to fetch attribute definitions for form');
                const catData = await catRes.json(); const attrData = await attrRes.json();
                setCategoriesList(catData.map((c: any) => ({ _id: c._id, name: c.name })));
                setAttributeDefinitions(attrData);
            } catch (err: any) { notifications.show({ title: 'Error loading form metadata', message: err.message, color: 'red' });
            } finally { setIsMetaLoading(false); }
        };
        fetchMetaData();
      }
  }, [authStatus, router]); // Added router

  useEffect(() => {
    if (productId && authStatus === 'authenticated') {
        const fetchProductData = async () => {
            setIsFetchingProduct(true); setApiError(null);
            try {
                const response = await fetch(`/api/admin/products/${productId}`);
                if (!response.ok) { const errData = await response.json(); throw new Error(errData.message || 'Failed to fetch product details.'); }
                const productData: ProductDataFromAPI = await response.json();
                form.setValues({
                    name: productData.name,
                    slug: productData.slug || generateSlugFromName(productData.name), // Ensure slug is populated
                    description: productData.description,
                    price: productData.price,
                    sku: productData.sku || '', // Ensure SKU is a string
                    stockQuantity: productData.stockQuantity,
                    category: typeof productData.category === 'string' ? productData.category : productData.category?._id || '',
                    tags: productData.tags || [],
                    customAttributes: productData.customAttributes || {},
                    images: productData.images || [],
                    seoTitle: productData.seoTitle || '',
                    seoDescription: productData.seoDescription || '',
                    isPublished: productData.isPublished || false, // Populate isPublished
                });
                setOriginalProductName(productData.name); // Store original name for slug logic
                setUploadedImages(productData.images?.map((url: string, index: number) => ({ url, public_id: `existing_image_${productId}_${index}` })) || []);
                form.resetDirty();
            } catch (err: any) {
                setApiError(err.message);
                notifications.show({ title: 'Error', message: `Failed to load product: ${err.message}`, color: 'red' });
            } finally { setIsFetchingProduct(false); }
        };
        fetchProductData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, authStatus, form]); // Added form

  const handleFileSelectAndUpload = async (files: File[]) => { /* ... (image upload logic remains same) ... */
    if (!files || files.length === 0) return;
    setIsUploading(true); setUploadError(null); const currentUploadedImages = [...uploadedImages];
    for (const file of files) {
      try {
        const sigResponse = await fetch('/api/admin/upload/cloudinary-signature', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: 'product_images' }) });
        if (!sigResponse.ok) throw new Error((await sigResponse.json()).message || 'Failed to get upload signature.');
        const sigData = await sigResponse.json();
        const formData = new FormData();
        formData.append('file', file); formData.append('api_key', sigData.api_key); formData.append('timestamp', sigData.timestamp); formData.append('signature', sigData.signature);
        if (sigData.folder) formData.append('folder', sigData.folder);
        const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${sigData.cloud_name}/image/upload`;
        const cloudinaryResponse = await fetch(cloudinaryUrl, { method: 'POST', body: formData });
        if (!cloudinaryResponse.ok) throw new Error((await cloudinaryResponse.json()).error?.message || 'Cloudinary upload failed.');
        const cloudinaryData = await cloudinaryResponse.json();
        currentUploadedImages.push({ url: cloudinaryData.secure_url, public_id: cloudinaryData.public_id });
      } catch (err: any) {
        setUploadError((prev) => prev ? `${prev}\n${file.name}: ${err.message}` : `${file.name}: ${err.message}`);
        notifications.show({ title: `Upload Error: ${file.name}`, message: err.message, color: 'red' });
      }
    }
    setUploadedImages(currentUploadedImages); setSelectedFiles([]);
    form.setFieldValue('images', currentUploadedImages.map(img => img.url)); form.setDirty({ images: true });
    setIsUploading(false);
  };

  const handleRemoveUploadedImage = (publicIdToRemove: string) => { /* ... (image removal logic remains same) ... */
    const newUploadedImages = uploadedImages.filter(img => img.public_id !== publicIdToRemove);
    setUploadedImages(newUploadedImages); form.setFieldValue('images', newUploadedImages.map(img => img.url)); form.setDirty({ images: true });
  };

  const handleSubmit = async (values: typeof form.values) => {
    setIsLoading(true); setApiError(null);
    try {
      const payload = {
        name: values.name,
        slug: values.slug, // Added
        isPublished: values.isPublished, // Added
        description: values.description,
        price: values.price,
        sku: values.sku,
        stockQuantity: values.stockQuantity,
        category: values.category || null,
        tags: values.tags,
        customAttributes: Object.fromEntries( Object.entries(values.customAttributes).filter(([_, value]) => value !== null && value !== '') ),
        images: uploadedImages.map(img => img.url),
        seoTitle: values.seoTitle || undefined,
        seoDescription: values.seoDescription || undefined,
      };
      const response = await fetch(`/api/admin/products/${productId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
      notifications.show({ title: 'Product Updated', message: `Product "${data.name}" updated.`, color: 'green', icon: <IconDeviceFloppy /> });
      form.resetDirty(data);
      setUploadedImages(data.images?.map((url: string, index: number) => ({ url, public_id: uploadedImages.find(u => u.url === url)?.public_id || `existing_image_${productId}_${index}`})) || []);
      setOriginalProductName(data.name); // Update original name after successful save
    } catch (err: any) {
      setApiError(err.message || 'An unexpected error occurred.');
      notifications.show({ title: 'Error Updating Product', message: err.message || 'An unexpected error occurred.', color: 'red', icon: <IconAlertCircle /> });
    } finally { setIsLoading(false); }
  };

  if (authStatus === 'loading' || ((isMetaLoading || isFetchingProduct) && authStatus === 'authenticated')) { /* ... (Skeleton UI remains same, ensure it covers new fields conceptually) ... */
    return (
         <AdminLayout>
             <Title order={2} mb="xl">Edit Product</Title>
             <Paper withBorder shadow="md" p="xl" radius="md">
                 <Skeleton height={36} mb="sm" /> <Skeleton height={36} mb="md" /> {/* Name, Slug */}
                 <Skeleton height={76} mb="md" /> {/* Description */}
                 <Grid><Grid.Col span={4}><Skeleton height={36}/></Grid.Col><Grid.Col span={4}><Skeleton height={36}/></Grid.Col><Grid.Col span={4}><Skeleton height={36}/></Grid.Col></Grid> {/* Price, SKU, Stock */}
                 <Skeleton height={24} mb="md" width="50%"/> {/* isPublished Switch */}
                 <Divider my="lg" />
                 <Skeleton height={36} mb="md" /> <Skeleton height={60} mb="md" /> {/* Category, Tags */}
                 <Title order={4} mt="lg" mb="sm">Custom Attributes</Title>
                 <Grid><Grid.Col span={{base:12, md:6}}><Skeleton height={36} mb="sm"/></Grid.Col><Grid.Col span={{base:12, md:6}}><Skeleton height={36} mb="sm"/></Grid.Col></Grid>
                 <Title order={4} mt="lg" mb="sm">Product Images</Title>
                 <Skeleton height={76} mb="md" />
                 <SimpleGrid cols={4} mb="md"><Skeleton height={100} /><Skeleton height={100} /><Skeleton height={100} /></SimpleGrid>
                 <Accordion defaultValue="seo_settings" mt="lg" mb="md"><Accordion.Item value="seo_settings"><Accordion.Control><Skeleton height={20}/></Accordion.Control><Accordion.Panel><Skeleton height={36} mb="sm" /><Skeleton height={76}/></Accordion.Panel></Accordion.Item></Accordion>
                 <Group justify="flex-end" mt="xl"><Skeleton height={36} width={100} /><Skeleton height={36} width={150} /></Group>
             </Paper>
         </AdminLayout>
     );
  }
  // ... (rest of component, including return statement with new form fields)

  return (
    <AdminLayout>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Edit Product: {form.values.name || "Loading..."}</Title>
        <Button variant="outline" component={Link} href="/admin/products" leftSection={<IconArrowLeft size={16}/>}>Back to Products</Button>
      </Group>
      <Paper component="form" onSubmit={form.onSubmit(handleSubmit)} withBorder shadow="md" p="xl" radius="md" pos="relative">
        <LoadingOverlay visible={isLoading || isUploading} overlayProps={{ radius: 'sm', blur: 2 }} />
        {apiError && !isLoading && ( <Alert icon={<IconAlertCircle size="1rem" />} title="Error!" color="red" withCloseButton onClose={() => setApiError(null)} mb="md">{apiError}</Alert> )}

        <TextInput label="Product Name" placeholder="e.g., Awesome T-Shirt" required {...form.getInputProps('name')} mb="sm" />
        <TextInput label="Slug" placeholder="e.g., awesome-t-shirt" required description="URL-friendly identifier. Auto-updates if name changes and slug was not manually set, or customize it." {...form.getInputProps('slug')}
            onChange={(event) => {
                form.setFieldValue('slug', generateSlugFromName(event.currentTarget.value));
                form.setDirty({slug: true});
            }}
            mb="md" />
        <Textarea label="Description" placeholder="Detailed description..." required autosize minRows={3} {...form.getInputProps('description')} mb="md" />
        <Grid mb="md">
            <Grid.Col span={{base:12, md:4}}><NumberInput label="Price" placeholder="0.00" required decimalScale={2} step={0.01} min={0} leftSection="$" {...form.getInputProps('price')} /></Grid.Col>
            <Grid.Col span={{base:12, md:4}}><TextInput label="SKU" placeholder="e.g., TSHIRT-BLK-LG" required {...form.getInputProps('sku')} /></Grid.Col>
            <Grid.Col span={{base:12, md:4}}><NumberInput label="Stock Quantity" placeholder="0" required min={0} step={1} allowDecimal={false} {...form.getInputProps('stockQuantity')} /></Grid.Col>
        </Grid>

        <Switch label="Product is Published (visible on storefront)" {...form.getInputProps('isPublished', { type: 'checkbox' })} mb="md" />
        <Divider my="lg" label="Categorization, Attributes & Images" labelPosition="center" />

        <Select label="Category" placeholder="Select a category" data={categoriesList.map(cat => ({ value: cat._id, label: cat.name }))} searchable clearable disabled={isMetaLoading} {...form.getInputProps('category')} mb="md" />
        <TagsInput label="Tags" placeholder="Enter tags" description="Press Enter or comma" clearable {...form.getInputProps('tags')} mb="md" />

        <Title order={4} mt="lg" mb="sm">Custom Attributes</Title>
        {isMetaLoading && <Text c="dimmed" size="sm">Loading attributes...</Text>}
        {!isMetaLoading && attributeDefinitions.length === 0 && <Text c="dimmed" size="sm">No attributes defined.</Text>}
        <Grid mb="md">
            {attributeDefinitions.map((attrDef) => (
                <Grid.Col span={{ base: 12, md: 6 }} key={attrDef._id}>
                    <Select label={attrDef.name} placeholder={`Select ${attrDef.name}`} data={attrDef.values.map(val => ({ value: val, label: val }))} clearable value={form.values.customAttributes[attrDef.name] || null}
                        onChange={(value) => {
                            const newAttrs = { ...form.values.customAttributes };
                            if (value) newAttrs[attrDef.name] = value; else delete newAttrs[attrDef.name];
                            form.setFieldValue('customAttributes', newAttrs);
                        }} mb="sm" />
                </Grid.Col>
            ))}
        </Grid>

        <Title order={4} mt="lg" mb="sm">Product Images</Title>
        <FileInput label="Add New Images" placeholder="Select images" multiple accept="image/*" onChange={handleFileSelectAndUpload} disabled={isUploading || isLoading || isFetchingProduct} mb="md" value={selectedFiles} clearable />
        {isUploading && <Progress value={100} striped animated mb="md" />}
        {uploadError && (<Alert color="red" title="Upload Error" icon={<IconAlertCircle />} withCloseButton onClose={() => setUploadError(null)} mb="md">{uploadError}</Alert>)}
        {uploadedImages.length > 0 && (<Text size="sm" mb="xs" mt="md">Current Images:</Text>)}
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }} mb="md" spacing="sm">
            {uploadedImages.map((image) => (
                <MantineBox key={image.public_id || image.url} pos="relative" style={{border: '1px solid #dee2e6', padding: '4px', borderRadius: '4px' }}>
                    <MantineImage src={image.url} alt="Product image" radius="sm" h={100} fit="contain" />
                    <CloseButton size="xs" onClick={() => handleRemoveUploadedImage(image.public_id || image.url)} pos="absolute" top={2} right={2} bg="rgba(255,255,255,0.7)" radius="xl" disabled={isUploading || isLoading} />
                </MantineBox>
            ))}
        </SimpleGrid>

        <Accordion defaultValue="seo_settings" mt="lg" mb="md">
            <Accordion.Item value="seo_settings">
                <Accordion.Control icon={<IconSeo size={20}/>}>SEO Settings (Optional)</Accordion.Control>
                <Accordion.Panel>
                    <TextInput label="SEO Title" placeholder="Custom title for search (max 70 chars)" {...form.getInputProps('seoTitle')} mb="sm" description="Uses product name if empty."/>
                    <Textarea label="SEO Meta Description" placeholder="Brief summary for search (max 160 chars)" autosize minRows={3} {...form.getInputProps('seoDescription')} description="Uses product description if empty."/>
                </Accordion.Panel>
            </Accordion.Item>
        </Accordion>

        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={() => router.push('/admin/products')} leftSection={<IconX size={16}/>} disabled={isLoading || isUploading || isFetchingProduct}>Cancel</Button>
          <Button type="submit" leftSection={<IconDeviceFloppy size={16}/>} disabled={isLoading || isMetaLoading || isUploading || isFetchingProduct || !form.isDirty()}>Save Changes</Button>
        </Group>
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
