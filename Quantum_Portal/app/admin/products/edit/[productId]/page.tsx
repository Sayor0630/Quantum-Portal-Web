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
import VariantManager from '../../_components/VariantManager';

interface AttributeDefinition {
  _id: string;
  name: string;
  values: string[];
}

interface CategoryData {
  _id: string;
  name: string;
}

interface BrandData {
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

interface ProductDataFromAPI { // For data fetched from API
    _id: string;
    name: string;
    slug: string; // Added
    description: string;
    price: number;
    sku: string;
    stockQuantity: number;
    category?: { _id: string; name: string; } | string;
    brand?: { _id: string; name: string; } | string;
    tags: string[];
    images: string[];
    seoTitle?: string;
    seoDescription?: string;
    isPublished: boolean; // Added
    hasVariants?: boolean;
    attributeDefinitions?: { [key: string]: string[] };
    variants?: ProductVariant[];
}

const generateSlugFromName = (name: string): string => {
    if (!name) return '';
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
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
  brand: Yup.string().required('Brand is required'),
  tags: Yup.array().of(Yup.string()).ensure(),
  images: Yup.array().of(Yup.string().url("Each image must be a valid URL")).optional(),
  seoTitle: Yup.string().optional().trim().max(70, 'SEO Title should be 70 characters or less'),
  seoDescription: Yup.string().optional().trim().max(160, 'SEO Description should be 160 characters or less'),
  isPublished: Yup.boolean(),
  hasVariants: Yup.boolean(),
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
  const [isSlugManuallyModified, setIsSlugManuallyModified] = useState(false);

  const [categoriesList, setCategoriesList] = useState<CategoryData[]>([]);
  const [brandsList, setBrandsList] = useState<BrandData[]>([]);
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
      brand: '',
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

  // Update form validation when hasVariants changes, but only if user has already submitted
  useEffect(() => {
    if (hasSubmitted) {
      form.validate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasVariants, hasSubmitted]);

  // Slug auto-generation logic for edit page
  const productNameForSlug = form.values.name;
  
  useEffect(() => {
    if (productNameForSlug && !isSlugManuallyModified) {
        // Auto-generate slug from current name if slug field hasn't been manually modified
        form.setFieldValue('slug', generateSlugFromName(productNameForSlug));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productNameForSlug, isSlugManuallyModified]);


  useEffect(() => {
     if (authStatus === 'unauthenticated') {
         router.replace('/admin/login');
     }
     if (authStatus === 'authenticated') {
        const fetchMetaData = async () => { /* ... (metadata fetch logic remains same) ... */
            setIsMetaLoading(true);
            try {
                const [catRes, brandRes, attrRes] = await Promise.all([
                  fetch('/api/admin/categories'),
                  fetch('/api/admin/brands'),
                  fetch('/api/admin/attribute-definitions'),
                ]);
                if (!catRes.ok) throw new Error('Failed to fetch categories for form');
                if (!brandRes.ok) throw new Error('Failed to fetch brands for form');
                if (!attrRes.ok) throw new Error('Failed to fetch attribute definitions for form');
                const catData = await catRes.json(); 
                const brandData = await brandRes.json();
                const attrData = await attrRes.json();
                setCategoriesList(catData.map((c: any) => ({ _id: c._id, name: c.name })));
                setBrandsList(brandData.brands ? brandData.brands.map((b: any) => ({ _id: b._id, name: b.name })) : []);
                setAttributeDefinitions(attrData);
            } catch (err: any) { notifications.show({ title: 'Error loading form metadata', message: err.message, color: 'red' });
            } finally { setIsMetaLoading(false); }
        };
        fetchMetaData();
      }
  }, [authStatus, router]); // Added router

  useEffect(() => {
    if (productId && authStatus === 'authenticated' && !isMetaLoading) {
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
                    brand: typeof productData.brand === 'string' ? productData.brand : productData.brand?._id || '',
                    tags: productData.tags || [],
                    images: productData.images || [],
                    seoTitle: productData.seoTitle || '',
                    seoDescription: productData.seoDescription || '',
                    isPublished: productData.isPublished || false, // Populate isPublished
                    hasVariants: productData.hasVariants || false,
                });
                
                // Load variant data
                setHasVariants(productData.hasVariants || false);
                
                if (productData.hasVariants && productData.attributeDefinitions) {
                  // Convert attributeDefinitions to selectedAttributes format
                  const selectedAttrs: SelectedAttribute[] = Object.entries(productData.attributeDefinitions).map(([name, values]) => {
                    // Find the attribute definition to get the ID
                    const attrDef = attributeDefinitions.find(attr => attr.name === name);
                    return {
                      attributeId: attrDef?._id || name, // Fallback to name if not found
                      name,
                      selectedValues: values as string[]
                    };
                  });
                  setSelectedAttributes(selectedAttrs);
                }
                
                if (productData.variants) {
                  setVariants(productData.variants);
                }
                
                setUploadedImages(productData.images?.map((url: string, index: number) => ({ url, public_id: `existing_image_${productId}_${index}` })) || []);
                form.resetDirty();
                setIsSlugManuallyModified(false); // Reset manual modification flag
            } catch (err: any) {
                setApiError(err.message);
                notifications.show({ title: 'Error', message: `Failed to load product: ${err.message}`, color: 'red' });
            } finally { setIsFetchingProduct(false); }
        };
        fetchProductData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, authStatus, isMetaLoading]);

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
    setHasSubmitted(true);
    setIsLoading(true); setApiError(null);
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
        slug: values.slug, // Added
        isPublished: values.isPublished, // Added
        description: values.description,
        price: productPrice,
        ...(hasVariants ? {} : { sku: values.sku }), // Only include SKU for non-variant products
        stockQuantity: productStock,
        category: values.category || null,
        brand: values.brand,
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
      const response = await fetch(`/api/admin/products/${productId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
      notifications.show({ title: 'Product Updated', message: `Product "${data.name}" updated.`, color: 'green', icon: <IconDeviceFloppy /> });
      form.resetDirty(data);
      setVariantDataChanged(false); // Reset variant change tracking
      setUploadedImages(data.images?.map((url: string, index: number) => ({ url, public_id: uploadedImages.find(u => u.url === url)?.public_id || `existing_image_${productId}_${index}`})) || []);
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
        <TextInput label="Slug" placeholder="e.g., awesome-t-shirt" required description="URL-friendly identifier. Auto-updates from name if not manually changed, or customize it." 
            {...form.getInputProps('slug')}
            onChange={(event) => {
                // Update the slug value
                form.setFieldValue('slug', generateSlugFromName(event.currentTarget.value));
                // Mark as manually modified only if user is actually typing (not programmatic)
                if (document.activeElement === event.currentTarget) {
                    setIsSlugManuallyModified(true);
                }
            }}
            mb="md" />
        <Textarea label="Description" placeholder="Detailed description..." required autosize minRows={3} {...form.getInputProps('description')} mb="md" />

        <Switch label="Publish Product (Visible on storefront)" {...form.getInputProps('isPublished', { type: 'checkbox' })} mb="md" />
        <Divider my="lg" label="Categorization & Details" labelPosition="center" />

        <Select label="Category" placeholder="Select a category" data={categoriesList.map(cat => ({ value: cat._id, label: cat.name }))} searchable clearable disabled={isMetaLoading} {...form.getInputProps('category')} mb="md" />
        <Select label="Brand" placeholder="Select a brand" data={brandsList.map(brand => ({ value: brand._id, label: brand.name }))} searchable clearable disabled={isMetaLoading} {...form.getInputProps('brand')} mb="md" required />
        <TagsInput label="Tags" placeholder="Enter tags" description="Press Enter or comma" clearable {...form.getInputProps('tags')} mb="md" />

        <Divider my="lg" label="Product Variants" labelPosition="center" />
        
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
            setVariantDataChanged(true);
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
          onFormValueChange={(field, value) => form.setFieldValue(field, value)}
        />

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
          <Button 
            type="submit" 
            leftSection={<IconDeviceFloppy size={16}/>} 
            disabled={
              isLoading || 
              isMetaLoading || 
              isUploading || 
              isFetchingProduct || 
              (!form.values.name || !form.values.description || (hasVariants ? false : (!form.values.sku || form.values.price <= 0))) ||
              (!form.isDirty() && !variantDataChanged)
            }
          >
            Save Changes
          </Button>
        </Group>
      </Paper>
      <Space h="xl" />
    </AdminLayout>
  );
}
