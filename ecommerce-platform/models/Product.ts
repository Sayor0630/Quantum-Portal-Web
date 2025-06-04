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
  // Helper function (assuming generateSlugFromName is defined in the file)
  // const generateSlugFromName = (name: string): string => { ... };

  // Case 1: Slug is explicitly provided and modified by the user in this save operation
  if (this.isDirectModified('slug')) {
    if (this.slug && this.slug.trim() !== '') {
      // If user provided a non-empty slug, reformat it.
      this.slug = generateSlugFromName(this.slug);
    } else {
      // User explicitly set slug to empty or whitespace, so regenerate from name (if name exists).
      if (this.name) {
        this.slug = generateSlugFromName(this.name);
      } else {
        // Name is also empty, so slug remains empty (or whatever schema default/validation dictates)
        // For a 'unique sparse' slug, an empty slug is fine if name is also empty.
        this.slug = undefined; // Or null, depending on schema preference for empty unique sparse.
      }
    }
  }
  // Case 2: Slug was not explicitly modified by user, but name was, OR if product is new and slug is empty.
  // This handles new products or updates where only name changes (intending slug to follow).
  else if (this.isModified('name') || !this.slug) {
    if (this.name) {
      this.slug = generateSlugFromName(this.name);
    } else if (!this.slug) {
      // If name is also empty, and slug was already empty/not set, ensure it's set to undefined
      // to respect sparse index if name is not required.
      this.slug = undefined;
    }
  }
  // Case 3: Slug exists but wasn't directly modified (e.g. loaded from DB)
  // and name wasn't modified, but we still want to ensure its format.
  // This is mostly a safety net for existing slugs that might not be perfectly formatted.
  // However, this might be redundant if slugs are always formatted on save/creation.
  // Let's comment this out for now to avoid re-slugifying unchanged slugs unnecessarily.
  // else if (this.slug) {
  //   this.slug = generateSlugFromName(this.slug);
  // }


  // Final check: if slug is somehow still undefined/empty but name is present (e.g. new product with only name)
  // This is somewhat redundant with Case 2 but acts as a final safety.
  if (!this.slug && this.name) {
      this.slug = generateSlugFromName(this.name);
  }

  next();
});

const ProductModel: Model<IProduct> = mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);

export default ProductModel;
export type { IProduct };
