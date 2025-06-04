import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import connectToDatabase from '../../../../lib/dbConnect';
import Category from '../../../../models/Category';
import Product from '../../../../models/Product';
import mongoose from 'mongoose';

// Removed local generateSlugFromName, model will handle it.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { categoryId } = req.query;
  // Ensure categoryId is a string before creating ObjectId
  if (typeof categoryId !== 'string' || !mongoose.Types.ObjectId.isValid(categoryId)) {
     return res.status(400).json({ message: 'Invalid category ID format.' });
  }
  const categoryObjectId = new mongoose.Types.ObjectId(categoryId);


  await connectToDatabase();

  switch (req.method) {
    case 'GET':
      try {
        const category = await Category.findById(categoryObjectId)
          .populate('parent', 'name slug isPublished') // Added isPublished to parent populate
          .populate('children', 'name slug isPublished') // Added isPublished to children populate
          .lean();
        if (!category) {
          return res.status(404).json({ message: 'Category not found' });
        }
        return res.status(200).json(category);
      } catch (error) {
        console.error('Error fetching category:', error);
        return res.status(500).json({ message: 'Error fetching category', error: (error as Error).message });
      }

    case 'PUT':
      try {
        const { name, slug, parent, isPublished } = req.body; // Added isPublished

        const currentCategory = await Category.findById(categoryObjectId);
        if (!currentCategory) {
          return res.status(404).json({ message: 'Category not found for update.' });
        }

        // Prepare an object for fields to update explicitly
        const updateFields: any = {};

        if (name !== undefined) {
            updateFields.name = name;
            // If name is changing, and slug is not explicitly provided,
            // the model's pre-save hook will handle slug regeneration.
        }

        // If slug is explicitly provided in the request body, pass it to updateFields.
        // The model's pre-save hook will handle formatting and ensuring uniqueness.
        if (slug !== undefined) {
            updateFields.slug = slug;
        }
        // Explicit slug uniqueness check removed, model's unique index and pre-save hook will handle it.

        if (isPublished !== undefined) {
          updateFields.isPublished = isPublished;
        }

        const oldParentIdString = currentCategory.parent ? currentCategory.parent.toString() : null;
        let newParentIdToSet: mongoose.Types.ObjectId | null = null; // Initialize as null for no parent case

        if (parent !== undefined) { // Only process parent if it's in the request body
            if (parent === null || parent === '') {
                newParentIdToSet = null;
            } else {
                if (!mongoose.Types.ObjectId.isValid(parent)) {
                    return res.status(400).json({ message: 'Invalid new parent category ID format.' });
                }
                if (parent === categoryObjectId.toString()) {
                    return res.status(400).json({ message: 'Category cannot be its own parent.' });
                }
                const newParentCategoryDoc = await Category.findById(parent);
                if (!newParentCategoryDoc) {
                    return res.status(404).json({ message: 'New parent category not found.' });
                }
                // Simplified cycle check: new parent cannot be a current child. Deep cycle check is harder.
                if (currentCategory.children.map(c => c.toString()).includes(parent)) {
                    return res.status(400).json({ message: 'Cyclical parenting: New parent cannot be a child of this category.' });
                }
                newParentIdToSet = newParentCategoryDoc._id;
            }
            updateFields.parent = newParentIdToSet;
        }

        // Apply updates using $set
        const updatedCategoryDoc = await Category.findByIdAndUpdate(
            categoryObjectId,
            { $set: updateFields },
            { new: true, runValidators: true } // runValidators to ensure schema rules are met
        );

        if (!updatedCategoryDoc) { // Should not happen if currentCategory was found
            return res.status(404).json({ message: 'Category update failed unexpectedly.' });
        }

        // Manage parent-child relationships if parent changed
        // This logic is now handled by the Category model's pre('save') hook.
        // const finalParentIdString = updatedCategoryDoc.parent ? updatedCategoryDoc.parent.toString() : null;
        // if (oldParentIdString !== finalParentIdString) {
        //     if (oldParentIdString) {
        //         await Category.updateOne({ _id: new mongoose.Types.ObjectId(oldParentIdString) }, { $pull: { children: categoryObjectId } });
        //     }
        //     if (finalParentIdString) {
        //         await Category.updateOne({ _id: new mongoose.Types.ObjectId(finalParentIdString) }, { $addToSet: { children: categoryObjectId } });
        //     }
        // }

        return res.status(200).json(updatedCategoryDoc);
      } catch (error) {
        if ((error as any).code === 11000) {
          const field = Object.keys((error as any).keyPattern)[0];
          return res.status(409).json({ message: `A category with this ${field} already exists.` });
        }
        if (error instanceof mongoose.Error.ValidationError) {
            return res.status(400).json({ message: 'Validation error', errors: error.errors });
        }
        console.error('Error updating category:', error);
        return res.status(500).json({ message: 'Error updating category', error: (error as Error).message });
      }

    case 'DELETE':
      try {
        const categoryToDelete = await Category.findById(categoryObjectId);
        if (!categoryToDelete) {
          return res.status(404).json({ message: 'Category not found for deletion' });
        }
        if (categoryToDelete.children && categoryToDelete.children.length > 0) {
          return res.status(400).json({ message: 'Cannot delete category with child categories. Re-assign or delete children first.' });
        }
        await Product.updateMany({ category: categoryObjectId }, { $unset: { category: "" } });
        if (categoryToDelete.parent) {
          await Category.updateOne({ _id: categoryToDelete.parent }, { $pull: { children: categoryObjectId } });
        }
        await Category.findByIdAndDelete(categoryObjectId);
        return res.status(200).json({ message: 'Category deleted successfully.' });
      } catch (error) {
        console.error('Error deleting category:', error);
        return res.status(500).json({ message: 'Error deleting category', error: (error as Error).message });
      }

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
