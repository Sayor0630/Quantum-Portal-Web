/**
 * Data Binding Resolver
 * Replaces {{field.path}} template strings with actual data from product, category, customer, etc.
 */

interface ProductVariant {
  _id?: string;
  attributeCombination?: Record<string, string>;
  sku?: string;
  price?: number;
  stockQuantity?: number;
  isActive?: boolean;
  images?: Array<{ url: string; public_id: string }>;
}

interface ProductData {
  _id?: string;
  name?: string;
  slug?: string;
  description?: string;
  price?: number;
  salePrice?: number;
  sku?: string;
  images?: string[];
  brand?: { _id?: string; name?: string; slug?: string };
  category?: { _id?: string; name?: string; slug?: string };
  tags?: string[];
  stock?: number;
  stockQuantity?: number;
  isPublished?: boolean;
  
  // Variant system
  hasVariants?: boolean;
  attributeDefinitions?: Record<string, string[]>;
  variants?: ProductVariant[];
  
  // SEO
  seoTitle?: string;
  seoDescription?: string;
  
  [key: string]: any;
}

interface CategoryData {
  _id?: string;
  name?: string;
  slug?: string;
  description?: string;
  image?: string;
  [key: string]: any;
}

interface CustomerData {
  _id?: string;
  name?: string;
  email?: string;
  phone?: string;
  [key: string]: any;
}

interface CollectionData {
  _id?: string;
  name?: string;
  slug?: string;
  description?: string;
  [key: string]: any;
}

export interface BindingContext {
  product?: ProductData;
  category?: CategoryData;
  customer?: CustomerData;
  collection?: CollectionData;
}

/**
 * Get nested value from object using dot notation path
 * e.g., 'brand.name' => product.brand.name
 */
function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  
  const keys = path.split('.');
  let value = obj;
  
  for (const key of keys) {
    if (value === null || value === undefined) return undefined;
    value = value[key];
  }
  
  return value;
}

/**
 * Replace all {{binding}} templates in a string with actual data
 */
export function replaceBindings(text: string, context: BindingContext): string {
  if (!text) return text;
  
  console.log('[replaceBindings] Input text:', text.substring(0, 200));
  
  // Match {{source.field.path}} patterns
  const bindingRegex = /\{\{([^}]+)\}\}/g;
  
  const result = text.replace(bindingRegex, (match, binding) => {
    // Remove whitespace
    const cleanBinding = binding.trim();
    
    console.log('[replaceBindings] Found binding:', cleanBinding);
    
    // Split into source and field path
    // e.g., "product.name" => ["product", "name"]
    // e.g., "product.brand.name" => ["product", "brand.name"]
    const parts = cleanBinding.split('.');
    const source = parts[0]; // 'product', 'category', 'customer', 'collection'
    const fieldPath = parts.slice(1).join('.'); // 'name', 'brand.name', etc.
    
    // Get the data source
    const sourceData = context[source as keyof BindingContext];
    
    console.log('[replaceBindings] Source:', source, 'Field path:', fieldPath, 'Source data:', sourceData);
    
    if (!sourceData) {
      // Source not found in context, return original binding
      console.log('[replaceBindings] Source not found, keeping original');
      return match;
    }
    
    // Get the value from the source using field path
    const value = getNestedValue(sourceData, fieldPath);
    
    console.log('[replaceBindings] Resolved value:', value);
    
    if (value === undefined || value === null) {
      // Value not found, return empty string
      console.log('[replaceBindings] Value not found, returning empty string');
      return '';
    }
    
    // Special handling for specific fields
    
    // Handle category/brand objects - extract name
    if (fieldPath === 'category' || fieldPath === 'brand') {
      if (typeof value === 'object' && value.name) {
        return value.name;
      }
    }
    
    // Handle nested category.name or brand.name
    if (fieldPath === 'category.name' || fieldPath === 'brand.name') {
      return value.toString();
    }
    
    // Handle price - check for variants to show price range
    if (fieldPath === 'price' && context.product?.hasVariants && context.product?.variants) {
      const variantPrices = context.product.variants
        .filter((v: any) => v.isActive)
        .map((v: any) => v.price || context.product?.price || 0);
      
      if (variantPrices.length > 0) {
        const minPrice = Math.min(...variantPrices);
        const maxPrice = Math.max(...variantPrices);
        
        if (minPrice === maxPrice) {
          return `$${minPrice.toFixed(2)}`;
        } else {
          return `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;
        }
      }
    }
    
    // Handle attributeDefinitions - show as "Color: Black, Golden, White | Size: S, M, L"
    if (fieldPath === 'attributeDefinitions' || fieldPath === 'attributes') {
      if (typeof value === 'object') {
        const attributes = Object.entries(value)
          .map(([key, values]: [string, any]) => {
            if (Array.isArray(values)) {
              return `${key}: ${values.join(', ')}`;
            }
            return `${key}: ${values}`;
          })
          .join(' | ');
        return attributes;
      }
    }
    
    // Handle variants - show count and attributes
    if (fieldPath === 'variants') {
      if (Array.isArray(value) && value.length > 0) {
        return `${value.length} variant${value.length > 1 ? 's' : ''} available`;
      }
      return 'No variants';
    }
    
    // Format the value
    if (typeof value === 'number') {
      // Format currency if it looks like a price field
      if (fieldPath.includes('price') || fieldPath.includes('Price')) {
        return `$${value.toFixed(2)}`;
      }
      return value.toString();
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    if (Array.isArray(value)) {
      // For arrays, join with commas
      if (fieldPath === 'images' && value.length > 0) {
        // For images, return the first one
        return value[0];
      }
      return value.join(', ');
    }
    
    if (typeof value === 'object') {
      // For objects, check if it's a MongoDB reference with name
      if (value.name) {
        return value.name;
      }
      // Otherwise stringify
      return JSON.stringify(value);
    }
    
    return value.toString();
  });
  
  console.log('[replaceBindings] Output text:', result.substring(0, 200));
  
  return result;
}

/**
 * Apply data binding to a block's content
 * @param skipMediaGallery - If true, skip processing MediaGallery blocks (used when re-applying bindings for variant changes)
 */
export function applyBindingsToBlock(block: any, context: BindingContext, skipMediaGallery = false): any {
  if (!block || !block.content) return block;
  
  // Skip MediaGallery if requested (to preserve already-loaded images during variant selection)
  // Return the ORIGINAL block unchanged - don't even create a copy
  if (skipMediaGallery && block.type === 'mediaGallery') {
    console.log('[applyBindingsToBlock] Skipping MediaGallery - returning original block unchanged');
    return block; // Return original, not a copy
  }
  
  const newBlock = { ...block };
  const newContent = { ...block.content };
  
  // Replace bindings in text content
  if (newContent.text) {
    newContent.text = replaceBindings(newContent.text, context);
  }
  
  // Replace bindings in button text
  if (newContent.buttonText) {
    newContent.buttonText = replaceBindings(newContent.buttonText, context);
  }
  
  // Replace bindings in button link
  if (newContent.buttonLink) {
    newContent.buttonLink = replaceBindings(newContent.buttonLink, context);
  }
  
  // Replace bindings in image URL
  if (newContent.imageUrl) {
    newContent.imageUrl = replaceBindings(newContent.imageUrl, context);
  }
  
  // Replace bindings in image alt text
  if (newContent.imageAlt) {
    newContent.imageAlt = replaceBindings(newContent.imageAlt, context);
  }
  
  // Replace bindings in image link
  if (newContent.imageLink) {
    newContent.imageLink = replaceBindings(newContent.imageLink, context);
  }
  
  // Replace bindings in video URL
  if (newContent.videoUrl) {
    newContent.videoUrl = replaceBindings(newContent.videoUrl, context);
  }
  
  // Replace bindings in custom HTML
  if (newContent.htmlContent) {
    newContent.htmlContent = replaceBindings(newContent.htmlContent, context);
  }
  
  // Special handling for MediaGallery with product images
  if (block.type === 'mediaGallery' && context.product) {
    const product = context.product;
    const dataBinding = newContent.dataBinding;
    const fieldPath = dataBinding?.fieldPath || '';
    
    console.log('[MediaGallery] Field path:', fieldPath);
    console.log('[MediaGallery] Product:', { 
      name: product.name, 
      baseImages: product.images?.length,
      hasVariants: product.hasVariants,
      variantCount: product.variants?.length 
    });
    
    let imagesToUse: string[] = [];
    
    if (fieldPath.includes('allImages')) {
      // Get all images: base + variant images
      console.log('[MediaGallery] Loading ALL images');
      
      // Add base images
      if (product.images && Array.isArray(product.images)) {
        imagesToUse.push(...product.images);
      }
      
      // Add variant images
      if (product.hasVariants && product.variants && Array.isArray(product.variants)) {
        product.variants.forEach((variant: any) => {
          if (variant.images && Array.isArray(variant.images)) {
            variant.images.forEach((img: any) => {
              const url = typeof img === 'string' ? img : img.url;
              if (url && !imagesToUse.includes(url)) {
                imagesToUse.push(url);
              }
            });
          }
        });
      }
    } else if (fieldPath.includes('baseImages') || fieldPath.includes('product.images')) {
      // Only base images
      console.log('[MediaGallery] Loading BASE images only');
      if (product.images && Array.isArray(product.images)) {
        imagesToUse = [...product.images];
      }
    } else if (fieldPath.includes('variantImages')) {
      // Only variant images
      console.log('[MediaGallery] Loading VARIANT images only');
      if (product.hasVariants && product.variants && Array.isArray(product.variants)) {
        product.variants.forEach((variant: any) => {
          if (variant.images && Array.isArray(variant.images)) {
            variant.images.forEach((img: any) => {
              const url = typeof img === 'string' ? img : img.url;
              if (url && !imagesToUse.includes(url)) {
                imagesToUse.push(url);
              }
            });
          }
        });
      }
    }
    
    console.log('[MediaGallery] Total images found:', imagesToUse.length);
    
    // Convert images to MediaGallery items format
    if (imagesToUse.length > 0) {
      newContent.items = imagesToUse.map((url: string, index: number) => ({
        id: `media-${url.split('/').pop()}-${index}`, // Create unique ID from URL and index
        type: 'image',
        url,
        alt: `${product.name || 'Product'} - Image ${index + 1}`,
        thumbnail: url,
      }));
      
      console.log('[MediaGallery] Created items:', newContent.items.length);
    }
  }
  
  // Replace bindings in accordion items
  if (newContent.accordionItems && Array.isArray(newContent.accordionItems)) {
    newContent.accordionItems = newContent.accordionItems.map((item: any) => ({
      ...item,
      title: replaceBindings(item.title, context),
      content: replaceBindings(item.content, context),
    }));
  }
  
  // Replace bindings in carousel items
  if (newContent.carouselItems && Array.isArray(newContent.carouselItems)) {
    newContent.carouselItems = newContent.carouselItems.map((item: any) => ({
      ...item,
      title: item.title ? replaceBindings(item.title, context) : item.title,
      subtitle: item.subtitle ? replaceBindings(item.subtitle, context) : item.subtitle,
      buttonText: item.buttonText ? replaceBindings(item.buttonText, context) : item.buttonText,
      imageUrl: item.imageUrl ? replaceBindings(item.imageUrl, context) : item.imageUrl,
      link: item.link ? replaceBindings(item.link, context) : item.link,
    }));
  }
  
  newBlock.content = newContent;
  return newBlock;
}

/**
 * Apply data binding to a segment (including all its blocks)
 */
export function applyBindingsToSegment(segment: any, context: BindingContext, skipMediaGallery = false): any {
  if (!segment) return segment;
  
  const newSegment = { ...segment };
  
  // Apply bindings to all blocks in the segment
  if (newSegment.blocks && Array.isArray(newSegment.blocks)) {
    newSegment.blocks = newSegment.blocks.map((block: any) => 
      applyBindingsToBlock(block, context, skipMediaGallery)
    );
  }
  
  return newSegment;
}

/**
 * Apply data binding to an entire page (all segments)
 */
export function applyBindingsToPage(pageData: any, context: BindingContext, skipMediaGallery = false): any {
  if (!pageData) return pageData;
  
  const newPageData = { ...pageData };
  
  // Apply bindings to all segments
  if (newPageData.segments && Array.isArray(newPageData.segments)) {
    newPageData.segments = newPageData.segments.map((segment: any) => 
      applyBindingsToSegment(segment, context, skipMediaGallery)
    );
  }
  
  // Apply bindings to grid cells if they exist
  if (newPageData.gridCells && Array.isArray(newPageData.gridCells)) {
    newPageData.gridCells = newPageData.gridCells.map((cell: any) => {
      const newCell = { ...cell };
      if (newCell.blocks && Array.isArray(newCell.blocks)) {
        newCell.blocks = newCell.blocks.map((block: any) => 
          applyBindingsToBlock(block, context, skipMediaGallery)
        );
      }
      return newCell;
    });
  }
  
  // Apply bindings to page title and description
  if (newPageData.title) {
    newPageData.title = replaceBindings(newPageData.title, context);
  }
  
  if (newPageData.description) {
    newPageData.description = replaceBindings(newPageData.description, context);
  }
  
  if (newPageData.seoTitle) {
    newPageData.seoTitle = replaceBindings(newPageData.seoTitle, context);
  }
  
  if (newPageData.seoDescription) {
    newPageData.seoDescription = replaceBindings(newPageData.seoDescription, context);
  }
  
  return newPageData;
}
