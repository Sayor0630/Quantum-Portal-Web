import mongoose, { Schema, Document, Model } from 'mongoose';

interface IPageSection extends Document { // Can be a sub-document
  sectionId: string; // e.g., "description", "attributes", "reviews", "relatedProducts"
  name: string; // Human-readable name, e.g., "Product Description"
  isVisible: boolean;
  order: number;
}

const PageSectionSchema = new Schema<IPageSection>({
  sectionId: { type: String, required: true }, // Not globally unique, but unique within a layout
  name: { type: String, required: true },
  isVisible: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
}, {_id: false }); // No separate _id for sub-documents if not needed, sectionId is key

interface IProductPageLayoutConfig extends Document {
  // Fixed identifier for the singleton document could be added here if desired
  // e.g., configKey: { type: String, default: "singleton", unique: true }
  sections: IPageSection[];
  createdAt: Date;
  updatedAt: Date;
}

const ProductPageLayoutConfigSchema: Schema<IProductPageLayoutConfig> = new Schema({
  sections: [PageSectionSchema],
}, { timestamps: true });

// Pre-save hook to ensure sectionId uniqueness within the sections array
ProductPageLayoutConfigSchema.pre('save', function(next) {
  if (this.isModified('sections') && this.sections) {
    const sectionIds = new Set<string>();
    for (const section of this.sections) {
      if (sectionIds.has(section.sectionId)) {
        return next(new Error(`Duplicate sectionId found: ${section.sectionId}. Section IDs must be unique within the layout.`));
      }
      sectionIds.add(section.sectionId);
    }
  }
  next();
});


const ProductPageLayoutConfig: Model<IProductPageLayoutConfig> = mongoose.models.ProductPageLayoutConfig || mongoose.model<IProductPageLayoutConfig>('ProductPageLayoutConfig', ProductPageLayoutConfigSchema);

export default ProductPageLayoutConfig;
export type { IProductPageLayoutConfig, IPageSection };

// Function to get default layout
export const getDefaultProductPageLayout = (): Omit<IPageSection, keyof Document>[] => {
  // Return plain objects, not Mongoose Documents for defaults
  return [
    { sectionId: 'images', name: 'Product Images', isVisible: true, order: 0 },
    { sectionId: 'titlePrice', name: 'Title & Price', isVisible: true, order: 1 },
    { sectionId: 'attributes', name: 'Custom Attributes', isVisible: true, order: 2 },
    { sectionId: 'description', name: 'Product Description', isVisible: true, order: 3 },
    { sectionId: 'reviews', name: 'Customer Reviews', isVisible: true, order: 4 },
    { sectionId: 'relatedProducts', name: 'Related Products', isVisible: true, order: 5 },
  ];
};
