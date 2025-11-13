import { DataSourceType, ProductFieldPath, CategoryFieldPath, type FieldOption } from './types';

/**
 * Get available field paths based on data source and block type
 */
export function getDataSourceFieldOptions(
  sourceType: DataSourceType,
  blockType: string
): FieldOption[] {
  if (sourceType === DataSourceType.STATIC) {
    return [];
  }

  if (sourceType === DataSourceType.PRODUCT) {
    switch (blockType) {
      case 'text':
        return [
          // Basic Information
          { value: 'product.name', label: 'Product Name', description: 'The product title' },
          { value: 'product.description', label: 'Product Description', description: 'Full product description' },
          { value: 'product.slug', label: 'Product Slug', description: 'URL-friendly identifier' },
          { value: 'product.sku', label: 'Product SKU', description: 'Stock keeping unit' },
          
          // Pricing
          { value: 'product.price', label: 'Product Price', description: 'Base price' },
          
          // Inventory
          { value: 'product.stockQuantity', label: 'Stock Quantity', description: 'Available stock' },
          
          // Organization
          { value: 'product.category', label: 'Category Name', description: 'Product category' },
          { value: 'product.brand', label: 'Brand Name', description: 'Product brand' },
          { value: 'product.tags', label: 'Product Tags', description: 'Comma-separated tags' },
          
          // SEO
          { value: 'product.seoTitle', label: 'SEO Title', description: 'SEO title (fallback to product name)' },
          { value: 'product.seoDescription', label: 'SEO Description', description: 'SEO meta description' },
          
          // Status
          { value: 'product.isPublished', label: 'Published Status', description: 'Whether product is published' },
          
          // Dates
          { value: 'product.createdAt', label: 'Created Date', description: 'When product was created' },
          { value: 'product.updatedAt', label: 'Updated Date', description: 'Last update date' },
          
          // Variants (if applicable)
          { value: 'product.hasVariants', label: 'Has Variants', description: 'Whether product has variants' },
          { value: 'product.attributeDefinitions', label: 'Attribute Definitions', description: 'Available attributes (Color, Size, etc.)' },
        ];
      
      case 'mediaGallery':
        return [
          { value: 'product.allImages', label: 'All Product Images', description: 'Base images + all variant images' },
          { value: 'product.baseImages', label: 'Base Images Only', description: 'Only the main product images' },
          { value: 'product.variantImages', label: 'Variant Images Only', description: 'Images from all variants' },
          { value: 'product.images', label: 'Product Images (Legacy)', description: 'Base product images' },
        ];
      
      case 'button':
        return [
          { value: 'product.name', label: 'Product Name', description: 'Use in button text' },
          { value: 'product.price', label: 'Product Price', description: 'Use in button text' },
        ];
      
      default:
        return [
          { value: 'product.name', label: 'Product Name' },
          { value: 'product.description', label: 'Product Description' },
          { value: 'product.price', label: 'Product Price' },
          { value: 'product.images', label: 'Product Images' },
        ];
    }
  }

  if (sourceType === DataSourceType.CATEGORY) {
    switch (blockType) {
      case 'text':
        return [
          { value: 'category.name', label: 'Category Name', description: 'The category name' },
          { value: 'category.slug', label: 'Category Slug', description: 'URL-friendly identifier' },
          { value: 'category.isPublished', label: 'Published Status', description: 'Whether category is published' },
          { value: 'category.createdAt', label: 'Created Date', description: 'When category was created' },
          { value: 'category.updatedAt', label: 'Updated Date', description: 'Last update date' },
        ];
      
      case 'mediaGallery':
        return [
          { value: 'category.image', label: 'Category Banner/Image' },
        ];
      
      default:
        return [
          { value: 'category.name', label: 'Category Name' },
          { value: 'category.slug', label: 'Category Slug' },
        ];
    }
  }

  if (sourceType === DataSourceType.CUSTOMER) {
    switch (blockType) {
      case 'text':
        return [
          { value: 'customer.email', label: 'Customer Email', description: 'Customer email address' },
          { value: 'customer.firstName', label: 'First Name', description: 'Customer first name' },
          { value: 'customer.lastName', label: 'Last Name', description: 'Customer last name' },
          { value: 'customer.phoneNumber', label: 'Phone Number', description: 'Customer phone number' },
          { value: 'customer.isActive', label: 'Active Status', description: 'Whether customer is active' },
          { value: 'customer.createdAt', label: 'Member Since', description: 'When customer registered' },
          
          // Address fields
          { value: 'customer.addresses.street', label: 'Address - Street' },
          { value: 'customer.addresses.city', label: 'Address - City' },
          { value: 'customer.addresses.state', label: 'Address - State' },
          { value: 'customer.addresses.zipCode', label: 'Address - ZIP Code' },
          { value: 'customer.addresses.country', label: 'Address - Country' },
        ];
      
      default:
        return [
          { value: 'customer.firstName', label: 'First Name' },
          { value: 'customer.lastName', label: 'Last Name' },
          { value: 'customer.email', label: 'Email' },
        ];
    }
  }

  if (sourceType === DataSourceType.COLLECTION) {
    // Placeholder for collection - you can add collection fields when collection model is ready
    return [
      { value: 'collection.name', label: 'Collection Name' },
      { value: 'collection.description', label: 'Collection Description' },
    ];
  }

  return [];
}

/**
 * Parse video URL to get embed URL and type
 */
export function parseVideoUrl(url: string): { embedUrl: string; type: 'youtube' | 'vimeo' | 'file' } | null {
  if (!url) return null;
  
  // YouTube
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
  if (youtubeMatch) {
    return { embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}`, type: 'youtube' };
  }
  
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return { embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`, type: 'vimeo' };
  }
  
  // Direct video file
  if (url.startsWith('data:video') || url.match(/\.(mp4|webm|ogg)$/i)) {
    return { embedUrl: url, type: 'file' };
  }
  
  return null;
}

/**
 * Convert File to base64 data URL
 */
export function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
