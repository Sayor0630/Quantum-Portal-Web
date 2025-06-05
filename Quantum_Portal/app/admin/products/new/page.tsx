'use client';

import AdminLayout from '../../../../components/admin/AdminLayout';
import { Title, Paper, TextInput, Button, Group, LoadingOverlay, Alert, Textarea, NumberInput, Space, Select, TagsInput, Grid, Text, FileInput, Image as MantineImage, Progress, SimpleGrid, CloseButton, Box as MantineBox, Accordion, Divider } from '@mantine/core'; // Added Accordion, Divider
import { useForm, yupResolver } from '@mantine/form';
import * as Yup from 'yup';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IconDeviceFloppy, IconAlertCircle, IconX, IconUpload, IconPhoto, IconSeo } from '@tabler/icons-react'; // Added IconSeo
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

// Yup validation schema
const schema = Yup.object().shape({
  name: Yup.string().required('Product name is required'),
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
});

export default function NewProductPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isMetaLoading, setIsMetaLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const [categoriesList, setCategoriesList] = useState<CategoryData[]>([]);
  const [attributeDefinitions, setAttributeDefinitions] = useState<AttributeDefinition[]>([]);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedImages, setUploadedImages] = useState<UploadedImageInfo[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const form = useForm({
    initialValues: {
      name: '',
      description: '',
      price: 0.00,
      sku: '',
      stockQuantity: 0,
      category: '',
      tags: [] as string[],
      customAttributes: {} as Record<string, string | null>,
      images: [] as string[],
      seoTitle: '', // Added
      seoDescription: '', // Added
    },
    validate: yupResolver(schema),
  });

  useEffect(() => {
     if (authStatus === 'unauthenticated') {
         router.replace('/admin/login');
     }
     if (authStatus === 'authenticated') {
        const fetchMetaData = async () => {
          setIsMetaLoading(true);
          try {
            const [catRes, attrRes] = await Promise.all([
              fetch('/api/admin/categories'),
              fetch('/api/admin/attribute-definitions'),
            ]);
            if (!catRes.ok) throw new Error('Failed to fetch categories');
            if (!attrRes.ok) throw new Error('Failed to fetch attribute definitions');

            const catData = await catRes.json();
            const attrData = await attrRes.json();

            setCategoriesList(catData.map((c: any) => ({ _id: c._id, name: c.name })));
            setAttributeDefinitions(attrData);

          } catch (err: any) {
            notifications.show({ title: 'Error loading metadata', message: err.message || "Could not load categories or attributes.", color: 'red' });
          } finally {
            setIsMetaLoading(false);
          }
        };
        fetchMetaData();
      }
  }, [authStatus]);

  const handleFileSelectAndUpload = async (files: File[]) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadError(null);
    const currentUploadedImages = [...uploadedImages];

    for (const file of files) {
      try {
        const sigResponse = await fetch('/api/admin/upload/cloudinary-signature', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder: 'product_images' })
        });
        if (!sigResponse.ok) {
          const sigErrorData = await sigResponse.json();
          throw new Error(sigErrorData.message || 'Failed to get upload signature.');
        }
        const sigData = await sigResponse.json();

        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', sigData.api_key);
        formData.append('timestamp', sigData.timestamp);
        formData.append('signature', sigData.signature);
        if (sigData.folder) formData.append('folder', sigData.folder);

        const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${sigData.cloud_name}/image/upload`;
        const cloudinaryResponse = await fetch(cloudinaryUrl, {
          method: 'POST',
          body: formData,
        });

        if (!cloudinaryResponse.ok) {
          const cloudErrorData = await cloudinaryResponse.json();
          throw new Error(cloudErrorData.error?.message || 'Cloudinary upload failed.');
        }
        const cloudinaryData = await cloudinaryResponse.json();

        currentUploadedImages.push({ url: cloudinaryData.secure_url, public_id: cloudinaryData.public_id });

      } catch (err: any) {
        setUploadError((prevError) => prevError ? `${prevError}\nError uploading ${file.name}: ${err.message}` : `Error uploading ${file.name}: ${err.message}`);
        notifications.show({ title: `Upload Error: ${file.name}`, message: err.message, color: 'red' });
      }
    }
    setUploadedImages(currentUploadedImages);
    setSelectedFiles([]); // Clear the FileInput after processing
    setIsUploading(false);
  };

  const handleRemoveUploadedImage = (publicIdToRemove: string) => {
    setUploadedImages(currentImages => currentImages.filter(img => img.public_id !== publicIdToRemove));
  };

  const handleSubmit = async (values: typeof form.values) => {
    setIsLoading(true);
    setApiError(null);

    try {
      const payload = {
        name: values.name,
        description: values.description,
        price: values.price,
        sku: values.sku,
        stockQuantity: values.stockQuantity,
        category: values.category || null,
        tags: values.tags,
        customAttributes: Object.fromEntries(
            Object.entries(values.customAttributes).filter(([_, value]) => value !== null && value !== '')
        ),
        images: uploadedImages.map(img => img.url),
        seoTitle: values.seoTitle || undefined, // Send undefined if empty for cleaner data
        seoDescription: values.seoDescription || undefined, // Send undefined if empty
      };

      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      notifications.show({
         title: 'Product Created',
         message: `Product "${data.name}" has been successfully created.`,
         color: 'green',
         icon: <IconDeviceFloppy />,
         autoClose: 5000,
      });
      router.push(`/admin/products/edit/${data._id}`);

    } catch (err: any) {
      setApiError(err.message || 'An unexpected error occurred.');
      const errorMessage = err.message || 'An unexpected error occurred while creating the product.';
      setApiError(errorMessage); // Also set this for the Alert component if needed
      notifications.show({
         title: 'Error Creating Product',
         message: errorMessage,
         color: 'red',
         icon: <IconAlertCircle />,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authStatus === 'loading' || (isMetaLoading && authStatus === 'authenticated')) {
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
      <Title order={2} mb="xl">Add New Product</Title>
      <Paper component="form" onSubmit={form.onSubmit(handleSubmit)} withBorder shadow="md" p="xl" radius="md" pos="relative"> {/* Increased padding */}
        <LoadingOverlay visible={isLoading || isUploading} overlayProps={{ radius: 'sm', blur: 2 }} />

        {apiError && (
          <Alert icon={<IconAlertCircle size="1rem" />} title="Form Submission Error!" color="red" withCloseButton onClose={() => setApiError(null)} mb="md">
            {apiError}
          </Alert>
        )}

        <TextInput label="Product Name" placeholder="e.g., Awesome T-Shirt" required {...form.getInputProps('name')} mb="md" />
        <Textarea label="Description" placeholder="Detailed description..." required autosize minRows={4} {...form.getInputProps('description')} mb="md" />
        <Group grow mb="md">
            <NumberInput label="Price" placeholder="0.00" required precision={2} step={0.01} min={0} leftSection="$" {...form.getInputProps('price')} />
            <TextInput label="SKU" placeholder="e.g., TSHIRT-BLK-LG" required {...form.getInputProps('sku')} />
        </Group>
        <NumberInput label="Stock Quantity" placeholder="0" required min={0} step={1} allowDecimal={false} {...form.getInputProps('stockQuantity')} mb="md" />

        <Select label="Category" placeholder="Select a category" data={categoriesList.map(cat => ({ value: cat._id, label: cat.name }))} searchable clearable disabled={isMetaLoading} {...form.getInputProps('category')} mb="md" />
        <TagsInput label="Tags" placeholder="Enter tags (e.g., new, sale)" description="Press Enter or comma to add a tag" clearable {...form.getInputProps('tags')} mb="md" />

        <Title order={4} mt="lg" mb="sm">Custom Attributes</Title>
        {isMetaLoading && <Text c="dimmed" size="sm">Loading attribute options...</Text>}
        {!isMetaLoading && attributeDefinitions.length === 0 && <Text c="dimmed" size="sm">No custom attributes defined. Define them in 'Custom Attributes' section.</Text>}
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
        <FileInput label="Upload Images" placeholder="Click to select images" multiple accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleFileSelectAndUpload} disabled={isUploading || isLoading} mb="md" value={selectedFiles} clearable onClear={() => setSelectedFiles([])} />
        {isUploading && <Progress value={100} striped animated mb="md" />}
        {uploadError && (<Alert color="red" title="Upload Error" icon={<IconAlertCircle />} withCloseButton onClose={() => setUploadError(null)} mb="md">{uploadError}</Alert>)}
        {uploadedImages.length > 0 && (<Text size="sm" mb="xs" mt="md">Uploaded Images (preview):</Text>)}
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }} mb="md" spacing="sm">
            {uploadedImages.map((image, index) => (
                <MantineBox key={image.public_id || index} style={{ position: 'relative', border: '1px solid #dee2e6', padding: '4px', borderRadius: '4px' }}>
                    <MantineImage src={image.url} alt={`Uploaded image ${index + 1}`} radius="sm" height={100} fit="contain" />
                    <CloseButton size="xs" onClick={() => handleRemoveUploadedImage(image.public_id)} style={{ position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(255,255,255,0.8)' }} aria-label="Remove image" disabled={isUploading || isLoading} />
                </MantineBox>
            ))}
        </SimpleGrid>

        <Accordion defaultValue="seo_settings" mt="lg" mb="md">
            <Accordion.Item value="seo_settings">
                <Accordion.Control icon={<IconSeo size={20}/>}>SEO Settings (Optional)</Accordion.Control>
                <Accordion.Panel>
                    <TextInput label="SEO Title" placeholder="Custom title for search engine results (max 70 chars)" {...form.getInputProps('seoTitle')} mb="sm" description="Recommended: 50-60 characters. Uses product name if empty."/>
                    <Textarea label="SEO Meta Description" placeholder="Brief summary for search engine results (max 160 chars)" autosize minRows={3} {...form.getInputProps('seoDescription')} description="Recommended: 150-160 characters. Uses product description if empty."/>
                </Accordion.Panel>
            </Accordion.Item>
        </Accordion>

        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={() => router.push('/admin/products')} leftSection={<IconX size={16}/>} disabled={isLoading || isUploading}>Cancel</Button>
          <Button type="submit" leftSection={<IconDeviceFloppy size={16}/>} disabled={isLoading || isMetaLoading || isUploading}>Save Product</Button>
        </Group>
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
