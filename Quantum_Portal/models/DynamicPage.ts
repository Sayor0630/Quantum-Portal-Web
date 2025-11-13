import mongoose, { Schema, Document, Model } from 'mongoose';

// ========================================
// BLOCK TYPES - Individual content units
// ========================================

type BlockType = 
  | 'text'
  | 'image' 
  | 'video'
  | 'button'
  | 'mediaGallery'
  | 'productList'
  | 'productAttributeSelector'
  | 'categoryList'
  | 'brandList'
  | 'customHtml'
  | 'spacer'
  | 'divider'
  | 'carousel'
  | 'accordion'
  | 'tabs'
  | 'countdown'
  | 'socialMedia'
  | 'form'
  | 'map';

// ========================================
// RESPONSIVE BREAKPOINTS
// ========================================

interface IResponsiveConfig {
  mobile?: {
    width?: string; // e.g., '100%', '50%', '300px'
    height?: string;
    display?: boolean;
    order?: number;
    padding?: string;
    margin?: string;
  };
  tablet?: {
    width?: string;
    height?: string;
    display?: boolean;
    order?: number;
    padding?: string;
    margin?: string;
  };
  desktop?: {
    width?: string;
    height?: string;
    display?: boolean;
    order?: number;
    padding?: string;
    margin?: string;
  };
}

// ========================================
// PRODUCT FILTER CONFIGURATION
// ========================================

interface IProductFilter {
  filterType: 'all' | 'category' | 'brand' | 'tags' | 'featured' | 'bestsellers' | 'newArrivals' | 'onSale' | 'custom';
  categoryIds?: mongoose.Types.ObjectId[];
  brandIds?: mongoose.Types.ObjectId[];
  tags?: string[];
  customQuery?: string; // JSON string for advanced filtering
  sortBy?: 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc' | 'newest' | 'popular';
  limit?: number;
}

// ========================================
// DATA BINDING CONFIGURATION
// ========================================

enum DataSourceType {
  STATIC = 'static',
  PRODUCT = 'product',
  CATEGORY = 'category',
  COLLECTION = 'collection',
  CUSTOMER = 'customer',
}

interface IDataBinding {
  sourceType: DataSourceType;
  fieldPath?: string;
  fallbackValue?: any;
  templateString?: string;
}

// ========================================
// BLOCK CONTENT - Specific to each block type
// ========================================

interface IBlockContent {
  // Data Binding (applies to all block types)
  dataBinding?: IDataBinding;
  
  // Width (applies to most blocks)
  width?: string;
  
  // Text Block
  text?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  fontSize?: string;
  fontWeight?: 'normal' | 'bold' | 'lighter' | 'bolder';
  color?: string;
  
  // Image Block
  imageUrl?: string;
  imageAlt?: string;
  imageLink?: string;
  imageFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  
  // Video Block
  videoUrl?: string;
  videoType?: 'youtube' | 'vimeo' | 'direct' | 'cloudinary';
  autoplay?: boolean;
  loop?: boolean;
  controls?: boolean;
  
  // Button Block
  buttonText?: string;
  buttonLink?: string;
  buttonStyle?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link';
  buttonSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  openInNewTab?: boolean;
  buttonTarget?: '_self' | '_blank';
  
  // Media Gallery Block
  items?: Array<{
    type: 'image' | 'video';
    url: string;
    alt?: string;
    thumbnail?: string;
    link?: string;
  }>;
  displayMode?: 'carousel1' | 'carousel2' | 'slideshow1' | 'slideshow2' | 'grid' | 'thumbnails';
  itemsPerView?: number;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showThumbnails?: boolean;
  thumbnailPosition?: 'bottom' | 'right' | 'left';
  transitionAnimation?: 'slide' | 'fade' | 'zoom' | 'flip' | 'cube' | 'coverflow';
  transitionSpeed?: number;
  aspectRatio?: '16:9' | '4:3' | '1:1' | 'auto';
  showDots?: boolean;
  showArrows?: boolean;
  
  // Product List Block
  productFilter?: IProductFilter;
  displayStyle?: 'grid' | 'carousel' | 'list' | 'masonry';
  columns?: number;
  showPrice?: boolean;
  showAddToCart?: boolean;
  showQuickView?: boolean;
  
  // Category/Brand List Block
  categoryIds?: mongoose.Types.ObjectId[];
  brandIds?: mongoose.Types.ObjectId[];
  listDisplayStyle?: 'grid' | 'carousel' | 'list';
  showDescription?: boolean;
  showImage?: boolean;
  
  // Custom HTML Block
  htmlContent?: string;
  customCSS?: string;
  customJS?: string;
  
  // Spacer Block
  spacerHeight?: string;
  
  // Divider Block
  dividerStyle?: 'solid' | 'dashed' | 'dotted' | 'double';
  dividerColor?: string;
  dividerWidth?: string;
  
  // Carousel Block
  carouselItems?: Array<{
    imageUrl?: string;
    title?: string;
    subtitle?: string;
    link?: string;
    buttonText?: string;
  }>;
  autoplaySpeed?: number;
  // Note: showArrows and showDots are defined in Media Gallery section
  
  // Accordion/Tabs Block
  accordionItems?: Array<{
    title: string;
    content: string;
  }>;
  
  // Countdown Block
  countdownDate?: Date;
  countdownText?: string;
  
  // Social Media Block
  socialLinks?: Array<{
    platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'youtube' | 'tiktok' | 'pinterest';
    url: string;
  }>;
  iconSize?: string;
  iconStyle?: 'default' | 'rounded' | 'square';
  
  // Form Block
  formFields?: Array<{
    type: 'text' | 'email' | 'textarea' | 'select' | 'checkbox' | 'radio';
    label: string;
    name: string;
    required?: boolean;
    options?: string[]; // For select, checkbox, radio
  }>;
  submitButtonText?: string;
  formAction?: string; // API endpoint
  
  // Map Block
  mapAddress?: string;
  mapLatitude?: number;
  mapLongitude?: number;
  mapZoom?: number;
}

// ========================================
// BLOCK - Individual content unit
// ========================================

interface IBlock {
  _id?: mongoose.Types.ObjectId;
  blockId: string; // Unique ID for this block instance
  type: BlockType;
  content: IBlockContent;
  
  // Styling
  backgroundColor?: string;
  backgroundImage?: string;
  borderRadius?: string;
  boxShadow?: string;
  padding?: string;
  margin?: string;
  
  // Layout within segment
  width?: string; // e.g., '100%', '50%', '33.33%'
  height?: string;
  order?: number; // Order within segment
  
  // Responsive configuration
  responsive?: IResponsiveConfig;
  
  // Animations
  animation?: {
    type?: 'fade' | 'slide' | 'zoom' | 'bounce' | 'none';
    duration?: number;
    delay?: number;
  };
  
  // Visibility conditions
  visibility?: {
    showOnMobile?: boolean;
    showOnTablet?: boolean;
    showOnDesktop?: boolean;
    showForLoggedIn?: boolean;
    showForGuest?: boolean;
  };
}

// ========================================
// SEGMENT - Container for blocks
// ========================================

type SegmentLayout = 
  | 'fullWidth'           // 100% width
  | 'contained'           // Max-width container
  | 'twoColumn'           // 50-50 split
  | 'threeColumn'         // 33-33-33 split
  | 'fourColumn'          // 25-25-25-25 split
  | 'sidebar-left'        // 30-70 split
  | 'sidebar-right'       // 70-30 split
  | 'custom';             // Custom flex/grid layout

interface ISegment {
  _id?: mongoose.Types.ObjectId;
  segmentId: string; // Unique ID for this segment instance
  name: string; // Admin-facing name
  
  // Layout Configuration
  layout: SegmentLayout;
  maxWidth?: string; // For contained layouts
  
  // Blocks within this segment
  blocks: IBlock[];
  
  // Segment Styling
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: 'cover' | 'contain' | 'auto';
  backgroundPosition?: string;
  backgroundAttachment?: 'scroll' | 'fixed';
  
  // Spacing
  paddingTop?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  paddingRight?: string;
  marginTop?: string;
  marginBottom?: string;
  
  // Order in page
  order: number;
  
  // Responsive configuration
  responsive?: IResponsiveConfig;
  
  // Advanced Layout (for custom layout type)
  customLayout?: {
    display?: 'flex' | 'grid' | 'block';
    flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
    justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
    alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
    gap?: string;
    gridTemplateColumns?: string;
    gridTemplateRows?: string;
  };
  
  // Visibility
  isVisible: boolean;
  
  // Parallax effect
  parallax?: {
    enabled: boolean;
    speed?: number;
  };
}

// ========================================
// GRID CELL - New Visual Page Builder structure
// ========================================

interface IGridCell {
  cellId: string;
  parentId: string | null;
  split: 'horizontal' | 'vertical' | null;
  splitRatio: number;
  children: string[];
  blocks: IBlock[];
  backgroundColor?: string;
  padding?: number;
}

// ========================================
// DYNAMIC PAGE - Main document
// ========================================

interface IDynamicPage extends Document {
  // Basic Info
  title: string;
  slug: string;
  description?: string;
  
  // Page Type - helps categorize pages
  pageType: 'landing' | 'content' | 'category' | 'brand' | 'custom';
  
  // Segments (OLD structure - kept for backward compatibility)
  segments: ISegment[];
  
  // Grid Cells (NEW Visual Page Builder structure)
  gridCells?: IGridCell[];
  
  // SEO
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string[];
  ogImage?: string;
  
  // Publishing
  isPublished: boolean;
  publishDate?: Date;
  unpublishDate?: Date;
  
  // Access Control
  requiresAuth?: boolean;
  allowedRoles?: string[];
  
  // Page Settings
  pageSettings?: {
    headerVisible?: boolean;
    footerVisible?: boolean;
    customCSS?: string;
    customJS?: string;
    canonicalUrl?: string;
    themeMode?: 'inherit' | 'custom';
    customTheme?: {
      light?: {
        backgroundColor?: string;
        textColor?: string;
      };
      dark?: {
        backgroundColor?: string;
        textColor?: string;
      };
    };
    pageMargins?: {
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
    };
  };
  
  // Analytics
  viewCount?: number;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}

// ========================================
// SCHEMAS
// ========================================

const ResponsiveConfigSchema = new Schema<IResponsiveConfig>({
  mobile: {
    width: { type: String },
    height: { type: String },
    display: { type: Boolean, default: true },
    order: { type: Number },
    padding: { type: String },
    margin: { type: String },
  },
  tablet: {
    width: { type: String },
    height: { type: String },
    display: { type: Boolean, default: true },
    order: { type: Number },
    padding: { type: String },
    margin: { type: String },
  },
  desktop: {
    width: { type: String },
    height: { type: String },
    display: { type: Boolean, default: true },
    order: { type: Number },
    padding: { type: String },
    margin: { type: String },
  },
}, { _id: false });

const ProductFilterSchema = new Schema<IProductFilter>({
  filterType: { type: String, enum: ['all', 'category', 'brand', 'tags', 'featured', 'bestsellers', 'newArrivals', 'onSale', 'custom'], default: 'all' },
  categoryIds: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
  brandIds: [{ type: Schema.Types.ObjectId, ref: 'Brand' }],
  tags: [{ type: String }],
  customQuery: { type: String },
  sortBy: { type: String, enum: ['price-asc', 'price-desc', 'name-asc', 'name-desc', 'newest', 'popular'] },
  limit: { type: Number, default: 12 },
}, { _id: false });

const DataBindingSchema = new Schema({
  sourceType: { type: String, enum: ['static', 'product', 'category', 'collection', 'customer'], default: 'static' },
  fieldPath: { type: String },
  fallbackValue: { type: Schema.Types.Mixed },
  templateString: { type: String },
}, { _id: false });

const BlockContentSchema = new Schema<IBlockContent>({
  // Data Binding
  dataBinding: DataBindingSchema,
  
  // Width
  width: { type: String },
  
  // Text
  text: { type: String },
  textAlign: { type: String, enum: ['left', 'center', 'right', 'justify'] },
  fontSize: { type: String },
  fontWeight: { type: String, enum: ['normal', 'bold', 'lighter', 'bolder'] },
  color: { type: String },
  
  // Image
  imageUrl: { type: String },
  imageAlt: { type: String },
  imageLink: { type: String },
  imageFit: { type: String, enum: ['cover', 'contain', 'fill', 'none', 'scale-down'] },
  
  // Video
  videoUrl: { type: String },
  videoType: { type: String, enum: ['youtube', 'vimeo', 'direct', 'cloudinary'] },
  autoplay: { type: Boolean, default: false },
  loop: { type: Boolean, default: false },
  controls: { type: Boolean, default: true },
  
  // Button
  buttonText: { type: String },
  buttonLink: { type: String },
  buttonStyle: { type: String, enum: ['primary', 'secondary', 'outline', 'ghost', 'link'] },
  buttonSize: { type: String, enum: ['xs', 'sm', 'md', 'lg', 'xl'] },
  openInNewTab: { type: Boolean, default: false },
  buttonTarget: { type: String, enum: ['_self', '_blank'], default: '_self' },
  
  // Media Gallery
  items: [{
    type: { type: String, enum: ['image', 'video'] },
    url: { type: String },
    alt: { type: String },
    thumbnail: { type: String },
    link: { type: String },
  }],
  displayMode: { type: String, enum: ['carousel1', 'carousel2', 'slideshow1', 'slideshow2', 'grid', 'thumbnails'], default: 'carousel1' },
  itemsPerView: { type: Number, default: 1 },
  autoPlay: { type: Boolean, default: false },
  autoPlayInterval: { type: Number, default: 3000 },
  showThumbnails: { type: Boolean, default: true },
  thumbnailPosition: { type: String, enum: ['bottom', 'right', 'left'], default: 'bottom' },
  transitionAnimation: { type: String, enum: ['slide', 'fade', 'zoom', 'flip', 'cube', 'coverflow'], default: 'slide' },
  transitionSpeed: { type: Number, default: 500 },
  aspectRatio: { type: String, enum: ['16:9', '4:3', '1:1', 'auto'], default: '16:9' },
  
  // Product List
  productFilter: ProductFilterSchema,
  displayStyle: { type: String, enum: ['grid', 'carousel', 'list', 'masonry'] },
  columns: { type: Number, default: 4 },
  showPrice: { type: Boolean, default: true },
  showAddToCart: { type: Boolean, default: true },
  showQuickView: { type: Boolean, default: false },
  
  // Category/Brand List
  categoryIds: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
  brandIds: [{ type: Schema.Types.ObjectId, ref: 'Brand' }],
  listDisplayStyle: { type: String, enum: ['grid', 'carousel', 'list'] },
  showDescription: { type: Boolean, default: true },
  showImage: { type: Boolean, default: true },
  
  // Custom HTML
  htmlContent: { type: String },
  customCSS: { type: String },
  customJS: { type: String },
  
  // Spacer
  spacerHeight: { type: String },
  
  // Divider
  dividerStyle: { type: String, enum: ['solid', 'dashed', 'dotted', 'double'] },
  dividerColor: { type: String },
  dividerWidth: { type: String },
  
  // Carousel
  carouselItems: [{
    imageUrl: { type: String },
    title: { type: String },
    subtitle: { type: String },
    link: { type: String },
    buttonText: { type: String },
  }],
  autoplaySpeed: { type: Number },
  showArrows: { type: Boolean, default: true },
  showDots: { type: Boolean, default: true },
  
  // Accordion/Tabs
  accordionItems: [{
    title: { type: String, required: true },
    content: { type: String, required: true },
  }],
  
  // Countdown
  countdownDate: { type: Date },
  countdownText: { type: String },
  
  // Social Media
  socialLinks: [{
    platform: { type: String, enum: ['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok', 'pinterest'] },
    url: { type: String },
  }],
  iconSize: { type: String },
  iconStyle: { type: String, enum: ['default', 'rounded', 'square'] },
  
  // Form
  formFields: [{
    type: { type: String, enum: ['text', 'email', 'textarea', 'select', 'checkbox', 'radio'] },
    label: { type: String, required: true },
    name: { type: String, required: true },
    required: { type: Boolean, default: false },
    options: [{ type: String }],
  }],
  submitButtonText: { type: String },
  formAction: { type: String },
  
  // Map
  mapAddress: { type: String },
  mapLatitude: { type: Number },
  mapLongitude: { type: Number },
  mapZoom: { type: Number, default: 14 },
}, { _id: false });

const BlockSchema = new Schema<IBlock>({
  blockId: { type: String, required: true },
  type: { 
    type: String, 
    required: true,
    enum: ['text', 'image', 'video', 'button', 'mediaGallery', 'productList', 'productAttributeSelector', 'categoryList', 'brandList', 
           'customHtml', 'spacer', 'divider', 'carousel', 'accordion', 'tabs', 'countdown', 
           'socialMedia', 'form', 'map']
  },
  content: { type: BlockContentSchema, required: true },
  
  backgroundColor: { type: String },
  backgroundImage: { type: String },
  borderRadius: { type: String },
  boxShadow: { type: String },
  padding: { type: String },
  margin: { type: String },
  
  width: { type: String, default: '100%' },
  height: { type: String },
  order: { type: Number, default: 0 },
  
  responsive: ResponsiveConfigSchema,
  
  animation: {
    type: { type: String, enum: ['fade', 'slide', 'zoom', 'bounce', 'none'], default: 'none' },
    duration: { type: Number, default: 500 },
    delay: { type: Number, default: 0 },
  },
  
  visibility: {
    showOnMobile: { type: Boolean, default: true },
    showOnTablet: { type: Boolean, default: true },
    showOnDesktop: { type: Boolean, default: true },
    showForLoggedIn: { type: Boolean, default: true },
    showForGuest: { type: Boolean, default: true },
  },
}, { _id: true });

const SegmentSchema = new Schema<ISegment>({
  segmentId: { type: String, required: true },
  name: { type: String, required: true },
  
  layout: { 
    type: String, 
    required: true,
    enum: ['fullWidth', 'contained', 'twoColumn', 'threeColumn', 'fourColumn', 'sidebar-left', 'sidebar-right', 'custom'],
    default: 'contained'
  },
  maxWidth: { type: String, default: '1200px' },
  
  blocks: [BlockSchema],
  
  backgroundColor: { type: String },
  backgroundImage: { type: String },
  backgroundSize: { type: String, enum: ['cover', 'contain', 'auto'], default: 'cover' },
  backgroundPosition: { type: String, default: 'center' },
  backgroundAttachment: { type: String, enum: ['scroll', 'fixed'], default: 'scroll' },
  
  paddingTop: { type: String },
  paddingBottom: { type: String },
  paddingLeft: { type: String },
  paddingRight: { type: String },
  marginTop: { type: String },
  marginBottom: { type: String },
  
  order: { type: Number, default: 0 },
  
  responsive: ResponsiveConfigSchema,
  
  customLayout: {
    display: { type: String, enum: ['flex', 'grid', 'block'] },
    flexDirection: { type: String, enum: ['row', 'column', 'row-reverse', 'column-reverse'] },
    justifyContent: { type: String, enum: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'] },
    alignItems: { type: String, enum: ['flex-start', 'center', 'flex-end', 'stretch', 'baseline'] },
    gap: { type: String },
    gridTemplateColumns: { type: String },
    gridTemplateRows: { type: String },
  },
  
  isVisible: { type: Boolean, default: true },
  
  parallax: {
    enabled: { type: Boolean, default: false },
    speed: { type: Number, default: 0.5 },
  },
}, { _id: true });

const GridCellSchema = new Schema<IGridCell>({
  cellId: { type: String, required: true },
  parentId: { type: String, default: null },
  split: { type: String, enum: ['horizontal', 'vertical', null], default: null },
  splitRatio: { type: Number, default: 50 },
  children: [{ type: String }],
  blocks: [BlockSchema],
  backgroundColor: { type: String },
  padding: { type: Number, default: 20 },
}, { _id: false });

const DynamicPageSchema: Schema<IDynamicPage> = new Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true },
  description: { type: String, trim: true },
  
  pageType: { 
    type: String, 
    required: true,
    enum: ['landing', 'content', 'category', 'brand', 'custom'],
    default: 'custom'
  },
  
  segments: [SegmentSchema],
  
  gridCells: [GridCellSchema],
  
  seoTitle: { type: String, trim: true },
  seoDescription: { type: String, trim: true },
  seoKeywords: [{ type: String }],
  ogImage: { type: String },
  
  isPublished: { type: Boolean, default: false },
  publishDate: { type: Date },
  unpublishDate: { type: Date },
  
  requiresAuth: { type: Boolean, default: false },
  allowedRoles: [{ type: String }],
  
  pageSettings: {
    headerVisible: { type: Boolean, default: true },
    footerVisible: { type: Boolean, default: true },
    customCSS: { type: String },
    customJS: { type: String },
    canonicalUrl: { type: String },
    themeMode: { type: String, enum: ['inherit', 'custom'], default: 'inherit' },
    customTheme: {
      light: {
        backgroundColor: { type: String },
        textColor: { type: String },
      },
      dark: {
        backgroundColor: { type: String },
        textColor: { type: String },
      },
    },
    pageMargins: {
      top: { type: Number, default: 0 },
      bottom: { type: Number, default: 0 },
      left: { type: Number, default: 0 },
      right: { type: Number, default: 0 },
    },
  },
  
  viewCount: { type: Number, default: 0 },
  
  createdBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'AdminUser' },
}, { timestamps: true });

// Auto-generate slug from title if not provided
DynamicPageSchema.pre<IDynamicPage>('validate', function(next) {
  if (this.isModified('title') && !this.isModified('slug') && this.title && !this.slug) {
    this.slug = this.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
  } else if (this.slug) {
    this.slug = this.slug.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
  }
  next();
});

// Force delete cached model in development to ensure schema updates
if (process.env.NODE_ENV !== 'production' && mongoose.models.DynamicPage) {
  delete mongoose.models.DynamicPage;
}

const DynamicPage: Model<IDynamicPage> = mongoose.model<IDynamicPage>('DynamicPage', DynamicPageSchema);

// Log schema structure once (for debugging)
if (process.env.NODE_ENV !== 'production') {
  const schemaKeys = Object.keys(DynamicPageSchema.paths);
  console.log('📋 DynamicPage Schema registered');
  console.log('  - Has gridCells:', schemaKeys.includes('gridCells'));
  console.log('  - Has segments:', schemaKeys.includes('segments'));
  console.log('  - Total paths:', schemaKeys.length);
}

export default DynamicPage;
export type { 
  IDynamicPage, 
  ISegment, 
  IBlock, 
  IBlockContent, 
  IProductFilter, 
  IResponsiveConfig,
  IGridCell,
  BlockType,
  SegmentLayout
};
