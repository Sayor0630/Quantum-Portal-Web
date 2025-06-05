import mongoose, { Schema, Document, Model } from 'mongoose';

interface IStaticPage extends Document {
  title: string;
  slug: string;
  content?: string;
  isPublished: boolean;
  seoTitle?: string;
  seoDescription?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StaticPageSchema: Schema<IStaticPage> = new Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true },
  content: { type: String, trim: true },
  isPublished: { type: Boolean, default: false },
  seoTitle: { type: String, trim: true },
  seoDescription: { type: String, trim: true },
}, { timestamps: true });

// Helper to generate slug from title if slug is not provided (or to ensure format)
StaticPageSchema.pre<IStaticPage>('validate', function(next) {
  if (this.isModified('title') && !this.isModified('slug') && this.title && !this.slug) {
    this.slug = this.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
  } else if (this.slug) { // Always clean the slug if it's provided or modified
    this.slug = this.slug.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
  }
  next();
});

const StaticPage: Model<IStaticPage> = mongoose.models.StaticPage || mongoose.model<IStaticPage>('StaticPage', StaticPageSchema);

export default StaticPage;
export type { IStaticPage };
