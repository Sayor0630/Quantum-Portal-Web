import mongoose, { Document, Schema, Model } from 'mongoose';

// Helper function to generate a slug (can be moved to a shared util)
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

export interface ICategory extends Document {
  name: string;
  slug: string;
  parent?: mongoose.Schema.Types.ObjectId | ICategory | null; // Can be populated
  children: (mongoose.Schema.Types.ObjectId | ICategory)[]; // Can be populated
  // description?: string; // Optional: if you want descriptions for categories
  // image?: { url: string; public_id?: string }; // Optional: if you want images for categories
  isPublished: boolean; // New field
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema: Schema<ICategory> = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true, index: true },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', sparse: true, index: true },
  children: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  // description: { type: String, trim: true },
  // image: { url: String, public_id: String },
  isPublished: { type: Boolean, default: false, index: true }, // New field
}, { timestamps: true });

CategorySchema.pre<ICategory>('save', function(next) {
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

// When a category is deleted, remove it from its parent's children array
CategorySchema.pre('findOneAndDelete', async function (next) {
    const categoryToDelete = await this.model.findOne(this.getQuery());
    if (categoryToDelete && categoryToDelete.parent) {
        await mongoose.model('Category').updateOne(
            { _id: categoryToDelete.parent },
            { $pull: { children: categoryToDelete._id } }
        );
    }
    // Also, consider what to do with children of the deleted category.
    // Current API prevents deletion if children exist. Alternative: set children's parent to null.
    next();
});


const CategoryModel: Model<ICategory> = mongoose.models.Category || mongoose.model<ICategory>('Category', CategorySchema);

export default CategoryModel;
