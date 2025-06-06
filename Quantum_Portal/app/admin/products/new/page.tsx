'use client';

import AdminLayout from '../../../../components/admin/AdminLayout';
import { Title, Paper, TextInput, Button, Group, LoadingOverlay, Alert, Textarea, NumberInput, Space, Select, TagsInput, Grid, Text, FileInput, Image as MantineImage, Progress, SimpleGrid, CloseButton, Box as MantineBox, Accordion, Divider, Switch } from '@mantine/core'; // Added Switch
import { useForm, yupResolver } from '@mantine/form';
import * as Yup from 'yup';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { IconDeviceFloppy, IconAlertCircle, IconX, IconUpload, IconPhoto, IconSeo, IconArrowLeft } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useSession } from 'next-auth/react';
import VariantManager from '../_components/VariantManager';

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

// New interfaces for variant system
interface SelectedAttribute {
  attributeId: string;
  name: string;
  selectedValues: string[];
}

interface ProductVariant {
  _id?: string;
  attributeCombination: { [key: string]: string };
  sku?: string;
  price?: number;
  stockQuantity: number;
  isActive: boolean;
  images?: Array<{ url: string; public_id: string }>;
}

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

// Yup validation schema - conditional based on variant system
const createValidationSchema = (hasVariants: boolean) => Yup.object().shape({
  name: Yup.string().required('Product name is required'),
  slug: Yup.string().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens.').required('Slug is required'),
  description: Yup.string().required('Description is required'),
  price: hasVariants ? 
    Yup.number().min(0, 'Base price must be non-negative').optional() : 
    Yup.number().min(0, 'Price must be non-negative').required('Price is required').typeError('Price must be a number'),
  sku: hasVariants ? 
    Yup.string().optional() : 
    Yup.string().required('SKU is required'),
  stockQuantity: hasVariants ? 
    Yup.number().integer('Stock must be an integer').min(0, 'Stock must be non-negative').optional() : 
    Yup.number().integer('Stock must be an integer').min(0, 'Stock must be non-negative').required('Stock quantity is required').typeError('Stock must be a number'),
  category: Yup.string().nullable(),
  tags: Yup.array().of(Yup.string()).ensure(),
  images: Yup.array().of(Yup.string().url("Each image must be a valid URL")).optional(),
  seoTitle: Yup.string().optional().trim().max(70, 'SEO Title should be 70 characters or less'),
  seoDescription: Yup.string().optional().trim().max(160, 'SEO Description should be 160 characters or less'),
  isPublished: Yup.boolean(),
  hasVariants: Yup.boolean(),
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

  // Variant system state
  const [selectedAttributes, setSelectedAttributes] = useState<SelectedAttribute[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [hasVariants, setHasVariants] = useState(false);
  const [variantDataChanged, setVariantDataChanged] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

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

      images: [] as string[],
      seoTitle: '',
      seoDescription: '',
      isPublished: false, // Added
      hasVariants: false,
    },
    validate: yupResolver(createValidationSchema(hasVariants)),
    validateInputOnChange: hasSubmitted,
    validateInputOnBlur: hasSubmitted,
  });

  const [isSlugManuallySet, setIsSlugManuallySet] = useState(false);

  // Update form validation when hasVariants changes, but only if user has already submitted
  useEffect(() => {
    if (hasSubmitted) {
      form.validate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasVariants, hasSubmitted]);

  const productNameForSlug = form.values.name; // Watch product name for slug generation
  useEffect(() => {
    if (productNameForSlug && (!form.values.slug || !isSlugManuallySet)) {
      form.setFieldValue('slug', generateSlugFromName(productNameForSlug));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productNameForSlug, isSlugManuallySet]);

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
  }, [authStatus, router]); // Added router

  const handleFileSelectAndUpload = async (files: File[]) => {
    // ... (image upload logic remains the same)
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadError(null);
    const currentUploadedImages = [...uploadedImages];
    for (const file of files) {
      try {
        const sigResponse = await fetch('/api/admin/upload/cloudinary-signature', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: 'product_images' }) });
        if (!sigResponse.ok) { const sigErrorData = await sigResponse.json(); throw new Error(sigErrorData.message || 'Failed to get upload signature.');}
        const sigData = await sigResponse.json();
        const formData = new FormData();
        formData.append('file', file); formData.append('api_key', sigData.api_key); formData.append('timestamp', sigData.timestamp); formData.append('signature', sigData.signature);
        if (sigData.folder) formData.append('folder', sigData.folder);
        const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${sigData.cloud_name}/image/upload`;
        const cloudinaryResponse = await fetch(cloudinaryUrl, { method: 'POST', body: formData });
        if (!cloudinaryResponse.ok) { const cloudErrorData = await cloudinaryResponse.json(); throw new Error(cloudErrorData.error?.message || 'Cloudinary upload failed.');}
        const cloudinaryData = await cloudinaryResponse.json();
        currentUploadedImages.push({ url: cloudinaryData.secure_url, public_id: cloudinaryData.public_id });
      } catch (err: any) {
        setUploadError((prevError) => prevError ? `${prevError}\n${file.name}: ${err.message}` : `${file.name}: ${err.message}`);
        notifications.show({ title: `Upload Error: ${file.name}`, message: err.message, color: 'red' });
      }
    }
    setUploadedImages(currentUploadedImages);
    setSelectedFiles([]);
    setIsUploading(false);
  };

  const handleRemoveUploadedImage = (publicIdToRemove: string) => {
    setUploadedImages(currentImages => currentImages.filter(img => img.public_id !== publicIdToRemove));
  };

  const handleSubmit = async (values: typeof form.values) => {
    setHasSubmitted(true);
    setIsLoading(true);
    setApiError(null);
    try {
      // For variant products, use 0 for price and calculate stock
      let productPrice = values.price;
      let productStock = values.stockQuantity;
      
      if (hasVariants) {
        // For variant products, always use 0 for price
        productPrice = 0;
        
        // Calculate total stock across all variants
        if (variants.length > 0) {
          productStock = variants.reduce((total, variant) => {
            return total + (variant.stockQuantity || 0);
          }, 0);
        } else {
          productStock = 0;
        }
      }

      const payload = {
        name: values.name,
        slug: values.slug, // Added slug
        isPublished: values.isPublished, // Added isPublished
        description: values.description,
        price: productPrice,
        ...(hasVariants ? {} : { sku: values.sku }), // Only include SKU for non-variant products
        stockQuantity: productStock,
        category: values.category || null,
        tags: values.tags,
        images: uploadedImages.map(img => img.url),
        seoTitle: values.seoTitle || undefined,
        seoDescription: values.seoDescription || undefined,
        // New variant fields
        hasVariants,
        attributeDefinitions: hasVariants ? 
          Object.fromEntries(
            selectedAttributes.map(attr => [attr.name, attr.selectedValues])
          ) : {},
        variants: hasVariants ? variants : [],
      };

      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
      notifications.show({
         title: 'Product Created',
         message: `Product "${data.name}" created. Edit to add more details or publish.`, // Updated message
         color: 'green', icon: <IconDeviceFloppy />, autoClose: 5000,
      });
      router.push(`/admin/products/edit/${data._id}`);
    } catch (err: any) {
      const errorMessage = err.message || 'An unexpected error occurred while creating the product.';
      setApiError(errorMessage);
      notifications.show({ title: 'Error Creating Product', message: errorMessage, color: 'red', icon: <IconAlertCircle /> });
    } finally {
      setIsLoading(false);
    }
  };

  if (authStatus === 'loading' || (isMetaLoading && authStatus === 'authenticated')) {
     return <AdminLayout><LoadingOverlay visible={true} overlayProps={{ radius: 'sm', blur: 2, fixed: true }} /></AdminLayout>;
  }
  if (authStatus === 'unauthenticated') return <Text p="xl">Redirecting to login...</Text>;

  return (
    <AdminLayout>
      <Group justify="space-between" mb="xl">
        <Title order={2}>Add New Product</Title>
        <Button 
          variant="outline" 
          component={Link} 
          href="/admin/products" 
          leftSection={<IconArrowLeft size={16}/>}
        >
          Back to Products
        </Button>
      </Group>
      <Paper component="form" onSubmit={form.onSubmit(handleSubmit)} withBorder shadow="md" p="xl" radius="md" pos="relative">
        <LoadingOverlay visible={isLoading || isUploading} overlayProps={{ radius: 'sm', blur: 2 }} />
        {apiError && <Alert icon={<IconAlertCircle size="1rem" />} title="Form Submission Error!" color="red" withCloseButton onClose={() => setApiError(null)} mb="md">{apiError}</Alert>}

        <TextInput label="Product Name" placeholder="e.g., Awesome T-Shirt" required {...form.getInputProps('name')} mb="sm" />
        <TextInput
            label="Slug"
            placeholder="e.g., awesome-t-shirt (auto-generated)"
            required
            description="URL-friendly identifier. Auto-generated from name, or customize it."
            {...form.getInputProps('slug')}
            onChange={(event) => { // Allow manual editing and re-format
                form.setFieldValue('slug', generateSlugFromName(event.currentTarget.value));
                setIsSlugManuallySet(true);
            }}
            mb="md"
        />
        <Textarea label="Description" placeholder="Detailed description..." required autosize minRows={3} {...form.getInputProps('description')} mb="md" />

        <Switch label="Publish Product (Visible on storefront)" {...form.getInputProps('isPublished', { type: 'checkbox' })} mb="md" />
        <Divider my="lg" label="Categorization & Details" labelPosition="center" />

        <Select label="Category" placeholder="Select a category" data={categoriesList.map(cat => ({ value: cat._id, label: cat.name }))} searchable clearable disabled={isMetaLoading} {...form.getInputProps('category')} mb="md" />
        <TagsInput label="Tags" placeholder="Enter tags (e.g., new, sale)" description="Press Enter or comma to add a tag" clearable {...form.getInputProps('tags')} mb="md" />

        <VariantManager
          attributeDefinitions={attributeDefinitions}
          selectedAttributes={selectedAttributes}
          onAttributesChange={(attrs) => {
            setSelectedAttributes(attrs);
            setVariantDataChanged(true);
          }}
          variants={variants}
          onVariantsChange={(vars) => {
            setVariants(vars);
            setVariantDataChanged(true);
          }}
          basePrice={form.values.price}
          hasVariants={hasVariants}
          onHasVariantsChange={(enabled) => {
            setHasVariants(enabled);
            form.setFieldValue('hasVariants', enabled);
            setVariantDataChanged(true);
            
            // Reset variant data if disabled
            if (!enabled) {
              setSelectedAttributes([]);
              setVariants([]);
            }
          }}
          onAttributeDefinitionsChange={(attrDefs) => {
            setAttributeDefinitions(attrDefs);
          }}
          isLoading={isLoading}
          formValues={{
            price: form.values.price,
            sku: form.values.sku,
            stockQuantity: form.values.stockQuantity
          }}
          onFormValueChange={(field, value) => {
            form.setFieldValue(field, value);
          }}
        />

        <Title order={4} mt="lg" mb="sm">Product Images</Title>
        <FileInput label="Upload Images" placeholder="Click to select images" multiple accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleFileSelectAndUpload} disabled={isUploading || isLoading} mb="md" value={selectedFiles} clearable />
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
          <Button 
            type="submit" 
            leftSection={<IconDeviceFloppy size={16}/>} 
            disabled={
              isLoading || 
              isMetaLoading || 
              isUploading || 
              (!form.values.name || !form.values.description || (!hasVariants && (!form.values.sku || form.values.price <= 0)))
            }
          >
            Save Product
          </Button>
        </Group>
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
