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

export interface IBrand extends Document {
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  website?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BrandSchema: Schema<IBrand> = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true, index: true },
  description: { type: String, trim: true },
  logo: { type: String, trim: true }, // URL to logo image
  website: { type: String, trim: true }, // Brand website URL
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

// Pre-save middleware to auto-generate slug
BrandSchema.pre<IBrand>('save', function(next) {
  // Only auto-generate/update slug if name is modified and slug is not, or if slug is empty
  if (this.isModified('name') && !this.isModified('slug') && this.name) {
    this.slug = generateSlugFromName(this.name);
  } else if (this.slug) { // If slug is provided or changed, ensure it's formatted correctly
    this.slug = generateSlugFromName(this.slug);
  }
  // Ensure slug is generated if it's empty and name is present
  if (!this.slug && this.name) {
    this.slug = generateSlugFromName(this.name);
  }
  next();
});

const Brand: Model<IBrand> = mongoose.models.Brand || mongoose.model<IBrand>('Brand', BrandSchema);

export default Brand;
