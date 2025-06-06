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

// Interface for product variants (combination of attributes)
export interface IProductVariant {
  _id?: mongoose.Schema.Types.ObjectId;
  attributeCombination: Map<string, string>; // e.g., {Color: "Red", Size: "Large"}
  sku?: string; // Variant-specific SKU
  price?: number; // Variant-specific price (optional, falls back to product base price)
  stockQuantity: number; // Stock for this specific variant
  isActive: boolean; // Whether this variant is available
  images?: Array<{ url: string; public_id: string }>; // Variant-specific images
}

export interface IProduct extends Document {
  name: string;
  slug: string;
  description: string;
  price: number; // Base price
  sku?: string; // Base SKU
  stockQuantity: number; // Total/default stock (for simple products without variants)
  images?: string[];
  category?: mongoose.Schema.Types.ObjectId;
  tags?: string[];
  
  // New variant-based attributes system
  attributeDefinitions: Map<string, string[]>; // e.g., {Color: ["Red", "Blue"], Size: ["S", "M", "L"]}
  variants: IProductVariant[]; // Stock and pricing per variant combination
  hasVariants: boolean; // Whether product uses variant system
  
  // Legacy - keeping for backward compatibility during migration
  customAttributes?: Map<string, string>;
  
  seoTitle?: string;
  seoDescription?: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods for variant management
  getTotalStock(): number;
  getVariantByAttributes(attributes: Record<string, string>): IProductVariant | null;
  getVariantPrice(attributes: Record<string, string>): number;
  getVariantSku(attributes: Record<string, string>): string;
}

// Schema for product variants
const ProductVariantSchema = new Schema({
  attributeCombination: { type: Map, of: String, required: true },
  sku: { type: String, trim: true, sparse: true },
  price: { type: Number, min: 0 },
  stockQuantity: { type: Number, required: true, min: 0, default: 0 },
  isActive: { type: Boolean, default: true },
  images: [{ 
    url: { type: String, required: true },
    public_id: { type: String, required: true }
  }]
}, { _id: true });

const ProductSchema: Schema<IProduct> = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true, trim: true, sparse: true, index: true },
  description: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 }, // Base price
  sku: { type: String, unique: true, sparse: true, trim: true }, // Base SKU
  stockQuantity: { type: Number, default: 0, min: 0, validate: { validator: Number.isInteger, message: 'Stock quantity must be an integer.' } },
  images: [{ type: String, trim: true }],
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', index: true },
  tags: [{ type: String, trim: true }],
  
  // New variant system
  attributeDefinitions: { type: Map, of: [String], default: {} }, // e.g., {Color: ["Red", "Blue"], Size: ["S", "M"]}
  variants: [ProductVariantSchema],
  hasVariants: { type: Boolean, default: false },
  
  // Legacy field for backward compatibility
  customAttributes: { type: Map, of: String, default: {} },
  
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

  next();
});

// Instance methods for variant management
ProductSchema.methods.getTotalStock = function(): number {
  if (this.hasVariants && this.variants.length > 0) {
    return this.variants
      .filter((variant: IProductVariant) => variant.isActive)
      .reduce((total: number, variant: IProductVariant) => total + variant.stockQuantity, 0);
  }
  return this.stockQuantity;
};

ProductSchema.methods.getVariantByAttributes = function(attributes: Record<string, string>): IProductVariant | null {
  if (!this.hasVariants) return null;
  
  return this.variants.find((variant: IProductVariant) => {
    const variantAttrs = Object.fromEntries(variant.attributeCombination);
    return Object.keys(attributes).every(key => variantAttrs[key] === attributes[key]);
  }) || null;
};

ProductSchema.methods.getVariantPrice = function(attributes: Record<string, string>): number {
  const variant = this.getVariantByAttributes(attributes);
  return variant?.price ?? this.price;
};

ProductSchema.methods.getVariantSku = function(attributes: Record<string, string>): string {
  const variant = this.getVariantByAttributes(attributes);
  return variant?.sku ?? this.sku ?? '';
};

const ProductModel: Model<IProduct> = mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);

export default ProductModel;
