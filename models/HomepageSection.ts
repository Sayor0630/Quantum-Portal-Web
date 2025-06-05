import mongoose, { Schema, Document, Model } from 'mongoose';

// Interface for common content fields, can be extended by specific section types
interface ISectionContentItem { // Explicitly defining the item structure for clarity
  itemId?: mongoose.Types.ObjectId; // e.g., Product ID, Category ID
  itemType?: 'Product' | 'Category' | 'CustomLink';
  imageUrl?: string;
  title?: string;
  subtitle?: string;
  link?: string;
  // Add any other item-specific fields, like price for a product item, etc.
}

interface ISectionContent {
  title?: string;
  subtitle?: string;
  text?: string;
  imageUrl?: string; // For banners, single images
  videoUrl?: string;
  buttonText?: string;
  buttonLink?: string;
  items?: ISectionContentItem[]; // Array of items for carousels or lists
  htmlContent?: string; // For custom HTML blocks
  // Add other content fields as needed, e.g., alignment, background color
}

interface IHomepageSection extends Document {
  name: string; // Admin-facing name for this section instance (e.g., "Summer Sale Hero Banner")
  type: 'hero' | 'banner' | 'productCarousel' | 'categoryList' | 'promotionalBlock' | 'customHtml' | 'featuredProducts';
  order: number;
  isVisible: boolean;
  content: ISectionContent;
  createdAt: Date;
  updatedAt: Date;
}

const SectionContentItemSchema = new Schema<ISectionContentItem>({
    itemId: { type: Schema.Types.ObjectId, refPath: 'content.items.itemType' },
    itemType: { type: String, enum: ['Product', 'Category', 'CustomLink'] },
    imageUrl: { type: String, trim: true },
    title: { type: String, trim: true },
    subtitle: { type: String, trim: true },
    link: { type: String, trim: true },
}, {_id: false}); // No _id for sub-sub-documents unless explicitly needed

const HomepageSectionSchema: Schema<IHomepageSection> = new Schema({
  name: { type: String, required: true, trim: true },
  type: {
    type: String,
    required: true,
    enum: ['hero', 'banner', 'productCarousel', 'categoryList', 'promotionalBlock', 'customHtml', 'featuredProducts'],
  },
  order: { type: Number, default: 0 },
  isVisible: { type: Boolean, default: true },
  content: {
    title: { type: String, trim: true },
    subtitle: { type: String, trim: true },
    text: { type: String, trim: true },
    imageUrl: { type: String, trim: true },
    videoUrl: { type: String, trim: true },
    buttonText: { type: String, trim: true },
    buttonLink: { type: String, trim: true },
    items: [SectionContentItemSchema], // Use the defined sub-schema
    htmlContent: { type: String },
  },
}, { timestamps: true });

const HomepageSection: Model<IHomepageSection> = mongoose.models.HomepageSection || mongoose.model<IHomepageSection>('HomepageSection', HomepageSectionSchema);

export default HomepageSection;
export type { IHomepageSection, ISectionContent, ISectionContentItem };
