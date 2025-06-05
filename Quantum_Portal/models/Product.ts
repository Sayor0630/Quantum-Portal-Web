import mongoose, { Document, Schema, Model } from 'mongoose';

// Helper function to generate a slug
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

export interface IProduct extends Document {
  name: string;
  slug: string;
  description: string;
  price: number;
  sku?: string;
  stockQuantity: number;
  images?: string[];
  category?: mongoose.Schema.Types.ObjectId;
  tags?: string[];
  customAttributes?: Map<string, string>;
  seoTitle?: string;
  seoDescription?: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema: Schema<IProduct> = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true, trim: true, sparse: true, index: true }, // Added index
  description: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  sku: { type: String, unique: true, sparse: true, trim: true },
  stockQuantity: { type: Number, default: 0, min: 0, validate: { validator: Number.isInteger, message: 'Stock quantity must be an integer.' } },
  images: [{ type: String, trim: true }],
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', index: true },
  tags: [{ type: String, trim: true }],
  customAttributes: { type: Map, of: String },
  seoTitle: { type: String, trim: true, maxlength: 70 },
  seoDescription: { type: String, trim: true, maxlength: 160 },
  isPublished: { type: Boolean, default: false, index: true },
}, { timestamps: true });

ProductSchema.pre<IProduct>('save', function(next) {
  // Only generate/update slug if name is present and slug is being modified or is empty
  if (this.isModified('name') || !this.slug) {
    if (this.name) { // Ensure name is present
      const generatedSlug = generateSlugFromName(this.name);
      // If slug is not manually set OR if the current slug is the auto-generated version of the old name
      // (this part is tricky without storing old name, so simplify: if slug is empty or name changes and slug is not dirty)
      if (!this.slug || (this.isModified('name') && !this.isDirectModified('slug'))) {
         this.slug = generatedSlug;
      }
    }
  }
  // Always ensure the slug is in the correct format if it exists
  if (this.slug) {
    this.slug = generateSlugFromName(this.slug); // Re-formats existing slug too
  }

  // If after all attempts, slug is still empty and name is not, try one last time.
  // This primarily handles the create case where slug might not be provided.
  if (!this.slug && this.name) {
      this.slug = generateSlugFromName(this.name);
  }

  // If slug is required in your schema (not just unique/sparse), you'd add a validation error here if it's still empty.
  // For now, sparse:true allows it to be empty/null and still maintain uniqueness for non-null values.
  next();
});

const ProductModel: Model<IProduct> = mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);

export default ProductModel;
