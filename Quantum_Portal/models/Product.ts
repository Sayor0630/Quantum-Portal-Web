import mongoose, { Document, Schema, Model } from 'mongoose';

// Interface IProduct was defined in Subtask 2, Step 2.
// Re-defining here for clarity and adding new fields.
export interface IProduct extends Document {
  name: string;
  description: string;
  price: number;
  sku?: string; // Was unique, sparse in Subtask 2. Keep that.
  stockQuantity: number;
  images?: string[]; // Array of image URLs
  category?: mongoose.Schema.Types.ObjectId; // Ref 'Category'
  tags?: string[];
  customAttributes?: Map<string, string>; // Map of string to string
  seoTitle?: string; // New SEO field
  seoDescription?: string; // New SEO field
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema: Schema<IProduct> = new Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  sku: { type: String, unique: true, sparse: true, trim: true },
  stockQuantity: { type: Number, default: 0, min: 0, validate: { validator: Number.isInteger } },
  images: [{ type: String, trim: true }], // Array of image URLs
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', index: true }, // Added index for better query performance
  tags: [{ type: String, trim: true }],
  customAttributes: { type: Map, of: String },
  seoTitle: { type: String, trim: true, maxlength: 70 }, // New field with maxlength
  seoDescription: { type: String, trim: true, maxlength: 160 }, // New field with maxlength
  // createdAt and updatedAt are handled by timestamps: true
}, { timestamps: true });

// Pre-save hook for updatedAt (already handled by timestamps: true)
// ProductSchema.pre('save', function(next) {
//   if (this.isModified()) {
//     this.updatedAt = new Date();
//   }
//   next();
// });

const ProductModel: Model<IProduct> = mongoose.models.Product || mongoose.model<IProduct>('Product', ProductSchema);

export default ProductModel;
// No need to export IProduct again if it's already defined and exported, but good for clarity here.
// export type { IProduct };
