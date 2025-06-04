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

CategorySchema.pre<ICategory>('save', async function(next) { // Made async for parent update logic
  // Slug generation logic
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
        // Name is also empty, slug becomes undefined (schema has sparse unique index for slug)
        this.slug = undefined;
      }
    }
  }
  // Case 2: Slug was not explicitly modified by user, but name was, OR if product is new and slug is empty.
  else if (this.isModified('name') || (this.isNew && !this.slug)) {
    if (this.name) {
      this.slug = generateSlugFromName(this.name);
    } else if (!this.slug) {
      // If name is also empty, and slug was already empty/not set, ensure it's set to undefined
      this.slug = undefined;
    }
  }

  // Final check: if slug is somehow still undefined/empty but name is present
  if (!this.slug && this.name) {
      this.slug = generateSlugFromName(this.name);
  }

  // Parent-child relationship management
  if (this.isModified('parent')) {
    const currentParentId = this.parent ? new mongoose.Types.ObjectId(this.parent.toString()) : null;
    let oldParentId: mongoose.Types.ObjectId | null = null;

    if (!this.isNew) {
      // Fetch the original document to get the old parent ID
      // Use lean() for performance as we only need the parent field
      const originalDoc = await (this.constructor as Model<ICategory>).findById(this._id).select('parent').lean();
      if (originalDoc && originalDoc.parent) {
        oldParentId = new mongoose.Types.ObjectId(originalDoc.parent.toString());
      }
    }

    // If oldParentId exists and is different from the new currentParentId
    if (oldParentId && (!currentParentId || !oldParentId.equals(currentParentId))) {
      try {
        await (this.constructor as Model<ICategory>).updateOne(
          { _id: oldParentId },
          { $pull: { children: this._id } }
        );
      } catch (error) {
        console.error("Error removing category from old parent's children:", error);
        // Decide if this error should halt the save operation
        // return next(error as Error);
      }
    }

    // If newParentId exists and is different from the oldParentId
    if (currentParentId && (!oldParentId || !currentParentId.equals(oldParentId))) {
      try {
        await (this.constructor as Model<ICategory>).updateOne(
          { _id: currentParentId },
          { $addToSet: { children: this._id } } // Use $addToSet to prevent duplicates
        );
      } catch (error) {
        console.error("Error adding category to new parent's children:", error);
        // Decide if this error should halt the save operation
        // return next(error as Error);
      }
    }
  }

  next();
});

// When a category is deleted, remove it from its parent's children array
CategorySchema.pre('findOneAndDelete', async function (next) { // This seems correct for findOneAndDelete
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
export type { ICategory };
