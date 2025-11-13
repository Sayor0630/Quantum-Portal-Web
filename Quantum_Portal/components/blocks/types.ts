// Shared types for block components

export enum DataSourceType {
  STATIC = 'static',
  PRODUCT = 'product',
  CATEGORY = 'category',
  COLLECTION = 'collection',
  CUSTOMER = 'customer',
}

export enum ProductFieldPath {
  // Basic Information
  NAME = 'name',
  SLUG = 'slug',
  DESCRIPTION = 'description',
  SHORT_DESCRIPTION = 'shortDescription',
  SKU = 'sku',
  
  // Pricing
  PRICE = 'price',
  SALE_PRICE = 'salePrice',
  COST_PRICE = 'costPrice',
  
  // Inventory
  STOCK = 'stock',
  LOW_STOCK_THRESHOLD = 'lowStockThreshold',
  TRACK_INVENTORY = 'trackInventory',
  
  // Variants
  VARIANTS = 'variants',
  VARIANT_OPTIONS = 'variantOptions',
  
  // Media
  IMAGES = 'images',
  BASE_IMAGES = 'baseImages',
  VARIANT_IMAGES = 'variantImages',
  ALL_IMAGES = 'allImages',
  FEATURED_IMAGE = 'featuredImage',
  GALLERY_IMAGES = 'galleryImages',
  VIDEOS = 'videos',
  
  // Organization
  CATEGORY = 'category',
  CATEGORIES = 'categories',
  BRAND = 'brand',
  TAGS = 'tags',
  
  // SEO
  SEO_TITLE = 'seo.title',
  SEO_DESCRIPTION = 'seo.description',
  SEO_KEYWORDS = 'seo.keywords',
  META_TITLE = 'metaTitle',
  META_DESCRIPTION = 'metaDescription',
  
  // Status
  STATUS = 'status',
  VISIBILITY = 'visibility',
  IS_FEATURED = 'isFeatured',
  IS_NEW = 'isNew',
  IS_SALE = 'isOnSale',
  
  // Shipping
  WEIGHT = 'weight',
  DIMENSIONS = 'dimensions',
  SHIPPING_CLASS = 'shippingClass',
  
  // Reviews
  RATING = 'rating',
  REVIEW_COUNT = 'reviewCount',
  REVIEWS = 'reviews',
  
  // Dates
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  PUBLISHED_AT = 'publishedAt',
  
  // Additional
  CUSTOM_FIELDS = 'customFields',
  RELATED_PRODUCTS = 'relatedProducts',
  UPSELLS = 'upsells',
  CROSS_SELLS = 'crossSells',
}

export enum CategoryFieldPath {
  NAME = 'name',
  SLUG = 'slug',
  DESCRIPTION = 'description',
  IMAGE = 'image',
  PARENT = 'parent',
  CHILDREN = 'children',
  PRODUCT_COUNT = 'productCount',
  SEO_TITLE = 'seo.title',
  SEO_DESCRIPTION = 'seo.description',
  META_TITLE = 'metaTitle',
  META_DESCRIPTION = 'metaDescription',
}

export interface DataBinding {
  sourceType: DataSourceType;
  fieldPath?: ProductFieldPath | CategoryFieldPath | string;
  fallbackValue?: string;
  templateString?: string;
}

export interface FieldOption {
  value: string;
  label: string;
  description?: string;
}
